@echo off
REM Pem2 Services Inventory - Windows Backup Script
REM For local development/testing on Windows

echo =========================================
echo Pem2 Services Inventory - Backup
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

set BACKUP_DATE=%date:~-4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DATE=%BACKUP_DATE: =0%
set BACKUP_DIR=.\backups
set DAILY_DIR=%BACKUP_DIR%\daily

REM Create backup directories
if not exist "%DAILY_DIR%" mkdir "%DAILY_DIR%"

echo Step 1: Backing up database...
echo ----------------------------

REM Database backup
set DB_BACKUP=%DAILY_DIR%\db_backup_%BACKUP_DATE%.sql
docker exec ma_electrical-db pg_dump -U postgres ma_electrical > "%DB_BACKUP%"

if exist "%DB_BACKUP%" (
    for %%A in ("%DB_BACKUP%") do set BACKUP_SIZE=%%~zA
    echo ✓ Database backed up: %DB_BACKUP% (!BACKUP_SIZE! bytes)
) else (
    echo ✗ Database backup failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Checking photos volume...
echo ----------------------------

REM Check if photos volume exists
docker volume inspect photos_storage >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Photos volume exists
    echo ⚠ Note: Photos volume backup on Windows requires manual export
    echo   Use: docker run --rm -v photos_storage:/data -v %CD%\%DAILY_DIR%:/backup alpine tar czf /backup/photos_%BACKUP_DATE%.tar.gz -C /data .
) else (
    echo ⚠ Photos volume not found - using local storage
)

echo.
echo Step 3: Cleanup old backups (keep last 30)...
echo ----------------------------

REM Delete old backups (older than 30 days)
forfiles /P "%DAILY_DIR%" /S /M *.sql /D -30 /C "cmd /c del @path" 2>nul
if errorlevel 1 (
    echo No old backups to delete
) else (
    echo ✓ Cleaned up old backups
)

REM Count remaining backups
set COUNT=0
for %%A in ("%DAILY_DIR%\*.sql") do set /a COUNT+=1
echo Remaining daily backups: %COUNT%

echo.
echo =========================================
echo ✓ Backup Complete!
echo =========================================
echo.
echo Backup Summary:
echo   Database: %DB_BACKUP%
echo   Location: %CD%\%BACKUP_DIR%
echo.

REM Show total backup size
if exist "%BACKUP_DIR%" (
    echo Total backup directory size:
    dir /s "%BACKUP_DIR%" | find "bytes"
)

echo.
pause
