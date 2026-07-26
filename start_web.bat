@echo off
chcp 65001 >nul


pushd "%CD%"
CD /D "%~dp0"
title VLStudio Web Server

echo =========================================
echo ViraLoop Studio Web Server Starter
echo =========================================

echo 0. Cleaning up previous server processes...
powershell -Command "$ports = @(8000, 8100); foreach ($p in $ports) { $procs = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess; foreach ($pid_ in $procs) { if ($pid_ -and $pid_ -ne 0) { Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue } } }"

echo 1. Checking frontend build...
if not exist "apps\dashboard\dist\index.html" (
    echo Frontend build not found. Building now...
    call npm install
    call npm run build --workspace=apps/dashboard
) else (
    echo Frontend build found.
)

echo.
echo 2. Starting FastAPI Backend Server...
start "VLStudio Backend" cmd /k "cd apps\api && call venv\Scripts\activate && set PYTHONPATH=%%cd%% && python -m app.main > backend_error.log 2>&1"

echo.
echo 3. Starting Ddalkkak Studio...
start "Ddalkkak Studio" cmd /k "cd ..\Ddalkkak && call start.bat"

echo.
echo =========================================
echo Server is starting... 
echo Please wait a few seconds and open your Chrome browser to:
echo http://localhost:8000
echo =========================================
echo.
echo To stop the server, run stop_web.bat or close the backend window.
pause
