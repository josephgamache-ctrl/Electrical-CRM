# Deployment Checklist - MA Electrical Inventory

## ✅ Pre-Deployment Setup (COMPLETE)

- [x] Created production docker-compose.yml
- [x] Created nginx reverse proxy configuration
- [x] Created environment file templates
- [x] Created Windows deployment scripts
- [x] Created Linux deployment scripts
- [x] Created comprehensive documentation
- [x] Removed old NPP Deals droplet references
- [x] Added .gitignore for sensitive files
- [x] Configured cross-platform compatibility

## 📋 When You Purchase Your Droplet

### Step 1: Note Your Droplet Details
- [ ] Droplet IP Address: `___________________`
- [ ] SSH Access Confirmed: [ ] Yes
- [ ] OS: Ubuntu 22.04 LTS (recommended)
- [ ] Size: $12/month minimum (2GB RAM, 1 vCPU)

### Step 2: Generate Production Config (5 mins)
Run on your Windows machine:
```batch
setup-droplet-env.bat
```

You'll be asked for:
- [ ] Droplet IP address
- [ ] Secure database password (save this!)
- [ ] Domain name (optional)

This creates `.env.production` file automatically.

### Step 3: Update Backend CORS (2 mins)
Edit `backend/main.py` around line 27-32:
```python
allow_origins=[
    "http://localhost",
    "http://localhost:3001",
    "http://YOUR_DROPLET_IP",        # Add this
    "http://YOUR_DROPLET_IP:80",     # Add this
    # "https://your-domain.com",     # If you have a domain
]
```

### Step 4: Deploy to Droplet (10-15 mins)
Run on your Windows machine:
```batch
deploy-to-droplet.bat
```

This will automatically:
- [ ] Copy files to droplet
- [ ] Install Docker on droplet
- [ ] Install Docker Compose on droplet
- [ ] Build containers
- [ ] Start all services
- [ ] Initialize database with seed data

### Step 5: Configure Firewall (2 mins)
SSH into your droplet and run:
```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS (for future SSL)
ufw enable
```

### Step 6: Access Your Application
- [ ] Frontend: `http://YOUR_DROPLET_IP`
- [ ] Login with default credentials:
  - Username: `joseph`
  - Password: `password123`
- [ ] **IMMEDIATELY change the password!**

### Step 7: Verify Everything Works
- [ ] Can login
- [ ] Can see inventory items
- [ ] Can create work order
- [ ] Can add customer
- [ ] Can add materials to work order
- [ ] Can edit work order

## 🔐 Post-Deployment Security (Recommended)

### Immediate (Do First)
- [ ] Change default password for `joseph` user
- [ ] Change default password for `warehouse` user (if applicable)
- [ ] Verify `.env.production` has strong `DB_PASSWORD`
- [ ] Verify `.env.production` has unique `SECRET_KEY`

### Soon (Within 24 Hours)
- [ ] Set up SSL certificate (Let's Encrypt - free)
- [ ] Configure automatic backups
- [ ] Set up monitoring/logging

### Optional (Nice to Have)
- [ ] Point a domain name to droplet
- [ ] Set up email notifications
- [ ] Configure automated backups to separate location

## 📊 SSL/HTTPS Setup (Optional but Recommended)

If you want HTTPS (the padlock icon):

1. **Get a domain** (like `electrical.your-company.com`)
2. **Point domain to droplet** (update DNS A record)
3. **SSH into droplet** and run:
```bash
cd /root/MA_Electrical_Inventory
apt install certbot -y
certbot certonly --standalone -d your-domain.com
```
4. **Update nginx config** (instructions in DEPLOYMENT.md)
5. **Restart nginx:**
```bash
docker-compose -f docker-compose.prod.yml restart nginx
```

## 🔄 Updating Your Production App

After making local changes and testing:

```batch
deploy-to-droplet.bat
```

That's it! Your changes will be deployed.

## 💾 Database Backups

### Manual Backup
SSH into droplet:
```bash
docker exec ma_electrical-db pg_dump -U postgres ma_electrical_inventory > backup_$(date +%Y%m%d).sql
```

### Download Backup to Local
From Windows:
```batch
scp root@YOUR_DROPLET_IP:/root/MA_Electrical_Inventory/backup_*.sql ./backups/
```

### Automated Daily Backups
SSH into droplet and add to crontab:
```bash
crontab -e
```
Add this line:
```
0 2 * * * docker exec ma_electrical-db pg_dump -U postgres ma_electrical_inventory > /root/MA_Electrical_Inventory/backups/backup_$(date +\%Y\%m\%d).sql
```

## 📱 Testing on Mobile

Once deployed:
1. Open phone browser
2. Navigate to `http://YOUR_DROPLET_IP`
3. Add to home screen for app-like experience
4. Test all features on mobile

## 🆘 Troubleshooting

### Can't Connect to Droplet
- Check firewall: `ufw status`
- Check services: `docker-compose -f docker-compose.prod.yml ps`
- Check logs: `docker-compose -f docker-compose.prod.yml logs`

### Services Not Starting
```bash
cd /root/MA_Electrical_Inventory
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

### Database Issues
```bash
docker-compose -f docker-compose.prod.yml logs ma_electrical-db
```

### Frontend Not Updating
```bash
docker-compose -f docker-compose.prod.yml build ma_electrical-frontend --no-cache
docker-compose -f docker-compose.prod.yml up -d ma_electrical-frontend
```

## 📞 Need Help?

See detailed troubleshooting in [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🎯 Quick Reference

### Local Development
```batch
start-local.bat       # Start
stop-local.bat        # Stop
check-status.bat      # Status
```

### Production Deployment
```batch
setup-droplet-env.bat      # First time setup
deploy-to-droplet.bat      # Deploy/Update
```

### On Droplet
```bash
docker-compose -f docker-compose.prod.yml ps        # Status
docker-compose -f docker-compose.prod.yml logs -f   # Logs
docker-compose -f docker-compose.prod.yml restart   # Restart
```

---

**You're ready! Just waiting on that droplet IP address.** 🚀
