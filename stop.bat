@echo off
REM Pem2 Services Inventory - Stop Script
REM Simple script to stop the application on Windows

echo =========================================
echo Pem2 Services Inventory - Stopping
echo =========================================
echo.

REM Check if docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    pause
    exit /b 1
)

echo Stopping all services...
docker-compose down

echo.
echo =========================================
echo ✓ Application Stopped!
echo =========================================
echo.
echo To start again: start.bat
echo.
pause
