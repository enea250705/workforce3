#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Starting Workforce Manager ===${NC}"

# Set environment to production
export NODE_ENV=production

# Check if .env file exists and load it
if [ -f .env ]; then
  echo -e "${YELLOW}Loading environment from .env file...${NC}"
  export $(grep -v '^#' .env | xargs)
  echo -e "${GREEN}Environment variables loaded${NC}"
else
  echo -e "${RED}Warning: No .env file found. Using default environment.${NC}"
fi

echo -e "${YELLOW}Starting application...${NC}"
node dist/index.js 