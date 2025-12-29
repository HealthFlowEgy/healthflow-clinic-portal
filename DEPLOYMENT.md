# HealthFlow Clinic Portal - Digital Ocean Deployment Guide

Complete guide for deploying the HealthFlow Clinic Portal on a Digital Ocean droplet.

---

## 📋 Prerequisites

### Digital Ocean Account
- Active Digital Ocean account
- API token (optional, for automated provisioning)

### Droplet Specifications (Recommended)
- **OS**: Ubuntu 22.04 LTS (x64)
- **Plan**: Basic
- **CPU**: 2 vCPUs
- **RAM**: 2 GB
- **SSD**: 50 GB
- **Transfer**: 2 TB
- **Price**: ~$12/month

### Domain (Optional)
- Custom domain or subdomain
- DNS configured to point to droplet IP

---

## 🚀 Quick Deployment (Automated)

### Step 1: Create Digital Ocean Droplet

```bash
# Via Digital Ocean Dashboard:
1. Click "Create" → "Droplets"
2. Choose Ubuntu 22.04 LTS
3. Select Basic plan (2GB RAM, 2 vCPUs)
4. Choose datacenter region (closest to Egypt)
5. Add SSH key
6. Create droplet
```

### Step 2: Connect to Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

### Step 3: Clone Repository

```bash
# Install git if not present
apt-get update && apt-get install -y git

# Clone the repository
git clone https://github.com/HealthFlowEgy/healthflow-clinic-portal.git
cd healthflow-clinic-portal
```

### Step 4: Build Application

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install dependencies
npm install

# Build for production
npm run build
```

### Step 5: Deploy

```bash
# Run deployment script
sudo bash deploy.sh
```

### Step 6: Access Application

```
http://YOUR_DROPLET_IP:8080
```

**Test Credentials:**
- Email: `doctor.test@healthflow.gov.eg`
- Password: `Test@1234`

---

## 🔧 Manual Deployment (Step-by-Step)

If you prefer manual deployment or need to customize the setup:

### 1. System Setup

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install dependencies
apt-get install -y nginx nodejs npm git curl ufw

# Install PM2 (optional, for process management)
npm install -g pm2
```

### 2. Install Node.js 18

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
```

### 3. Clone and Build

```bash
# Create application directory
mkdir -p /var/www/healthflow-clinic-portal
cd /var/www/healthflow-clinic-portal

# Clone repository
git clone https://github.com/HealthFlowEgy/healthflow-clinic-portal.git .

# Install dependencies
npm install

# Build production bundle
npm run build
```

### 4. Configure Nginx

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/healthflow-clinic-portal
```

Paste the following configuration:

```nginx
server {
    listen 8080;
    server_name _;
    
    root /var/www/healthflow-clinic-portal/dist;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API proxy (Prescription Service)
    location /api/v1/ {
        proxy_pass http://209.38.231.84:4002/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Auth API proxy
    location /api/auth/ {
        proxy_pass http://209.38.231.84:4003/api/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/healthflow-clinic-portal /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx
```

### 5. Configure Firewall

```bash
# Allow HTTP traffic
ufw allow 8080/tcp
ufw allow 'Nginx Full'
ufw allow OpenSSH

# Enable firewall
ufw enable
```

### 6. Set Permissions

```bash
chown -R www-data:www-data /var/www/healthflow-clinic-portal
chmod -R 755 /var/www/healthflow-clinic-portal
```

---

## 🔒 SSL/HTTPS Setup (Optional but Recommended)

### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
certbot --nginx -d clinic.healthflow.gov.eg

# Auto-renewal is configured automatically
# Test renewal:
certbot renew --dry-run
```

### Update Nginx Configuration

After obtaining SSL certificate, update the Nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name clinic.healthflow.gov.eg;
    
    ssl_certificate /etc/letsencrypt/live/clinic.healthflow.gov.eg/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clinic.healthflow.gov.eg/privkey.pem;
    
    # ... rest of configuration ...
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name clinic.healthflow.gov.eg;
    return 301 https://$server_name$request_uri;
}
```

---

## 📊 Monitoring & Maintenance

### View Logs

```bash
# Nginx access logs
tail -f /var/log/nginx/clinic-portal-access.log

# Nginx error logs
tail -f /var/log/nginx/clinic-portal-error.log

# System logs
journalctl -u nginx -f
```

### Check Service Status

```bash
# Nginx status
systemctl status nginx

# Check if port 8080 is listening
netstat -tulpn | grep :8080

# Test application
curl http://localhost:8080
```

### Update Application

