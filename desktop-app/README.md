# SystemQr - CTPH

## Aplicación de Escritorio

Sistema de control de asistencia mediante códigos QR.

### Requisitos para compilar

1. **Node.js** v18 o superior
2. **Python** 3.10 o superior
3. **MongoDB** (para desarrollo)

### Instalación para desarrollo

```bash
# Instalar dependencias de Electron
cd desktop-app
npm install

# Copiar el backend
cp -r ../backend ./backend

# Instalar dependencias del backend
cd backend
pip install -r requirements.txt
cd ..

# Copiar y compilar el frontend
cd ../frontend
npm run build
cp -r build ../desktop-app/react-build
```

### Ejecutar en modo desarrollo

```bash
# Terminal 1: MongoDB
mongod --dbpath ./data/mongodb

# Terminal 2: Backend
cd backend && python server.py

# Terminal 3: Frontend (para dev)
cd ../frontend && npm start

# Terminal 4: Electron
npm start
```

### Compilar instalador para Windows

```bash
# Compilar el frontend
npm run build:react

# Crear instalador
npm run dist:win
```

El instalador se generará en `dist/SystemQr CTPH Setup 1.0.0.exe`

### Estructura del instalador

```
SystemQr CTPH/
├── SystemQr CTPH.exe    # Ejecutable principal
├── resources/
│   ├── backend/         # Servidor Python compilado
│   ├── mongodb/         # MongoDB embebido
│   └── react-build/     # Frontend compilado
└── data/                # Datos de la aplicación
    └── mongodb/         # Base de datos
```

### Credenciales por defecto

- **Usuario:** admin
- **Contraseña:** admin123

### Soporte

Para soporte técnico, contactar al administrador de CTPH.
