// ============================================================
// User and Authentication Types (Keycloak SSO)
// ============================================================
export interface User {
  id: string;
  email: string;
  role: 'doctor' | 'clinic_staff';
  name: string;
  license?: string;
  specialty?: string;
  clinicName?: string;
}

export interface AuthResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ============================================================
// Patient Types (DPR - Digital Patient Registry)
// ============================================================
export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  nationalId: string;
}

export interface PatientDemographics {
  nationalId: string;
  name: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  age?: number;
  verified: boolean;
}

export interface InsuranceCoverage {
  nationalId: string;
  enrolled: boolean;
  tier: 'A' | 'B' | 'C' | 'D';
  copayPercentage: number;
  status: 'active' | 'inactive' | 'suspended';
}

// ============================================================
// Doctor / Practitioner Types (HPR)
// ============================================================
export interface Doctor {
  id: string;
  name: string;
  license: string;
  specialty: string;
}

// ============================================================
// Medicine Types (NDP Medication Directory - EDA Database)
// ============================================================
export interface Medicine {
  id: string;
  commercialName: string;
  searchName?: string;
  genericName?: string;
  strength?: string;
  form?: string;
  drugId?: string;
  edaCode?: string;
  manufacturer?: string;
  activeIngredient?: string;
}

// ============================================================
// Medication Types (Prescription Line Items)
// ============================================================
export interface Medication {
  medicineId: string;
  medicineName: string;
  drugId?: string;
  edaCode?: string;
  medicineGenericName?: string;
  medicineStrength?: string;
  medicineForm?: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  refills?: number;
  instructions?: string;
  warnings?: string;
  substitutionAllowed?: boolean;
  icd?: string;
  doseQuantity?: number;
  everyDays?: number;
  forDays?: number;
  numberOfTimes?: number;
}

// ============================================================
// Prescription Types (NDP FHIR MedicationRequest)
// ============================================================
export type PrescriptionStatus = 
  | 'draft' 
  | 'pending_validation' 
  | 'active'
  | 'approved' 
  | 'dispensed' 
  | 'cancelled' 
  | 'rejected' 
  | 'expired';

export interface Prescription {
  id: string;
  prescriptionNumber: string;
  doctor: Doctor;
  patient: Patient;
  diagnosis: string;
  icdCode?: string;
  clinicalNotes?: string;
  medications: Medication[];
  status: PrescriptionStatus;
  prescriptionDate: string;
  createdAt: string;
  updatedAt: string;
  digitalSignature?: string;
  aiValidation?: {
    valid: boolean;
    warnings: string[];
    checkedAt: string;
  };
}

export interface PrescriptionCreatePayload {
  doctor: Doctor;
  patient: Patient;
  diagnosis: string;
  icdCode?: string;
  clinicalNotes?: string;
  medications: Medication[];
}

export interface PrescriptionHistoryItem {
  id: string;
  action: string;
  status: PrescriptionStatus;
  performedBy: string;
  timestamp: string;
  details?: string;
}

// ============================================================
// Drug Interaction Types (NDP AI Validation Service)
// ============================================================
export interface DrugInteractionResult {
  drug1: string;
  drug2: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  description: string;
  recommendation: string;
}

// ============================================================
// API Response Types
// ============================================================
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  error?: string;
  details?: unknown[];
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// ============================================================
// Dashboard Stats
// ============================================================
export interface DashboardStats {
  total: number;
  approved: number;
  pending: number;
  dispensed: number;
  cancelled: number;
}

// ============================================================
// ICD-10 Types
// ============================================================
export interface ICD10Code {
  code: string;
  description: string;
  category?: string;
  chapter?: string;
}

// ============================================================
// Form Types
// ============================================================
export interface PatientFormData {
  name: string;
  age: number;
  gender: 'male' | 'female';
  nationalId: string;
}

export interface MedicationFormData {
  medicine: Medicine | null;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
}

export interface PrescriptionFormData {
  patient: PatientFormData;
  diagnosis: string;
  clinicalNotes?: string;
  medications: MedicationFormData[];
}
