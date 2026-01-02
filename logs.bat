@echo off
REM Pem2 Services Inventory - View Logs
REM Simple script to view application logs on Windows

echo =========================================
echo Pem2 Services Inventory - Logs
echo =========================================
echo.
echo Showing logs (press Ctrl+C to exit)...
echo.

docker-compose logs -f
