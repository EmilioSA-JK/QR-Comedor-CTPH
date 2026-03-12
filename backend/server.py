"""
Sistema de Asistencia Escolar (SAE) - Backend API
"""

import os
import io
import base64
from datetime import datetime, timedelta, timezone

# Zona horaria de Costa Rica (UTC-6)
COSTA_RICA_TZ = timezone(timedelta(hours=-6))
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER

# Environment variables
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "sae_db")
JWT_SECRET = os.environ.get("JWT_SECRET", "sae_secret_key_2024_secure")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Database connection
db_client: AsyncIOMotorClient = None
db = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_client, db
    db_client = AsyncIOMotorClient(MONGO_URL)
    db = db_client[DB_NAME]
    # Create indexes
    await db.estudiantes.create_index("cedula", unique=True)
    await db.administradores.create_index("usuario", unique=True)
    await db.registros.create_index([("cedula", 1), ("fecha", -1)])
    # Create default admin if none exists
    admin_count = await db.administradores.count_documents({})
    if admin_count == 0:
        hashed_password = pwd_context.hash("admin123")
        await db.administradores.insert_one({
            "usuario": "admin",
            "password": hashed_password,
            "nombre": "Administrador",
            "creado": datetime.now(timezone.utc)
        })
    yield
    db_client.close()


