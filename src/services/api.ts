import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import keycloak from '../config/keycloak';
import type { 
  AuthResponse, 
  User, 
  Medicine, 
  Prescription, 
  PrescriptionCreatePayload,
  PrescriptionHistoryItem,
  ApiResponse,
  PaginationParams,
  DashboardStats,
  PatientDemographics,
  InsuranceCoverage,
  DrugInteractionResult,
} from '../types';
import { 
  NDP_GATEWAY_URL, 
  MEDICATION_API_URL,
  HPR_API_URL,
  USER_KEY,
} from '../config/constants';
import { MOCK_PRESCRIPTIONS, getMockDashboardStats, getMockPrescription } from '../data/mockPrescriptions';

/**
 * NDP Platform API Service
 * 
 * Integrates with the National Digital Prescription (NDP) platform APIs:
 * - Prescription Service (FHIR MedicationRequest)
 * - Medication Directory (EDA drug database)
 * - Dispense Service (FHIR MedicationDispense)
 * - HPR APIs (practitioner verification & digital signatures)
 * - DPR APIs (patient verification & insurance coverage)
 * 
 * Authentication is handled via Keycloak SSO JWT tokens from the HCP Registry.
 */
class NDPApiService {
  private prescriptionClient: AxiosInstance;
  private medicationClient: AxiosInstance;
  private dispenseClient: AxiosInstance;
  private hprClient: AxiosInstance;

