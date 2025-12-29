# HealthFlow Clinic Portal v2.0

<div align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-teal?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/API-v8.0-green?style=for-the-badge" alt="API Version">
  <img src="https://img.shields.io/badge/status-production--ready-brightgreen?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/React-18.2-blue?style=for-the-badge&logo=react" alt="React">
</div>

<br>

**Egypt's Digital Prescription Infrastructure** - A comprehensive web application for healthcare professionals to manage digital prescriptions with integrated OCR scanning, voice input, and the National Medicine Directory.

---

## 🌟 Features

### Core Prescription Management
- ✅ **Create Prescriptions** - Full form with patient details, diagnosis, and medications
- ✅ **Medicine Directory** - Autocomplete search across 47,292+ Egyptian medicines
- ✅ **Status Workflow** - Draft → Approved → Dispensed lifecycle
- ✅ **Audit Trail** - Complete history of all prescription changes
- ✅ **Search & Filter** - Find by RX number, National ID, or status

### Advanced Input Methods
- 🎤 **Voice Prescription** - Dictate prescriptions using speech recognition
- 📷 **OCR Scanning** - Upload photos of handwritten prescriptions
- ⌨️ **Manual Entry** - Traditional form-based input

### Technical Features
- 🔐 **JWT Authentication** - Secure token-based auth with auto-refresh
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🎨 **Medical-Tech UI** - Clean, professional healthcare aesthetic
- ⚡ **Fast Performance** - Optimized React with Vite bundling

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm or yarn
- Modern browser with Speech Recognition support (for voice input)

### Installation

```bash
# Clone the repository
git clone https://github.com/healthflow/clinic-portal.git
cd healthflow-clinic-portal

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will open at `http://localhost:3000`

### Test Credentials

```
Email: pharmacy.integration@healthflow.gov.eg
Password: Pharmacy@2025
```

---

## 📁 Project Structure

```
healthflow-clinic-portal/
├── src/
│   ├── App.jsx          # Main application (all components)
│   └── main.jsx         # React entry point
├── index.html           # HTML template
├── package.json         # Dependencies & scripts
├── vite.config.js       # Vite configuration
└── README.md            # Documentation
```

---

## 🔌 API Integration

### Base URLs
```
Auth Service:        http://209.38.231.84:4003/api/auth
Prescription Service: http://209.38.231.84:4002/api/v1
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User authentication |
| `/api/v1/medicines/search` | GET | Medicine autocomplete |
| `/api/v1/medicines/:id` | GET | Get medicine details |
| `/api/v1/prescriptions` | GET/POST | List/Create prescriptions |
| `/api/v1/prescriptions/:id` | GET | Get prescription details |
| `/api/v1/prescriptions/:id/status` | **PUT** | Update status (v8.0) |
| `/api/v1/prescriptions/:id/history` | GET | Audit trail |
| `/api/v1/prescriptions/search/number/:rx` | GET | Search by RX |
| `/api/v1/prescriptions/search/national-id/:id` | GET | Search by National ID |

### Important: API v8.0 Changes

Status updates use **PUT** method (not PATCH):

```javascript
// ✅ Correct (v8.0)
fetch(`/api/v1/prescriptions/${id}/status`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'approved' })
});

// ❌ Wrong (v7.0 - returns 404)
fetch(`/api/v1/prescriptions/${id}/status`, {
  method: 'PATCH',
  body: JSON.stringify({ status: 'approved' })
});
```

---

## 🎤 Voice Prescription Feature

The Voice Prescription feature uses the Web Speech API for hands-free prescription entry.

### Supported Commands
- "Patient name [name]" - Sets patient name
- "Diagnosis [diagnosis]" - Sets diagnosis
- "Medicine [medicine name]" - Adds medication

### Browser Support
- Chrome (recommended)
- Edge
- Safari (partial)
- Firefox (limited)

### Usage
1. Click "Voice Input" tab in prescription form
2. Click "Start" button
3. Speak clearly into microphone
4. Click "Stop" when finished

---

## 📷 OCR Scanning Feature

Upload photos of handwritten prescriptions for automatic data extraction.

### Supported Formats
- PNG, JPG, JPEG, WEBP
- Maximum file size: 10MB

### How It Works
1. Click "Scan Image" tab in prescription form
2. Upload or drag-drop prescription image
3. Click "Extract Prescription Data"
4. Review and edit extracted data
5. Complete form and submit

> **Note**: OCR processing is simulated in this demo. In production, integrate with an OCR API like Google Cloud Vision, AWS Textract, or Azure Computer Vision.

---

## 🔄 Prescription Workflow

```
┌─────────┐
│  DRAFT  │ ← Initial state after creation
└────┬────┘
     │
     ▼
