# Pem2 Services - Production Deployment Plan

**Status:** PLANNING PHASE - Do not execute until fully reviewed
**Last Updated:** January 2025

---

## Overview

This document outlines the complete plan to deploy Pem2 Services to production so it runs independently (not on your local Docker) and employees can safely install it on their phones with full barcode scanner functionality.

---

## Phase 1: Pre-Deployment Preparation

### 1.1 Git Repository Setup

**Why:** Version control ensures we can track changes, rollback if needed, and deploy reliably.

**Steps:**
1. Create `.gitignore` file to exclude sensitive files:
   - `.env` files (contain passwords)
   - `node_modules/`
   - `__pycache__/`
   - Build artifacts
   - Local database files

2. Initialize Git repository locally

3. Create private GitHub repository (keeps your code secure)

4. Push code to GitHub

**Files to NEVER commit:**
- `.env`
- `.env.production`
- Any file containing passwords, API keys, or secrets

---

### 1.2 Environment Variables Audit

**Required for Production:**

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `DB_PASSWORD` | Database password | Generate strong password |
| `SECRET_KEY` | JWT token signing | Generate with Python secrets |
| `DOMAIN_NAME` | Your domain | Purchase from registrar |
| `ACME_EMAIL` | SSL certificate email | Your business email |
| `DO_SPACES_KEY` | Photo storage access | DigitalOcean dashboard |
| `DO_SPACES_SECRET` | Photo storage secret | DigitalOcean dashboard |

**Optional (can add later):**
- `SMTP_*` - Email notifications
- `SENTRY_DSN` - Error monitoring

---

### 1.3 Domain Name

**Requirement:** You need a domain name for:
1. **HTTPS/SSL** - Required for camera/barcode scanner on phones
2. **Professional appearance** - Employees access via clean URL
3. **PWA installation** - "Add to Home Screen" works properly

**Recommended:** `app.pem2services.com` or similar

**Where to purchase:** Namecheap, Google Domains, GoDaddy, etc. (~$12-15/year for .com)

---

## Phase 2: Infrastructure Setup

### 2.1 Hosting Option: DigitalOcean Droplet

**Why DigitalOcean:**
- Simple, reliable
- Good documentation
- Already have deployment configs set up
- Spaces for photo storage
- Predictable pricing

**Recommended Droplet:**
- **Size:** 2GB RAM / 1 vCPU ($12/month) - can upgrade if needed
- **Region:** New York (NYC1 or NYC3) - closest to Massachusetts
- **Image:** Ubuntu 22.04 LTS

**Additional Services:**
- **DigitalOcean Spaces:** $5/month for photo storage (250GB included)
- **Automated backups:** $2.40/month (20% of droplet cost)

**Estimated Monthly Cost:** ~$20/month

---

### 2.2 What Gets Deployed

```
┌─────────────────────────────────────────────────────────────┐
│                    DigitalOcean Droplet                      │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Caddy     │  │  Frontend   │  │      Backend        │  │
│  │  (HTTPS +   │──│  (React     │──│    (FastAPI +       │  │
│  │   Reverse   │  │   App)      │  │    PostgreSQL)      │  │
│  │   Proxy)    │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                                    │               │
│         │                                    │               │
│    HTTPS:443                          DigitalOcean Spaces   │
│    (auto SSL)                         (Photo Storage)       │
└─────────────────────────────────────────────────────────────┘
```

