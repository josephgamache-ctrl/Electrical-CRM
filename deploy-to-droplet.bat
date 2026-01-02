@echo off
setlocal enabledelayedexpansion

echo ================================================
echo   Deploy to Digital Ocean Droplet
echo ================================================
echo.

REM Check if SSH connection details are configured
if "%DROPLET_IP%"=="" (
    set /p DROPLET_IP="Enter your Droplet IP address: "
)

if "%DROPLET_USER%"=="" (
    set DROPLET_USER=root
)

echo.
echo Deploying to: %DROPLET_USER%@%DROPLET_IP%
echo.
echo This will:
echo   1. Copy project files to droplet
echo   2. Pull latest changes from git (if using git)
echo   3. Rebuild and restart containers
echo.
set /p CONFIRM="Continue? (y/n): "

if /i not "%CONFIRM%"=="y" (
    echo Deployment cancelled.
    pause
    exit /b
)

echo.
echo ================================================
echo Step 1: Syncing files to droplet...
echo ================================================
scp -r . %DROPLET_USER%@%DROPLET_IP%:/root/MA_Electrical_Inventory

echo.
echo ================================================
echo Step 2: Deploying on droplet...
echo ================================================
ssh %DROPLET_USER%@%DROPLET_IP% "cd /root/MA_Electrical_Inventory && chmod +x deploy-remote.sh && ./deploy-remote.sh"

echo.
echo ================================================
echo Deployment Complete!
echo ================================================
echo.
echo Your application should now be running at:
echo http://%DROPLET_IP%
echo.
pause
