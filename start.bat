@echo off
REM Pem2 Services Inventory - Quick Start Script
REM Simple script to start the application on Windows

echo =========================================
echo Pem2 Services Inventory - Starting
echo =========================================
echo.

REM Check if docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo Starting all services...
docker-compose up -d

echo.
echo Waiting for services to be ready...
timeout /t 5 /nobreak >nul

echo.
echo Services Status:
docker-compose ps

echo.
echo =========================================
echo ✓ Application Started!
echo =========================================
echo.
echo Access your application:
echo   Frontend: http://localhost:3001
echo   Backend API: http://localhost:8001/docs
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
echo.
pause
