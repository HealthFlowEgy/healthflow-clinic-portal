#!/bin/bash
set -e

echo "=== HealthFlow Clinic Portal - Deploy Fixed Version ==="
echo "Date: $(date)"
echo ""

# Stop and remove old container
echo "1. Stopping old container..."
docker stop healthflow-clinic-portal || true
docker rm healthflow-clinic-portal || true

# Build new image
echo "2. Building new Docker image..."
cd /tmp/clinic-portal
docker build -t healthflow/clinic-portal:1.0.3-fixed .

# Start new container
echo "3. Starting new container..."
docker run -d \
  --name healthflow-clinic-portal \
  --restart unless-stopped \
  -p 8080:80 \
  healthflow/clinic-portal:1.0.3-fixed

# Wait for container to be healthy
echo "4. Waiting for container to be ready..."
sleep 5

# Check container status
echo "5. Checking container status..."
docker ps | grep healthflow-clinic-portal

echo ""
echo "=== Deployment Complete ==="
echo "Clinic portal is now running on port 8080"
echo "Access at: http://138.197.16.43:8080"