```bash
cd /var/www/healthflow-clinic-portal

# Pull latest changes
git pull origin main

# Rebuild
npm install
npm run build

# Restart Nginx
systemctl restart nginx
```

---

## 🔄 Continuous Deployment (CI/CD)

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Digital Ocean

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build
      run: npm run build
    
    - name: Deploy to Digital Ocean
      uses: appleboy/scp-action@master
      with:
        host: ${{ secrets.DROPLET_IP }}
        username: root
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        source: "dist/*"
        target: "/var/www/healthflow-clinic-portal/"
    
    - name: Restart Nginx
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.DROPLET_IP }}
        username: root
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: systemctl restart nginx
```

### Required Secrets

Add these secrets in GitHub repository settings:
- `DROPLET_IP`: Your Digital Ocean droplet IP
- `SSH_PRIVATE_KEY`: SSH private key for authentication

---

## 🧪 Testing Deployment

### Smoke Test Checklist

```bash
# 1. Check if application is accessible
curl -I http://YOUR_DROPLET_IP:8080

# 2. Test API proxy
curl http://YOUR_DROPLET_IP:8080/api/v1/medicines/search?q=test

# 3. Test auth proxy
curl -X POST http://YOUR_DROPLET_IP:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor.test@healthflow.gov.eg","password":"Test@1234"}'

# 4. Check Nginx logs for errors
tail -n 50 /var/log/nginx/clinic-portal-error.log
```

### Browser Testing

1. Open `http://YOUR_DROPLET_IP:8080`
2. Login with test credentials
3. Test medicine search autocomplete
4. Create a test prescription
5. View prescription history
6. Test voice input (Chrome)
7. Test OCR upload

---

## 🐛 Troubleshooting

### Issue: White screen / Application not loading

**Solution:**
```bash
# Check if dist folder exists
ls -la /var/www/healthflow-clinic-portal/dist

# Rebuild if missing
cd /var/www/healthflow-clinic-portal
npm run build

# Check Nginx error logs
tail -f /var/log/nginx/clinic-portal-error.log
```

### Issue: API calls failing (CORS errors)

**Solution:**
```bash
# Verify API proxy configuration in Nginx
nginx -t

# Check if backend services are accessible
curl http://209.38.231.84:4002/api/v1/medicines/search?q=test
curl http://209.38.231.84:4003/api/auth/login
```

### Issue: 502 Bad Gateway

**Solution:**
```bash
# Check if Nginx is running
systemctl status nginx

# Restart Nginx
systemctl restart nginx

# Check if port 8080 is available
netstat -tulpn | grep :8080
```

### Issue: Permission denied errors

**Solution:**
```bash
# Fix permissions
chown -R www-data:www-data /var/www/healthflow-clinic-portal
chmod -R 755 /var/www/healthflow-clinic-portal
```

---

## 📈 Performance Optimization

### Enable Nginx Caching

Add to Nginx configuration:

```nginx
# Cache configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /api/v1/medicines/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 60m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    add_header X-Cache-Status $upstream_cache_status;
    
    proxy_pass http://209.38.231.84:4002/api/v1/medicines/;
}
```

### Enable HTTP/2

```nginx
listen 443 ssl http2;
```

### Optimize Static Assets

```bash
# Install compression tools
apt-get install -y brotli

# Pre-compress static files
find /var/www/healthflow-clinic-portal/dist -type f \( -name '*.js' -o -name '*.css' \) -exec brotli {} \;
```

---

## 💰 Cost Estimation

| Component | Monthly Cost |
|-----------|--------------|
| Digital Ocean Droplet (2GB) | $12 |
| Bandwidth (2TB included) | $0 |
| Backups (optional) | $2.40 |
| **Total** | **~$14.40/month** |

---

## 📞 Support

For deployment assistance:
- **Email**: devops@healthflow.gov.eg
- **Documentation**: http://docs.healthflow.gov.eg/deployment
- **Emergency**: +20 XXX XXX XXXX

---

## ✅ Post-Deployment Checklist

- [ ] Application accessible at http://DROPLET_IP:8080
- [ ] Login working with test credentials
- [ ] Medicine search autocomplete functional
- [ ] Prescription creation working
- [ ] Status updates working (PUT method)
- [ ] Prescription history visible
- [ ] Voice input functional (Chrome)
- [ ] OCR upload working
- [ ] Nginx logs showing no errors
- [ ] Firewall configured
- [ ] SSL certificate installed (if using HTTPS)
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Documentation updated with actual IP/domain

---

**Last Updated**: December 29, 2025  
**Version**: 2.0.0  
**Deployment Target**: Digital Ocean Ubuntu 22.04 LTS