**Caddy** handles:
- Automatic HTTPS/SSL certificates (free via Let's Encrypt)
- Routing requests to frontend or backend
- Compression

---

## Phase 3: Mobile App (PWA) Setup

### 3.1 Why PWA (Progressive Web App)

The app is already configured as a PWA, which means:
- Employees can "Add to Home Screen" on their phones
- App icon appears like a native app
- Works offline for basic functions
- No app store approval needed
- Updates automatically

### 3.2 Requirements for Scanner to Work

**HTTPS is REQUIRED** - Browsers block camera access on non-HTTPS sites.

Once deployed with proper HTTPS:
1. Employee visits `https://app.pem2services.com`
2. Logs in
3. Browser prompts "Add to Home Screen"
4. App appears on phone like native app
5. Scanner uses camera with full permission

### 3.3 Current Scanner Implementation

- Uses `@zxing/library` for barcode reading
- Has fallback for "Take Photo" mode (works even if live camera fails)
- Supports switching between front/back cameras
- Already optimized for mobile

### 3.4 PWA Manifest (Already Configured)

Current `manifest.json` is properly set up with:
- App name: "MA Electrical Inventory"
- Icons in all required sizes
- Standalone display mode
- Portrait orientation

**Note:** We should update the app name to "Pem2 Services" before final deployment.

---

## Phase 4: Deployment Steps

### 4.1 One-Time Server Setup

1. Create DigitalOcean Droplet
2. Point domain DNS to Droplet IP
3. SSH into server
4. Install Docker and Docker Compose
5. Clone repository from GitHub
6. Create `.env.production` with real values
7. Run `docker compose up -d --build`
8. Create initial admin user

### 4.2 Database Migration

**Current data on your local Docker will need to be migrated:**
1. Export from local PostgreSQL
2. Transfer to production server
3. Import into production PostgreSQL

This includes:
- Users (but passwords should be reset)
- Customers
- Inventory items
- Work orders
- Time entries
- etc.

---

## Phase 5: Post-Deployment Testing

### 5.1 Critical Tests Before Going Live

| Test | Description | Pass/Fail |
|------|-------------|-----------|
| Login | Admin can log in | |
| Login | Technician can log in | |
| Scanner | Barcode scanner works on mobile | |
| Camera | Can take job photos | |
| PWA Install | Can add to home screen | |
| Work Orders | Can create/view/edit | |
| Timesheet | Can enter time | |
| Schedule | Dispatch board works | |
| Inventory | Can adjust stock | |
| Offline | Basic viewing works offline | |

### 5.2 Mobile Device Tests

Test on:
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Tablet (if used)

### 5.3 User Acceptance Testing

Have 1-2 employees test the system on production before full rollout.

---

## Phase 6: Go Live Checklist

### Before Announcing to Team:

- [ ] All tests pass
- [ ] Admin accounts created
- [ ] Employee accounts created
- [ ] Initial data migrated
- [ ] Backup system verified
- [ ] Documentation ready for employees

### Employee Rollout:

1. Send email with:
   - URL to access system
   - Their username (they set password on first login)
   - Instructions for "Add to Home Screen"

2. Quick training session (15-30 min) covering:
   - How to log in
   - How to install on phone
   - Basic daily tasks (timesheet, viewing schedule)
   - How to use barcode scanner

---

## Security Considerations

### Already Implemented:
- JWT token authentication (1 hour expiration)
- Role-based access control
- Password hashing
- HTTPS (via Caddy)

### Recommended Additions:
- [ ] Regular database backups
- [ ] Rate limiting on login attempts
- [ ] Security headers configuration
- [ ] Monitoring/alerting setup

---

## Rollback Plan

If issues occur after deployment:

1. **Minor Issues:** Fix in code, push to GitHub, rebuild containers
2. **Major Issues:** Restore from database backup, redeploy previous version
3. **Critical Issues:** Point DNS back to local/temporary setup while fixing

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Phase 1: Preparation | 1-2 hours | Git setup, env review |
| Phase 2: Infrastructure | 1-2 hours | Server + domain setup |
| Phase 3: PWA updates | 30 min | Update app name/icons if needed |
| Phase 4: Deployment | 1-2 hours | Deploy + migrate data |
| Phase 5: Testing | 2-4 hours | Thorough testing |
| Phase 6: Go Live | 1 hour | Final checks + announce |

**Total:** 1-2 days of focused work (not rushing)

---

## Questions to Decide

Before proceeding, please confirm:

1. **Domain name:** Do you have one, or do we need to purchase?
   - Suggestion: `app.pem2services.com`

2. **Hosting budget:** Is ~$20/month acceptable?

3. **Photo storage:** Approximately how many photos per month expected?

4. **Email notifications:** Do you want email alerts for PTO requests, etc.?

5. **Data migration:**
   - Migrate existing data from local Docker?
   - Or start fresh on production?

6. **User passwords:**
   - Reset all passwords for production?
   - Or keep existing?

---

## Next Steps

Once you've reviewed this plan and answered the questions above, we will:

1. Set up Git repository
2. Acquire domain (if needed)
3. Create DigitalOcean resources
4. Execute deployment
5. Test thoroughly
6. Go live

**Important:** We will not make any changes to the running system until you approve each step.