  constructor() {
    // Prescription Service client (NDP Gateway → Prescription Service :3001)
    this.prescriptionClient = axios.create({
      baseURL: NDP_GATEWAY_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    // Medication Directory client (NDP Medication Directory API)
    this.medicationClient = axios.create({
      baseURL: MEDICATION_API_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    // Dispense Service client (NDP Gateway → Dispense Service :3002)
    this.dispenseClient = axios.create({
      baseURL: NDP_GATEWAY_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    // HPR (Healthcare Professional Registry) client
    this.hprClient = axios.create({
      baseURL: HPR_API_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  /**
   * Set up Axios interceptors to inject Keycloak JWT token
   * and handle 401 responses with automatic token refresh.
   */
  private setupInterceptors(): void {
    const clients = [
      this.prescriptionClient,
      this.medicationClient,
      this.dispenseClient,
      this.hprClient,
    ];

    clients.forEach((client) => {
      // Request interceptor: inject Bearer token from Keycloak
      client.interceptors.request.use(
        async (config: InternalAxiosRequestConfig) => {
          if (keycloak.authenticated) {
            // Ensure token is fresh (refresh if expiring within 30s)
            try {
              await keycloak.updateToken(30);
            } catch {
              console.warn('[API] Token refresh failed during request');
            }
            if (keycloak.token && config.headers) {
              config.headers.Authorization = `Bearer ${keycloak.token}`;
            }
          }
          return config;
        },
        (error) => Promise.reject(error)
      );

      // Response interceptor: handle 401 by redirecting to Keycloak login
      client.interceptors.response.use(
        (response) => response,
        async (error: AxiosError) => {
          if (error.response?.status === 401) {
            try {
              const refreshed = await keycloak.updateToken(0);
              if (refreshed && error.config) {
                // Retry the original request with new token
                error.config.headers.Authorization = `Bearer ${keycloak.token}`;
                return axios.request(error.config);
              }
            } catch {
              // Token refresh failed, redirect to login
              keycloak.login();
            }
          }
          return Promise.reject(error);
        }
      );
    });
  }

  // ============================================================
  // Token & User Management
  // ============================================================

  getToken(): string | null {
    return keycloak.token || null;
  }

  clearAuth(): void {
    localStorage.removeItem(USER_KEY);
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!keycloak.authenticated;
  }

  // ============================================================
  // Authentication (delegated to Keycloak SSO)
  // ============================================================

  /**
   * @deprecated Login is now handled by Keycloak SSO redirect.
   * This method is kept for backward compatibility during transition.
   */
  async login(_email: string, _password: string): Promise<AuthResponse> {
    // Keycloak handles login via redirect, this should not be called
    keycloak.login();
    // Return a placeholder (the page will redirect)
    return {
      success: true,
      access_token: keycloak.token || '',
      refresh_token: keycloak.refreshToken || '',
      token_type: 'Bearer',
      expires_in: 3600,
      user: this.getCurrentUser() || { id: '', email: '', name: '', role: 'doctor' },
    };
  }

  async logout(): Promise<void> {
    this.clearAuth();
    keycloak.logout({ redirectUri: window.location.origin + '/login' });
  }

  // ============================================================
  // NDP Prescription Service API (FHIR MedicationRequest)
  // Spec: Section 4.3.2 - Prescription Service API
  // ============================================================

  /**
   * Create a new prescription (FHIR MedicationRequest)
   * POST /fhir/MedicationRequest
   */
  async createPrescription(data: PrescriptionCreatePayload): Promise<ApiResponse<Prescription>> {
    const fhirPayload = this.toFhirMedicationRequest(data);
    const response = await this.prescriptionClient.post<ApiResponse<Prescription>>(
      '/fhir/MedicationRequest',
      fhirPayload
    );
    return response.data;
  }

  /**
   * Get prescription by ID
   * GET /fhir/MedicationRequest/{id}
   */
  async getPrescription(id: string): Promise<ApiResponse<Prescription>> {
    try {
      const response = await this.prescriptionClient.get<ApiResponse<Prescription>>(
        `/fhir/MedicationRequest/${id}`
      );
      return response.data;
    } catch {
      // Fallback to mock data
      console.info('[API] Using mock prescription data for get:', id);
      const prescription = getMockPrescription(id);
      if (prescription) {
        return { success: true, data: prescription };
      }
      return { success: false, data: {} as Prescription, error: 'Prescription not found' };
    }
  }

  /**
   * Search/list prescriptions with FHIR parameters
   * GET /fhir/MedicationRequest
   */
  async listPrescriptions(params?: PaginationParams): Promise<ApiResponse<Prescription[]>> {
    try {
      const response = await this.prescriptionClient.get<ApiResponse<Prescription[]>>(
        '/fhir/MedicationRequest',
        { params: { _count: params?.limit, _offset: params?.offset } }
      );
      return response.data;
    } catch {
      // Fallback to mock data when NDP backend is unavailable
      console.info('[API] Using mock prescription data for list');
      const offset = params?.offset || 0;
      const limit = params?.limit || 10;
      const sliced = MOCK_PRESCRIPTIONS.slice(offset, offset + limit);
      return { success: true, data: sliced, total: MOCK_PRESCRIPTIONS.length };
    }
  }

  /**
   * Update draft prescription
   * PUT /fhir/MedicationRequest/{id}
   */
  async updatePrescription(id: string, data: Partial<PrescriptionCreatePayload>): Promise<ApiResponse<Prescription>> {
    const response = await this.prescriptionClient.put<ApiResponse<Prescription>>(
      `/fhir/MedicationRequest/${id}`,
      data
    );
    return response.data;
  }

  /**
   * Digitally sign a prescription via HPR PKI
   * POST /api/prescriptions/{id}/sign
   */
  async signPrescription(id: string): Promise<ApiResponse<Prescription>> {
    const response = await this.prescriptionClient.post<ApiResponse<Prescription>>(
      `/api/prescriptions/${id}/sign`
    );
    return response.data;
  }

  /**
   * Cancel a prescription with reason
   * POST /api/prescriptions/{id}/cancel
   */
  async cancelPrescription(id: string, reason: string): Promise<ApiResponse<Prescription>> {
    const response = await this.prescriptionClient.post<ApiResponse<Prescription>>(
      `/api/prescriptions/${id}/cancel`,
      { reason }
    );
    return response.data;
  }

  /**
   * Run AI validation checks on a prescription
   * POST /api/prescriptions/{id}/validate
   */
  async validatePrescription(id: string): Promise<ApiResponse<{ valid: boolean; warnings: string[] }>> {
    const response = await this.prescriptionClient.post<ApiResponse<{ valid: boolean; warnings: string[] }>>(
      `/api/prescriptions/${id}/validate`
    );
    return response.data;
  }

  /**
   * Get complete audit trail for a prescription
   * GET /api/prescriptions/{id}/history
   */
  async getPrescriptionHistory(id: string): Promise<ApiResponse<PrescriptionHistoryItem[]>> {
    const response = await this.prescriptionClient.get<ApiResponse<PrescriptionHistoryItem[]>>(
      `/api/prescriptions/${id}/history`
    );
    return response.data;
  }

  /**
   * Update prescription status (backward-compatible wrapper)
   */
  async updatePrescriptionStatus(
    id: string, 
    status: string, 
    reason?: string
  ): Promise<ApiResponse<Prescription>> {
    if (status === 'cancelled') {
      return this.cancelPrescription(id, reason || 'Cancelled by prescriber');
    }
    if (status === 'approved') {
      return this.signPrescription(id);
    }
    // Fallback: update via FHIR PUT
    const response = await this.prescriptionClient.put<ApiResponse<Prescription>>(
      `/fhir/MedicationRequest/${id}`,
      { status }
    );
    return response.data;
  }

  async deletePrescription(id: string): Promise<ApiResponse<void>> {
    return this.cancelPrescription(id, 'Deleted by prescriber') as unknown as ApiResponse<void>;
  }

  async searchPrescriptionByNumber(rxNumber: string): Promise<ApiResponse<Prescription>> {
    try {
      const response = await this.prescriptionClient.get<ApiResponse<Prescription>>(
        '/fhir/MedicationRequest',
        { params: { identifier: rxNumber } }
      );
      return response.data;
    } catch {
      // Fallback to mock data
      const found = MOCK_PRESCRIPTIONS.find(p => p.prescriptionNumber === rxNumber);
      if (found) {
        return { success: true, data: found };
      }
      return { success: false, data: {} as Prescription, error: 'Prescription not found' };
    }
  }

  async searchPrescriptionsByNationalId(nationalId: string): Promise<ApiResponse<Prescription[]>> {
    try {
      const response = await this.prescriptionClient.get<ApiResponse<Prescription[]>>(
        '/fhir/MedicationRequest',
        { params: { 'patient.identifier': nationalId } }
      );
      return response.data;
    } catch {
      // Fallback to mock data
      const found = MOCK_PRESCRIPTIONS.filter(p => p.patient.nationalId === nationalId);
      return { success: true, data: found, total: found.length };
    }
  }

  // ============================================================
  // NDP Medication Directory API (EDA Drug Database)
  // Spec: Section 4.3.4 - Medication Directory API
  // ============================================================

  /**
   * Search medications by name in the EDA drug database
   * GET /api/v1/medicines/search?q={query}&limit={limit}
   */
  async searchMedicines(query: string, limit: number = 20): Promise<ApiResponse<Medicine[]>> {
    const response = await this.medicationClient.get<ApiResponse<Medicine[]>>(
      '/api/v1/medicines/search',
      { params: { q: query, limit } }
    );
    return response.data;
  }

  /**
   * Get medication details by ID
   * GET /api/v1/medicines/{id}
   */
  async getMedicine(id: string): Promise<ApiResponse<Medicine>> {
    const response = await this.medicationClient.get<ApiResponse<Medicine>>(
      `/api/v1/medicines/${id}`
    );
    return response.data;
  }

  /**
   * List medicines with pagination
   * GET /api/v1/medicines
   */
  async listMedicines(params?: PaginationParams): Promise<ApiResponse<Medicine[]>> {
    const response = await this.medicationClient.get<ApiResponse<Medicine[]>>(
      '/api/v1/medicines',
      { params }
    );
    return response.data;
  }

  /**
   * Get therapeutic alternatives for a medication
   * GET /api/medications/{code}/alternatives
   */
  async getMedicationAlternatives(code: string): Promise<ApiResponse<Medicine[]>> {
    const response = await this.medicationClient.get<ApiResponse<Medicine[]>>(
      `/api/medications/${code}/alternatives`
    );
    return response.data;
  }

  /**
   * Check drug-drug interactions
   * POST /api/medications/check-interactions
   */
  async checkDrugInteractions(drugCodes: string[]): Promise<ApiResponse<DrugInteractionResult[]>> {
    const response = await this.medicationClient.post<ApiResponse<DrugInteractionResult[]>>(
      '/api/medications/check-interactions',
      { medications: drugCodes }
    );
    return response.data;
  }

  /**
   * Get active drug recalls
   * GET /api/recalls
   */
  async getDrugRecalls(): Promise<ApiResponse<unknown[]>> {
    const response = await this.medicationClient.get<ApiResponse<unknown[]>>('/api/recalls');
    return response.data;
  }

  // ============================================================
  // NDP Dispense Service API (FHIR MedicationDispense)
  // Spec: Section 4.3.3 - Dispense Service API
  // ============================================================

  /**
   * Verify prescription for dispensing
   * GET /api/dispense/verify/{rxNumber}
   */
  async verifyForDispensing(rxNumber: string): Promise<ApiResponse<Prescription>> {
    const response = await this.dispenseClient.get<ApiResponse<Prescription>>(
      `/api/dispense/verify/${rxNumber}`
    );
    return response.data;
  }

  // ============================================================
  // HPR APIs (Healthcare Professional Registry)
  // Spec: Section 7.1.2 - HPR APIs Serving the Platform
  // ============================================================

  /**
   * Verify prescriber license status and specialties
   * GET /api/v1/practitioners/{license}/verify
   */
  async verifyPractitionerLicense(license: string): Promise<ApiResponse<{ valid: boolean; specialties: string[] }>> {
    const response = await this.hprClient.get<ApiResponse<{ valid: boolean; specialties: string[] }>>(
      `/api/v1/practitioners/${license}/verify`
    );
    return response.data;
  }

  /**
   * Generate digital signature for prescription
   * POST /api/v1/signatures/sign
   */
  async generateDigitalSignature(prescriptionData: unknown): Promise<ApiResponse<{ signature: string }>> {
    const response = await this.hprClient.post<ApiResponse<{ signature: string }>>(
      '/api/v1/signatures/sign',
      prescriptionData
    );
    return response.data;
  }

  /**
   * Verify digital signature authenticity
   * POST /api/v1/signatures/verify
   */
  async verifyDigitalSignature(signature: string, data: unknown): Promise<ApiResponse<{ valid: boolean }>> {
    const response = await this.hprClient.post<ApiResponse<{ valid: boolean }>>(
      '/api/v1/signatures/verify',
      { signature, data }
    );
    return response.data;
  }

  /**
   * Retrieve prescriber's public certificate
   * GET /api/v1/practitioners/{license}/certificate
   */
  async getPractitionerCertificate(license: string): Promise<ApiResponse<{ certificate: string }>> {
    const response = await this.hprClient.get<ApiResponse<{ certificate: string }>>(
      `/api/v1/practitioners/${license}/certificate`
    );
    return response.data;
  }

  // ============================================================
  // DPR APIs (Digital Patient Registry)
  // Spec: Section 7.2.1 - DPR APIs Serving the Platform
  // ============================================================

  /**
   * Verify patient identity and return demographics
   * GET /api/v1/patients/verify/{nationalId}
   */
  async verifyPatient(nationalId: string): Promise<ApiResponse<PatientDemographics>> {
    const response = await this.prescriptionClient.get<ApiResponse<PatientDemographics>>(
      `/api/v1/patients/verify/${nationalId}`
    );
    return response.data;
  }

  /**
   * Return patient demographics for prescription
   * GET /api/v1/patients/{nationalId}/demographics
   */
  async getPatientDemographics(nationalId: string): Promise<ApiResponse<PatientDemographics>> {
    const response = await this.prescriptionClient.get<ApiResponse<PatientDemographics>>(
      `/api/v1/patients/${nationalId}/demographics`
    );
    return response.data;
  }

  /**
   * Return insurance enrollment status and tier
   * GET /api/v1/coverage/verify/{nationalId}
   */
  async getInsuranceCoverage(nationalId: string): Promise<ApiResponse<InsuranceCoverage>> {
    const response = await this.prescriptionClient.get<ApiResponse<InsuranceCoverage>>(
      `/api/v1/coverage/verify/${nationalId}`
    );
    return response.data;
  }

  // ============================================================
  // Dashboard Stats
  // ============================================================

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await this.listPrescriptions({ limit: 1000 });
      const prescriptions = response.data || [];
      
      return {
        total: prescriptions.length,
        approved: prescriptions.filter(p => p.status === 'approved' || p.status === 'active').length,
        pending: prescriptions.filter(p => p.status === 'draft' || p.status === 'pending_validation').length,
        dispensed: prescriptions.filter(p => p.status === 'dispensed').length,
        cancelled: prescriptions.filter(p => p.status === 'cancelled' || p.status === 'rejected').length,
      };
    } catch {
      // Fallback to mock data when NDP backend is unavailable
      console.info('[API] Using mock prescription data for dashboard stats');
      return getMockDashboardStats();
    }
  }

  // ============================================================
  // FHIR Resource Mapping Helpers
  // ============================================================

  /**
   * Convert application prescription payload to FHIR MedicationRequest format.
   */
  private toFhirMedicationRequest(data: PrescriptionCreatePayload): Record<string, unknown> {
    return {
      resourceType: 'MedicationRequest',
      status: 'draft',
      intent: 'order',
      subject: {
        reference: `Patient/${data.patient.nationalId}`,
        display: data.patient.name,
        identifier: {
          system: 'urn:oid:2.16.818.1.1.1',  // Egypt National ID system
          value: data.patient.nationalId,
        },
      },
      requester: {
        reference: `Practitioner/${data.doctor.license}`,
        display: data.doctor.name,
        identifier: {
          system: 'urn:healthflow:hpr:license',
          value: data.doctor.license,
        },
      },
      reasonCode: data.icdCode ? [{
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: data.icdCode,
          display: data.diagnosis,
        }],
        text: data.diagnosis,
      }] : [{ text: data.diagnosis }],
      note: data.clinicalNotes ? [{ text: data.clinicalNotes }] : undefined,
      // Application-specific fields passed through
      patient: data.patient,
      doctor: data.doctor,
      diagnosis: data.diagnosis,
      icdCode: data.icdCode,
      clinicalNotes: data.clinicalNotes,
      medications: data.medications,
      medicationRequest: data.medications.map((med) => ({
        medicationCodeableConcept: {
          coding: [{
            system: 'urn:eda:drug-registry',
            code: med.drugId || med.medicineId,
            display: med.medicineName,
          }],
        },
        dosageInstruction: [{
          text: `${med.dosage} - ${med.frequency} - ${med.duration}`,
          timing: { code: { text: med.frequency } },
          doseAndRate: [{
            doseQuantity: {
              value: med.doseQuantity || parseFloat(med.dosage) || 1,
              unit: med.medicineForm || 'dose',
            },
          }],
        }],
        dispenseRequest: {
          quantity: {
            value: med.quantity,
            unit: med.medicineForm || 'unit',
          },
          numberOfRepeatsAllowed: med.refills || 0,
        },
      })),
    };
  }
}

export const apiService = new NDPApiService();
export default apiService;
