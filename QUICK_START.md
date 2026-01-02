# Pem2 Services Inventory - Quick Start Guide

## 🪟 On Windows (Development)

### First Time Setup
1. Make sure Docker Desktop is running
2. Open Command Prompt in this folder
3. Run: `start.bat`
4. Access at: http://localhost:3001

### Daily Use
- **Start**: `start.bat`
- **Stop**: `stop.bat`
- **Check Status**: `status.bat`
- **View Logs**: `logs.bat`

### Making Changes
1. Edit your code files
2. Run: `deploy.bat`
3. App rebuilds and restarts automatically

### Backups
- **Create Backup**: `backup.bat`
- Backups saved to: `.\backups\daily\`

---

## 🐧 On Linux (Production Server)

### First Time Deployment
1. Upload files to server
2. Edit `.env.production` with your settings
3. Run: `./deploy.sh`
4. Access at: https://your-domain.com

### Updates
```bash
git pull origin main
./deploy.sh
```

### Backups
```bash
# Manual backup
./backup.sh

# Automated (add to crontab)
0 2 * * * /opt/pem2-inventory/backup.sh
```

---

## 📚 Full Documentation

- **WINDOWS_COMMANDS.md** - All Windows commands and troubleshooting
- **PRODUCTION_DEPLOYMENT.md** - Complete production deployment guide
- **PRODUCTION_READY_SUMMARY.md** - Overview of production features

---

## 🆘 Need Help?

### Application won't start?
```cmd
status.bat
logs.bat
```

### Made a mistake?
```cmd
backup.bat     # Create backup first
deploy.bat     # Rebuild and restart
```

### Everything broken?
```cmd
docker-compose down
docker-compose build
docker-compose up -d
```

---

## ✅ Access URLs

**Development (Windows)**:
- Frontend: http://localhost:3001
- Backend API: http://localhost:8001/docs

**Production (Linux)**:
- Frontend: https://inventory.pem2services.com
- Backend API: https://inventory.pem2services.com/api/docs

---

## 🎯 Next Steps

1. ✅ Use Windows scripts for local development
2. ⏳ When ready, deploy to DigitalOcean (see PRODUCTION_DEPLOYMENT.md)
3. ⏳ Set up SSL certificate
4. ⏳ Create employee accounts (Monday)

**You're ready to go!** 🚀
