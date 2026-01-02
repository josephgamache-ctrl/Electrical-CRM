@echo off
REM Pem2 Services Inventory - Status Check
REM Check the status of all services

echo =========================================
echo Pem2 Services Inventory - Status
echo =========================================
echo.

REM Check if docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    pause
    exit /b 1
)

echo Container Status:
echo ----------------------------
docker-compose ps

echo.
echo Health Check:
echo ----------------------------
curl -s http://localhost:8001/health 2>nul
if errorlevel 1 (
    echo ✗ Backend not responding
) else (
    echo.
    echo.
)

echo.
echo Detailed Health:
echo ----------------------------
curl -s http://localhost:8001/api/health 2>nul
if errorlevel 1 (
    echo ✗ Backend not responding
) else (
    echo.
)

echo.
echo To view logs: logs.bat
echo.
pause
