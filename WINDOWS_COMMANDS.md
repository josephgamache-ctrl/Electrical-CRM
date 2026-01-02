# Pem2 Services Inventory - Windows Commands

## 🪟 Windows vs Linux Scripts

Since you're developing on **Windows** but will deploy to **Linux** (DigitalOcean Droplet), we have two sets of scripts:

### Windows (.bat files) - For local development
- Use these on your Windows machine
- Double-click to run, or run from Command Prompt

### Linux (.sh files) - For production server
- Use these on the DigitalOcean droplet
- Run from SSH terminal with `./scriptname.sh`

---

## 🚀 Windows Commands (Local Development)

### Start the Application
```cmd
start.bat
```
**What it does:**
- Starts all Docker containers
- Shows status
- Displays access URLs

**Access after starting:**
- Frontend: http://localhost:3001
- Backend API: http://localhost:8001/docs

---

### Stop the Application
```cmd
stop.bat
```
**What it does:**
- Stops all Docker containers
- Cleans up gracefully

---

### Deploy/Update
```cmd
deploy.bat
```
**What it does:**
1. Creates automatic backup
2. Builds new containers
3. Stops old containers
4. Starts new containers
5. Runs health checks
6. Cleans up old images

**Use this when:**
- You've made code changes
- You've updated dependencies
- You want to rebuild everything

---

### Backup Database
```cmd
backup.bat
```
**What it does:**
1. Backs up PostgreSQL database
2. Stores in `.\backups\daily\`
3. Keeps last 30 backups
4. Shows backup size and location

**Backups saved to:**
```
.\backups\daily\db_backup_YYYYMMDD_HHMMSS.sql
```

---

### Check Status
```cmd
status.bat
```
**What it does:**
- Shows container status
- Tests health endpoints
- Displays if services are running

---

### View Logs
```cmd
logs.bat
```
**What it does:**
- Shows real-time logs from all containers
- Press Ctrl+C to exit

**To view specific service logs:**
```cmd
docker-compose logs -f ma_electrical-backend
docker-compose logs -f ma_electrical-frontend
docker-compose logs -f ma_electrical-db
```

---

## 📋 Quick Reference Card

### Daily Use
```cmd
start.bat          # Start the application
stop.bat           # Stop the application
status.bat         # Check if it's running
logs.bat           # View what's happening
```

### When Making Changes
```cmd
deploy.bat         # Rebuild and restart with changes
backup.bat         # Create manual backup
```

### Manual Docker Commands
```cmd
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart a specific service
docker-compose restart ma_electrical-backend

# Rebuild a specific service
docker-compose build ma_electrical-frontend
docker-compose up -d ma_electrical-frontend
```

---

## 🐧 Linux Commands (Production Server)

When you deploy to DigitalOcean, use these commands via SSH:

### Deploy/Update
```bash
./deploy.sh
```

### Backup
```bash
./backup.sh
```

### Restore from Backup
```bash
./rollback.sh BACKUP_DATE
```

### Check Status
```bash
docker-compose -f docker-compose.production.yml ps
```

### View Logs
```bash
docker-compose -f docker-compose.production.yml logs -f
```

---

## 🔧 Troubleshooting

### "Docker is not running" Error

**Solution:**
1. Open Docker Desktop
2. Wait for it to fully start (whale icon in system tray)
3. Run your command again

### "Port already in use" Error

**Solution:**
```cmd
# Stop any conflicting services
docker-compose down

# Or find and kill the process using the port
netstat -ano | findstr :3001
taskkill /PID <process_id> /F
```

### "Can't connect to database" Error

**Solution:**
```cmd
# Restart all services
docker-compose down
docker-compose up -d

# Check if database is running
docker-compose ps
docker-compose logs ma_electrical-db
```

### Scripts Won't Run

**Solution:**
```cmd
# Make sure you're in the project directory
cd C:\Users\josep\projects\MA_Electrical_Inventory

# Run the script
start.bat
```

### Need to Reset Everything

**Solution:**
```cmd
# Stop and remove everything (WARNING: Deletes data!)
docker-compose down -v

# Rebuild from scratch
docker-compose build
docker-compose up -d
```

---

## 📝 Common Tasks

### Task: Update the Frontend
```cmd
# Make your changes to files in frontend/src/
# Then rebuild:
docker-compose build ma_electrical-frontend
docker-compose up -d ma_electrical-frontend
```

### Task: Update the Backend
```cmd
# Make your changes to files in backend/
# Then rebuild:
docker-compose build ma_electrical-backend
docker-compose up -d ma_electrical-backend
```

### Task: View Database
```cmd
# Connect to database
docker exec -it ma_electrical-db psql -U postgres -d ma_electrical

# Inside psql:
\dt                 # List tables
\d inventory        # Describe inventory table
SELECT * FROM inventory LIMIT 10;  # View data
\q                  # Quit
```

### Task: Create a Backup Before Major Changes
```cmd
backup.bat
```

Backup will be saved to: `.\backups\daily\db_backup_<timestamp>.sql`

### Task: Check if Backend is Healthy
```cmd
curl http://localhost:8001/health
curl http://localhost:8001/api/health
```

---

## 💡 Tips

1. **Before Making Changes**: Run `backup.bat`
2. **After Making Changes**: Run `deploy.bat`
3. **If Something Breaks**: Check logs with `logs.bat`
4. **Keep Docker Desktop Running**: The application needs Docker to run

---

## 🆘 Emergency Recovery

If everything is broken and you need to start fresh:

```cmd
# 1. Create a backup first (if possible)
backup.bat

# 2. Stop everything
docker-compose down -v

# 3. Rebuild everything
docker-compose build

# 4. Start fresh
docker-compose up -d

# 5. Check status
status.bat
```

---

## 📞 File Locations

**Logs**: View with `logs.bat`
**Backups**: `.\backups\daily\`
**Database**: Inside Docker volume `pgdata_electrical`
**Photos**: Inside Docker volume `photos_storage` (or `backend/uploads` locally)
**Code**:
- Frontend: `.\frontend\src\`
- Backend: `.\backend\`

---

## ✅ Quick Health Check

Run this to verify everything is working:

```cmd
status.bat
```

Should show:
- ✓ All containers running
- ✓ Backend responding at /health
- ✓ Database connected

---

## 🔄 Update Workflow

When you need to make changes and deploy:

```cmd
REM 1. Make sure current version works
status.bat

REM 2. Create backup
backup.bat

REM 3. Make your code changes
REM (edit files in VS Code or your editor)

REM 4. Deploy changes
deploy.bat

REM 5. Verify it worked
status.bat
```

---

**Remember**: Use `.bat` files on Windows, `.sh` files on Linux (production server)!
