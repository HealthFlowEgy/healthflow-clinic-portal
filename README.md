# HealthFlow Clinic Portal

A modern, responsive web application for clinics to create and manage electronic prescriptions within the HealthFlow ecosystem.

## 🚀 Features

- **Secure Authentication** - JWT-based login with automatic token refresh
- **Dashboard** - Overview of prescription statistics and recent activity
- **Prescription Creation** - Step-by-step wizard with patient info, diagnosis, and medications
- **Medicine Search** - Autocomplete search with 47,292+ medicines from the national database
- **ICD-10 Diagnosis Codes** - 90+ common diagnosis codes with autocomplete search
- **Prescription History** - Paginated list with search and filtering
- **Status Management** - Approve, cancel, and track prescription status

## 📋 Tech Stack

- **Frontend**: React 18 + TypeScript
- **UI Library**: Material-UI (MUI) v5
- **Build Tool**: Vite 5
- **HTTP Client**: Axios
- **Routing**: React Router v6
- **Styling**: Tailwind CSS

## 🔧 Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🐳 Docker Deployment

### Quick Start with Docker Compose

```bash
# Build and run locally
docker-compose up -d

# View logs
docker logs -f healthflow-clinic-portal

# Stop
docker-compose down
```

### Deploy to Production Server (138.197.16.43)

```bash
# Make deploy script executable
chmod +x deploy.sh

# Deploy version 1.0.0
./deploy.sh 1.0.0
```

### Manual Docker Deployment

```bash
# Build the image
docker build -t healthflow/clinic-portal:1.0.0 .

# Run the container
docker run -d \
  --name healthflow-clinic-portal \
  --restart unless-stopped \
  -p 8080:80 \
  healthflow/clinic-portal:1.0.0
```

## 🌐 Nginx Configuration (Dashboard Server)

Copy `nginx-site.conf` to the dashboard server:

```bash
# On the server (138.197.16.43)
sudo cp nginx-site.conf /etc/nginx/sites-available/clinic-portal
sudo ln -s /etc/nginx/sites-available/clinic-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔐 Test Credentials

- **Email**: doctor.test@healthflow.gov.eg
- **Password**: Test@1234

## 📡 API Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| Auth Service | http://209.38.231.84:4003 | User authentication |
| Prescription Service | http://209.38.231.84:4002 | Prescription CRUD operations |
| Medicine Search | http://209.38.231.84:4002/api/v1/medicines/search | Medicine directory |

## 📁 Project Structure

```
clinic-portal/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── common/       # Layout, ProtectedRoute
│   │   └── prescription/ # MedicineSearch, MedicationList, etc.
│   ├── contexts/         # React contexts (Auth)
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   ├── services/         # API service layer
│   ├── types/            # TypeScript type definitions
│   └── config/           # Configuration constants
├── public/               # Static assets
├── Dockerfile            # Docker build configuration
├── docker-compose.yml    # Docker Compose configuration
├── nginx.conf            # Nginx config for container
├── nginx-site.conf       # Nginx config for host server
└── deploy.sh             # Deployment script
```

## 🔄 Prescription Workflow

1. **Login** - Authenticate with doctor credentials
2. **Create** - Fill patient info, diagnosis, and medications
3. **Submit** - Save as draft or submit & approve
4. **Track** - Monitor status in history view
5. **Manage** - Approve, cancel, or view details

## 🛡️ Status Transitions

```
draft → pending_validation → approved → dispensed
draft → cancelled
pending_validation → rejected
approved → cancelled
approved → expired
```

## 🐛 Known Issues & Recent Fixes

### Version 1.0.3 (December 28, 2025)

**Fixed Issues:**
- ✅ **Medicine Search Component** - Rewrote with simplified state management and direct API calls
- ✅ **ICD-10 Diagnosis Search** - Added 90+ common diagnosis codes with autocomplete
- ✅ **Form Validation** - Improved error handling and user feedback

**Key Components:**
- `MedicineSearch.tsx` - Medicine autocomplete with debounced search
- `DiagnosisSearch.tsx` - ICD-10 code autocomplete with 90+ common codes
- `CreatePrescription.tsx` - Multi-step prescription creation wizard

## 🚧 Deployment Notes

### Docker Container Deployment

The clinic portal runs in a Docker container. To deploy updates:

```bash
# 1. Extract source code
cd /tmp && tar -xzf clinic-portal-source.tar.gz

# 2. Build new Docker image
cd clinic-portal
docker build -t healthflow/clinic-portal:1.0.3 .

# 3. Stop old container
docker stop healthflow-clinic-portal
docker rm healthflow-clinic-portal

# 4. Start new container
docker run -d \
  --name healthflow-clinic-portal \
  --restart unless-stopped \
  -p 8080:80 \
  healthflow/clinic-portal:1.0.3
```

### Quick Deployment Script

Use the provided `deploy-fixed.sh` script:

```bash
chmod +x deploy-fixed.sh
./deploy-fixed.sh
```

## 📄 License

Copyright © 2025 HealthFlow Group. All rights reserved.
