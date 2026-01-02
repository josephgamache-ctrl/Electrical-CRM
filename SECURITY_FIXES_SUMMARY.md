# Security Fixes Summary (Sanitized)

This document intentionally contains **no secrets** (no passwords, keys, tokens, or real domains).

## Applied hardening for sale/replication
- Secrets are no longer stored in repo `.env*` files; only templates remain.
- TLS private keys/certs are not stored in the repo (generate per environment or use Let’s Encrypt via reverse proxy).
- Default credentials are removed from schemas and docs; bootstrap the first admin with `backend/scripts/create_admin.py`.

## Required operational controls
- Rotate secrets per customer deployment.
- Enable backups (database + uploads) and test restores.
- Restrict CORS to customer domain in production.

