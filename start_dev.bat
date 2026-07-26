@echo off
chcp 65001 >nul


pushd "%CD%"
CD /D "%~dp0"
title VLStudio Web Server (Development Mode)

echo =========================================
echo ViraLoop Studio Web Server Starter (Dev Mode)
echo =========================================

echo 1. Starting FastAPI Backend Server (Port 8000)...
start "VLStudio Backend" cmd /k "cd apps\api && call venv\Scripts\activate && set PYTHONPATH=%%cd%% && python -m app.main > backend_error.log 2>&1"

echo 2. Starting Vite Frontend Dev Server (Port 5183)...
start "VLStudio Frontend" cmd /k "cd apps\dashboard && npm run dev"

echo 3. Starting Ddalkkak Studio (Port 8100)...
start "Ddalkkak Studio" cmd /k "cd ..\Ddalkkak && call start.bat"

echo.
echo =========================================
echo Servers are starting in separate windows...
echo Please open your Chrome browser to:
echo http://localhost:5183
echo =========================================
echo.
pause
