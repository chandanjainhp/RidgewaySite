#!/bin/bash

# Ridgeway Site - Docker Setup Script
# This script helps set up the entire application with Docker

set -e

echo "🚀 Ridgeway Site - Docker Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose found${NC}"

# Create environment files if they don't exist
if [ ! -f "server/.env" ]; then
    echo -e "${YELLOW}Creating server/.env from template...${NC}"
    cp server/.env.example server/.env
    echo -e "${GREEN}✓ Created server/.env${NC}"
    echo -e "${YELLOW}⚠️  Please update server/.env with your settings${NC}"
fi

if [ ! -f "client/.env.local" ]; then
    echo -e "${YELLOW}Creating client/.env.local from template...${NC}"
    cp client/.env.example client/.env.local
    echo -e "${GREEN}✓ Created client/.env.local${NC}"
fi

# Build and start containers
echo ""
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose build --no-cache

echo ""
echo -e "${YELLOW}Starting containers...${NC}"
docker-compose up -d

# Wait for services to be ready
echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Check service health
echo ""
echo -e "${YELLOW}Checking service status...${NC}"

if docker-compose ps | grep -q "healthy"; then
    echo -e "${GREEN}✓ Services are running and healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Some services may not be healthy yet, wait a moment...${NC}"
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Access your application:"
echo "  🌐 Client: http://localhost:3000"
echo "  🔌 Server: http://localhost:8000"
echo "  🗄️  MongoDB: mongodb://admin:password123@localhost:27017"
echo "  💾 Redis: redis://localhost:6379"
echo ""
echo "MongoDB Admin User:"
echo "  Username: admin"
echo "  Password: password123"
echo ""
echo "Useful commands:"
echo "  docker-compose logs -f              # View logs"
echo "  docker-compose down                 # Stop all services"
echo "  docker-compose up -d                # Start all services"
echo "  docker-compose ps                   # Check status"
echo ""
