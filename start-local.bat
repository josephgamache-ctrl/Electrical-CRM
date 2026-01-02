@echo off
echo ================================================
echo   MA Electrical Inventory - Local Development
echo ================================================
echo.

REM Load local environment variables
if exist .env.local (
    echo Loading local environment variables...
    for /f "usebackq tokens=*" %%a in (".env.local") do set %%a
) else (
    echo Warning: .env.local not found, using defaults
)

echo Starting local development environment...
docker-compose up -d

echo.
echo ================================================
echo Services started!
echo Frontend: http://localhost:3001
echo Backend API: http://localhost:8001
echo ================================================
echo.
echo Use stop-local.bat to stop services
echo Use check-status.bat to check service status
pause
