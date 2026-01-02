#!/bin/bash

echo "================================================"
echo "  Stopping MA Electrical Inventory (Production)"
echo "================================================"
echo ""

docker-compose -f docker-compose.prod.yml down

echo ""
echo "Services stopped successfully!"
