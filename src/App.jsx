import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// ============================================================================
// HEALTHFLOW CLINIC PORTAL - Digital Prescription Management System
// Version: 2.7.0 | Integrated with HealthFlow API v8.0
// Build: 2025-12-29-v7
// Features: Medicine Directory, OCR Upload, Voice Prescription, PDF Generation,
//           National ID Validation, Quantity Auto-calculation, PDF Improvements
// ============================================================================

// App version for debugging
const APP_VERSION = '2.7.0';
const BUILD_DATE = '2025-12-29';

console.log(`[HealthFlow] Clinic Portal v${APP_VERSION} (${BUILD_DATE})`);
console.log('[HealthFlow] OCR/Voice → Medicine Directory Auto-Match');
console.log('[HealthFlow] Initializing application...');

// Determine API URLs based on environment
// When deployed with Nginx proxy, use relative URLs
// When running locally, use absolute URLs to the backend
const getApiConfig = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
  
  // Direct backend URLs (for local development or when not using proxy)
  const DIRECT_AUTH = 'http://209.38.231.84:4003/api/auth';
  const DIRECT_PRESCRIPTION = 'http://209.38.231.84:4002/api/v1';
  
  // Relative URLs (for production behind Nginx proxy)
  const PROXY_AUTH = '/api/auth';
  const PROXY_PRESCRIPTION = '/api/v1';
  
  // Check if we should use proxy URLs
  // The proxy is typically used in production deployments
  const useProxy = !isLocalDev;
  
  const config = {
    AUTH_BASE: useProxy ? PROXY_AUTH : DIRECT_AUTH,
    PRESCRIPTION_BASE: useProxy ? PROXY_PRESCRIPTION : DIRECT_PRESCRIPTION,
    // Also store direct URLs for fallback
    DIRECT_AUTH_BASE: DIRECT_AUTH,
    DIRECT_PRESCRIPTION_BASE: DIRECT_PRESCRIPTION,
  };
  
  console.log('[API Config] Environment:', { hostname, isLocalDev, useProxy });
  console.log('[API Config] URLs:', config);
  
  return config;
};

const API_CONFIG = getApiConfig();

// ============================================================================
// DESIGN TOKENS - Medical Tech Aesthetic
// ============================================================================
const TOKENS = {
  colors: {
    primary: '#0D9488',
    primaryLight: '#14B8A6',
    primaryDark: '#0F766E',
    accent: '#F59E0B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    background: '#F0F9FF',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#64748B',
    border: '#E2E8F0',
    gradient: 'linear-gradient(135deg, #0D9488 0%, #0891B2 50%, #0284C7 100%)',
    gradientAlt: 'linear-gradient(135deg, #14B8A6 0%, #06B6D4 100%)',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    glow: '0 0 40px rgba(13, 148, 136, 0.3)',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
};

// ============================================================================
// API SERVICE LAYER
// ============================================================================

class HealthFlowAPI {
  static token = null;
  static refreshToken = null;
  static tokenExpiry = null;
  static user = null;

  // Token storage keys - using healthflow_auth_token for consistency
  static TOKEN_KEY = 'healthflow_auth_token';
  static REFRESH_KEY = 'healthflow_refresh_token';
  static EXPIRY_KEY = 'healthflow_token_expiry';
  static USER_KEY = 'healthflow_user';

  static setTokens(accessToken, refresh, expiresIn, userData) {
    this.token = accessToken;
    this.refreshToken = refresh;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);
    this.user = userData;
    try {
      localStorage.setItem(this.TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_KEY, refresh || '');
      localStorage.setItem(this.EXPIRY_KEY, this.tokenExpiry.toString());
      localStorage.setItem(this.USER_KEY, JSON.stringify(userData || {}));
      console.log('[HealthFlowAPI] Tokens saved successfully');
    } catch (e) {
      console.warn('[HealthFlowAPI] localStorage not available:', e);
    }
  }

  static loadTokens() {
    try {
      this.token = localStorage.getItem(this.TOKEN_KEY);
      this.refreshToken = localStorage.getItem(this.REFRESH_KEY);
      this.tokenExpiry = parseInt(localStorage.getItem(this.EXPIRY_KEY) || '0');
      const userData = localStorage.getItem(this.USER_KEY);
      this.user = userData ? JSON.parse(userData) : null;
      console.log('[HealthFlowAPI] Tokens loaded, authenticated:', this.isAuthenticated());
    } catch (e) {
      console.warn('[HealthFlowAPI] Error loading tokens:', e);
      this.token = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      this.user = null;
    }
  }

  static clearTokens() {
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.user = null;
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_KEY);
      localStorage.removeItem(this.EXPIRY_KEY);
      localStorage.removeItem(this.USER_KEY);
      console.log('[HealthFlowAPI] Tokens cleared');
    } catch (e) {
      console.warn('[HealthFlowAPI] Error clearing tokens:', e);
    }
  }

  static isAuthenticated() {
    const hasToken = !!this.token;
    const notExpired = this.tokenExpiry && Date.now() < this.tokenExpiry;
    const isAuth = hasToken && notExpired;
    console.log('[HealthFlowAPI] Auth check:', { hasToken, notExpired, isAuth });
    return isAuth;
  }

  // Check if token is expired and refresh if needed
  static async ensureValidToken() {
    if (!this.token || !this.tokenExpiry) {
      return; // No token to refresh
    }
    
    // Check if token expires in less than 5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    const timeUntilExpiry = this.tokenExpiry - Date.now();
    
    if (timeUntilExpiry < fiveMinutes && this.refreshToken) {
      console.log('[HealthFlowAPI] Token expiring soon, refreshing...');
      try {
        await this.refreshAuthToken();
      } catch (error) {
        console.error('[HealthFlowAPI] Token refresh failed:', error);
        // Clear tokens and force re-login
        this.clearTokens();
        throw new Error('Session expired. Please log in again.');
      }
    }
  }
  
  // Refresh the authentication token using refresh token
  static async refreshAuthToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const url = `${API_CONFIG.DIRECT_AUTH_BASE}/refresh`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: this.refreshToken
      })
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    
    const data = await response.json();
    this.setTokens(data.access_token, data.refresh_token || this.refreshToken, data.expires_in || 900, this.user);
    console.log('[HealthFlowAPI] Token refreshed successfully');
  }

  static async request(url, options = {}) {
    // Ensure token is valid before making request
    await this.ensureValidToken();
    
    console.log('[HealthFlowAPI] Making request to:', url);
    console.log('[HealthFlowAPI] Request options:', { 
      method: options.method || 'GET',
      hasBody: !!options.body,
      hasToken: !!this.token 
    });
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Determine if this is a cross-origin request
    const isCrossOrigin = url.startsWith('http') && !url.includes(window.location.hostname);
    
    const fetchOptions = {
      ...options,
      headers,
      mode: 'cors',
      // Credentials removed to fix CORS issue with backend
    };

    try {
      console.log('[HealthFlowAPI] Fetching with credentials:', fetchOptions.credentials);
      const response = await fetch(url, fetchOptions);
      console.log('[HealthFlowAPI] Response status:', response.status);
      
      const text = await response.text();
      console.log('[HealthFlowAPI] Response body (raw):', text.substring(0, 500));
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[HealthFlowAPI] Failed to parse JSON:', parseError);
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        console.error('[HealthFlowAPI] Request failed:', data);
        
        // Enhanced error handling for validation errors (v2.7.0)
        if (response.status === 400 && data.errors) {
          // Backend returned field-specific validation errors
          const fieldErrors = Object.entries(data.errors)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join('; ');
          throw new Error(`Validation failed - ${fieldErrors}`);
        } else if (response.status === 400 && data.details) {
          // Alternative error format
          throw new Error(`Validation failed - ${JSON.stringify(data.details)}`);
        }
        
        const errorMsg = data.error || data.message || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      console.log('[HealthFlowAPI] Request successful:', data);
      return data;
    } catch (error) {
      console.error('[HealthFlowAPI] Request error:', error);
      console.error('[HealthFlowAPI] Error name:', error.name);
      console.error('[HealthFlowAPI] Error message:', error.message);
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  }

  // Authentication
  static async login(email, password) {
    console.log('[HealthFlowAPI] ========== LOGIN ATTEMPT ==========');
    console.log('[HealthFlowAPI] Email:', email);
    console.log('[HealthFlowAPI] Auth URL (proxy):', API_CONFIG.AUTH_BASE);
    console.log('[HealthFlowAPI] Auth URL (direct):', API_CONFIG.DIRECT_AUTH_BASE);
    
    const body = JSON.stringify({ email, password });
    
    // Try direct URL first (more reliable for cross-origin)
    const urlsToTry = [
      { url: `${API_CONFIG.DIRECT_AUTH_BASE}/login`, label: 'direct' },
      { url: `${API_CONFIG.AUTH_BASE}/login`, label: 'proxy' },
    ];
    
    let lastError = null;
    
    for (const { url, label } of urlsToTry) {
      console.log(`[HealthFlowAPI] Trying ${label} URL:`, url);
      
      try {
        const data = await this.request(url, {
          method: 'POST',
          body: body,
        });

        console.log(`[HealthFlowAPI] Login response (${label}):`, data);
        
        if (data.access_token) {
          console.log(`[HealthFlowAPI] Login successful via ${label} URL`);
          this.setTokens(data.access_token, data.refresh_token, data.expires_in || 900, data.user);
          return data;
        }
        
        // Response OK but no token
        lastError = new Error(data.error || data.message || 'Login failed - no access token received');
        console.error(`[HealthFlowAPI] ${label} login - no token:`, lastError.message);
        
      } catch (error) {
        console.error(`[HealthFlowAPI] ${label} login error:`, error.message);
        lastError = error;
        // Continue to next URL
      }
    }
    
    // All URLs failed
    console.error('[HealthFlowAPI] All login attempts failed');
    throw lastError || new Error('Login failed - unable to connect to authentication server');
  }

  // Medicine Directory
  static async searchMedicines(query, limit = 30) {
    console.log('[HealthFlowAPI] searchMedicines called with query:', query, 'limit:', limit);
    
    if (!query || query.length < 2) {
      console.log('[HealthFlowAPI] Query too short, returning empty');
      return { success: true, data: [], total: 0 };
    }
    
    const url = `${API_CONFIG.PRESCRIPTION_BASE}/medicines/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    console.log('[HealthFlowAPI] Medicine search URL:', url);
    
    try {
      const result = await this.request(url);
      console.log('[HealthFlowAPI] Medicine search result:', result);
      return result;
    } catch (error) {
      console.error('[HealthFlowAPI] Medicine search failed:', error);
      
      // Try direct URL if proxy failed
      if (API_CONFIG.PRESCRIPTION_BASE !== API_CONFIG.DIRECT_PRESCRIPTION_BASE) {
        console.log('[HealthFlowAPI] Trying direct prescription URL...');
        const directUrl = `${API_CONFIG.DIRECT_PRESCRIPTION_BASE}/medicines/search?q=${encodeURIComponent(query)}&limit=${limit}`;
        try {
          return await this.request(directUrl);
        } catch (fallbackError) {
          console.error('[HealthFlowAPI] Direct URL also failed:', fallbackError);
        }
      }
      
      throw error;
    }
  }

  static async getMedicine(id) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/medicines/${id}`);
  }

  static async listMedicines(limit = 50, offset = 0) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/medicines?limit=${limit}&offset=${offset}`);
  }

  // Medicine Matching for OCR/Voice Integration
  // Takes extracted medicine names and finds best matches from the National Medicine Directory
  static async matchMedicinesToDirectory(extractedMedicines) {
    console.log('[HealthFlowAPI] matchMedicinesToDirectory called with:', extractedMedicines);
    
    const matchedMedicines = [];
    
    for (const med of extractedMedicines) {
      const medicineName = med.medicineName || med;
      console.log('[HealthFlowAPI] Matching medicine:', medicineName);
      
      if (!medicineName || medicineName.length < 2) {
        matchedMedicines.push({
          ...med,
          drugId: '',
          matchStatus: 'skipped',
          matchConfidence: 0,
        });
        continue;
      }
      
      try {
        // Extract key words from the medicine name for better matching
        // Remove common words and get the main drug name
        const searchTerms = medicineName
          .replace(/\d+\s*(mg|ml|mcg|g|tab|tablets?|caps?|capsules?|syrup|injection|inj)/gi, '')
          .replace(/[^\w\s]/g, '')
          .trim()
          .split(/\s+/)
          .filter(word => word.length >= 3)
          .slice(0, 2); // Take first 2 significant words
        
        const searchQuery = searchTerms.join(' ') || medicineName.substring(0, 10);
        console.log('[HealthFlowAPI] Searching for:', searchQuery);
        
        const result = await this.searchMedicines(searchQuery, 10);
        
        if (result.success && result.data && result.data.length > 0) {
          // Find best match using string similarity
          const bestMatch = this.findBestMatch(medicineName, result.data);
          
          console.log('[HealthFlowAPI] Best match found:', bestMatch);
          
          matchedMedicines.push({
            medicineId: generateUUID(),
            medicineName: bestMatch.medicine.commercialName,
            drugId: bestMatch.medicine.id,
            originalName: medicineName,
            matchStatus: 'matched',
            matchConfidence: bestMatch.score,
            dosage: med.dosage || this.extractDosage(bestMatch.medicine.commercialName),
            frequency: med.frequency || 'Once daily',
            duration: med.duration || '30 days',
            quantity: med.quantity || 30,
          });
        } else {
          // No match found - keep original name without drugId
          console.log('[HealthFlowAPI] No match found for:', medicineName);
          matchedMedicines.push({
            medicineId: generateUUID(),
            medicineName: medicineName,
            drugId: '',
            originalName: medicineName,
            matchStatus: 'not_found',
            matchConfidence: 0,
            dosage: med.dosage || '',
            frequency: med.frequency || 'Once daily',
            duration: med.duration || '30 days',
            quantity: med.quantity || 30,
          });
        }
      } catch (error) {
        console.error('[HealthFlowAPI] Error matching medicine:', medicineName, error);
        matchedMedicines.push({
          medicineId: generateUUID(),
          medicineName: medicineName,
          drugId: '',
          originalName: medicineName,
          matchStatus: 'error',
          matchConfidence: 0,
          dosage: med.dosage || '',
          frequency: med.frequency || 'Once daily',
          duration: med.duration || '30 days',
          quantity: med.quantity || 30,
        });
      }
    }
    
    console.log('[HealthFlowAPI] Matching complete:', matchedMedicines);
    return matchedMedicines;
  }

  // Find best match using string similarity scoring
  static findBestMatch(searchTerm, medicines) {
    const searchLower = searchTerm.toLowerCase().replace(/[^\w]/g, '');
    
    let bestMatch = { medicine: medicines[0], score: 0 };
    
    for (const medicine of medicines) {
      const nameLower = medicine.commercialName.toLowerCase().replace(/[^\w]/g, '');
      const searchNameLower = (medicine.searchName || '').toLowerCase().replace(/[^\w]/g, '');
      
      // Calculate similarity scores
      let score = 0;
      
      // Exact match
      if (nameLower === searchLower || searchNameLower === searchLower) {
        score = 100;
      }
      // Starts with
      else if (nameLower.startsWith(searchLower) || searchLower.startsWith(nameLower)) {
        score = 90;
      }
      // Contains
      else if (nameLower.includes(searchLower) || searchLower.includes(nameLower)) {
        score = 70;
      }
      // Word match
      else {
        const searchWords = searchLower.split(/\s+/);
        const nameWords = nameLower.split(/\s+/);
        const matchingWords = searchWords.filter(sw => 
          nameWords.some(nw => nw.includes(sw) || sw.includes(nw))
        );
        score = (matchingWords.length / Math.max(searchWords.length, 1)) * 60;
      }
      
      if (score > bestMatch.score) {
        bestMatch = { medicine, score };
      }
    }
    
    return bestMatch;
  }

  // Extract dosage from medicine name (e.g., "Panadol 500mg" → "500mg")
  static extractDosage(medicineName) {
    const dosageMatch = medicineName.match(/(\d+\s*(mg|ml|mcg|g|iu|unit)s?)/i);
    return dosageMatch ? dosageMatch[1] : '';
  }

  // Prescriptions
  static async createPrescription(prescriptionData) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/prescriptions`, {
      method: 'POST',
      body: JSON.stringify(prescriptionData),
    });
  }

  static async getPrescription(id) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/prescriptions/${id}`);
  }

  static async listPrescriptions(limit = 50, offset = 0) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/prescriptions?limit=${limit}&offset=${offset}`);
  }

  static async updatePrescriptionStatus(id, status, reason = null) {
    const body = { status };
    if (reason) body.reason = reason;
    
    // v8.0: Use PUT method (not PATCH)
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/prescriptions/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  static async getPrescriptionHistory(id) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/prescriptions/${id}/history`);
  }

  static async searchByRxNumber(rxNumber) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/prescriptions/search/number/${encodeURIComponent(rxNumber)}`);
  }

  static async searchByNationalId(nationalId) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/prescriptions/search/national-id/${encodeURIComponent(nationalId)}`);
  }

  static async deletePrescription(id) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/prescriptions/${id}`, {
      method: 'DELETE',
    });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateShort = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-EG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ============================================================================
