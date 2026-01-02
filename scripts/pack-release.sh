#!/usr/bin/env bash
set -euo pipefail

OUTPUT="${1:-./release.tar.gz}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

tar \
  --exclude='./backups' \
  --exclude='./frontend/node_modules' \
  --exclude='./frontend/build' \
  --exclude='./frontend/dist' \
  --exclude='./backend/__pycache__' \
  --exclude='./nginx/certs' \
  --exclude='./nginx/ssl' \
  --exclude='./.env' \
  --exclude='./.env.*' \
  --exclude='./backend/.env' \
  --exclude='./backend/.env.*' \
  --exclude='*.log' \
  -C "$REPO_ROOT" \
  -czf "$OUTPUT" .

echo "Release package created: $OUTPUT"

