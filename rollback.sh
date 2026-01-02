#!/bin/bash

# Pem2 Services Inventory - Rollback Script
# Usage: ./rollback.sh BACKUP_DATE (e.g., ./rollback.sh 20241203_143022)

set -e  # Exit on error

if [ -z "$1" ]; then
    echo "ERROR: Please specify a backup date"
    echo "Usage: ./rollback.sh BACKUP_DATE"
    echo ""
    echo "Available backups:"
    ls -1 ./backups/daily/db_backup_*.sql.gz 2>/dev/null | sed 's/.*db_backup_//' | sed 's/.sql.gz//' || echo "No backups found"
    exit 1
fi

BACKUP_DATE=$1
BACKUP_DIR="./backups/daily"
DB_BACKUP="$BACKUP_DIR/db_backup_$BACKUP_DATE.sql.gz"
PHOTOS_BACKUP="$BACKUP_DIR/photos_backup_$BACKUP_DATE.tar.gz"

echo "========================================="
echo "Pem2 Services Inventory - Rollback"
echo "========================================="
echo ""

# Check if backup exists
if [ ! -f "$DB_BACKUP" ]; then
    echo "ERROR: Backup not found: $DB_BACKUP"
    echo ""
    echo "Available backups:"
    ls -1 $BACKUP_DIR/db_backup_*.sql.gz 2>/dev/null | sed 's/.*db_backup_//' | sed 's/.sql.gz//' || echo "No backups found"
    exit 1
fi

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Confirmation
echo "⚠️  WARNING: This will restore the database to backup from: $BACKUP_DATE"
echo "Current data will be LOST!"
echo ""
read -p "Are you absolutely sure? (type 'yes' to confirm) " -r
echo ""
if [[ ! $REPLY = "yes" ]]; then
    echo "Rollback cancelled."
    exit 1
fi

echo ""
echo "Step 1: Creating safety backup of current state..."
echo "----------------------------"
SAFETY_BACKUP="./backups/pre_rollback_$(date +%Y%m%d_%H%M%S).sql.gz"
docker exec ma_electrical-db pg_dump -U ${DB_USER:-postgres} ${DB_NAME:-pem2_inventory} | gzip > "$SAFETY_BACKUP"
echo "✓ Safety backup created: $SAFETY_BACKUP"

echo ""
echo "Step 2: Stopping containers..."
echo "----------------------------"
docker-compose -f docker-compose.production.yml down

echo ""
echo "Step 3: Restoring database..."
echo "----------------------------"

# Start only database container
docker-compose -f docker-compose.production.yml up -d ma_electrical-db
sleep 5

# Drop and recreate database
docker exec ma_electrical-db psql -U ${DB_USER:-postgres} -c "DROP DATABASE IF EXISTS ${DB_NAME:-pem2_inventory};"
docker exec ma_electrical-db psql -U ${DB_USER:-postgres} -c "CREATE DATABASE ${DB_NAME:-pem2_inventory};"

# Restore from backup
gunzip -c "$DB_BACKUP" | docker exec -i ma_electrical-db psql -U ${DB_USER:-postgres} ${DB_NAME:-pem2_inventory}

echo "✓ Database restored from: $DB_BACKUP"

echo ""
echo "Step 4: Restoring photos..."
echo "----------------------------"

if [ -f "$PHOTOS_BACKUP" ]; then
    # Remove existing photos volume
    docker volume rm photos_storage 2>/dev/null || true

    # Create new volume and restore
    docker volume create photos_storage
    docker run --rm \
        -v photos_storage:/data \
        -v $(pwd)/$BACKUP_DIR:/backup \
        alpine tar xzf /backup/photos_backup_$BACKUP_DATE.tar.gz -C /data

    echo "✓ Photos restored from: $PHOTOS_BACKUP"
else
    echo "⚠ No photos backup found - skipping"
fi

echo ""
echo "Step 5: Starting all containers..."
echo "----------------------------"
docker-compose -f docker-compose.production.yml up -d

echo ""
echo "Step 6: Waiting for services..."
echo "----------------------------"
sleep 10

# Health check
for i in {1..30}; do
    if curl -f http://localhost:8001/health >/dev/null 2>&1; then
        echo "✓ Backend is healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠ Backend health check failed"
        docker-compose -f docker-compose.production.yml logs backend
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

echo ""
echo "========================================="
echo "✓ Rollback Complete!"
echo "========================================="
echo ""
echo "Restored from: $BACKUP_DATE"
echo "Safety backup: $SAFETY_BACKUP"
echo ""
echo "Services Status:"
docker-compose -f docker-compose.production.yml ps
echo ""