// PDF GENERATION UTILITY - Prescription PDF Generator
// Prepared for ITIDA digital signature integration
// ============================================================================

const PrescriptionPDFGenerator = {
  // Color scheme matching HealthFlow branding
  colors: {
    primary: '#0066CC',
    primaryDark: '#004C99',
    text: '#1F2937',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    background: '#F9FAFB',
    success: '#059669',
  },

  // Generate QR code as data URL
  async generateQRCode(text) {
    try {
      return await QRCode.toDataURL(text, {
        width: 100,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
    } catch (err) {
      console.error('QR Code generation failed:', err);
      return null;
    }
  },

  // Format date for PDF display
  formatPDFDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  },

  // Draw a horizontal line
  drawLine(doc, y, startX = 20, endX = 190) {
    doc.setDrawColor(229, 231, 235); // #E5E7EB
    doc.setLineWidth(0.5);
    doc.line(startX, y, endX, y);
  },

  // Draw section header
  drawSectionHeader(doc, title, y) {
    doc.setFillColor(249, 250, 251); // #F9FAFB
    doc.rect(20, y, 170, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55); // #1F2937
    doc.text(title, 25, y + 5.5);
    return y + 12;
  },

  // Main PDF generation function
  async generatePDF(prescription, options = {}) {
    console.log('[PDF] Generating prescription PDF for:', prescription.prescriptionNumber);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    let y = margin;

    // ========== HEADER ==========
    // Logo placeholder (left side)
    doc.setFillColor(0, 102, 204); // #0066CC
    doc.roundedRect(margin, y, 40, 15, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('HEALTHFLOW', margin + 4, y + 7);
    doc.setFontSize(6);
    doc.text('Digital Health', margin + 4, y + 11);

    // Ministry badge (right side)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128); // #6B7280
    doc.text('Ministry of Health & Population', pageWidth - margin, y + 4, { align: 'right' });
    doc.text('Arab Republic of Egypt', pageWidth - margin, y + 9, { align: 'right' });
    
    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 102, 204);
    doc.text('DIGITAL PRESCRIPTION', pageWidth - margin, y + 15, { align: 'right' });

    y += 25;
    this.drawLine(doc, y);
    y += 8;

    // ========== PRESCRIPTION INFO ==========
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(`Prescription ID: ${prescription.prescriptionNumber || prescription.id || 'N/A'}`, margin, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Date: ${this.formatPDFDate(prescription.prescriptionDate)}`, pageWidth - margin, y, { align: 'right' });
    
    y += 5;
    
    // Status badge
    const status = prescription.status || 'draft';
    const statusColors = {
      draft: [107, 114, 128],
      approved: [5, 150, 105],
      dispensed: [59, 130, 246],
      cancelled: [239, 68, 68],
      rejected: [239, 68, 68],
    };
    const statusColor = statusColors[status] || statusColors.draft;
    
    doc.setFillColor(...statusColor);
    doc.roundedRect(margin, y, 25, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(status.toUpperCase(), margin + 12.5, y + 4, { align: 'center' });

    y += 15;

    // ========== PATIENT INFORMATION ==========
    y = this.drawSectionHeader(doc, 'PATIENT INFORMATION', y);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text(prescription.patientName || 'N/A', margin, y + 5);
    
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    
    const patientInfo = [];
    // Support multiple data structures for National ID
    const nationalId = prescription.patient?.nationalId || prescription.patientNationalId || prescription.patient?.national_id;
    if (nationalId) {
      patientInfo.push(`National ID: ${nationalId}`);
    }
    if (prescription.patient?.age) {
      patientInfo.push(`Age: ${prescription.patient.age} years`);
    }
    if (prescription.patient?.gender) {
      patientInfo.push(`Gender: ${prescription.patient.gender.charAt(0).toUpperCase() + prescription.patient.gender.slice(1)}`);
    }
    
    if (patientInfo.length > 0) {
      doc.text(patientInfo.join('   |   '), margin, y + 3);
      y += 8;
    }

    y += 8;

    // ========== DIAGNOSIS ==========
    if (prescription.diagnosis) {
      y = this.drawSectionHeader(doc, 'DIAGNOSIS', y);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      
      // Handle long diagnosis text with word wrap
      const diagnosisLines = doc.splitTextToSize(prescription.diagnosis, 160);
      doc.text(diagnosisLines, margin, y + 5);
      y += 5 + (diagnosisLines.length * 5);
      
      // ICD code if available
      if (prescription.icdCode) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(`ICD-10: ${prescription.icdCode}`, margin, y + 3);
        y += 7;
      }
      
      y += 8;
    }

    // ========== MEDICATIONS ==========
    y = this.drawSectionHeader(doc, `MEDICATIONS (${prescription.medications?.length || 0})`, y);
    
    if (prescription.medications && prescription.medications.length > 0) {
      prescription.medications.forEach((med, index) => {
        // Check if we need a new page
        if (y > pageHeight - 60) {
          doc.addPage();
          y = margin;
        }

        // Medication card background
        doc.setFillColor(248, 250, 252); // Light blue-gray
        doc.roundedRect(margin, y, 170, 32, 2, 2, 'F');
        
        // Medication number badge
        doc.setFillColor(0, 102, 204);
        doc.circle(margin + 6, y + 6, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(String(index + 1), margin + 6, y + 7.5, { align: 'center' });

        // Medicine name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(31, 41, 55);
        doc.text(med.medicineName || 'Unknown Medicine', margin + 14, y + 7);
        
        // Drug ID if available
        if (med.drugId) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(0, 102, 204);
          doc.text(`Drug ID: ${med.drugId}`, margin + 14, y + 12);
        }

        // Medication details in grid
        const detailsY = y + 18;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        
        // Row 1
        doc.text(`Dosage: ${med.dosage || '-'}`, margin + 5, detailsY);
        doc.text(`Frequency: ${med.frequency || '-'}`, margin + 55, detailsY);
        doc.text(`Duration: ${med.duration || '-'}`, margin + 110, detailsY);
        
        // Row 2
        doc.text(`Quantity: ${med.quantity || '-'}`, margin + 5, detailsY + 6);
        if (med.instructions) {
          const instructionText = `Instructions: ${med.instructions}`;
          const truncated = instructionText.length > 60 ? instructionText.substring(0, 57) + '...' : instructionText;
          doc.text(truncated, margin + 55, detailsY + 6);
        }

        // Quantity badge (right side)
        doc.setFillColor(0, 102, 204);
        doc.roundedRect(pageWidth - margin - 25, y + 3, 20, 8, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`Qty: ${med.quantity || '-'}`, pageWidth - margin - 15, y + 8.5, { align: 'center' });

        y += 38;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text('No medications prescribed', margin, y + 5);
      y += 12;
    }

    // Check if we need a new page for footer
    if (y > pageHeight - 80) {
      doc.addPage();
      y = margin;
    }

    y += 5;

    // ========== DOCTOR INFORMATION ==========
    y = this.drawSectionHeader(doc, 'PRESCRIBING PHYSICIAN', y);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(prescription.doctorName || 'N/A', margin, y + 5);
    
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    
    const doctorInfo = [];
    if (prescription.doctor?.license) {
      doctorInfo.push(`License: ${prescription.doctor.license}`);
    }
    if (prescription.doctor?.specialty) {
      doctorInfo.push(`Specialty: ${prescription.doctor.specialty}`);
    }
    
    if (doctorInfo.length > 0) {
      doc.text(doctorInfo.join('   |   '), margin, y + 3);
    }

    // Signature placeholder
    y += 15;
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, y + 15, margin + 60, y + 15);
    doc.setLineDashPattern([], 0);
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Digital Signature', margin, y + 20);
    
    // ITIDA placeholder text
    doc.setFontSize(7);
    doc.text('ITIDA Certified • Pending Signature', margin, y + 25);

    // ========== VERIFICATION QR CODE ==========
    const qrY = y;
    const verificationUrl = `https://verify.healthflow.gov.eg/${prescription.prescriptionNumber || 'N/A'}`;
    
    // QR Code (right side)
    const qrDataUrl = await this.generateQRCode(verificationUrl);
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 30, qrY, 25, 25);
    }
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text('Scan to verify', pageWidth - margin - 17.5, qrY + 28, { align: 'center' });

    // ========== FOOTER ==========
    y = pageHeight - 25;
    this.drawLine(doc, y);
    
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('This is an electronically generated prescription from the HealthFlow Digital Health Platform.', pageWidth / 2, y, { align: 'center' });
    doc.text(`Verification: ${verificationUrl}`, pageWidth / 2, y + 4, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString('en-EG')} | Document ID: ${prescription.id || 'N/A'}`, pageWidth / 2, y + 8, { align: 'center' });

    // Page number
    doc.text(`Page 1 of ${doc.internal.getNumberOfPages()}`, pageWidth - margin, y + 8, { align: 'right' });

    console.log('[PDF] PDF generation complete');
    return doc;
  },

  // Download the PDF
  async downloadPDF(prescription) {
    try {
      const doc = await this.generatePDF(prescription);
      const filename = `prescription-${prescription.prescriptionNumber || 'draft'}.pdf`;
      doc.save(filename);
      console.log('[PDF] Downloaded:', filename);
      return { success: true, filename };
    } catch (err) {
      console.error('[PDF] Download failed:', err);
      return { success: false, error: err.message };
    }
  },

  // Get PDF as blob (for signing)
  async getPDFBlob(prescription) {
    try {
      const doc = await this.generatePDF(prescription);
      const blob = doc.output('blob');
      return { success: true, blob };
    } catch (err) {
      console.error('[PDF] Blob generation failed:', err);
      return { success: false, error: err.message };
    }
  },

  // Get PDF as base64 (for ITIDA signing)
  async getPDFBase64(prescription) {
    try {
      const doc = await this.generatePDF(prescription);
      const base64 = doc.output('datauristring');
      return { success: true, base64 };
    } catch (err) {
      console.error('[PDF] Base64 generation failed:', err);
      return { success: false, error: err.message };
    }
  },
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

const Icons = {
  Pulse: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  User: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Pill: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
      <path d="m8.5 8.5 7 7"/>
    </svg>
  ),
  FileText: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  Download: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Printer: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  Signature: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17c3.333-2 5-4 5-6 0-1.5-1-2-2-2s-2 1-2 2c0 3 4 5 7 5 2 0 3-1 3-2" />
      <path d="M17 14c.333-.667.5-1.333.5-2 0-1-.5-2-1.5-2s-2 1-2 2c0 2 2 4 5 4" />
      <line x1="3" y1="22" x2="21" y2="22" />
    </svg>
  ),
  Search: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Plus: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  X: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Logout: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Upload: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Mic: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  MicOff: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  Camera: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Clock: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  AlertCircle: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Trash: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Eye: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Activity: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Stethoscope: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
      <circle cx="20" cy="10" r="2"/>
    </svg>
  ),
  Loader: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" />
    </svg>
  ),
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

// Status Badge Component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { bg: '#F1F5F9', color: '#475569', label: 'Draft', icon: '📝' },
    pending_validation: { bg: '#FEF3C7', color: '#92400E', label: 'Pending', icon: '⏳' },
    approved: { bg: '#D1FAE5', color: '#065F46', label: 'Approved', icon: '✓' },
    rejected: { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected', icon: '✕' },
    dispensed: { bg: '#DBEAFE', color: '#1E40AF', label: 'Dispensed', icon: '💊' },
    cancelled: { bg: '#F3F4F6', color: '#6B7280', label: 'Cancelled', icon: '—' },
    expired: { bg: '#FECACA', color: '#7F1D1D', label: 'Expired', icon: '⚠' },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 14px',
      borderRadius: TOKENS.radius.full,
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: config.bg,
      color: config.color,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
};

// Button Component
const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon: Icon, 
  loading, 
  disabled, 
  onClick, 
  style = {},
  type = 'button',
  ...props 
}) => {
  const variants = {
    primary: {
      background: TOKENS.colors.gradient,
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
    },
    secondary: {
      background: TOKENS.colors.surfaceAlt,
      color: TOKENS.colors.text,
      border: `1px solid ${TOKENS.colors.border}`,
      boxShadow: TOKENS.shadows.sm,
    },
    success: {
      background: TOKENS.colors.success,
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
    },
    danger: {
      background: '#FEE2E2',
      color: TOKENS.colors.error,
      border: 'none',
      boxShadow: 'none',
    },
    ghost: {
      background: 'transparent',
      color: TOKENS.colors.primary,
      border: 'none',
      boxShadow: 'none',
    },
  };

  const sizes = {
    sm: { padding: '8px 16px', fontSize: '13px' },
    md: { padding: '12px 24px', fontSize: '14px' },
    lg: { padding: '16px 32px', fontSize: '16px' },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        borderRadius: TOKENS.radius.md,
        fontWeight: '600',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled || loading ? 0.6 : 1,
        fontFamily: 'inherit',
        ...variants[variant],
        ...sizes[size],
        ...style,
      }}
      {...props}
    >
      {loading ? <Icons.Loader size={18} /> : Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

// Input Component
const Input = ({ label, error, icon: Icon, style = {}, containerStyle = {}, ...props }) => (
  <div style={{ marginBottom: '16px', ...containerStyle }}>
    {label && (
      <label style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: '600',
        color: TOKENS.colors.textMuted,
        marginBottom: '8px',
      }}>
        {label}
      </label>
    )}
    <div style={{ position: 'relative' }}>
      {Icon && (
        <div style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: TOKENS.colors.textMuted,
        }}>
          <Icon size={18} />
        </div>
      )}
      <input
        style={{
          width: '100%',
          padding: Icon ? '12px 16px 12px 44px' : '12px 16px',
          fontSize: '14px',
          border: `2px solid ${error ? TOKENS.colors.error : TOKENS.colors.border}`,
          borderRadius: TOKENS.radius.md,
          outline: 'none',
          transition: 'all 0.2s',
          boxSizing: 'border-box',
          backgroundColor: TOKENS.colors.surface,
          fontFamily: 'inherit',
          ...style,
        }}
        onFocus={(e) => e.target.style.borderColor = TOKENS.colors.primary}
        onBlur={(e) => e.target.style.borderColor = error ? TOKENS.colors.error : TOKENS.colors.border}
        {...props}
      />
    </div>
    {error && (
      <p style={{ color: TOKENS.colors.error, fontSize: '12px', marginTop: '6px', margin: '6px 0 0' }}>
        {error}
      </p>
    )}
  </div>
);

// Card Component
const Card = ({ children, style = {}, hover = false, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: TOKENS.colors.surface,
      borderRadius: TOKENS.radius.lg,
      boxShadow: TOKENS.shadows.md,
      overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s ease',
      ...(hover && { ':hover': { transform: 'translateY(-2px)', boxShadow: TOKENS.shadows.lg } }),
      ...style,
    }}
  >
    {children}
  </div>
);

// Modal Component
const Modal = ({ isOpen, onClose, title, children, maxWidth = '600px' }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: TOKENS.colors.surface,
        borderRadius: TOKENS.radius.xl,
        width: '100%',
        maxWidth,
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: TOKENS.shadows.xl,
        animation: 'slideUp 0.3s ease',
      }}>
        <div style={{
          padding: '24px',
          borderBottom: `1px solid ${TOKENS.colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: TOKENS.colors.text }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              background: TOKENS.colors.surfaceAlt,
              border: 'none',
              borderRadius: TOKENS.radius.md,
              cursor: 'pointer',
              color: TOKENS.colors.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icons.X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LOGIN PAGE COMPONENT
// ============================================================================

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  const handleSubmit = async (e) => {
    console.log('[LoginPage] ========== FORM SUBMITTED ==========');
    console.log('[LoginPage] Event:', e);
    console.log('[LoginPage] Form values:', { email, password: password ? '***' : '(empty)' });
    
    e.preventDefault();
    
    // Validate inputs
    if (!email || !email.trim()) {
      console.error('[LoginPage] Email is empty');
      setError('Please enter your email address');
      return;
    }
    
    if (!password || !password.trim()) {
      console.error('[LoginPage] Password is empty');
      setError('Please enter your password');
      return;
    }
    
    setLoading(true);
    setError('');
    setDebugInfo('Attempting login...');

    try {
      console.log('[LoginPage] Calling HealthFlowAPI.login...');
      const result = await HealthFlowAPI.login(email.trim(), password);
      console.log('[LoginPage] Login result:', result);
      
      setDebugInfo('Login successful! Redirecting...');
      
      // Small delay to show success message
      setTimeout(() => {
        onLogin(result.user || { email: email.trim() });
      }, 500);
      
    } catch (err) {
      console.error('[LoginPage] Login error:', err);
      console.error('[LoginPage] Error stack:', err.stack);
      
      const errorMessage = err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      setDebugInfo(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Debug: Log state changes
  useEffect(() => {
    console.log('[LoginPage] State updated:', { email, password: password ? '***' : '', loading, error });
  }, [email, password, loading, error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: `linear-gradient(135deg, ${TOKENS.colors.primaryDark} 0%, #0891B2 50%, #0369A1 100%)`,
    }}>
      {/* Left Side - Branding */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative Elements */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          left: '-100px',
          width: '400px',
          height: '400px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-150px',
          right: '-150px',
          width: '500px',
          height: '500px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '50%',
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: TOKENS.radius.xl,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px',
            backdropFilter: 'blur(10px)',
          }}>
            <Icons.Pulse size={40} color="white" />
          </div>
          
          <h1 style={{
            fontSize: '48px',
            fontWeight: '800',
            color: 'white',
            margin: '0 0 16px',
            lineHeight: 1.1,
          }}>
            HealthFlow<br/>
            <span style={{ opacity: 0.8, fontWeight: '400' }}>Clinic Portal</span>
          </h1>
          
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.8)',
            maxWidth: '400px',
            lineHeight: 1.6,
            margin: 0,
          }}>
            Egypt's Digital Prescription Infrastructure. Manage prescriptions, 
            access the National Medicine Directory, and streamline patient care.
          </p>
          
          <div style={{
            display: 'flex',
            gap: '24px',
            marginTop: '48px',
          }}>
            {[
              { icon: Icons.FileText, label: '575K+ Daily Rx' },
              { icon: Icons.Pill, label: '47,292 Medicines' },
              { icon: Icons.User, label: '105M Citizens' },
            ].map((stat, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: TOKENS.radius.md,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <stat.icon size={22} color="rgba(255,255,255,0.9)" />
                </div>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500' }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div style={{
        width: '500px',
        background: TOKENS.colors.surface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px',
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: TOKENS.colors.text,
            margin: '0 0 8px',
          }}>
            Welcome back
          </h2>
          <p style={{
            fontSize: '15px',
            color: TOKENS.colors.textMuted,
            margin: '0 0 32px',
          }}>
            Sign in to access your clinic portal
          </p>

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: TOKENS.radius.md,
                padding: '14px 16px',
                marginBottom: '24px',
                color: TOKENS.colors.error,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <Icons.AlertCircle size={20} />
                {error}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@clinic.com"
              required
              icon={Icons.User}
              containerStyle={{ marginBottom: '20px' }}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              containerStyle={{ marginBottom: '28px' }}
            />

            <Button
              type="submit"
              loading={loading}
              style={{ width: '100%' }}
              size="lg"
            >
              Sign In
            </Button>
          </form>

          <div style={{
            marginTop: '32px',
            padding: '20px',
            background: `linear-gradient(135deg, ${TOKENS.colors.primaryLight}15 0%, ${TOKENS.colors.primary}10 100%)`,
            borderRadius: TOKENS.radius.lg,
            border: `1px solid ${TOKENS.colors.primary}20`,
          }}>
            <p style={{ fontSize: '13px', color: TOKENS.colors.primary, margin: '0 0 10px', fontWeight: '600' }}>
              🔑 Test Credentials
            </p>
            <code style={{
              display: 'block',
              fontSize: '12px',
              color: TOKENS.colors.primaryDark,
              fontFamily: 'monospace',
              lineHeight: 1.8,
            }}>
              pharmacy.integration@healthflow.gov.eg<br/>
              Pharmacy@2025
            </code>
          </div>

          {/* Debug Info Panel */}
          {debugInfo && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#F0F9FF',
              borderRadius: TOKENS.radius.md,
              border: '1px solid #BAE6FD',
            }}>
              <p style={{ fontSize: '12px', color: '#0369A1', margin: 0, fontFamily: 'monospace' }}>
                {debugInfo}
              </p>
            </div>
          )}

          {/* API Config Display */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#F8FAFC',
            borderRadius: TOKENS.radius.md,
            border: '1px solid #E2E8F0',
          }}>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 4px', fontWeight: '600' }}>
              API Configuration:
            </p>
            <code style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              Auth: {API_CONFIG.AUTH_BASE}<br/>
              Prescription: {API_CONFIG.PRESCRIPTION_BASE}
            </code>
            <button
              type="button"
              onClick={async () => {
                setDebugInfo('Testing API connection...');
                try {
                  // Test with a simple fetch
                  const testUrl = `${API_CONFIG.AUTH_BASE}/login`;
                  console.log('[LoginPage] Testing API at:', testUrl);
                  
                  const response = await fetch(testUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
                  });
                  
                  const text = await response.text();
                  console.log('[LoginPage] Test response status:', response.status);
                  console.log('[LoginPage] Test response:', text);
                  
                  setDebugInfo(`API responded: ${response.status} - ${text.substring(0, 100)}`);
                } catch (testError) {
                  console.error('[LoginPage] API test failed:', testError);
                  setDebugInfo(`API test failed: ${testError.message}`);
                }
              }}
              style={{
                marginTop: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                background: '#E2E8F0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Test API Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MEDICINE AUTOCOMPLETE COMPONENT - v2.3.0 (useEffect pattern)
// ============================================================================

const MedicineAutocomplete = ({ value, onChange, onSelect, disabled }) => {
  const [query, setQuery] = useState(value?.commercialName || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [lastSearched, setLastSearched] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // v2.3.0: Use useEffect for debounced search - avoids closure issues
  useEffect(() => {
    // Don't search if query is too short
    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Don't search if we just searched this exact query
    if (query === lastSearched) {
      return;
    }

    console.log('[MedicineAutocomplete v2.3] useEffect triggered, query:', query);
    
    // Set loading immediately
    setLoading(true);
    setSearchError('');

    // Debounce timer
    const timeoutId = setTimeout(async () => {
      console.log('[MedicineAutocomplete v2.3] Executing search for:', query);
      
      try {
        const response = await HealthFlowAPI.searchMedicines(query);
        console.log('[MedicineAutocomplete v2.3] API response:', response);
        
        // Only update if this is still the current query
        if (inputRef.current && inputRef.current.value === query) {
          if (response.success) {
            console.log('[MedicineAutocomplete v2.3] Found', response.data?.length || 0, 'results');
            setResults(response.data || []);
            setLastSearched(query);
          } else {
            console.error('[MedicineAutocomplete v2.3] API error:', response);
            setResults([]);
            setSearchError(response.error || 'Search failed');
          }
        }
      } catch (err) {
        console.error('[MedicineAutocomplete v2.3] Search error:', err);
        if (inputRef.current && inputRef.current.value === query) {
          setResults([]);
          setSearchError(err.message || 'Search failed');
        }
      } finally {
        if (inputRef.current && inputRef.current.value === query) {
          setLoading(false);
        }
      }
    }, 300);

    // Cleanup: cancel timeout if query changes before it fires
    return () => {
      console.log('[MedicineAutocomplete v2.3] Cleanup - clearing timeout');
      clearTimeout(timeoutId);
    };
  }, [query, lastSearched]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    console.log('[MedicineAutocomplete v2.3] Input changed to:', newValue);
    setQuery(newValue);
    onChange(newValue);
    setShowDropdown(true);
  };

  const handleSelect = (medicine) => {
    console.log('[MedicineAutocomplete v2.3] Medicine selected:', medicine);
    setQuery(medicine.commercialName);
    setLastSearched(medicine.commercialName); // Prevent re-search
    setShowDropdown(false);
    setResults([]);
    onSelect(medicine);
  };

  const handleFocus = () => {
    console.log('[MedicineAutocomplete v2.3] Input focused, query:', query);
    setShowDropdown(true);
  };

  // Manual search button for debugging
  const handleManualSearch = async () => {
    if (!query || query.length < 2) {
      setSearchError('Enter at least 2 characters');
      return;
    }
    
    console.log('[MedicineAutocomplete v2.3] Manual search triggered for:', query);
    setLoading(true);
    setSearchError('');
    
    try {
      const response = await HealthFlowAPI.searchMedicines(query);
      console.log('[MedicineAutocomplete v2.3] Manual search response:', response);
      
      if (response.success) {
        setResults(response.data || []);
        setLastSearched(query);
        setShowDropdown(true);
      } else {
        setSearchError(response.error || 'Search failed');
      }
    } catch (err) {
      console.error('[MedicineAutocomplete v2.3] Manual search error:', err);
      setSearchError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}>
            <Icons.Search size={18} color={TOKENS.colors.textMuted} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            placeholder="Search National Medicine Directory..."
            disabled={disabled}
            style={{
              width: '100%',
              padding: '12px 16px 12px 44px',
              fontSize: '14px',
              border: `2px solid ${loading ? TOKENS.colors.primary : TOKENS.colors.border}`,
              borderRadius: TOKENS.radius.md,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.2s',
              backgroundColor: disabled ? TOKENS.colors.surfaceAlt : TOKENS.colors.surface,
              fontFamily: 'inherit',
            }}
          />
          {loading && (
            <div style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}>
              <Icons.Loader size={18} color={TOKENS.colors.primary} />
            </div>
          )}
        </div>
        
        {/* Manual search button for debugging */}
        <button
          type="button"
          onClick={handleManualSearch}
          disabled={disabled || loading || !query || query.length < 2}
          style={{
            padding: '12px 16px',
            background: TOKENS.colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: TOKENS.radius.md,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            opacity: (disabled || loading || !query || query.length < 2) ? 0.5 : 1,
          }}
        >
          🔍
        </button>
      </div>
      
      {/* Status indicator */}
      <div style={{ 
        fontSize: '11px', 
        color: TOKENS.colors.textMuted, 
        marginTop: '4px',
        display: 'flex',
        gap: '12px',
      }}>
        <span>Query: "{query}" ({query.length} chars)</span>
        <span>Loading: {loading ? 'Yes' : 'No'}</span>
        <span>Results: {results.length}</span>
      </div>
      
      {/* Dropdown for results, loading, or errors */}
      {showDropdown && (query.length >= 2 || results.length > 0 || searchError) && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 24px)',
          left: 0,
          right: 0,
          background: TOKENS.colors.surface,
          border: `1px solid ${TOKENS.colors.border}`,
          borderRadius: TOKENS.radius.lg,
          marginTop: '8px',
          maxHeight: '280px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: TOKENS.shadows.lg,
        }}>
          {/* Loading state */}
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Icons.Loader size={24} color={TOKENS.colors.primary} />
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: TOKENS.colors.textMuted }}>
                Searching medicines for "{query}"...
              </p>
            </div>
          )}
          
          {/* Error state */}
          {!loading && searchError && (
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <Icons.AlertCircle size={24} color={TOKENS.colors.error} />
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: TOKENS.colors.error }}>
                {searchError}
              </p>
              <button
                onClick={handleManualSearch}
                style={{
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: TOKENS.colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: TOKENS.radius.sm,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Retry Search
              </button>
            </div>
          )}
          
          {/* No results */}
          {!loading && !searchError && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', color: TOKENS.colors.textMuted }}>
                No medicines found for "{query}"
              </p>
            </div>
          )}
          
          {/* Results list */}
          {!loading && results.length > 0 && results.map((medicine) => (
            <div
              key={medicine.id}
              onClick={() => handleSelect(medicine)}
              style={{
                padding: '14px 18px',
                cursor: 'pointer',
                borderBottom: `1px solid ${TOKENS.colors.border}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = TOKENS.colors.surfaceAlt}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: '600', color: TOKENS.colors.text, fontSize: '14px' }}>
                {medicine.commercialName}
              </div>
              <div style={{
                fontSize: '12px',
                color: TOKENS.colors.primary,
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <Icons.Pill size={12} />
                Drug ID: {medicine.id}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// VOICE PRESCRIPTION COMPONENT
// ============================================================================

const VoicePrescription = ({ onTranscript, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en-US'); // en-US or ar-EG
  const recognitionRef = useRef(null);

  // Initialize speech recognition with selected language
  const initRecognition = (lang) => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = lang;

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript);
          onTranscript(finalTranscript, lang);
        }
      };

      recognitionRef.current.onerror = (event) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  };

  useEffect(() => {
    initRecognition(language);
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, onTranscript]);

  const handleLanguageChange = (newLang) => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    setLanguage(newLang);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setError('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div style={{
      background: isListening 
        ? `linear-gradient(135deg, ${TOKENS.colors.error}10 0%, ${TOKENS.colors.error}05 100%)`
        : TOKENS.colors.surfaceAlt,
      borderRadius: TOKENS.radius.lg,
      padding: '20px',
      border: `2px solid ${isListening ? TOKENS.colors.error : TOKENS.colors.border}`,
      transition: 'all 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isListening ? <Icons.Mic size={24} color={TOKENS.colors.error} /> : <Icons.MicOff size={24} color={TOKENS.colors.textMuted} />}
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: TOKENS.colors.text }}>
              Voice Prescription
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: TOKENS.colors.textMuted }}>
              {isListening ? 'Listening... Speak now' : 'Click to start voice input'}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Language Selector */}
          <div style={{ display: 'flex', borderRadius: TOKENS.radius.md, overflow: 'hidden', border: `1px solid ${TOKENS.colors.border}` }}>
            <button
              type="button"
              onClick={() => handleLanguageChange('en-US')}
              disabled={isListening}
              style={{
                padding: '6px 12px',
                border: 'none',
                background: language === 'en-US' ? TOKENS.colors.primary : TOKENS.colors.surface,
                color: language === 'en-US' ? 'white' : TOKENS.colors.text,
                fontSize: '12px',
                fontWeight: '600',
                cursor: isListening ? 'not-allowed' : 'pointer',
                opacity: isListening ? 0.5 : 1,
              }}
            >
              🇺🇸 EN
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('ar-EG')}
              disabled={isListening}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderLeft: `1px solid ${TOKENS.colors.border}`,
                background: language === 'ar-EG' ? TOKENS.colors.primary : TOKENS.colors.surface,
                color: language === 'ar-EG' ? 'white' : TOKENS.colors.text,
                fontSize: '12px',
                fontWeight: '600',
                cursor: isListening ? 'not-allowed' : 'pointer',
                opacity: isListening ? 0.5 : 1,
              }}
            >
              🇪🇬 AR
            </button>
          </div>
          
          <Button
            variant={isListening ? 'danger' : 'secondary'}
            size="sm"
            onClick={toggleListening}
            disabled={disabled}
            icon={isListening ? Icons.MicOff : Icons.Mic}
          >
            {isListening ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>

      {isListening && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
          marginBottom: '16px',
        }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                width: '4px',
                height: '20px',
                background: TOKENS.colors.error,
                borderRadius: '2px',
                animation: `pulse 0.5s ease-in-out ${i * 0.1}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}

      {transcript && (
        <div style={{
          background: TOKENS.colors.surface,
          borderRadius: TOKENS.radius.md,
          padding: '14px',
          marginTop: '12px',
          direction: language === 'ar-EG' ? 'rtl' : 'ltr',
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: TOKENS.colors.text, lineHeight: 1.6 }}>
            {transcript}
          </p>
        </div>
      )}

      {error && (
        <p style={{ color: TOKENS.colors.error, fontSize: '12px', marginTop: '12px', margin: '12px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// OCR UPLOAD COMPONENT
// ============================================================================

const OCRUpload = ({ onExtract, disabled }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [matchingMedicines, setMatchingMedicines] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      setFile(selectedFile);
      setError('');
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const processImage = async () => {
    if (!file) return;
    
    setProcessing(true);
    setError('');
    setStatus('Processing image...');

    try {
      // Step 1: OCR Processing (simulated - would call real OCR API in production)
      // In production, this would be: POST /api/v1/prescriptions/ocr with image data
      setStatus('Extracting text from prescription...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulated OCR extracted data
      const ocrResult = {
        patientName: 'Extracted Patient Name',
        diagnosis: 'Type 2 Diabetes Mellitus',
        rawMedications: [
          { medicineName: 'Januvia 100mg', dosage: '100mg', frequency: 'Once daily', duration: '30 days' },
          { medicineName: 'Metformin 500mg', dosage: '500mg', frequency: 'Twice daily', duration: '30 days' },
        ],
        notes: 'Prescription extracted from uploaded image. Please verify all details.',
      };
      
      console.log('[OCR] Extracted data:', ocrResult);
      
      // Step 2: Match medicines to directory
      setStatus('Matching medicines to directory...');
      setMatchingMedicines(true);
      
      let matchedMedicines = [];
      
      if (ocrResult.rawMedications && ocrResult.rawMedications.length > 0) {
        try {
          matchedMedicines = await HealthFlowAPI.matchMedicinesToDirectory(ocrResult.rawMedications);
          console.log('[OCR] Matched medicines:', matchedMedicines);
          
          // Show match results
          const matchedCount = matchedMedicines.filter(m => m.matchStatus === 'matched').length;
          const totalCount = matchedMedicines.length;
          setStatus(`Matched ${matchedCount}/${totalCount} medicines to directory`);
        } catch (matchError) {
          console.error('[OCR] Medicine matching failed:', matchError);
          // Continue with unmatched medicines
          matchedMedicines = ocrResult.rawMedications.map(med => ({
            medicineId: generateUUID(),
            medicineName: med.medicineName,
            drugId: '',
            dosage: med.dosage || '',
            frequency: med.frequency || 'Once daily',
            duration: med.duration || '30 days',
            quantity: 30,
            matchStatus: 'not_matched',
          }));
        }
      }
      
      // Small delay to show status
      await new Promise(resolve => setTimeout(resolve, 500));

      // Prepare final extracted data with matched medicines
      const extractedData = {
        patientName: ocrResult.patientName,
        diagnosis: ocrResult.diagnosis,
        medications: matchedMedicines,
        notes: ocrResult.notes,
        matchSummary: {
          total: matchedMedicines.length,
          matched: matchedMedicines.filter(m => m.matchStatus === 'matched').length,
          unmatched: matchedMedicines.filter(m => m.matchStatus !== 'matched').length,
        },
      };

      onExtract(extractedData);
      setFile(null);
      setPreview(null);
      setStatus('');
    } catch (err) {
      console.error('[OCR] Processing error:', err);
      setError('Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
      setMatchingMedicines(false);
    }
  };

  return (
    <div style={{
      background: TOKENS.colors.surfaceAlt,
      borderRadius: TOKENS.radius.lg,
      padding: '20px',
      border: `2px dashed ${TOKENS.colors.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Icons.Camera size={24} color={TOKENS.colors.primary} />
        <div>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: TOKENS.colors.text }}>
            Scan Prescription
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: TOKENS.colors.textMuted }}>
            Upload a photo of a handwritten prescription
          </p>
        </div>
      </div>

      {!preview ? (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          style={{
            background: TOKENS.colors.surface,
            border: `2px dashed ${TOKENS.colors.border}`,
            borderRadius: TOKENS.radius.md,
            padding: '40px 20px',
            textAlign: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Icons.Upload size={40} color={TOKENS.colors.textMuted} />
          <p style={{ margin: '16px 0 0', fontSize: '14px', color: TOKENS.colors.textMuted }}>
            Click to upload or drag and drop
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: TOKENS.colors.textMuted }}>
            PNG, JPG up to 10MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div>
          <div style={{
            position: 'relative',
            borderRadius: TOKENS.radius.md,
            overflow: 'hidden',
            marginBottom: '16px',
          }}>
            <img
              src={preview}
              alt="Prescription preview"
              style={{
                width: '100%',
                height: '200px',
                objectFit: 'cover',
              }}
            />
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                width: '32px',
                height: '32px',
                background: 'rgba(0,0,0,0.5)',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icons.X size={16} color="white" />
            </button>
          </div>
          
          <Button
            onClick={processImage}
            loading={processing || matchingMedicines}
            disabled={disabled}
            style={{ width: '100%' }}
          >
            {processing || matchingMedicines ? status || 'Processing...' : 'Extract Prescription Data'}
          </Button>
          
          {status && !error && (processing || matchingMedicines) && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: `${TOKENS.colors.primary}10`,
              borderRadius: TOKENS.radius.md,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: `2px solid ${TOKENS.colors.primary}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <span style={{ fontSize: '13px', color: TOKENS.colors.primary, fontWeight: '500' }}>
                {status}
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p style={{ color: TOKENS.colors.error, fontSize: '12px', marginTop: '12px', margin: '12px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// PRESCRIPTION FORM COMPONENT
// ============================================================================

const PrescriptionForm = ({ onSubmit, onCancel, doctorInfo, initialData }) => {
  const [formData, setFormData] = useState({
    patient: {
      id: initialData?.patient?.id || generateUUID(),
      name: initialData?.patient?.name || '',
      age: initialData?.patient?.age || '',
      gender: initialData?.patient?.gender || 'male',
      nationalId: initialData?.patient?.nationalId || '',
    },
    diagnosis: initialData?.diagnosis || '',
    clinicalNotes: initialData?.clinicalNotes || '',
    medications: initialData?.medications?.length ? initialData.medications.map(med => ({
      medicineId: med.medicineId || generateUUID(),
      medicineName: med.medicineName || '',
      drugId: med.drugId || '',
      medicineGenericName: med.medicineGenericName || '',
      medicineStrength: med.medicineStrength || '',
      medicineForm: med.medicineForm || 'tablet',
      dosage: med.dosage || '',
      frequency: med.frequency || 'Once daily',
      duration: med.duration || '',
      quantity: med.quantity || 1,
      refills: med.refills || 0,
      instructions: med.instructions || '',
      warnings: med.warnings || '',
      substitutionAllowed: med.substitutionAllowed !== false,
      icd: med.icd || '',
    })) : [{
      medicineId: generateUUID(),
      medicineName: '',
      drugId: '',
      medicineGenericName: '',
      medicineStrength: '',
      medicineForm: 'tablet',
      dosage: '',
      frequency: 'Once daily',
      duration: '',
      quantity: 1,
      refills: 0,
      instructions: '',
      warnings: '',
      substitutionAllowed: true,
      icd: '',
    }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeInputMethod, setActiveInputMethod] = useState('manual'); // manual, voice, ocr

  // Validation function for National ID
  const validateNationalId = (value) => {
    if (!value) return '';
    if (!/^\d{14}$/.test(value)) return 'National ID must be exactly 14 digits';
    return '';
  };

  // Auto-calculate quantity based on frequency and duration
  const calculateQuantity = (frequency, duration) => {
    const frequencyMap = {
      'Once daily': 1,
      'Twice daily': 2,
      'Three times daily': 3,
      'Four times daily': 4,
      'Every 4 hours': 6,
      'Every 6 hours': 4,
      'Every 8 hours': 3,
      'Every 12 hours': 2,
      'As needed': 1,
    };
    
    const perDay = frequencyMap[frequency] || 1;
    const days = parseInt(duration) || 0;
    return perDay * days;
  };

  // Auto-update quantity when frequency or duration changes
  React.useEffect(() => {
    formData.medications.forEach((med, index) => {
      if (med.frequency && med.duration) {
        const newQuantity = calculateQuantity(med.frequency, med.duration);
        if (newQuantity > 0 && newQuantity !== parseInt(med.quantity)) {
          updateMedication(index, 'quantity', newQuantity);
        }
      }
    });
  }, [formData.medications.map(m => `${m.frequency}-${m.duration}`).join(',')]);

  const updatePatient = (field, value) => {
    setFormData(prev => ({
      ...prev,
      patient: { ...prev.patient, [field]: value }
    }));
  };

  // Helper function to extract generic name from commercial name
  const extractGenericName = (commercialName) => {
    // Remove dosage, form, and packaging info to get generic name
    return commercialName
      .replace(/\d+\s*(mg|ml|mcg|g|%|iu|units?)\b.*/gi, '') // Remove dosage and everything after
      .replace(/\s+(tab|tablet|cap|capsule|syrup|injection|cream|ointment|drops?|suspension)s?\b.*/gi, '') // Remove form
      .trim();
  };
  
  // Helper function to extract dosage from commercial name
  const extractDosage = (commercialName) => {
    const match = commercialName.match(/(\d+\s*(mg|ml|mcg|g|%|iu|units?))/i);
    return match ? match[1] : '';
  };

  const updateMedication = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) => 
        i === index ? { ...med, [field]: value } : med
      )
    }));
  };

  const handleMedicineSelect = (index, medicine) => {
    updateMedication(index, 'medicineName', medicine.commercialName);
    updateMedication(index, 'drugId', medicine.id);
    
    // v2.7.0: Auto-fill generic name from medicine data
    const genericName = medicine.genericName || medicine.activeIngredient || extractGenericName(medicine.commercialName);
    if (genericName) {
      updateMedication(index, 'medicineGenericName', genericName);
    }
    
    // v2.7.0: Auto-fill dosage from commercial name if not already set
    const currentDosage = formData.medications[index]?.dosage;
    if (!currentDosage) {
      const extractedDosage = extractDosage(medicine.commercialName);
      if (extractedDosage) {
        updateMedication(index, 'dosage', extractedDosage);
      }
    }
  };

  const addMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, {
        medicineId: generateUUID(),
        medicineName: '',
        drugId: '',
        medicineGenericName: '',
        medicineStrength: '',
        medicineForm: 'tablet',
        dosage: '',
        frequency: 'Once daily',
        duration: '',
        quantity: 1,
        refills: 0,
        instructions: '',
        warnings: '',
        substitutionAllowed: true,
        icd: '',
      }]
    }));
  };

  const removeMedication = (index) => {
    if (formData.medications.length > 1) {
      setFormData(prev => ({
        ...prev,
        medications: prev.medications.filter((_, i) => i !== index)
      }));
    }
  };

  // Helper function to search medicine directory and update form
  const searchAndMatchMedicine = async (medicineName, dosage = '', frequency = 'Once daily', duration = '30 days') => {
    console.log('[Voice] Searching medicine directory for:', medicineName);
    
    try {
      const matchedMedicines = await HealthFlowAPI.matchMedicinesToDirectory([
        { medicineName, dosage, frequency, duration }
      ]);
      
      if (matchedMedicines && matchedMedicines.length > 0) {
        const matched = matchedMedicines[0];
        console.log('[Voice] Medicine matched:', matched);
        
        setFormData(prev => ({
          ...prev,
          medications: [
            ...prev.medications.filter(m => m.medicineName && m.medicineName !== medicineName),
            {
              medicineId: matched.medicineId || generateUUID(),
              medicineName: matched.medicineName,
              drugId: matched.drugId || '',
              medicineGenericName: '',
              medicineStrength: matched.dosage || '',
              medicineForm: 'tablet',
              dosage: matched.dosage || dosage,
              frequency: matched.frequency || frequency,
              duration: matched.duration || duration,
              quantity: matched.quantity || 30,
              refills: 0,
              instructions: '',
              warnings: '',
              substitutionAllowed: true,
              icd: '',
              matchStatus: matched.matchStatus,
              matchConfidence: matched.matchConfidence,
            }
          ]
        }));
        
        return matched;
      }
    } catch (error) {
      console.error('[Voice] Medicine matching failed:', error);
    }
    
    // Fallback: add medicine without drugId
    const fallbackMed = {
      medicineId: generateUUID(),
      medicineName: medicineName,
      drugId: '',
      medicineGenericName: '',
      medicineStrength: '',
      medicineForm: 'tablet',
      dosage: dosage,
      frequency: frequency,
      duration: duration,
      quantity: 30,
      refills: 0,
      instructions: '',
      warnings: '',
      substitutionAllowed: true,
      icd: '',
      matchStatus: 'not_matched',
    };
    
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications.filter(m => m.medicineName), fallbackMed]
    }));
    
    return fallbackMed;
  };

  const handleVoiceTranscript = (transcript, language = 'en-US') => {
    console.log('[Voice] Parsing transcript:', transcript, 'Language:', language);
    const lowerTranscript = transcript.toLowerCase();
    
    // English parsing patterns
    if (language === 'en-US') {
      // Patient name extraction
      if (lowerTranscript.includes('patient name') || lowerTranscript.includes('patient is')) {
        const nameMatch = transcript.match(/patient(?:\s+name)?(?:\s+is)?[:\s]+([^,\.]+)/i);
        if (nameMatch) {
          updatePatient('name', nameMatch[1].trim());
          console.log('[Voice] Extracted patient name:', nameMatch[1].trim());
        }
      }
      
      // National ID extraction
      if (lowerTranscript.includes('national id') || lowerTranscript.includes('id number')) {
        const idMatch = transcript.match(/(?:national\s+)?id(?:\s+number)?[:\s]+(\d+)/i);
        if (idMatch) {
          updatePatient('nationalId', idMatch[1].trim());
          console.log('[Voice] Extracted national ID:', idMatch[1].trim());
        }
      }
      
      // Age extraction
      if (lowerTranscript.includes('age') || lowerTranscript.includes('years old')) {
        const ageMatch = transcript.match(/(?:age[:\s]+)?(\d+)(?:\s+years?\s+old)?/i);
        if (ageMatch) {
          updatePatient('age', ageMatch[1]);
          console.log('[Voice] Extracted age:', ageMatch[1]);
        }
      }
      
      // Diagnosis extraction
      if (lowerTranscript.includes('diagnosis') || lowerTranscript.includes('diagnosed with')) {
        const diagMatch = transcript.match(/diagnos(?:is|ed with)[:\s]+([^,\.]+)/i);
        if (diagMatch) {
          setFormData(prev => ({ ...prev, diagnosis: diagMatch[1].trim() }));
          console.log('[Voice] Extracted diagnosis:', diagMatch[1].trim());
        }
      }
      
      // Medication extraction - enhanced patterns with async directory search
      const medPatterns = [
        /prescribe\s+([a-zA-Z]+(?:\s+\d+(?:mg|ml|mcg|g)?)?)/i,
        /(?:give|take)\s+([a-zA-Z]+(?:\s+\d+(?:mg|ml|mcg|g)?)?)/i,
        /medication[:\s]+([a-zA-Z]+(?:\s+\d+(?:mg|ml|mcg|g)?)?)/i,
      ];
      
      for (const pattern of medPatterns) {
        const medMatch = pattern.exec(transcript);
        if (medMatch) {
          const medicineName = medMatch[1].trim();
          const dosageMatch = transcript.match(/(\d+\s*(?:mg|ml|mcg|g))/i);
          const dosage = dosageMatch ? dosageMatch[1] : '';
          
          // Extract frequency if mentioned
          let frequency = 'Once daily';
          if (lowerTranscript.includes('twice')) frequency = 'Twice daily';
          else if (lowerTranscript.includes('three times')) frequency = 'Three times daily';
          else if (lowerTranscript.includes('every 8 hours')) frequency = 'Every 8 hours';
          else if (lowerTranscript.includes('every 12 hours')) frequency = 'Every 12 hours';
          
          // Extract duration if mentioned
          let duration = '30 days';
          const durationMatch = transcript.match(/(?:for\s+)?(\d+)\s*(days?|weeks?|months?)/i);
          if (durationMatch) {
            duration = `${durationMatch[1]} ${durationMatch[2]}`;
          }
          
          console.log('[Voice] Detected medication:', medicineName, 'dosage:', dosage, 'frequency:', frequency);
          
          // Search medicine directory asynchronously
          searchAndMatchMedicine(medicineName, dosage, frequency, duration);
          
          break; // Process one medication at a time
        }
      }
    }
    
    // Arabic parsing patterns (ar-EG)
    if (language === 'ar-EG') {
      // اسم المريض (Patient name)
      if (lowerTranscript.includes('اسم المريض') || lowerTranscript.includes('المريض')) {
        const nameMatch = transcript.match(/(?:اسم\s+)?المريض[:\s]+([^\.,،]+)/);
        if (nameMatch) {
          updatePatient('name', nameMatch[1].trim());
          console.log('[Voice-AR] Extracted patient name:', nameMatch[1].trim());
        }
      }
      
      // التشخيص (Diagnosis)
      if (lowerTranscript.includes('التشخيص') || lowerTranscript.includes('تشخيص')) {
        const diagMatch = transcript.match(/التشخيص[:\s]+([^\.,،]+)/);
        if (diagMatch) {
          setFormData(prev => ({ ...prev, diagnosis: diagMatch[1].trim() }));
          console.log('[Voice-AR] Extracted diagnosis:', diagMatch[1].trim());
        }
      }
      
      // الدواء (Medication) - with directory search
      if (lowerTranscript.includes('الدواء') || lowerTranscript.includes('دواء') || lowerTranscript.includes('وصف')) {
        const medMatch = transcript.match(/(?:الدواء|دواء|وصف)[:\s]+([^\.,،]+)/);
        if (medMatch) {
          const medicineName = medMatch[1].trim();
          console.log('[Voice-AR] Detected medication:', medicineName);
          
          // Search medicine directory asynchronously
          searchAndMatchMedicine(medicineName, '', 'مرة واحدة يومياً', '30 يوم');
        }
      }
    }
  };

  const handleOCRExtract = (extractedData) => {
    console.log('[OCR] Extracted data received:', extractedData);
    
    if (extractedData.patientName) {
      updatePatient('name', extractedData.patientName);
    }
    if (extractedData.diagnosis) {
      setFormData(prev => ({ ...prev, diagnosis: extractedData.diagnosis }));
    }
    if (extractedData.medications?.length) {
      setFormData(prev => ({
        ...prev,
        medications: extractedData.medications.map(med => ({
          medicineId: med.medicineId || generateUUID(),
          medicineName: med.medicineName || '',
          drugId: med.drugId || '',  // Will be populated from medicine directory match
          medicineGenericName: med.medicineGenericName || '',
          medicineStrength: med.medicineStrength || '',
          medicineForm: med.medicineForm || 'tablet',
          dosage: med.dosage || '',
          frequency: med.frequency || 'Once daily',
          duration: med.duration || '30 days',
          quantity: med.quantity || 30,
          refills: med.refills || 0,
          instructions: med.instructions || '',
          warnings: med.warnings || '',
          substitutionAllowed: med.substitutionAllowed !== false,
          icd: med.icd || '',
        }))
      }));
      
      // Show match summary notification
      if (extractedData.matchSummary) {
        const { matched, unmatched, total } = extractedData.matchSummary;
        const message = matched === total
          ? `✅ All ${total} medicines matched to National Drug Directory`
          : `✅ ${matched}/${total} medicines matched. ${unmatched} require manual verification.`;
        
        // Show as temporary notification
        setError(''); // Clear any previous errors
        console.log('[OCR] Match summary:', message);
        
        // You could add a toast notification here
        // For now, we'll add the note to clinical notes
        if (unmatched > 0) {
          setFormData(prev => ({
            ...prev,
            clinicalNotes: prev.clinicalNotes 
              ? `${prev.clinicalNotes}\n\n[OCR Note: ${unmatched} medicine(s) need manual verification]`
              : `[OCR Note: ${unmatched} medicine(s) need manual verification]`
          }));
        }
      }
    }
    if (extractedData.notes) {
      setFormData(prev => ({ 
        ...prev, 
        clinicalNotes: prev.clinicalNotes 
          ? `${prev.clinicalNotes}\n\n${extractedData.notes}`
          : extractedData.notes 
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validation
      if (!formData.patient.name.trim()) {
        throw new Error('Patient name is required');
      }
      
      for (const med of formData.medications) {
        if (!med.medicineName.trim()) {
          throw new Error('Medicine name is required for all medications');
        }
        if (!med.dosage.trim()) {
          throw new Error('Dosage is required for all medications');
        }
        if (!med.duration.trim()) {
          throw new Error('Duration is required for all medications (v8.0 requirement)');
        }
      }

      const prescriptionData = {
        doctor: doctorInfo,
        patient: {
          ...formData.patient,
          age: parseInt(formData.patient.age) || undefined,
        },
        diagnosis: formData.diagnosis,
        clinicalNotes: formData.clinicalNotes,
        medications: formData.medications.map(med => ({
          ...med,
          quantity: parseInt(med.quantity) || 1,
          refills: parseInt(med.refills) || 0,
        })),
      };

      const result = await HealthFlowAPI.createPrescription(prescriptionData);
      onSubmit(result.data);
    } catch (err) {
      setError(err.message || 'Failed to create prescription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: TOKENS.radius.md,
          padding: '14px 16px',
          marginBottom: '24px',
          color: TOKENS.colors.error,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <Icons.AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Input Method Selector */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        padding: '4px',
        background: TOKENS.colors.surfaceAlt,
        borderRadius: TOKENS.radius.lg,
      }}>
        {[
          { id: 'manual', label: 'Manual Entry', icon: Icons.FileText },
          { id: 'voice', label: 'Voice Input', icon: Icons.Mic },
          { id: 'ocr', label: 'Scan Image', icon: Icons.Camera },
        ].map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => setActiveInputMethod(method.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              border: 'none',
              borderRadius: TOKENS.radius.md,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              background: activeInputMethod === method.id ? TOKENS.colors.surface : 'transparent',
              color: activeInputMethod === method.id ? TOKENS.colors.primary : TOKENS.colors.textMuted,
              boxShadow: activeInputMethod === method.id ? TOKENS.shadows.sm : 'none',
            }}
          >
            <method.icon size={18} />
            {method.label}
          </button>
        ))}
      </div>

      {/* Voice & OCR Input */}
      {activeInputMethod === 'voice' && (
        <div style={{ marginBottom: '24px' }}>
          <VoicePrescription onTranscript={handleVoiceTranscript} disabled={loading} />
        </div>
      )}

      {activeInputMethod === 'ocr' && (
        <div style={{ marginBottom: '24px' }}>
          <OCRUpload onExtract={handleOCRExtract} disabled={loading} />
        </div>
      )}

      {/* Patient Information Section */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px' }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '700',
            color: TOKENS.colors.text,
            margin: '0 0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <Icons.User size={20} color={TOKENS.colors.primary} />
            Patient Information
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <Input
                label="Patient Name *"
                type="text"
                value={formData.patient.name}
                onChange={(e) => updatePatient('name', e.target.value)}
                required
                placeholder="Full name"
                containerStyle={{ marginBottom: 0 }}
              />
            </div>
            <Input
              label="National ID"
              type="text"
              value={formData.patient.nationalId}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                updatePatient('nationalId', value);
                const error = validateNationalId(value);
                if (error) {
                  setFieldErrors(prev => ({...prev, nationalId: error}));
                } else {
                  setFieldErrors(prev => {
                    const {nationalId, ...rest} = prev;
                    return rest;
                  });
                }
              }}
              placeholder="14 digits (numbers only)"
              maxLength={14}
              pattern="[0-9]{14}"
              error={fieldErrors.nationalId}
              containerStyle={{ marginBottom: 0 }}
            />
            <Input
              label="Age"
              type="number"
              value={formData.patient.age}
              onChange={(e) => updatePatient('age', e.target.value)}
              placeholder="Years"
              min="0"
              max="150"
              containerStyle={{ marginBottom: 0 }}
            />
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: TOKENS.colors.textMuted,
                marginBottom: '8px',
              }}>
                Gender
              </label>
              <select
                value={formData.patient.gender}
                onChange={(e) => updatePatient('gender', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  border: `2px solid ${TOKENS.colors.border}`,
                  borderRadius: TOKENS.radius.md,
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: TOKENS.colors.surface,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Diagnosis Section */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px' }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '700',
            color: TOKENS.colors.text,
            margin: '0 0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <Icons.Stethoscope size={20} color={TOKENS.colors.primary} />
            Diagnosis
          </h3>

          <Input
            label="Diagnosis"
            type="text"
            value={formData.diagnosis}
            onChange={(e) => setFormData(prev => ({ ...prev, diagnosis: e.target.value }))}
            placeholder="Primary diagnosis"
          />
          
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: TOKENS.colors.textMuted,
              marginBottom: '8px',
            }}>
              Clinical Notes
            </label>
            <textarea
              value={formData.clinicalNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, clinicalNotes: e.target.value }))}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: `2px solid ${TOKENS.colors.border}`,
                borderRadius: TOKENS.radius.md,
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: TOKENS.colors.surface,
                fontFamily: 'inherit',
                minHeight: '100px',
                resize: 'vertical',
              }}
              placeholder="Additional clinical notes..."
            />
          </div>
        </div>
      </Card>

      {/* Medications Section */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '700',
              color: TOKENS.colors.text,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <Icons.Pill size={20} color={TOKENS.colors.primary} />
              Medications
            </h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addMedication}
              icon={Icons.Plus}
            >
              Add Medicine
            </Button>
          </div>

          {formData.medications.map((medication, index) => (
            <div
              key={index}
              style={{
                background: TOKENS.colors.surfaceAlt,
                borderRadius: TOKENS.radius.lg,
                padding: '20px',
                marginBottom: index < formData.medications.length - 1 ? '16px' : 0,
                border: `1px solid ${TOKENS.colors.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: TOKENS.colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    width: '28px',
                    height: '28px',
                    background: TOKENS.colors.gradientAlt,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: '700',
                  }}>
                    {index + 1}
                  </span>
                  Medicine #{index + 1}
                </span>
                {formData.medications.length > 1 && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => removeMedication(index)}
                    icon={Icons.Trash}
                    style={{ padding: '6px 12px' }}
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: TOKENS.colors.textMuted,
                    marginBottom: '8px',
                  }}>
                    Medicine Name * (Search National Directory)
                  </label>
                  <MedicineAutocomplete
                    value={{ commercialName: medication.medicineName }}
                    onChange={(val) => updateMedication(index, 'medicineName', val)}
                    onSelect={(med) => handleMedicineSelect(index, med)}
                    disabled={loading}
                  />
                </div>
                
                <Input
                  label="Drug ID (from Directory)"
                  type="text"
                  value={medication.drugId}
                  onChange={(e) => updateMedication(index, 'drugId', e.target.value)}
                  placeholder="Auto-filled from search"
                  style={{ background: TOKENS.colors.surfaceAlt }}
                  containerStyle={{ marginBottom: 0 }}
                  readOnly
                />
                
                <Input
                  label="Generic Name"
                  type="text"
                  value={medication.medicineGenericName}
                  onChange={(e) => updateMedication(index, 'medicineGenericName', e.target.value)}
                  placeholder="e.g., Sitagliptin"
                  containerStyle={{ marginBottom: 0 }}
                />
                
                <Input
                  label="Dosage *"
                  type="text"
                  value={medication.dosage}
                  onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                  required
                  placeholder="e.g., 100mg"
                  containerStyle={{ marginBottom: 0 }}
                />
                
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: TOKENS.colors.textMuted,
                    marginBottom: '8px',
                  }}>
                    Frequency *
                  </label>
                  <select
                    value={medication.frequency}
                    onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '14px',
                      border: `2px solid ${TOKENS.colors.border}`,
                      borderRadius: TOKENS.radius.md,
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: TOKENS.colors.surface,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="Once daily">Once daily</option>
                    <option value="Twice daily">Twice daily</option>
                    <option value="Three times daily">Three times daily</option>
                    <option value="Four times daily">Four times daily</option>
                    <option value="Every 4 hours">Every 4 hours</option>
                    <option value="Every 6 hours">Every 6 hours</option>
                    <option value="Every 8 hours">Every 8 hours</option>
                    <option value="Every 12 hours">Every 12 hours</option>
                    <option value="As needed">As needed (PRN)</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
                
                <Input
                  label="Duration * (REQUIRED)"
                  type="text"
                  value={medication.duration}
                  onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                  required
                  placeholder="e.g., 30 days"
                  containerStyle={{ marginBottom: 0 }}
                />
                
                <Input
                  label="Quantity *"
                  type="number"
                  value={medication.quantity}
                  onChange={(e) => updateMedication(index, 'quantity', e.target.value)}
                  required
                  min="1"
                  containerStyle={{ marginBottom: 0 }}
                />
                
                <Input
                  label="ICD-10 Code"
                  type="text"
                  value={medication.icd}
                  onChange={(e) => updateMedication(index, 'icd', e.target.value)}
                  placeholder="e.g., E11.9"
                  containerStyle={{ marginBottom: 0 }}
                />
                
                <div style={{ gridColumn: 'span 2' }}>
                  <Input
                    label="Instructions"
                    type="text"
                    value={medication.instructions}
                    onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                    placeholder="e.g., Take with breakfast"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </div>
                
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id={`substitution-${index}`}
                    checked={medication.substitutionAllowed}
                    onChange={(e) => updateMedication(index, 'substitutionAllowed', e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor={`substitution-${index}`} style={{ fontSize: '14px', color: TOKENS.colors.text, cursor: 'pointer' }}>
                    Allow generic substitution
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Form Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Create Prescription
        </Button>
      </div>
    </form>
  );
};

// ============================================================================
// PRESCRIPTION DETAIL MODAL COMPONENT
// ============================================================================

const PrescriptionDetailModal = ({ prescription, onClose, onStatusUpdate }) => {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [prescription.id]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const result = await HealthFlowAPI.getPrescriptionHistory(prescription.id);
      setHistory(result.data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStatusChange = async (newStatus, reason = null) => {
    setStatusLoading(true);
    try {
      // Update status in backend
      await HealthFlowAPI.updatePrescriptionStatus(prescription.id, newStatus, reason);
      
      // If approved, fetch the updated prescription with official ID/Number
      if (newStatus === 'approved') {
        console.log('[Approval] Fetching updated prescription with official credentials...');
        const updatedPrescription = await HealthFlowAPI.getPrescription(prescription.id);
        console.log('[Approval] Updated prescription received:', updatedPrescription.data);
        
        // Update local prescription data with official credentials
        Object.assign(prescription, updatedPrescription.data);
      }
      
      onStatusUpdate();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setStatusLoading(false);
      setShowCancelDialog(false);
    }
  };

  // PDF Download handler
  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      console.log('[PDF] Initiating download for prescription:', prescription.prescriptionNumber);
      const result = await PrescriptionPDFGenerator.downloadPDF(prescription);
      if (!result.success) {
        alert(`Failed to generate PDF: ${result.error}`);
      }
    } catch (err) {
      console.error('[PDF] Download error:', err);
      alert(`PDF generation failed: ${err.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // Print PDF handler (opens in new window)
  const handlePrintPDF = async () => {
    setPdfLoading(true);
    try {
      const doc = await PrescriptionPDFGenerator.generatePDF(prescription);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (err) {
      console.error('[PDF] Print error:', err);
      alert(`PDF generation failed: ${err.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const canApprove = ['draft', 'pending_validation'].includes(prescription.status);
  const canDispense = prescription.status === 'approved';
  const canCancel = ['draft', 'pending_validation', 'approved'].includes(prescription.status);
  const canPrint = prescription.status === 'approved'; // Only approved prescriptions can be printed

  return (
    <Modal isOpen={true} onClose={onClose} title={prescription.prescriptionNumber} maxWidth="900px">
      {/* Status & Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        padding: '20px',
        background: TOKENS.colors.surfaceAlt,
        borderRadius: TOKENS.radius.lg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '12px', color: TOKENS.colors.textMuted, textTransform: 'uppercase' }}>
              Status
            </p>
            <StatusBadge status={prescription.status} />
          </div>
          <div style={{ borderLeft: `1px solid ${TOKENS.colors.border}`, paddingLeft: '16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '12px', color: TOKENS.colors.textMuted, textTransform: 'uppercase' }}>
              Created
            </p>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: TOKENS.colors.text }}>
              {formatDateShort(prescription.prescriptionDate)}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {canApprove && (
            <Button
              variant="success"
              size="sm"
              onClick={() => handleStatusChange('approved')}
              loading={statusLoading}
              icon={Icons.Check}
            >
              Approve
            </Button>
          )}
          {canDispense && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStatusChange('dispensed')}
              loading={statusLoading}
              icon={Icons.Pill}
            >
              Mark Dispensed
            </Button>
          )}
          {canCancel && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowCancelDialog(true)}
              disabled={statusLoading}
              icon={Icons.X}
            >
              Cancel
            </Button>
          )}
          
          {/* PDF Actions */}
          <div style={{ borderLeft: `1px solid ${TOKENS.colors.border}`, paddingLeft: '8px', marginLeft: '8px', display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPDF}
              loading={pdfLoading}
              disabled={!canPrint || pdfLoading}
              icon={Icons.Download}
              title={!canPrint ? 'Only approved prescriptions can be downloaded' : ''}
            >
              Download PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrintPDF}
              disabled={!canPrint || pdfLoading}
              icon={Icons.Printer}
              title={!canPrint ? 'Only approved prescriptions can be printed' : ''}
            >
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div style={{
          marginBottom: '24px',
          padding: '20px',
          background: '#FEF2F2',
          borderRadius: TOKENS.radius.lg,
          border: '1px solid #FECACA',
        }}>
          <p style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600', color: '#991B1B' }}>
            Cancel Prescription
          </p>
          <Input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)"
            containerStyle={{ marginBottom: '12px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleStatusChange('cancelled', cancelReason || undefined)}
              loading={statusLoading}
            >
              Confirm Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCancelDialog(false)}
            >
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Patient & Doctor Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <Card style={{ padding: '20px' }}>
          <h4 style={{
            margin: '0 0 12px',
            fontSize: '12px',
            fontWeight: '600',
            color: TOKENS.colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Patient
          </h4>
          <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: TOKENS.colors.text }}>
            {prescription.patientName}
          </p>
          {prescription.patient?.nationalId && (
            <p style={{ margin: 0, fontSize: '13px', color: TOKENS.colors.textMuted }}>
              National ID: {prescription.patient.nationalId}
            </p>
          )}
        </Card>
        <Card style={{ padding: '20px' }}>
          <h4 style={{
            margin: '0 0 12px',
            fontSize: '12px',
            fontWeight: '600',
            color: TOKENS.colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Prescribing Doctor
          </h4>
          <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: TOKENS.colors.text }}>
            {prescription.doctorName}
          </p>
        </Card>
      </div>

      {/* Diagnosis */}
      {prescription.diagnosis && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{
            margin: '0 0 12px',
            fontSize: '12px',
            fontWeight: '600',
            color: TOKENS.colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Diagnosis
          </h4>
          <p style={{
            margin: 0,
            fontSize: '16px',
            color: TOKENS.colors.text,
            padding: '16px',
            background: TOKENS.colors.surfaceAlt,
            borderRadius: TOKENS.radius.md,
          }}>
            {prescription.diagnosis}
          </p>
        </div>
      )}

      {/* Medications */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{
          margin: '0 0 16px',
          fontSize: '12px',
          fontWeight: '600',
          color: TOKENS.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Medications ({prescription.medications?.length || 0})
        </h4>
        {prescription.medications?.map((med, index) => (
          <div
            key={med.id || index}
            style={{
              background: `linear-gradient(135deg, ${TOKENS.colors.primary}08 0%, ${TOKENS.colors.primary}03 100%)`,
              borderRadius: TOKENS.radius.lg,
              padding: '20px',
              marginBottom: index < prescription.medications.length - 1 ? '12px' : 0,
              border: `1px solid ${TOKENS.colors.primary}20`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '700', color: TOKENS.colors.text }}>
                  {med.medicineName}
                </p>
                {med.drugId && (
                  <p style={{
                    margin: '0 0 12px',
                    fontSize: '12px',
                    color: TOKENS.colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <Icons.Pill size={12} />
                    Drug ID: {med.drugId}
                  </p>
                )}
              </div>
              <span style={{
                padding: '6px 14px',
                background: TOKENS.colors.primary,
                borderRadius: TOKENS.radius.full,
                fontSize: '13px',
                fontWeight: '700',
                color: 'white',
              }}>
                Qty: {med.quantity}
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginTop: '16px',
              padding: '16px',
              background: TOKENS.colors.surface,
              borderRadius: TOKENS.radius.md,
            }}>
              <div>
                <span style={{ fontSize: '11px', color: TOKENS.colors.textMuted, display: 'block', marginBottom: '4px' }}>
                  Dosage
                </span>
                <span style={{ fontSize: '14px', color: TOKENS.colors.text, fontWeight: '600' }}>
                  {med.dosage}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: TOKENS.colors.textMuted, display: 'block', marginBottom: '4px' }}>
                  Frequency
                </span>
                <span style={{ fontSize: '14px', color: TOKENS.colors.text, fontWeight: '600' }}>
                  {med.frequency}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: TOKENS.colors.textMuted, display: 'block', marginBottom: '4px' }}>
                  Duration
                </span>
                <span style={{ fontSize: '14px', color: TOKENS.colors.text, fontWeight: '600' }}>
                  {med.duration}
                </span>
              </div>
            </div>
            {med.instructions && (
              <p style={{
                margin: '16px 0 0',
                fontSize: '14px',
                color: TOKENS.colors.textMuted,
                fontStyle: 'italic',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                📝 {med.instructions}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Audit Trail */}
      <div>
        <h4 style={{
          margin: '0 0 16px',
          fontSize: '12px',
          fontWeight: '600',
          color: TOKENS.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Audit Trail
        </h4>
        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <Icons.Loader size={24} color={TOKENS.colors.primary} />
          </div>
        ) : history.length === 0 ? (
          <p style={{ color: TOKENS.colors.textMuted, fontSize: '14px', textAlign: 'center', padding: '24px' }}>
            No history available
          </p>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '28px' }}>
            <div style={{
              position: 'absolute',
              left: '9px',
              top: '8px',
              bottom: '8px',
              width: '2px',
              background: TOKENS.colors.border,
            }} />
            {history.map((event, index) => (
              <div key={event.id || index} style={{ position: 'relative', marginBottom: '20px' }}>
                <div style={{
                  position: 'absolute',
                  left: '-23px',
                  top: '4px',
                  width: '14px',
                  height: '14px',
                  background: TOKENS.colors.primary,
                  borderRadius: '50%',
                  border: '3px solid white',
                  boxShadow: TOKENS.shadows.sm,
                }} />
                <div style={{
                  background: TOKENS.colors.surfaceAlt,
                  borderRadius: TOKENS.radius.md,
                  padding: '14px 18px',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: TOKENS.colors.text }}>
                    {event.action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: TOKENS.colors.textMuted }}>
                    {event.performedByName} • {formatDate(event.timestamp)}
                  </p>
                  {event.notes && (
                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: TOKENS.colors.text }}>
                      {event.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

const Dashboard = ({ user, onLogout }) => {
  const [activeView, setActiveView] = useState('list'); // list, create
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('rx'); // rx, national
  const [stats, setStats] = useState({ total: 0, draft: 0, approved: 0, dispensed: 0 });
  const [statusFilter, setStatusFilter] = useState('all');

  // Doctor info for prescriptions
  const doctorInfo = useMemo(() => {
    console.log('[Dashboard] Creating doctorInfo for user:', user);
    return {
      id: '650e8400-e29b-41d4-a716-446655440001', // Always use UUID (user.id is integer from JWT)
      name: user?.name || 'Dr. ' + (user?.email?.split('@')[0] || 'Doctor'),
      license: 'EG-DOC-' + Math.random().toString().slice(2, 7),
      specialty: 'General Medicine',
    };
  }, [user]);

  const loadPrescriptions = async () => {
    console.log('[Dashboard] Loading prescriptions...');
    setLoading(true);
    setError(null);
    try {
      const result = await HealthFlowAPI.listPrescriptions(100, 0);
      console.log('[Dashboard] Prescriptions loaded:', result);
      const data = result.data || [];
      setPrescriptions(data);
      
      // Calculate stats
      setStats({
        total: data.length,
        draft: data.filter(p => p.status === 'draft').length,
        approved: data.filter(p => p.status === 'approved').length,
        dispensed: data.filter(p => p.status === 'dispensed').length,
      });
    } catch (err) {
      console.error('[Dashboard] Failed to load prescriptions:', err);
      setError(err.message || 'Failed to load prescriptions');
      setPrescriptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[Dashboard] Component mounted, loading data...');
    loadPrescriptions();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadPrescriptions();
      return;
    }

    setLoading(true);
    try {
      let result;
      if (searchType === 'rx') {
        result = await HealthFlowAPI.searchByRxNumber(searchQuery);
        setPrescriptions(result.data ? [result.data] : []);
      } else {
        result = await HealthFlowAPI.searchByNationalId(searchQuery);
        setPrescriptions(result.data || []);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setPrescriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrescriptionCreated = (prescription) => {
    setActiveView('list');
    loadPrescriptions();
    setSelectedPrescription(prescription);
  };

  const filteredPrescriptions = useMemo(() => {
    if (statusFilter === 'all') return prescriptions;
    return prescriptions.filter(p => p.status === statusFilter);
  }, [prescriptions, statusFilter]);

  return (
    <div style={{ minHeight: '100vh', background: TOKENS.colors.background }}>
      {/* Header */}
      <header style={{
        background: TOKENS.colors.surface,
        borderBottom: `1px solid ${TOKENS.colors.border}`,
        padding: '0 32px',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: TOKENS.shadows.sm,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: TOKENS.colors.gradient,
            borderRadius: TOKENS.radius.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: TOKENS.shadows.glow,
          }}>
            <Icons.Pulse size={26} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: TOKENS.colors.text }}>
              HealthFlow
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: TOKENS.colors.textMuted }}>
              Clinic Portal v{APP_VERSION} • API v8.0
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            background: TOKENS.colors.surfaceAlt,
            borderRadius: TOKENS.radius.lg,
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: TOKENS.colors.gradientAlt,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icons.User size={18} color="white" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: TOKENS.colors.text }}>
                {doctorInfo.name}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: TOKENS.colors.textMuted }}>
                {user?.email}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            icon={Icons.Logout}
          >
            Logout
          </Button>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          marginBottom: '32px',
        }}>
          {[
            { label: 'Total Prescriptions', value: stats.total, color: '#6366F1', gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', icon: Icons.FileText },
            { label: 'Draft', value: stats.draft, color: '#64748B', gradient: 'linear-gradient(135deg, #64748B 0%, #94A3B8 100%)', icon: Icons.Clock },
            { label: 'Approved', value: stats.approved, color: '#10B981', gradient: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)', icon: Icons.Check },
            { label: 'Dispensed', value: stats.dispensed, color: '#0891B2', gradient: 'linear-gradient(135deg, #0891B2 0%, #22D3EE 100%)', icon: Icons.Pill },
          ].map((stat, index) => (
            <Card
              key={index}
              style={{
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '100px',
                height: '100px',
                background: stat.gradient,
                borderRadius: '50%',
                opacity: 0.1,
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: TOKENS.colors.textMuted, fontWeight: '500' }}>
                    {stat.label}
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: '36px',
                    fontWeight: '800',
                    background: stat.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    {stat.value}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: stat.gradient,
                  borderRadius: TOKENS.radius.lg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 14px ${stat.color}40`,
                }}>
                  <stat.icon size={24} color="white" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Debug Panel - Medicine Search Test */}
        <Card style={{ marginBottom: '24px', padding: '20px', background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: '#0369A1' }}>
              🔧 API Debug Panel v{APP_VERSION}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>
              Auth: {API_CONFIG.AUTH_BASE} | Rx: {API_CONFIG.PRESCRIPTION_BASE}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <input
              type="text"
              placeholder="Test medicine search (e.g., 'aspirin', 'panadol', 'januvia')"
              id="debug-medicine-search"
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: '14px',
                border: '2px solid #BAE6FD',
                borderRadius: '6px',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={async () => {
                const input = document.getElementById('debug-medicine-search');
                const output = document.getElementById('debug-output');
                const query = input.value.trim();
                
                if (!query || query.length < 2) {
                  output.innerHTML = '<span style="color: #EF4444;">Please enter at least 2 characters</span>';
                  return;
                }
                
                output.innerHTML = '<span style="color: #0369A1;">🔄 Searching...</span>';
                console.log('[Debug v2.3] Testing medicine search with query:', query);
                console.log('[Debug v2.3] Token available:', !!HealthFlowAPI.token);
                console.log('[Debug v2.3] API URL:', API_CONFIG.PRESCRIPTION_BASE);
                
                try {
                  const startTime = Date.now();
                  const result = await HealthFlowAPI.searchMedicines(query);
                  const elapsed = Date.now() - startTime;
                  
                  console.log('[Debug v2.3] Medicine search result:', result);
                  
                  if (result.success && result.data && result.data.length > 0) {
                    const medicines = result.data.slice(0, 5).map(m => `• ${m.commercialName} (ID: ${m.id})`).join('<br>');
                    output.innerHTML = `<span style="color: #22C55E;">✅ Found ${result.data.length} results in ${elapsed}ms</span><br><br>${medicines}${result.data.length > 5 ? '<br>...' : ''}`;
                  } else if (result.success) {
                    output.innerHTML = `<span style="color: #F59E0B;">⚠️ No medicines found for "${query}" (${elapsed}ms)</span>`;
                  } else {
                    output.innerHTML = `<span style="color: #EF4444;">❌ API Error: ${result.error || 'Unknown error'}</span>`;
                  }
                } catch (err) {
                  console.error('[Debug v2.3] Medicine search error:', err);
                  output.innerHTML = `<span style="color: #EF4444;">❌ Error: ${err.message}</span><br><small>Check browser console for details</small>`;
                }
              }}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                background: '#0369A1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              🔍 Test API
            </button>
            <button
              onClick={async () => {
                const output = document.getElementById('debug-output');
                output.innerHTML = '<span style="color: #0369A1;">🔄 Testing direct API connection...</span>';
                
                // Test direct API call without going through HealthFlowAPI class
                const directUrl = `${API_CONFIG.DIRECT_PRESCRIPTION_BASE}/medicines/search?q=panadol&limit=5`;
                console.log('[Debug v2.3] Direct API test URL:', directUrl);
                
                try {
                  const response = await fetch(directUrl, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': `Bearer ${HealthFlowAPI.token}`,
                    },
                  });
                  
                  console.log('[Debug v2.3] Direct response status:', response.status);
                  const text = await response.text();
                  console.log('[Debug v2.3] Direct response body:', text);
                  
                  if (response.ok) {
                    const data = JSON.parse(text);
                    output.innerHTML = `<span style="color: #22C55E;">✅ Direct API working! Found ${data.data?.length || 0} medicines</span>`;
                  } else {
                    output.innerHTML = `<span style="color: #EF4444;">❌ Direct API failed: HTTP ${response.status}</span><br><small>${text.substring(0, 100)}</small>`;
                  }
                } catch (err) {
                  console.error('[Debug v2.3] Direct API error:', err);
                  output.innerHTML = `<span style="color: #EF4444;">❌ Network Error: ${err.message}</span><br><small>This might be a CORS or connectivity issue</small>`;
                }
              }}
              style={{
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: '600',
                background: '#7C3AED',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              🌐 Direct Test
            </button>
          </div>
          
          <div id="debug-output" style={{ 
            padding: '12px', 
            background: '#FFFFFF', 
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            fontSize: '13px', 
            color: '#475569', 
            fontFamily: 'monospace',
            minHeight: '40px',
            lineHeight: '1.5',
          }}>
            Enter a medicine name and click "Test API" to verify the connection
          </div>
        </Card>

        {/* Action Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              variant={activeView === 'list' ? 'primary' : 'secondary'}
              onClick={() => setActiveView('list')}
              icon={Icons.FileText}
            >
              Prescriptions
            </Button>
            <Button
              variant={activeView === 'create' ? 'primary' : 'secondary'}
              onClick={() => setActiveView('create')}
              icon={Icons.Plus}
            >
              New Prescription
            </Button>
          </div>

          {activeView === 'list' && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '12px 16px',
                  fontSize: '14px',
                  border: `2px solid ${TOKENS.colors.border}`,
                  borderRadius: TOKENS.radius.md,
                  outline: 'none',
                  background: TOKENS.colors.surface,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="dispensed">Dispensed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Search Type */}
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                style={{
                  padding: '12px 16px',
                  fontSize: '14px',
                  border: `2px solid ${TOKENS.colors.border}`,
                  borderRadius: TOKENS.radius.md,
                  outline: 'none',
                  background: TOKENS.colors.surface,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <option value="rx">RX Number</option>
                <option value="national">National ID</option>
              </select>

              {/* Search Input */}
              <div style={{ position: 'relative' }}>
                <Icons.Search size={18} color={TOKENS.colors.textMuted} style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={searchType === 'rx' ? 'Search RX number...' : 'Search National ID...'}
                  style={{
                    padding: '12px 16px 12px 44px',
                    fontSize: '14px',
                    border: `2px solid ${TOKENS.colors.border}`,
                    borderRadius: TOKENS.radius.md,
                    outline: 'none',
                    width: '260px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <Button variant="primary" onClick={handleSearch} icon={Icons.Search}>
                Search
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); loadPrescriptions(); }}
              >
                Reset
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {activeView === 'create' ? (
          <Card style={{ padding: '32px' }}>
            <h2 style={{
              margin: '0 0 8px',
              fontSize: '24px',
              fontWeight: '700',
              color: TOKENS.colors.text,
            }}>
              Create New Prescription
            </h2>
            <p style={{
              margin: '0 0 32px',
              fontSize: '14px',
              color: TOKENS.colors.textMuted,
            }}>
              Fill in the details below or use voice/OCR input to create a digital prescription
            </p>
            <PrescriptionForm
              doctorInfo={doctorInfo}
              onSubmit={handlePrescriptionCreated}
              onCancel={() => setActiveView('list')}
            />
          </Card>
        ) : (
          <Card>
            {loading ? (
              <div style={{ padding: '80px', textAlign: 'center' }}>
                <Icons.Loader size={48} color={TOKENS.colors.primary} />
                <p style={{ marginTop: '20px', color: TOKENS.colors.textMuted, fontSize: '15px' }}>
                  Loading prescriptions...
                </p>
              </div>
            ) : error ? (
              <div style={{ padding: '80px', textAlign: 'center' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: '#FEE2E2',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <Icons.AlertCircle size={40} color={TOKENS.colors.error} />
                </div>
                <p style={{ color: TOKENS.colors.error, fontSize: '16px', margin: '0 0 8px', fontWeight: '600' }}>
                  Failed to load prescriptions
                </p>
                <p style={{ color: TOKENS.colors.textMuted, fontSize: '14px', margin: '0 0 20px' }}>
                  {error}
                </p>
                <Button onClick={loadPrescriptions} icon={Icons.Activity}>
                  Retry
                </Button>
              </div>
            ) : filteredPrescriptions.length === 0 ? (
              <div style={{ padding: '80px', textAlign: 'center' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: TOKENS.colors.surfaceAlt,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <Icons.FileText size={40} color={TOKENS.colors.textMuted} />
                </div>
                <p style={{ color: TOKENS.colors.textMuted, fontSize: '16px', margin: '0 0 8px' }}>
                  No prescriptions found
                </p>
                <p style={{ color: TOKENS.colors.textMuted, fontSize: '14px', margin: 0 }}>
                  Create your first prescription to get started
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ background: TOKENS.colors.surfaceAlt }}>
                      {['RX Number', 'Patient', 'Diagnosis', 'Status', 'Date', 'Actions'].map((header, i) => (
                        <th
                          key={header}
                          style={{
                            padding: '16px 24px',
                            textAlign: i === 5 ? 'right' : 'left',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: TOKENS.colors.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrescriptions.map((prescription) => (
                      <tr
                        key={prescription.id}
                        style={{
                          borderTop: `1px solid ${TOKENS.colors.border}`,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = TOKENS.colors.surfaceAlt}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '18px 24px' }}>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: TOKENS.colors.primary,
                            fontFamily: 'monospace',
                          }}>
                            {prescription.prescriptionNumber}
                          </span>
                        </td>
                        <td style={{ padding: '18px 24px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: TOKENS.colors.text }}>
                            {prescription.patientName}
                          </span>
                        </td>
                        <td style={{ padding: '18px 24px' }}>
                          <span style={{
                            fontSize: '14px',
                            color: TOKENS.colors.textMuted,
                            maxWidth: '200px',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {prescription.diagnosis || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '18px 24px' }}>
                          <StatusBadge status={prescription.status} />
                        </td>
                        <td style={{ padding: '18px 24px' }}>
                          <span style={{ fontSize: '13px', color: TOKENS.colors.textMuted }}>
                            {formatDateShort(prescription.prescriptionDate)}
                          </span>
                        </td>
                        <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPrescription(prescription)}
                            icon={Icons.Eye}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </main>

      {/* Prescription Detail Modal */}
      {selectedPrescription && (
        <PrescriptionDetailModal
          prescription={selectedPrescription}
          onClose={() => setSelectedPrescription(null)}
          onStatusUpdate={() => {
            loadPrescriptions();
            setSelectedPrescription(null);
          }}
        />
      )}

      {/* Global Styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(2); }
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        ::selection {
          background: ${TOKENS.colors.primary}30;
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: ${TOKENS.colors.surfaceAlt};
        }
        ::-webkit-scrollbar-thumb {
          background: ${TOKENS.colors.border};
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${TOKENS.colors.textMuted};
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: TOKENS.colors.background,
          padding: '20px',
        }}>
          <div style={{
            background: TOKENS.colors.surface,
            borderRadius: TOKENS.radius.xl,
            padding: '40px',
            maxWidth: '500px',
            textAlign: 'center',
            boxShadow: TOKENS.shadows.lg,
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#FEE2E2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Icons.AlertCircle size={32} color={TOKENS.colors.error} />
            </div>
            <h2 style={{ margin: '0 0 12px', color: TOKENS.colors.text, fontSize: '20px' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 20px', color: TOKENS.colors.textMuted, fontSize: '14px' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button
              onClick={() => {
                HealthFlowAPI.clearTokens();
                window.location.reload();
              }}
            >
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    console.log('[App] Initializing application...');
    try {
      // Check for existing session
      HealthFlowAPI.loadTokens();
      
      if (HealthFlowAPI.isAuthenticated()) {
        const userData = HealthFlowAPI.user || { email: 'Authenticated User' };
        console.log('[App] User authenticated:', userData);
        setUser(userData);
      } else {
        console.log('[App] No valid session found');
      }
    } catch (error) {
      console.error('[App] Initialization error:', error);
      setInitError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData) => {
    console.log('[App] Login successful:', userData);
    setUser(userData);
  };

  const handleLogout = () => {
    console.log('[App] Logging out...');
    HealthFlowAPI.clearTokens();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: TOKENS.colors.background,
        gap: '16px',
      }}>
        <Icons.Loader size={48} color={TOKENS.colors.primary} />
        <p style={{ color: TOKENS.colors.textMuted, fontSize: '14px' }}>
          Loading HealthFlow Portal...
        </p>
      </div>
    );
  }

  if (initError) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: TOKENS.colors.background,
        padding: '20px',
      }}>
        <div style={{
          background: TOKENS.colors.surface,
          borderRadius: TOKENS.radius.xl,
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: TOKENS.shadows.lg,
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: '#FEE2E2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Icons.AlertCircle size={32} color={TOKENS.colors.error} />
          </div>
          <h2 style={{ margin: '0 0 12px', color: TOKENS.colors.text, fontSize: '20px' }}>
            Initialization Error
          </h2>
          <p style={{ margin: '0 0 20px', color: TOKENS.colors.textMuted, fontSize: '14px' }}>
            {initError}
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  console.log('[App] Rendering:', user ? 'Dashboard' : 'LoginPage');

  return user ? (
    <Dashboard user={user} onLogout={handleLogout} />
  ) : (
    <LoginPage onLogin={handleLogin} />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
