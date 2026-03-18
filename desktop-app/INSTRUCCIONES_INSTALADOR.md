# 🖥️ INSTRUCCIONES PARA CREAR EL INSTALADOR DE ESCRITORIO
# SystemQr - CTPH

## ✅ Requisitos previos (instalar en tu PC Windows)

1. **Node.js v18+**
   - Descargar de: https://nodejs.org/
   - Elegir versión LTS
   
2. **Python 3.10+**
   - Descargar de: https://python.org/
   - ⚠️ Marcar "Add Python to PATH" durante instalación
   
3. **MongoDB Community Server**
   - Descargar de: https://www.mongodb.com/try/download/community
   - Instalar como servicio de Windows

---

## 📦 Pasos para crear el instalador

### Paso 1: Descargar el código
- En Emergent, haz clic en "Download Code"
- Extrae el ZIP en una carpeta (ej: C:\SystemQr)

### Paso 2: Abrir terminal en la carpeta
```cmd
cd C:\SystemQr\desktop-app
```

### Paso 3: Ejecutar el compilador
```cmd
build-installer.bat
```

Este script automáticamente:
- ✅ Instala dependencias del frontend
- ✅ Compila el frontend React
- ✅ Instala dependencias de Electron
- ✅ Compila el backend Python a .exe
- ✅ Crea el instalador de Windows

### Paso 4: Encontrar el instalador
El instalador estará en:
```
C:\SystemQr\desktop-app\dist\SystemQr CTPH Setup 1.0.0.exe
```

---

## 🚀 Instalación del programa

1. Ejecuta `SystemQr CTPH Setup 1.0.0.exe`
2. Sigue el asistente de instalación
3. Se creará un acceso directo en el escritorio
4. ¡Doble clic y listo!

---

## 🔐 Credenciales por defecto

- **Usuario:** admin
- **Contraseña:** admin123

---

## ❓ Solución de problemas

### "MongoDB no está corriendo"
- Abrir Servicios de Windows (services.msc)
- Buscar "MongoDB" y asegurarse que esté "Iniciado"

### "El backend no inicia"
- Verificar que Python esté instalado correctamente
- Abrir CMD y ejecutar: `python --version`

### "Error al compilar"
- Asegurarse de tener conexión a internet
- Ejecutar como Administrador

---

## 📁 Estructura del programa instalado

```
C:\Program Files\SystemQr CTPH\
├── SystemQr CTPH.exe      ← Ejecutable principal (doble clic aquí)
├── resources\
│   ├── backend\           ← Servidor de la aplicación
│   ├── mongodb\           ← Base de datos embebida
│   └── react-build\       ← Interfaz de usuario
└── data\
    └── mongodb\           ← Datos guardados
```

---

¡Listo! Si tienes dudas, contacta al soporte técnico de CTPH.
