#!/bin/bash

echo "================================================"
echo "  Starting MA Electrical Inventory (Production)"
echo "================================================"
echo ""

# Load production environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "Warning: .env.production not found!"
    echo "Using default values. Please create .env.production for production use."
fi

echo "Starting production environment..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "================================================"
echo "Services started!"
echo "================================================"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "Stop services: docker-compose -f docker-compose.prod.yml down"
