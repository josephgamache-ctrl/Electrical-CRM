# Security Audit Report (Sanitized)

This repo is being prepared for sale/replication, so **no real secrets or credentials** are included here.

## Critical requirements before any customer hosting
- No `.env*` files with real values in the repo.
- No TLS private keys or certificates in the repo.
- No database dumps/backups inside the repo directory.
- No default usernames/passwords in schemas or docs.

## Production hardening checklist
- Restrict CORS to the customer domain.
- Use TLS termination (Caddy/Traefik) and redirect HTTP→HTTPS.
- Avoid returning raw exception strings to clients; log server-side instead.
- Validate uploads (size/type) and store outside containers (object storage preferred).

