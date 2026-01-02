# Software Audit Report — MA Electrical Inventory (Production Repo)
**Date:** 2025-12-16  
**Scope:** `C:\Users\josep\projects\MA_Electrical_Inventory` (backend, frontend, database, Docker/NGINX, scripts, docs).  
**Your target model:** one customer per DigitalOcean droplet, customer-owned domain, “mostly hands-off”.

---

## 1) Executive Summary (What blocks “ready to sell”)
Functionally this looks like the same system as the TEST repo (FastAPI + React + Postgres + Docker) with many advanced modules already present in `backend/main.py`. The main blockers to selling and replicating deployments are operational and security hygiene issues, plus reproducible install gaps:

### P0 (must fix before hosting for customers)
1. **Secrets and private keys exist in the repo**
   - `.env`, `.env.local`, `.env.production`, `backend/.env` are present.
   - TLS private key exists at `nginx/certs/server.key`.
   - Repo also contains a `backups/` folder with database dumps/backups (extremely sensitive).
2. **Default credentials are documented and seeded**
   - `database/schema.sql` seeds `joseph` and `warehouse`.
   - `README.md` advertises default login/password (`Winter2025$`).
3. **Fresh install is not deterministic**
   - Backend bootstraps schema from `database/schema.sql` only (`backend/main.py`), while many endpoints expect “v3/migration-level” tables/views. Your migrations exist, but they are not guaranteed to be applied automatically on a fresh droplet.

### P1 (required to be hands-off at scale)
4. **EOL base stack**
   - `python:3.8-slim` in `backend/Dockerfile` and `postgres:13` in compose are end-of-life; customers will eventually get security pressure to upgrade.
5. **No test suite / CI**
   - No backend pytest suite, no frontend tests, no linters/formatters configured.
6. **Configuration sprawl**
   - Multiple compose files and NGINX TLS patterns (some use `nginx/certs`, some `nginx/ssl`) increase the risk of “works on this droplet but not the next”.

---

## 2) Repository Observations (facts found)
- **Not a Git working tree:** no `.git` directory found at repo root (this may be a working copy, but it matters for “build from git”).
- **Large/unsafe artifacts present locally:** `backups/` directory with full backups; `frontend/node_modules/` exists in this working directory.
- **Backend is monolithic:** `backend/main.py` is ~7,251 lines; most logic is in one file.
- **DB migrations exist but are not enforced:** `database/` contains multiple schemas and migrations, including `migration_work_order_photos_compat.sql`.
- **TLS key is present:** `nginx/certs/server.key` + `server.crt` exist (should never be in a sellable codebase).

---

## 3) Security Findings (Prioritized)

### P0 — Immediate remediation
1. **Remove secrets/keys/backups from the distributed repo**
   - Delete `.env*` from the repo; keep only `.env.example` / `.env.production.template`.
   - Delete `nginx/certs/server.key` and any cert material; generate per environment (or use Let’s Encrypt via a reverse proxy).
   - Remove `backups/` from the repo entirely (and ensure it is not ever shipped to customers).
   - Rotate any values that have ever lived in these files (assume compromise).
2. **Eliminate default credentials**
   - Remove default logins from docs.
   - Stop seeding default users in `schema.sql` / `schema_v3_final.sql`.
   - Provide a first-run bootstrap flow to create the initial admin (one-time token or `create_admin.py` script + forced password change).
3. **Harden configuration exposure in docs**
   - Several docs reference example secrets/passwords; ensure they are placeholders only.

### P1 — Production hardening to be “mostly hands-off”
4. **CORS needs production tightening**
   - Current backend CORS allows a broad private-network regex + hard-coded IPs. For customer deployments, restrict to the customer domain only.
5. **Error messages leak internals**
   - Many endpoints use `HTTPException(... detail=str(e))`. Replace with generic messages; log details server-side.
6. **Uploads need validation**
   - Work-order photo upload currently reads the full file into memory and trusts `content_type`. Add file size limits and allowlisted MIME types; consider object storage per customer.

---

## 4) Data Model & Install Reproducibility (Key sellability issue)
Your backend auto-initializes a DB by executing only `database/schema.sql` when `inventory` doesn’t exist. However, your feature set clearly relies on additional tables/views introduced in other schema files and migration scripts.

**Recommendation (P0): choose one source of truth**
- **Best:** adopt Alembic migrations and make “fresh deploy” == “apply all migrations”.
- **Minimum:** maintain one “current full schema” file (or ordered migration list) that matches exactly what `backend/main.py` expects, and ensure it runs automatically on first boot.

---

## 5) “One customer per droplet” architecture (recommended for you)
To be hands-off with per-customer domains, standardize every droplet to:
- One Docker Compose stack
- Reverse proxy that handles TLS automatically (Caddy or Traefik)
- `/api/*` → backend, everything else → frontend
- Per-customer `.env.production` created on droplet, not in repo

**Why this matters:** it eliminates the need to store cert keys in the repo, removes manual NGINX TLS wiring, and makes onboarding repeatable.

---

## 6) Deployment & Operations Checklist (practical)
For each new customer droplet:
1. Provision droplet + firewall (restrict SSH, allow 80/443).
2. Install Docker + Compose.
3. Clone repo, create `.env.production` from template, generate secrets.
4. Start stack: `docker compose up -d --build`.
5. Bootstrap admin user (script).
6. Set up backups (pg_dump + uploads volume), and test restore monthly.
7. Basic monitoring: disk usage, container health, and HTTP uptime.

---

## 7) Recommended next step
If you want, I can apply a **P0 “sellable hygiene” patch set** to this real repo (mirroring what we did for TEST):
- remove `.env*` and TLS keys from repo
- remove default users/passwords from schemas and docs
- add/standardize an admin bootstrap script
- remove the `nul` file and add/verify `.dockerignore`/repo hygiene
- make DB initialization deterministic for fresh droplet installs

