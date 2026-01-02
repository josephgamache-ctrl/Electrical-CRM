# Production Deployment (Sanitized)

This document intentionally contains **no real secrets**, domains, or credentials.

## Recommended model (per customer per droplet)
Use a single droplet per customer with the customer’s domain, and terminate TLS with Caddy (Let’s Encrypt).

- Compose: `docker-compose.droplet.yml`
- Env template: `ops/droplet/.env.droplet.template`

## Quick deploy (droplet)
1. DNS: point customer domain `A` record to the droplet IP.
2. On the droplet: install Docker + Compose.
3. Clone this repo.
4. Create `.env.production` from `ops/droplet/.env.droplet.template` and fill:
   - `DOMAIN_NAME`, `ACME_EMAIL`, `DB_PASSWORD`, `SECRET_KEY`
5. Start:
   - `docker compose -f docker-compose.droplet.yml --env-file .env.production up -d --build`
6. Create first admin:
   - `docker compose -f docker-compose.droplet.yml --env-file .env.production exec backend python scripts/create_admin.py --username admin --password '<strong-password>' --role admin`

## Backups (minimum)
- Nightly `pg_dump` from the Postgres container + a tar backup of the uploads volume.
- Test restores monthly.

