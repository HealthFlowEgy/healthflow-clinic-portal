import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { 
  AuthResponse, 
  User, 
  Medicine, 
  Prescription, 
  PrescriptionCreatePayload,
  PrescriptionHistoryItem,
  ApiResponse,
  PaginationParams,
  DashboardStats
} from '../types';
import { 
  AUTH_BASE_URL, 
  API_BASE_URL, 
  API_VERSION,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY
} from '../config/constants';

class APIService {
  private authClient: AxiosInstance;
  private apiClient: AxiosInstance;

  constructor() {
    // Auth client for login/logout
    this.authClient = axios.create({
      baseURL: AUTH_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // API client for prescription service
    this.apiClient = axios.create({
      baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.apiClient.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401 errors
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Clear auth and redirect to login
          this.clearAuth();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Token Management
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }

  private setUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
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
    return !!this.getToken() && !!this.getCurrentUser();
  }

  // Authentication Endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.authClient.post<AuthResponse>('/api/auth/login', {
      email,
      password,
    });

    if (response.data.access_token) {
      this.setToken(response.data.access_token);
      this.setRefreshToken(response.data.refresh_token);
      this.setUser(response.data.user);
    }

    return response.data;
  }

  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        await this.authClient.post('/api/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      // Ignore logout errors
      console.warn('Logout request failed:', error);
    } finally {
      this.clearAuth();
    }
  }

  // Medicine Directory Endpoints
  async searchMedicines(query: string, limit: number = 20): Promise<ApiResponse<Medicine[]>> {
    const response = await this.apiClient.get<ApiResponse<Medicine[]>>('/medicines/search', {
      params: { q: query, limit },
    });
    return response.data;
  }

  async getMedicine(id: string): Promise<ApiResponse<Medicine>> {
    const response = await this.apiClient.get<ApiResponse<Medicine>>(`/medicines/${id}`);
    return response.data;
  }

  async listMedicines(params?: PaginationParams): Promise<ApiResponse<Medicine[]>> {
    const response = await this.apiClient.get<ApiResponse<Medicine[]>>('/medicines', {
      params,
    });
    return response.data;
  }

  // Prescription Endpoints
  async createPrescription(data: PrescriptionCreatePayload): Promise<ApiResponse<Prescription>> {
    const response = await this.apiClient.post<ApiResponse<Prescription>>('/prescriptions', data);
    return response.data;
  }

  async getPrescription(id: string): Promise<ApiResponse<Prescription>> {
    const response = await this.apiClient.get<ApiResponse<Prescription>>(`/prescriptions/${id}`);
    return response.data;
  }

  async listPrescriptions(params?: PaginationParams): Promise<ApiResponse<Prescription[]>> {
    const response = await this.apiClient.get<ApiResponse<Prescription[]>>('/prescriptions', {
      params,
    });
    return response.data;
  }

  async updatePrescriptionStatus(
    id: string, 
    status: string, 
    reason?: string
  ): Promise<ApiResponse<Prescription>> {
    const response = await this.apiClient.put<ApiResponse<Prescription>>(
      `/prescriptions/${id}/status`,
      { status, reason }
    );
    return response.data;
  }

  async deletePrescription(id: string): Promise<ApiResponse<void>> {
    const response = await this.apiClient.delete<ApiResponse<void>>(`/prescriptions/${id}`);
    return response.data;
  }

  async getPrescriptionHistory(id: string): Promise<ApiResponse<PrescriptionHistoryItem[]>> {
    const response = await this.apiClient.get<ApiResponse<PrescriptionHistoryItem[]>>(
      `/prescriptions/${id}/history`
    );
    return response.data;
  }

  async searchPrescriptionByNumber(rxNumber: string): Promise<ApiResponse<Prescription>> {
    const response = await this.apiClient.get<ApiResponse<Prescription>>(
      `/prescriptions/search/number/${encodeURIComponent(rxNumber)}`
    );
    return response.data;
  }

  async searchPrescriptionsByNationalId(nationalId: string): Promise<ApiResponse<Prescription[]>> {
    const response = await this.apiClient.get<ApiResponse<Prescription[]>>(
      `/prescriptions/search/national-id/${encodeURIComponent(nationalId)}`
    );
    return response.data;
  }

  // Dashboard Stats (computed from prescriptions list)
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await this.listPrescriptions({ limit: 1000 });
      const prescriptions = response.data || [];
      
      return {
        total: prescriptions.length,
        approved: prescriptions.filter(p => p.status === 'approved').length,
        pending: prescriptions.filter(p => p.status === 'draft' || p.status === 'pending_validation').length,
        dispensed: prescriptions.filter(p => p.status === 'dispensed').length,
        cancelled: prescriptions.filter(p => p.status === 'cancelled' || p.status === 'rejected').length,
      };
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      return { total: 0, approved: 0, pending: 0, dispensed: 0, cancelled: 0 };
    }
  }
}

export const apiService = new APIService();
export default apiService;