┌─────────────────────┐
│ PENDING_VALIDATION  │ ← Optional AI validation step
└──────────┬──────────┘
           │
           ▼
┌──────────┐     ┌──────────┐
│ APPROVED │ ──► │ DISPENSED│ ← Final state
└────┬─────┘     └──────────┘
     │
     ▼
┌──────────┐
│ CANCELLED│ ← Can cancel from draft/pending/approved
└──────────┘
```

### Status Transitions

| From | To | Action |
|------|-----|--------|
| draft | approved | Direct approval |
| draft | cancelled | Cancel prescription |
| pending_validation | approved | Validation passed |
| pending_validation | rejected | Validation failed |
| approved | dispensed | Mark as dispensed |
| approved | cancelled | Cancel prescription |

---

## 📦 Data Models

### Medication Object

```javascript
{
  medicineId: "UUID",           // Required - Internal ID
  medicineName: "string",       // Required - Commercial name
  drugId: "string",             // Recommended - National Directory ID
  medicineGenericName: "string",
  medicineStrength: "string",
  medicineForm: "tablet|capsule|syrup|...",
  dosage: "string",             // Required
  frequency: "string",          // Required
  duration: "string",           // Required (v8.0)
  quantity: number,             // Required
  refills: number,
  instructions: "string",
  warnings: "string",
  substitutionAllowed: boolean,
  icd: "string"                 // ICD-10 code
}
```

### Required Fields (v8.0)

| Field | Validation |
|-------|-----------|
| `patient.name` | Non-empty string |
| `medications[].medicineName` | Non-empty string |
| `medications[].dosage` | Non-empty string |
| `medications[].frequency` | Non-empty string |
| `medications[].duration` | Non-empty string (**NEW in v8.0**) |
| `medications[].quantity` | Positive integer |

---

## 🏗️ Building for Production

```bash
# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

Output directory: `dist/`

---

## 🧪 Testing Checklist

- [ ] Login with test credentials
- [ ] Search medicines (autocomplete)
- [ ] Create prescription with drugId
- [ ] Test voice input (Chrome)
- [ ] Test OCR upload
- [ ] View prescription details
- [ ] Update status to approved (PUT method)
- [ ] Update status to dispensed
- [ ] Cancel with reason
- [ ] View audit trail
- [ ] Search by RX number
- [ ] Search by National ID
- [ ] Filter by status
- [ ] Logout and login again

### Test UUIDs

```javascript
Doctor ID:   650e8400-e29b-41d4-a716-446655440001
Patient ID:  750e8400-e29b-41d4-a716-446655440888
Medicine ID: 950e8400-e29b-41d4-a716-446655440004
```

---

## 🎨 Design System

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0D9488` | Buttons, links, accents |
| Primary Light | `#14B8A6` | Hover states |
| Primary Dark | `#0F766E` | Active states |
| Success | `#10B981` | Success messages |
| Warning | `#F59E0B` | Warning messages |
| Error | `#EF4444` | Error messages |
| Background | `#F0F9FF` | Page background |
| Surface | `#FFFFFF` | Cards, modals |
| Text | `#0F172A` | Primary text |
| Text Muted | `#64748B` | Secondary text |

### Typography

- **Font Family**: Inter (Google Fonts)
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)

---

## 📞 Support

For technical support or integration assistance:

- **Email**: support@healthflow.gov.eg
- **Documentation**: http://docs.healthflow.gov.eg
- **API Reference**: See [Integration Guide v8.0](./docs/integration-guide.md)

---

## 📜 Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | Dec 2025 | Added Voice & OCR input, redesigned UI |
| 1.0.0 | Dec 2025 | Initial release with basic functionality |

---

## 📄 License

MIT © 2025 HealthFlow Group

---

<div align="center">
  <strong>Built with ❤️ for Egyptian Healthcare</strong>
  <br>
  <sub>Serving 105 million citizens with 575,000+ daily prescriptions</sub>
</div>