app = FastAPI(
    title="CTPH - SystemQr",
    description="API para gestión de asistencia escolar mediante códigos QR",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== MODELS ====================

class AdminLogin(BaseModel):
    usuario: str
    password: str


class AdminRegister(BaseModel):
    usuario: str
    password: str
    nombre: str


class AdminResponse(BaseModel):
    usuario: str
    nombre: str


class EstudianteCreate(BaseModel):
    cedula: str = Field(..., min_length=1, description="Cédula del estudiante (Primary Key)")
    nombre: str = Field(..., min_length=1)
    apellido1: str = Field(..., min_length=1)
    apellido2: str = Field(..., min_length=1)
    especialidad: str = Field(..., pattern="^(Electromecánica|Redes)$")
    grado: str = Field(..., pattern="^(10|11|12)$")
    seccion: str = Field(..., min_length=1)


class EstudianteUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido1: Optional[str] = None
    apellido2: Optional[str] = None
    especialidad: Optional[str] = None
    grado: Optional[str] = None
    seccion: Optional[str] = None


class EstudianteResponse(BaseModel):
    cedula: str
    nombre: str
    apellido1: str
    apellido2: str
    especialidad: str
    grado: str
    seccion: str
    creado: Optional[str] = None


class RegistroCreate(BaseModel):
    cedula: str


class RegistroResponse(BaseModel):
    cedula: str
    nombre_completo: str
    especialidad: str
    grado: str
    seccion: str
    fecha: str
    hora: str


class ReporteRequest(BaseModel):
    fecha_inicio: str
    fecha_fin: str


# ==================== AUTH HELPERS ====================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        usuario: str = payload.get("sub")
        if usuario is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    
    admin = await db.administradores.find_one({"usuario": usuario}, {"_id": 0, "password": 0})
    if admin is None:
        raise HTTPException(status_code=401, detail="Administrador no encontrado")
    return admin


# ==================== AUTH ROUTES ====================

@app.post("/api/auth/login")
async def login(data: AdminLogin):
    admin = await db.administradores.find_one({"usuario": data.usuario})
    if not admin or not pwd_context.verify(data.password, admin["password"]):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    token = create_access_token({"sub": admin["usuario"]})
    return {
        "token": token,
        "usuario": admin["usuario"],
        "nombre": admin["nombre"]
    }


@app.post("/api/auth/register")
async def register(data: AdminRegister, current_admin: dict = Depends(get_current_admin)):
    existing = await db.administradores.find_one({"usuario": data.usuario})
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    hashed_password = pwd_context.hash(data.password)
    await db.administradores.insert_one({
        "usuario": data.usuario,
        "password": hashed_password,
        "nombre": data.nombre,
        "creado": datetime.now(timezone.utc)
    })
    return {"message": "Administrador registrado exitosamente"}


@app.get("/api/auth/me")
async def get_me(current_admin: dict = Depends(get_current_admin)):
    return current_admin


@app.get("/api/administradores")
async def listar_administradores(current_admin: dict = Depends(get_current_admin)):
    cursor = db.administradores.find({}, {"_id": 0, "password": 0})
    admins = await cursor.to_list(length=100)
    for admin in admins:
        if "creado" in admin and admin["creado"]:
            admin["creado"] = admin["creado"].isoformat() if isinstance(admin["creado"], datetime) else str(admin["creado"])
    return admins


@app.delete("/api/administradores/{usuario}")
async def eliminar_administrador(usuario: str, current_admin: dict = Depends(get_current_admin)):
    # No permitir eliminar el propio usuario
    if current_admin["usuario"] == usuario:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    
    # Verificar que haya al menos otro administrador
    count = await db.administradores.count_documents({})
    if count <= 1:
        raise HTTPException(status_code=400, detail="Debe existir al menos un administrador")
    
    result = await db.administradores.delete_one({"usuario": usuario})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    return {"message": "Administrador eliminado exitosamente"}


# ==================== ESTUDIANTES ROUTES ====================

@app.get("/api/estudiantes", response_model=List[EstudianteResponse])
async def listar_estudiantes(
    current_admin: dict = Depends(get_current_admin),
    especialidad: Optional[str] = None,
    grado: Optional[str] = None,
    buscar: Optional[str] = None
):
    query = {}
    if especialidad:
        query["especialidad"] = especialidad
    if grado:
        query["grado"] = grado
    if buscar:
        query["$or"] = [
            {"cedula": {"$regex": buscar, "$options": "i"}},
            {"nombre": {"$regex": buscar, "$options": "i"}},
            {"apellido1": {"$regex": buscar, "$options": "i"}},
            {"apellido2": {"$regex": buscar, "$options": "i"}}
        ]
    
    cursor = db.estudiantes.find(query, {"_id": 0}).sort("apellido1", 1)
    estudiantes = await cursor.to_list(length=1000)
    
    for est in estudiantes:
        if "creado" in est and est["creado"]:
            est["creado"] = est["creado"].isoformat() if isinstance(est["creado"], datetime) else str(est["creado"])
    
    return estudiantes


@app.get("/api/estudiantes/{cedula}", response_model=EstudianteResponse)
async def obtener_estudiante(cedula: str, current_admin: dict = Depends(get_current_admin)):
    estudiante = await db.estudiantes.find_one({"cedula": cedula}, {"_id": 0})
    if not estudiante:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    
    if "creado" in estudiante and estudiante["creado"]:
        estudiante["creado"] = estudiante["creado"].isoformat() if isinstance(estudiante["creado"], datetime) else str(estudiante["creado"])
    
    return estudiante


@app.post("/api/estudiantes")
async def crear_estudiante(data: EstudianteCreate, current_admin: dict = Depends(get_current_admin)):
    existing = await db.estudiantes.find_one({"cedula": data.cedula})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un estudiante con esta cédula")
    
    estudiante = data.model_dump()
    estudiante["creado"] = datetime.now(timezone.utc)
    await db.estudiantes.insert_one(estudiante)
    
    return {"message": "Estudiante creado exitosamente", "cedula": data.cedula}


@app.put("/api/estudiantes/{cedula}")
async def actualizar_estudiante(cedula: str, data: EstudianteUpdate, current_admin: dict = Depends(get_current_admin)):
    estudiante = await db.estudiantes.find_one({"cedula": cedula})
    if not estudiante:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.estudiantes.update_one({"cedula": cedula}, {"$set": update_data})
    
    return {"message": "Estudiante actualizado exitosamente"}


@app.delete("/api/estudiantes/{cedula}")
async def eliminar_estudiante(cedula: str, current_admin: dict = Depends(get_current_admin)):
    result = await db.estudiantes.delete_one({"cedula": cedula})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    
    return {"message": "Estudiante eliminado exitosamente"}


# ==================== QR ROUTES ====================

@app.get("/api/qr/{cedula}")
async def generar_qr(cedula: str, current_admin: dict = Depends(get_current_admin)):
    estudiante = await db.estudiantes.find_one({"cedula": cedula}, {"_id": 0})
    if not estudiante:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(cedula)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "qr_base64": img_base64,
        "estudiante": estudiante
    }


# ==================== REGISTROS ROUTES ====================

@app.post("/api/registros")
async def crear_registro(data: RegistroCreate):
    """Endpoint público para registrar asistencia via QR"""
    estudiante = await db.estudiantes.find_one({"cedula": data.cedula}, {"_id": 0})
    if not estudiante:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    
    now = datetime.now(COSTA_RICA_TZ)
    
    registro = {
        "cedula": data.cedula,
        "nombre_completo": f"{estudiante['nombre']} {estudiante['apellido1']} {estudiante['apellido2']}",
        "especialidad": estudiante["especialidad"],
        "grado": estudiante["grado"],
        "seccion": estudiante["seccion"],
        "fecha": now.strftime("%Y-%m-%d"),
        "hora": now.strftime("%H:%M:%S"),
        "timestamp": now
    }
    
    await db.registros.insert_one(registro)
    
    return {
        "message": "Registro creado exitosamente",
        "registro": {
            "cedula": registro["cedula"],
            "nombre_completo": registro["nombre_completo"],
            "especialidad": registro["especialidad"],
            "grado": registro["grado"],
            "seccion": registro["seccion"],
            "fecha": registro["fecha"],
            "hora": registro["hora"]
        }
    }


