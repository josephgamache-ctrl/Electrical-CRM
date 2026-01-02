#!/bin/bash

echo "================================================"
echo "  MA Electrical Inventory - Production Deploy"
echo "================================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose not found. Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create .env.production if it doesn't exist
if [ ! -f .env.production ]; then
    echo ""
    echo "Creating production environment file..."
    echo "Please edit .env.production with your production values!"
    cp .env.example .env.production

    # Generate a random secret key
    SECRET_KEY=$(openssl rand -hex 32)
    sed -i "s/your_jwt_secret_key_here_minimum_32_characters/$SECRET_KEY/" .env.production

    echo ""
    echo "IMPORTANT: Edit .env.production and set:"
    echo "  - DB_PASSWORD (secure database password)"
    echo "  - API_URL (your domain or droplet IP)"
    echo ""
    read -p "Press enter after you've edited .env.production..."
fi

# Load production environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

echo ""
echo "================================================"
echo "Building and starting containers..."
echo "================================================"

# Stop existing containers
docker-compose -f docker-compose.prod.yml down

# Build and start containers
docker-compose -f docker-compose.prod.yml up -d --build

echo ""
echo "================================================"
echo "Deployment Complete!"
echo "================================================"
echo ""
echo "Services Status:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "View logs with:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "Your application is running!"
