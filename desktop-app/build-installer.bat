@echo off
title SystemQr CTPH - Compilador de Instalador
color 0A

echo ============================================
echo   SystemQr CTPH - Compilador de Instalador
echo ============================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descargalo de: https://nodejs.org/
    pause
    exit /b 1
)

REM Verificar Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python no esta instalado.
    echo Descargalo de: https://python.org/
    pause
    exit /b 1
)

echo [1/6] Instalando dependencias del frontend...
cd ..\frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al instalar dependencias del frontend
    pause
    exit /b 1
)

echo [2/6] Compilando frontend para produccion...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al compilar el frontend
    pause
    exit /b 1
)

echo [3/6] Copiando frontend compilado...
cd ..\desktop-app
if exist react-build rmdir /s /q react-build
xcopy /E /I /Y ..\frontend\build react-build

echo [4/6] Instalando dependencias de Electron...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al instalar dependencias de Electron
    pause
    exit /b 1
)

echo [5/6] Preparando backend...
cd backend
pip install pyinstaller
pip install -r requirements.txt
echo Compilando backend a ejecutable...
pyinstaller --onefile --name server server.py
copy dist\server.exe ..\backend\server.exe
cd ..

echo [6/6] Creando instalador de Windows...
call npm run dist:win
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al crear el instalador
    pause
    exit /b 1
)

echo.
echo ============================================
echo   COMPILACION COMPLETADA EXITOSAMENTE!
echo ============================================
echo.
echo El instalador se encuentra en:
echo   desktop-app\dist\SystemQr CTPH Setup 1.0.0.exe
echo.
pause
