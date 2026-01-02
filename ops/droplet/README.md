# Droplet Deployment (Single Customer / Single Droplet)

## Setup
1. Point customer domain `A` record to droplet IP (example: `app.customer.com`).
2. On droplet, install Docker + Compose plugin.
3. Clone this repo to the droplet.
4. Create `.env.production`:
   - `cp ops/droplet/.env.droplet.template .env.production`
   - Fill in `DOMAIN_NAME`, `ACME_EMAIL`, `DB_PASSWORD`, `SECRET_KEY`.

## Run
- `docker compose -f docker-compose.droplet.yml --env-file .env.production up -d --build`

## Create first admin user
- `docker compose -f docker-compose.droplet.yml --env-file .env.production exec backend python scripts/create_admin.py --username admin --password '<strong-password>' --role admin`

