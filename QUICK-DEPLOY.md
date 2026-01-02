# Quick Deploy Guide

## Local Development (Windows)

### Start
```batch
start-local.bat
```
Access: http://localhost:3001

### Stop
```batch
stop-local.bat
```

---

## Deploy to Digital Ocean

### First Time Setup

1. **Create Ubuntu 22.04 Droplet on Digital Ocean**

2. **Run from Windows:**
   ```batch
   deploy-to-droplet.bat
   ```

3. **On Droplet - Edit production config:**
   ```bash
   nano .env.production
   ```
   Set:
   - `DB_PASSWORD=your_secure_password`
   - `API_URL=http://YOUR_DROPLET_IP/api`

4. **Restart:**
   ```bash
   docker-compose -f docker-compose.prod.yml restart
   ```

5. **Access:** http://YOUR_DROPLET_IP

### Update Production

**From Windows:**
```batch
deploy-to-droplet.bat
```

**Or on Droplet:**
```bash
cd /root/MA_Electrical_Inventory
./deploy-remote.sh
```

---

## Common Tasks

### View Logs
```bash
# Production
docker-compose -f docker-compose.prod.yml logs -f

# Local
docker-compose logs -f
```

### Restart Services
```bash
# Production
docker-compose -f docker-compose.prod.yml restart

# Local
docker-compose restart
```

### Backup Database
```bash
# On droplet
docker exec ma_electrical-db pg_dump -U postgres ma_electrical_inventory > backup.sql
```

---

## Default Login
- Username: `joseph`
- Password: `password123`

**Change password immediately after first login!**
