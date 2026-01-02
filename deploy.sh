#!/bin/bash

# Pem2 Services Inventory - Deployment Script
# This script handles safe deployment of updates

set -e  # Exit on error

echo "========================================="
echo "Pem2 Services Inventory - Deployment"
echo "========================================="
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "ERROR: .env.production file not found!"
    echo "Please create it from .env.production.template"
    exit 1
fi

# Load production environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Confirmation
echo "This will deploy the Pem2 Services Inventory to production."
echo "Environment: ${ENVIRONMENT:-production}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

echo ""
echo "Step 1: Creating backup..."
echo "----------------------------"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# Backup database
docker exec ma_electrical-db pg_dump -U ${DB_USER:-postgres} ${DB_NAME:-pem2_inventory} | gzip > "$BACKUP_DIR/backup_$BACKUP_DATE.sql.gz"
echo "✓ Database backed up to: $BACKUP_DIR/backup_$BACKUP_DATE.sql.gz"

# Backup photos volume (if exists)
if docker volume inspect photos_storage >/dev/null 2>&1; then
    echo "✓ Photos volume exists (stored in Docker volume)"
fi

echo ""
echo "Step 2: Pulling latest code..."
echo "----------------------------"
if [ -d .git ]; then
    git pull origin main || echo "⚠ Not a git repository or no updates"
else
    echo "⚠ Not a git repository - skipping git pull"
fi

echo ""
echo "Step 3: Building containers..."
echo "----------------------------"
docker-compose -f docker-compose.production.yml build

echo ""
echo "Step 4: Stopping old containers..."
echo "----------------------------"
docker-compose -f docker-compose.production.yml down

echo ""
echo "Step 5: Starting new containers..."
echo "----------------------------"
docker-compose -f docker-compose.production.yml up -d

echo ""
echo "Step 6: Waiting for services to start..."
echo "----------------------------"
sleep 10

# Health check
echo "Checking backend health..."
for i in {1..30}; do
    if curl -f http://localhost:8001/health >/dev/null 2>&1; then
        echo "✓ Backend is healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠ Backend health check failed - please check logs"
        docker-compose -f docker-compose.production.yml logs backend
        exit 1
    fi
    echo "Waiting for backend... ($i/30)"
    sleep 2
done

echo ""
echo "Step 7: Cleaning up old images..."
echo "----------------------------"
docker image prune -f

echo ""
echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "Services Status:"
docker-compose -f docker-compose.production.yml ps
echo ""
echo "Access your application at:"
echo "  Frontend: ${FRONTEND_URL:-http://localhost:3001}"
echo "  Backend API: ${BACKEND_URL:-http://localhost:8001}/docs"
echo ""
echo "Backup location: $BACKUP_DIR/backup_$BACKUP_DATE.sql.gz"
echo ""
echo "To view logs: docker-compose -f docker-compose.production.yml logs -f"
echo "To rollback: ./rollback.sh $BACKUP_DATE"
echo ""
