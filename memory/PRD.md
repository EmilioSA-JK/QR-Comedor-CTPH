# Sistema de Asistencia Escolar (SAE) - PRD

## Descripción General
Sistema local para PC que gestiona la asistencia de estudiantes mediante códigos QR. Cada estudiante tiene un código QR único basado en su cédula que al escanearse registra automáticamente su asistencia.

## Fecha de Creación
2026-03-01

## Arquitectura

### Stack Tecnológico
- **Frontend**: React 18 con Sonner (notificaciones), html5-qrcode (escáner), qrcode.react (generación QR), jsPDF (reportes)
- **Backend**: FastAPI + Motor (MongoDB async)
- **Base de Datos**: MongoDB
- **Autenticación**: JWT

### Estructura de Archivos
```
/app/
├── backend/
│   ├── server.py          # API FastAPI completa
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.js         # Aplicación principal
│   │   ├── App.css        # Estilos
│   │   └── index.js
│   └── package.json
```

## Usuarios y Perfiles

### Administradores
- Acceso completo al sistema
- Pueden registrar nuevos administradores
- Credenciales iniciales: admin / admin123

### Estudiantes (Datos)
- **Cédula** (PK): Identificador único
- **Nombre, Apellido1, Apellido2**
- **Especialidad**: Electromecánica | Redes
- **Grado**: 10° | 11° | 12°
- **Sección**: A, B, C, etc.

## Funcionalidades Implementadas ✅

### 1. Autenticación
- Login con usuario/contraseña
- Registro de nuevos administradores (solo admins autenticados)
- Sesiones con JWT (24 horas)

### 2. Gestión de Estudiantes (CRUD)
- Crear estudiantes con todos sus datos
- Listar con filtros (especialidad, grado, búsqueda)
- Editar información
- Eliminar estudiantes

### 3. Códigos QR
- Generación de QR por estudiante (basado en cédula)
- Descarga de QR en PNG
- Visualización con datos del estudiante

### 4. Escáner de Asistencia
- Escaneo con cámara web
- Registro automático (cédula, fecha, hora)
- Historial de escaneos recientes
- Feedback visual de éxito/error

### 5. Historial de Registros
- Consulta por rango de fechas
- Filtro por cédula
- Vista de registros del día

### 6. Reportes PDF
- Generación por rango de fechas
- Selección rápida (hoy, semana, mes)
- Descarga automática

### 7. Dashboard
- Total de estudiantes
- Registros del día
- Estadísticas por especialidad
- Estadísticas por grado

## APIs del Backend

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| /api/health | GET | Estado del servicio |
| /api/auth/login | POST | Autenticación |
| /api/auth/register | POST | Nuevo admin |
| /api/auth/me | GET | Info admin actual |
| /api/estudiantes | GET/POST | Listar/Crear |
| /api/estudiantes/{cedula} | GET/PUT/DELETE | CRUD individual |
| /api/qr/{cedula} | GET | Generar QR |
| /api/registros | GET/POST | Asistencia |
| /api/registros/hoy | GET | Registros de hoy |
| /api/reportes/pdf | POST | Generar PDF |
| /api/stats | GET | Estadísticas |

## Tests Realizados
- Backend: 93.8% success rate
- CRUD estudiantes: ✅
- Autenticación: ✅
- QR generation: ✅
- Registro asistencia: ✅
- PDF generation: ✅

## Backlog / Mejoras Futuras

### P0 (Crítico)
- Ninguno pendiente

### P1 (Importante)
- Exportar lista de estudiantes a Excel
- Backup automático de base de datos

### P2 (Mejoras)
- Tema oscuro opcional
- Notificaciones por email de reportes
- Gráficas en dashboard
- Modo offline para escaneo
