#!/bin/bash

echo "============================================"
echo "  SystemQr CTPH - Compilador de Instalador"
echo "============================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js no está instalado.${NC}"
    echo "Instálalo con: sudo apt install nodejs npm"
    exit 1
fi

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[ERROR] Python no está instalado.${NC}"
    echo "Instálalo con: sudo apt install python3 python3-pip"
    exit 1
fi

echo "[1/6] Instalando dependencias del frontend..."
cd ../frontend
npm install || { echo -e "${RED}[ERROR] Fallo instalación frontend${NC}"; exit 1; }

echo "[2/6] Compilando frontend para producción..."
npm run build || { echo -e "${RED}[ERROR] Fallo compilación frontend${NC}"; exit 1; }

echo "[3/6] Copiando frontend compilado..."
cd ../desktop-app
rm -rf react-build
cp -r ../frontend/build react-build

echo "[4/6] Instalando dependencias de Electron..."
npm install || { echo -e "${RED}[ERROR] Fallo instalación Electron${NC}"; exit 1; }

echo "[5/6] Preparando backend..."
cd backend
pip3 install pyinstaller
pip3 install -r requirements.txt
echo "Compilando backend a ejecutable..."
pyinstaller --onefile --name server server.py
cp dist/server ../backend/server
cd ..

echo "[6/6] Creando instalador..."
npm run dist || { echo -e "${RED}[ERROR] Fallo creación instalador${NC}"; exit 1; }

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  COMPILACIÓN COMPLETADA EXITOSAMENTE!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "El instalador se encuentra en:"
echo "  desktop-app/dist/"
echo ""
