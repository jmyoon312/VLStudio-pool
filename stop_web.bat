@echo off
chcp 65001 >nul
title Stop VLStudio Web Server

echo =========================================
echo Stopping ViraLoop Studio Backend...
echo =========================================

taskkill /FI "WINDOWTITLE eq VLStudio Backend*" /T /F
taskkill /FI "WINDOWTITLE eq Ddalkkak Studio*" /T /F
taskkill /IM uvicorn.exe /F 2>nul
taskkill /IM api_server.exe /F 2>nul

echo Killing process on port 8000, 8100...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8100') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5183') do taskkill /F /PID %%a 2>nul

echo Done.
pause
