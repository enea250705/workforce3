#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Workforce Manager VPS Deployment Script ===${NC}"

# Check if .env file exists, if not create from example
if [ ! -f .env ]; then
  echo -e "${YELLOW}Creating .env file from template...${NC}"
  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${GREEN}Created .env file. Please edit with your configuration values.${NC}"
    echo -e "${YELLOW}Edit the file using: nano .env${NC}"
  else
    echo -e "${RED}Error: .env.example file not found!${NC}"
    exit 1
  fi
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Build the application
echo -e "${GREEN}Building application...${NC}"
npm run build

# Check for database env var
if grep -q "DATABASE_URL=" .env; then
  echo -e "${GREEN}Database configuration found.${NC}"
  echo -e "${YELLOW}Running database migrations...${NC}"
  npm run setup:db
else
  echo -e "${RED}Warning: DATABASE_URL not configured in .env file!${NC}"
  echo -e "${YELLOW}Using in-memory storage instead. Data will not persist between restarts.${NC}"
fi

echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${YELLOW}Start the application with: npm start${NC}"
echo -e "${YELLOW}For Windows: npm run start:win${NC}"

# Make the script executable
chmod +x deploy.sh 