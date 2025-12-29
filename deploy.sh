#!/bin/bash

###############################################################################
# HealthFlow Clinic Portal - Digital Ocean Deployment Script
# Version: 2.0.0
# Description: Automated deployment script for Ubuntu 22.04 droplet
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="healthflow-clinic-portal"
APP_DIR="/var/www/$APP_NAME"
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
NGINX_ENABLED="/etc/nginx/sites-enabled/$APP_NAME"
PM2_APP_NAME="clinic-portal"
BUILD_DIR="dist"
PORT=8080

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}HealthFlow Clinic Portal Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: Please run as root (use sudo)${NC}"
    exit 1
fi

# Step 1: Install dependencies
echo -e "${YELLOW}[1/8] Installing system dependencies...${NC}"
apt-get update -qq
apt-get install -y nginx nodejs npm git curl -qq

# Install PM2 globally
npm install -g pm2 --silent

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 2: Create application directory
echo -e "${YELLOW}[2/8] Setting up application directory...${NC}"
mkdir -p $APP_DIR
chown -R www-data:www-data $APP_DIR

echo -e "${GREEN}✓ Directory created: $APP_DIR${NC}"

# Step 3: Copy application files
echo -e "${YELLOW}[3/8] Copying application files...${NC}"
if [ -d "$BUILD_DIR" ]; then
    cp -r $BUILD_DIR/* $APP_DIR/
    echo -e "${GREEN}✓ Build files copied${NC}"
else
    echo -e "${RED}Error: Build directory not found. Run 'npm run build' first.${NC}"
    exit 1
fi

# Step 4: Configure Nginx
echo -e "${YELLOW}[4/8] Configuring Nginx...${NC}"
cat > $NGINX_CONF << 'EOF'
server {
    listen 8080;
    server_name _;
    
    root /var/www/healthflow-clinic-portal;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # API proxy
    location /api/ {
        proxy_pass http://209.38.231.84:4002/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Auth API proxy
    location /api/auth/ {
        proxy_pass http://209.38.231.84:4003/api/auth/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Logging
    access_log /var/log/nginx/clinic-portal-access.log;
    error_log /var/log/nginx/clinic-portal-error.log;
}
EOF

# Enable site
ln -sf $NGINX_CONF $NGINX_ENABLED

# Test Nginx configuration
nginx -t

echo -e "${GREEN}✓ Nginx configured${NC}"

# Step 5: Set permissions
echo -e "${YELLOW}[5/8] Setting file permissions...${NC}"
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

echo -e "${GREEN}✓ Permissions set${NC}"

# Step 6: Restart Nginx
echo -e "${YELLOW}[6/8] Restarting Nginx...${NC}"
systemctl restart nginx
systemctl enable nginx

echo -e "${GREEN}✓ Nginx restarted${NC}"

# Step 7: Configure firewall
echo -e "${YELLOW}[7/8] Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 8080/tcp
    ufw allow 'Nginx Full'
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ UFW not found, skipping firewall configuration${NC}"
fi

# Step 8: Display status
echo -e "${YELLOW}[8/8] Checking deployment status...${NC}"
sleep 2

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx is not running${NC}"
    exit 1
fi

# Final summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Application URL:${NC} http://$(hostname -I | awk '{print $1}'):8080"
echo -e "${BLUE}Application Directory:${NC} $APP_DIR"
echo -e "${BLUE}Nginx Config:${NC} $NGINX_CONF"
echo -e "${BLUE}Logs:${NC} /var/log/nginx/clinic-portal-*.log"
echo ""
echo -e "${YELLOW}Test Credentials:${NC}"
echo -e "  Email: doctor.test@healthflow.gov.eg"
echo -e "  Password: Test@1234"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  View logs: tail -f /var/log/nginx/clinic-portal-access.log"
echo -e "  Restart Nginx: sudo systemctl restart nginx"
echo -e "  Check status: sudo systemctl status nginx"
echo ""
