#!/bin/bash

# HealthFlow Clinic Portal - Deployment Script
# Deploy to: 138.197.16.43
# Usage: ./deploy.sh [version]

set -e

# Configuration
VERSION=${1:-"1.0.0"}
IMAGE_NAME="healthflow/clinic-portal"
CONTAINER_NAME="healthflow-clinic-portal"
REMOTE_HOST="root@138.197.16.43"
SSH_KEY="~/.ssh/healthflow_dashboard_key"
REMOTE_PATH="/opt/healthflow/clinic-portal"
PORT=8080

echo "=========================================="
echo "HealthFlow Clinic Portal Deployment"
echo "Version: $VERSION"
echo "Target: $REMOTE_HOST"
echo "=========================================="

# Step 1: Build Docker image locally
echo ""
echo "[1/5] Building Docker image..."
docker build -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:latest .

# Step 2: Save image to tar file
echo ""
echo "[2/5] Saving Docker image..."
docker save ${IMAGE_NAME}:${VERSION} | gzip > clinic-portal-${VERSION}.tar.gz

# Step 3: Transfer to server
echo ""
echo "[3/5] Transferring to server..."
scp -i ${SSH_KEY} clinic-portal-${VERSION}.tar.gz ${REMOTE_HOST}:/tmp/

# Step 4: Load and run on server
echo ""
echo "[4/5] Deploying on server..."
ssh -i ${SSH_KEY} ${REMOTE_HOST} << ENDSSH
    set -e
    
    # Create directory if not exists
    mkdir -p ${REMOTE_PATH}
    
    # Load the image
    echo "Loading Docker image..."
    gunzip -c /tmp/clinic-portal-${VERSION}.tar.gz | docker load
    
    # Stop existing container if running
    echo "Stopping existing container..."
    docker stop ${CONTAINER_NAME} 2>/dev/null || true
    docker rm ${CONTAINER_NAME} 2>/dev/null || true
    
    # Run new container
    echo "Starting new container..."
    docker run -d \
        --name ${CONTAINER_NAME} \
        --restart unless-stopped \
        -p ${PORT}:80 \
        --network healthflow-network \
        ${IMAGE_NAME}:${VERSION}
    
    # Cleanup
    echo "Cleaning up..."
    rm /tmp/clinic-portal-${VERSION}.tar.gz
    docker image prune -f
    
    # Verify deployment
    echo "Verifying deployment..."
    sleep 5
    docker ps | grep ${CONTAINER_NAME}
    
    echo "Deployment complete!"
ENDSSH

# Step 5: Cleanup local files
echo ""
echo "[5/5] Cleaning up local files..."
rm -f clinic-portal-${VERSION}.tar.gz

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "Portal URL: http://138.197.16.43:${PORT}"
echo "=========================================="
