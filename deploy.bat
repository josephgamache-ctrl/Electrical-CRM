@echo off
REM Pem2 Services Inventory - Windows Deployment Script
REM For local development/testing on Windows

echo =========================================
echo Pem2 Services Inventory - Deployment
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

echo Step 1: Creating backup...
echo ----------------------------
set BACKUP_DATE=%date:~-4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DATE=%BACKUP_DATE: =0%
set BACKUP_DIR=.\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Backup database
echo Backing up database...
docker exec ma_electrical-db pg_dump -U postgres ma_electrical > "%BACKUP_DIR%\backup_%BACKUP_DATE%.sql"
if exist "%BACKUP_DIR%\backup_%BACKUP_DATE%.sql" (
    echo ✓ Database backed up to: %BACKUP_DIR%\backup_%BACKUP_DATE%.sql
) else (
    echo ⚠ Database backup failed - continuing anyway
)

echo.
echo Step 2: Building containers...
echo ----------------------------
docker-compose build

echo.
echo Step 3: Stopping old containers...
echo ----------------------------
docker-compose down

echo.
echo Step 4: Starting new containers...
echo ----------------------------
docker-compose up -d

echo.
echo Step 5: Waiting for services to start...
echo ----------------------------
timeout /t 10 /nobreak >nul

REM Health check
echo Checking backend health...
set MAX_ATTEMPTS=30
set ATTEMPT=0

:HEALTHCHECK
set /a ATTEMPT+=1
curl -f http://localhost:8001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Backend is healthy!
    goto HEALTHCHECK_DONE
)
if %ATTEMPT% geq %MAX_ATTEMPTS% (
    echo ⚠ Backend health check failed - please check logs
    echo Run: docker-compose logs backend
    goto HEALTHCHECK_DONE
)
echo Waiting for backend... (%ATTEMPT%/%MAX_ATTEMPTS%)
timeout /t 2 /nobreak >nul
goto HEALTHCHECK

:HEALTHCHECK_DONE

echo.
echo Step 6: Cleaning up old images...
echo ----------------------------
docker image prune -f

echo.
echo =========================================
echo ✓ Deployment Complete!
echo =========================================
echo.
echo Services Status:
docker-compose ps
echo.
echo Access your application at:
echo   Frontend: http://localhost:3001
echo   Backend API: http://localhost:8001/docs
echo.
echo Backup location: %BACKUP_DIR%\backup_%BACKUP_DATE%.sql
echo.
echo To view logs: docker-compose logs -f
echo.
pause
