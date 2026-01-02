@echo off
REM MA Electrical Inventory - Status Checker
REM Run this to see if everything is up and running

echo ================================================
echo MA ELECTRICAL INVENTORY - STATUS CHECK
echo ================================================
echo.

cd /d "%~dp0"

echo [1] Checking Docker services...
echo.
docker-compose ps
echo.

echo ================================================
echo [2] Checking if frontend build is complete...
echo.
docker-compose logs ma_electrical-frontend | findstr /C:"Compiled successfully" /C:"ERROR" /C:"webpack compiled" > nul
if %errorlevel% equ 0 (
    echo ✅ Frontend has compiled!
) else (
    echo ⏳ Frontend is still building...
    echo    Run this command to watch progress:
    echo    docker-compose logs -f ma_electrical-frontend
)
echo.

echo ================================================
echo [3] Testing backend API...
echo.
curl -s http://localhost:8001/ > nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend API is responding at http://localhost:8001
) else (
    echo ❌ Backend API is not responding
)
echo.

echo ================================================
echo [4] Testing frontend...
echo.
curl -s http://localhost:3001/ > nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Frontend is responding at http://localhost:3001
    echo.
    echo 🎉 SUCCESS! Your application is ready!
    echo.
    echo    Open in browser: http://localhost:3001
    echo    Login: <your-admin-username> / <your-password>
) else (
    echo ⏳ Frontend is not ready yet
    echo    It may still be building...
)
echo.

echo ================================================
echo Quick Links:
echo - Frontend App:  http://localhost:3001
echo - Backend API:   http://localhost:8001
echo - API Docs:      http://localhost:8001/docs
echo.
echo Need help? See LAUNCH.md for full instructions
echo ================================================
pause
