// ============================================================
// Keycloak SSO Configuration (HCP Registry Auth)
// ============================================================
export const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'https://keycloak.healthflow.tech';
export const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'RegistryAdmin';
export const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'clinic-portal';

// ============================================================
// NDP Platform API Configuration
// ============================================================
export const NDP_GATEWAY_URL = import.meta.env.VITE_NDP_GATEWAY_URL || 'https://ndp-gateway.healthflow.tech';
export const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';

// NDP Microservice URLs (used via API Gateway)
export const PRESCRIPTION_API_URL = `${NDP_GATEWAY_URL}`;
export const MEDICATION_API_URL = import.meta.env.VITE_MEDICATION_API_URL || 'http://209.38.231.84:4002';
export const DISPENSE_API_URL = `${NDP_GATEWAY_URL}`;

// HCP Registry API (for practitioner verification & signing)
export const HPR_API_URL = import.meta.env.VITE_HPR_API_URL || 'https://registry.healthflow.tech';

// Application Configuration
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'HealthFlow Clinic Portal';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '2.0.0';

// Token Configuration (Keycloak manages tokens, but we store user info)
export const USER_KEY = 'healthflow_user';

// Prescription Status Configuration
export const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_validation: 'Pending Validation',
  active: 'Active',
  approved: 'Approved',
  dispensed: 'Dispensed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const PRESCRIPTION_STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  pending_validation: 'warning',
  active: 'success',
  approved: 'success',
  dispensed: 'info',
  cancelled: 'error',
  rejected: 'error',
  expired: 'default',
};

// Frequency Options
export const FREQUENCY_OPTIONS = [
  { value: 'once_daily', label: 'Once daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'three_times_daily', label: 'Three times daily' },
  { value: 'four_times_daily', label: 'Four times daily' },
  { value: 'every_4_hours', label: 'Every 4 hours' },
  { value: 'every_6_hours', label: 'Every 6 hours' },
  { value: 'every_8_hours', label: 'Every 8 hours' },
  { value: 'every_12_hours', label: 'Every 12 hours' },
  { value: 'as_needed', label: 'As needed (PRN)' },
  { value: 'before_meals', label: 'Before meals' },
  { value: 'after_meals', label: 'After meals' },
  { value: 'at_bedtime', label: 'At bedtime' },
  { value: 'weekly', label: 'Weekly' },
];

// Duration Options
export const DURATION_OPTIONS = [
  { value: '3_days', label: '3 days' },
  { value: '5_days', label: '5 days' },
  { value: '7_days', label: '7 days (1 week)' },
  { value: '10_days', label: '10 days' },
  { value: '14_days', label: '14 days (2 weeks)' },
  { value: '21_days', label: '21 days (3 weeks)' },
  { value: '30_days', label: '30 days (1 month)' },
  { value: '60_days', label: '60 days (2 months)' },
  { value: '90_days', label: '90 days (3 months)' },
  { value: 'ongoing', label: 'Ongoing/Continuous' },
];

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Debounce
export const SEARCH_DEBOUNCE_MS = 300;
export const MIN_SEARCH_LENGTH = 2;
