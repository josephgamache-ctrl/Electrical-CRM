@echo off
echo ================================================
echo   Setup Droplet Environment Variables
echo ================================================
echo.
echo This will help you configure your .env.production file
echo for deployment to Digital Ocean.
echo.

set /p DROPLET_IP="Enter your Droplet IP address: "
set /p DB_PASSWORD="Enter a secure database password: "
set /p DOMAIN="Enter your domain (or press Enter to use IP): "

if "%DOMAIN%"=="" (
    set API_URL=http://%DROPLET_IP%/api
) else (
    set API_URL=https://%DOMAIN%/api
)

echo.
echo Generating secure JWT secret key...
REM Generate a simple random string for secret key
set SECRET_KEY=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%

echo.
echo ================================================
echo Configuration Summary
echo ================================================
echo Droplet IP: %DROPLET_IP%
echo Database Password: %DB_PASSWORD%
echo API URL: %API_URL%
echo Secret Key: (generated)
echo.

echo Creating .env.production file...
(
echo # Production Environment Configuration
echo # Generated on %date% %time%
echo.
echo # Database Configuration
echo DB_PASSWORD=%DB_PASSWORD%
echo.
echo # Backend Security
echo SECRET_KEY=%SECRET_KEY%
echo.
echo # API Configuration
echo API_URL=%API_URL%
echo.
echo # Production Ports
echo FRONTEND_PORT=80
echo BACKEND_PORT=8001
) > .env.production

echo.
echo ================================================
echo .env.production file created successfully!
echo ================================================
echo.
echo IMPORTANT: Keep this file secure and never commit it to git!
echo.
echo You can now deploy using:
echo   deploy-to-droplet.bat
echo.
pause
