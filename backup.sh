#!/bin/bash

# Pem2 Services Inventory - Backup Script
# Run this daily via cron: 0 2 * * * /path/to/backup.sh

set -e  # Exit on error

echo "========================================="
echo "Pem2 Services Inventory - Backup"
echo "========================================="
echo ""

# Load environment variables if they exist
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
DAILY_DIR="$BACKUP_DIR/daily"
MONTHLY_DIR="$BACKUP_DIR/monthly"

# Create backup directories
mkdir -p $DAILY_DIR
mkdir -p $MONTHLY_DIR

echo "Step 1: Backing up database..."
echo "----------------------------"

# Database backup
DB_BACKUP="$DAILY_DIR/db_backup_$BACKUP_DATE.sql.gz"
docker exec ma_electrical-db pg_dump -U ${DB_USER:-postgres} ${DB_NAME:-pem2_inventory} | gzip > "$DB_BACKUP"

if [ -f "$DB_BACKUP" ]; then
    BACKUP_SIZE=$(du -h "$DB_BACKUP" | cut -f1)
    echo "✓ Database backed up: $DB_BACKUP ($BACKUP_SIZE)"
else
    echo "✗ Database backup failed!"
    exit 1
fi

echo ""
echo "Step 2: Backing up photos volume..."
echo "----------------------------"

# Photos volume backup (tar the entire volume)
PHOTOS_BACKUP="$DAILY_DIR/photos_backup_$BACKUP_DATE.tar.gz"
if docker volume inspect photos_storage >/dev/null 2>&1; then
    docker run --rm \
        -v photos_storage:/data \
        -v $(pwd)/$DAILY_DIR:/backup \
        alpine tar czf /backup/photos_backup_$BACKUP_DATE.tar.gz -C /data .

    if [ -f "$PHOTOS_BACKUP" ]; then
        PHOTOS_SIZE=$(du -h "$PHOTOS_BACKUP" | cut -f1)
        echo "✓ Photos backed up: $PHOTOS_BACKUP ($PHOTOS_SIZE)"
    fi
else
    echo "⚠ Photos volume not found - skipping"
fi

echo ""
echo "Step 3: Monthly archive..."
echo "----------------------------"

# Keep monthly backups (on the 1st of each month)
DAY_OF_MONTH=$(date +%d)
if [ "$DAY_OF_MONTH" = "01" ]; then
    MONTH_NAME=$(date +%Y_%m)
    cp "$DB_BACKUP" "$MONTHLY_DIR/db_backup_$MONTH_NAME.sql.gz"
    if [ -f "$PHOTOS_BACKUP" ]; then
        cp "$PHOTOS_BACKUP" "$MONTHLY_DIR/photos_backup_$MONTH_NAME.tar.gz"
    fi
    echo "✓ Monthly backup created for $(date +%B %Y)"
else
    echo "⚠ Not the 1st of the month - skipping monthly backup"
fi

echo ""
echo "Step 4: Cleanup old daily backups (keep 30 days)..."
echo "----------------------------"

# Delete daily backups older than 30 days
find $DAILY_DIR -name "*.gz" -type f -mtime +30 -delete
REMAINING=$(ls -1 $DAILY_DIR/*.gz 2>/dev/null | wc -l)
echo "✓ Cleaned up old backups. Remaining daily backups: $REMAINING"

echo ""
echo "Step 5: Upload to DigitalOcean Spaces (if configured)..."
echo "----------------------------"

if [ -n "$DO_SPACES_BUCKET" ] && [ -n "$DO_SPACES_KEY" ]; then
    # Check if s3cmd is installed
    if command -v s3cmd &> /dev/null; then
        # Upload to Spaces
        s3cmd put "$DB_BACKUP" s3://$DO_SPACES_BUCKET/backups/database/
        if [ -f "$PHOTOS_BACKUP" ]; then
            s3cmd put "$PHOTOS_BACKUP" s3://$DO_SPACES_BUCKET/backups/photos/
        fi
        echo "✓ Backups uploaded to DigitalOcean Spaces"
    else
        echo "⚠ s3cmd not installed - skipping Spaces upload"
        echo "  Install with: sudo apt-get install s3cmd"
    fi
else
    echo "⚠ DigitalOcean Spaces not configured - skipping upload"
fi

echo ""
echo "========================================="
echo "✓ Backup Complete!"
echo "========================================="
echo ""
echo "Backup Summary:"
echo "  Database: $DB_BACKUP"
if [ -f "$PHOTOS_BACKUP" ]; then
    echo "  Photos: $PHOTOS_BACKUP"
fi
echo "  Location: $(pwd)/$BACKUP_DIR"
echo ""
echo "Total backup size:"
du -sh $BACKUP_DIR
echo ""
