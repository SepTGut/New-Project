#!/bin/bash
set -e

echo "==================================================="
echo "  Starting Smart Warehouse Web & WA Bot Service"
echo "==================================================="
echo ""

if command -v docker &> /dev/null; then
    echo "Using Docker Compose..."
    docker compose up -d --build
elif command -v podman &> /dev/null; then
    echo "Using Podman Compose..."
    podman compose up -d --build
else
    echo "[ERROR] Neither Docker nor Podman was found on your system!"
    echo "Please install Docker or Podman to run the containers."
    exit 1
fi

echo ""
echo "==================================================="
echo "  Services are running!"
echo "  - Web Application: http://localhost:3000"
echo "  - Bot Dashboard:   http://localhost:3001/dashboard"
echo "  - Bot API Server:  http://localhost:3001"
echo "==================================================="