@app.get("/api/registros", response_model=List[RegistroResponse])
async def listar_registros(
    current_admin: dict = Depends(get_current_admin),
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    cedula: Optional[str] = None,
    limit: int = Query(default=100, le=1000)
):
    query = {}
    
    if fecha_inicio and fecha_fin:
        query["fecha"] = {"$gte": fecha_inicio, "$lte": fecha_fin}
    elif fecha_inicio:
        query["fecha"] = {"$gte": fecha_inicio}
    elif fecha_fin:
        query["fecha"] = {"$lte": fecha_fin}
    
    if cedula:
        query["cedula"] = cedula
    
    cursor = db.registros.find(query, {"_id": 0, "timestamp": 0}).sort("timestamp", -1).limit(limit)
    registros = await cursor.to_list(length=limit)
    
    return registros


@app.get("/api/registros/hoy")
async def registros_hoy(current_admin: dict = Depends(get_current_admin)):
    hoy = datetime.now(COSTA_RICA_TZ).strftime("%Y-%m-%d")
    cursor = db.registros.find({"fecha": hoy}, {"_id": 0, "timestamp": 0}).sort("timestamp", -1)
    registros = await cursor.to_list(length=500)
    
    total = len(registros)
    
    return {
        "fecha": hoy,
        "total": total,
        "registros": registros
    }


# ==================== REPORTES PDF ====================

@app.post("/api/reportes/pdf")
async def generar_reporte_pdf(data: ReporteRequest, current_admin: dict = Depends(get_current_admin)):
    query = {"fecha": {"$gte": data.fecha_inicio, "$lte": data.fecha_fin}}
    cursor = db.registros.find(query, {"_id": 0, "timestamp": 0}).sort([("fecha", 1), ("hora", 1)])
    registros = await cursor.to_list(length=5000)
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#0F172A'),
        alignment=TA_CENTER,
        spaceAfter=20
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#64748B'),
        alignment=TA_CENTER,
        spaceAfter=30
    )
    
    elements = []
    
    elements.append(Paragraph("SystemQr - CTPH", title_style))
    elements.append(Paragraph(f"Reporte de Asistencia: {data.fecha_inicio} al {data.fecha_fin}", subtitle_style))
    elements.append(Spacer(1, 10))
    
    if registros:
        table_data = [["Cédula", "Nombre", "Especialidad", "Grado", "Sección", "Fecha", "Hora"]]
        for reg in registros:
            table_data.append([
                reg["cedula"],
                reg["nombre_completo"][:25],
                reg["especialidad"][:12],
                reg["grado"],
                reg["seccion"],
                reg["fecha"],
                reg["hora"]
            ])
        
        table = Table(table_data, colWidths=[1.0*inch, 1.8*inch, 1.0*inch, 0.5*inch, 0.6*inch, 0.9*inch, 0.7*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No se encontraron registros en el rango de fechas especificado.", styles['Normal']))
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(f"Total de registros: {len(registros)}", styles['Normal']))
    elements.append(Paragraph(f"Generado el: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"reporte_asistencia_{data.fecha_inicio}_{data.fecha_fin}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== STATS ====================

@app.get("/api/stats")
async def obtener_estadisticas(current_admin: dict = Depends(get_current_admin)):
    total_estudiantes = await db.estudiantes.count_documents({})
    
    hoy = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    registros_hoy = await db.registros.count_documents({"fecha": hoy})
    
    pipeline_especialidad = [
        {"$group": {"_id": "$especialidad", "count": {"$sum": 1}}}
    ]
    por_especialidad = await db.estudiantes.aggregate(pipeline_especialidad).to_list(length=10)
    
    pipeline_grado = [
        {"$group": {"_id": "$grado", "count": {"$sum": 1}}}
    ]
    por_grado = await db.estudiantes.aggregate(pipeline_grado).to_list(length=10)
    
    return {
        "total_estudiantes": total_estudiantes,
        "registros_hoy": registros_hoy,
        "por_especialidad": {item["_id"]: item["count"] for item in por_especialidad if item["_id"]},
        "por_grado": {item["_id"]: item["count"] for item in por_grado if item["_id"]}
    }


# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "CTPH SystemQr API", "timestamp": datetime.now(timezone.utc).isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
