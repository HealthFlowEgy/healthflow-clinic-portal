import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================================================
// HEALTHFLOW CLINIC PORTAL - Digital Prescription Management System
// Version: 2.0 | Integrated with HealthFlow API v8.0
// Features: Medicine Directory, OCR Upload, Voice Prescription, Full Workflow
// ============================================================================

// API Configuration
const API_CONFIG = {
  AUTH_BASE: 'http://209.38.231.84:4003/api/auth',
  PRESCRIPTION_BASE: 'http://209.38.231.84:4002/api/v1',
};

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

  static setTokens(accessToken, refresh, expiresIn, userData) {
    this.token = accessToken;
    this.refreshToken = refresh;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);
    this.user = userData;
    try {
      localStorage.setItem('hf_token', accessToken);
      localStorage.setItem('hf_refresh', refresh);
      localStorage.setItem('hf_expiry', this.tokenExpiry.toString());
      localStorage.setItem('hf_user', JSON.stringify(userData));
    } catch (e) {
      console.warn('localStorage not available');
    }
  }

  static loadTokens() {
    try {
      this.token = localStorage.getItem('hf_token');
      this.refreshToken = localStorage.getItem('hf_refresh');
      this.tokenExpiry = parseInt(localStorage.getItem('hf_expiry') || '0');
      const userData = localStorage.getItem('hf_user');
      this.user = userData ? JSON.parse(userData) : null;
    } catch (e) {
      console.warn('localStorage not available');
    }
  }

  static clearTokens() {
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.user = null;
    try {
      localStorage.removeItem('hf_token');
      localStorage.removeItem('hf_refresh');
      localStorage.removeItem('hf_expiry');
      localStorage.removeItem('hf_user');
    } catch (e) {
      console.warn('localStorage not available');
    }
  }

  static isAuthenticated() {
    return this.token && this.tokenExpiry && Date.now() < this.tokenExpiry;
  }

  static async request(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your connection.');
      }
      throw error;
    }
  }

  // Authentication
  static async login(email, password) {
    const data = await this.request(`${API_CONFIG.AUTH_BASE}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.success && data.access_token) {
      this.setTokens(data.access_token, data.refresh_token, data.expires_in, data.user);
      return data;
    }
    throw new Error(data.error || 'Login failed');
  }

  // Medicine Directory
  static async searchMedicines(query, limit = 30) {
    if (!query || query.length < 2) return { success: true, data: [], total: 0 };
    const url = `${API_CONFIG.PRESCRIPTION_BASE}/medicines/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    return this.request(url);
  }

  static async getMedicine(id) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/medicines/${id}`);
  }

  static async listMedicines(limit = 50, offset = 0) {
    return this.request(`${API_CONFIG.PRESCRIPTION_BASE}/medicines?limit=${limit}&offset=${offset}`);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await HealthFlowAPI.login(email, password);
      onLogin(result.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

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
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MEDICINE AUTOCOMPLETE COMPONENT
// ============================================================================

const MedicineAutocomplete = ({ value, onChange, onSelect, disabled }) => {
  const [query, setQuery] = useState(value?.commercialName || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  const searchMedicines = useCallback(
    debounce(async (searchQuery) => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const response = await HealthFlowAPI.searchMedicines(searchQuery);
        setResults(response.success ? response.data : []);
      } catch (err) {
        console.error('Medicine search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (query) searchMedicines(query);
  }, [query, searchMedicines]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (medicine) => {
    setQuery(medicine.commercialName);
    setShowDropdown(false);
    onSelect(medicine);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Icons.Search size={18} color={TOKENS.colors.textMuted} style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
        }} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search National Medicine Directory..."
          disabled={disabled}
          style={{
            width: '100%',
            padding: '12px 16px 12px 44px',
            fontSize: '14px',
            border: `2px solid ${TOKENS.colors.border}`,
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
      
      {showDropdown && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
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
          {results.map((medicine) => (
            <div
              key={medicine.id}
              onClick={() => handleSelect(medicine)}
              style={{
                padding: '14px 18px',
                cursor: 'pointer',
                borderBottom: `1px solid ${TOKENS.colors.border}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.target.style.background = TOKENS.colors.surfaceAlt}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
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
  const recognitionRef = useRef(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript);
          onTranscript(finalTranscript);
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

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript]);

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
  const [error, setError] = useState('');
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

    try {
      // Simulated OCR processing - in production, this would call an OCR API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulated extracted data
      const extractedData = {
        patientName: 'Extracted Patient Name',
        diagnosis: 'Type 2 Diabetes Mellitus',
        medications: [
          {
            medicineName: 'Metformin 500mg',
            dosage: '500mg',
            frequency: 'Twice daily',
            duration: '30 days',
          }
        ],
        notes: 'Prescription extracted from uploaded image. Please verify all details.',
      };

      onExtract(extractedData);
      setFile(null);
      setPreview(null);
    } catch (err) {
      setError('Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
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
            loading={processing}
            disabled={disabled}
            style={{ width: '100%' }}
          >
            {processing ? 'Processing...' : 'Extract Prescription Data'}
          </Button>
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
  const [activeInputMethod, setActiveInputMethod] = useState('manual'); // manual, voice, ocr

  const updatePatient = (field, value) => {
    setFormData(prev => ({
      ...prev,
      patient: { ...prev.patient, [field]: value }
    }));
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

  const handleVoiceTranscript = (transcript) => {
    // Parse voice input - basic implementation
    const lowerTranscript = transcript.toLowerCase();
    
    if (lowerTranscript.includes('patient name')) {
      const nameMatch = transcript.match(/patient name[:\s]+([^,\.]+)/i);
      if (nameMatch) updatePatient('name', nameMatch[1].trim());
    }
    
    if (lowerTranscript.includes('diagnosis')) {
      const diagMatch = transcript.match(/diagnosis[:\s]+([^,\.]+)/i);
      if (diagMatch) setFormData(prev => ({ ...prev, diagnosis: diagMatch[1].trim() }));
    }
  };

  const handleOCRExtract = (extractedData) => {
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
          medicineId: generateUUID(),
          medicineName: med.medicineName || '',
          drugId: med.drugId || '',
          medicineGenericName: '',
          medicineStrength: '',
          medicineForm: 'tablet',
          dosage: med.dosage || '',
          frequency: med.frequency || 'Once daily',
          duration: med.duration || '',
          quantity: 1,
          refills: 0,
          instructions: '',
          warnings: '',
          substitutionAllowed: true,
          icd: '',
        }))
      }));
    }
    if (extractedData.notes) {
      setFormData(prev => ({ ...prev, clinicalNotes: extractedData.notes }));
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
              onChange={(e) => updatePatient('nationalId', e.target.value)}
              placeholder="14 digits"
              maxLength={14}
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
      await HealthFlowAPI.updatePrescriptionStatus(prescription.id, newStatus, reason);
      onStatusUpdate();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setStatusLoading(false);
      setShowCancelDialog(false);
    }
  };

  const canApprove = ['draft', 'pending_validation'].includes(prescription.status);
  const canDispense = prescription.status === 'approved';
  const canCancel = ['draft', 'pending_validation', 'approved'].includes(prescription.status);

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
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('rx'); // rx, national
  const [stats, setStats] = useState({ total: 0, draft: 0, approved: 0, dispensed: 0 });
  const [statusFilter, setStatusFilter] = useState('all');

  // Doctor info for prescriptions
  const doctorInfo = useMemo(() => ({
    id: user?.id || '650e8400-e29b-41d4-a716-446655440001',
    name: user?.name || 'Dr. ' + (user?.email?.split('@')[0] || 'Doctor'),
    license: 'EG-DOC-' + Math.random().toString().slice(2, 7),
    specialty: 'General Medicine',
  }), [user]);

  const loadPrescriptions = async () => {
    setLoading(true);
    try {
      const result = await HealthFlowAPI.listPrescriptions(100, 0);
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
      console.error('Failed to load prescriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
              Clinic Portal • API v8.0
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

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    HealthFlowAPI.loadTokens();
    if (HealthFlowAPI.isAuthenticated()) {
      setUser(HealthFlowAPI.user || { email: 'Authenticated User' });
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    HealthFlowAPI.clearTokens();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: TOKENS.colors.background,
      }}>
        <Icons.Loader size={48} color={TOKENS.colors.primary} />
      </div>
    );
  }

  return user ? (
    <Dashboard user={user} onLogout={handleLogout} />
  ) : (
    <LoginPage onLogin={handleLogin} />
  );
}
