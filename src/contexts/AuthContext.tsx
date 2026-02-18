import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import keycloak from '../config/keycloak';
import type { User } from '../types';
import { USER_KEY } from '../config/constants';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  clearError: () => void;
  getToken: () => string | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Extract user profile from Keycloak token claims.
 * Maps standard OIDC claims and custom HCP Registry claims
 * to the application User model.
 */
function extractUserFromKeycloak(): User | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    return null;
  }

  const token = keycloak.tokenParsed as Record<string, unknown>;

  const user: User = {
    id: (token.sub as string) || '',
    email: (token.email as string) || (token.preferred_username as string) || '',
    name: (token.name as string) || 
          `${(token.given_name as string) || ''} ${(token.family_name as string) || ''}`.trim() ||
          (token.preferred_username as string) || 'Healthcare Professional',
    role: mapKeycloakRole(token),
    license: (token.license_number as string) || (token.license as string) || undefined,
    specialty: (token.specialty as string) || (token.specialization as string) || undefined,
    clinicName: (token.clinic_name as string) || undefined,
  };

  return user;
}

/**
 * Map Keycloak realm/client roles to application roles.
 */
function mapKeycloakRole(token: Record<string, unknown>): 'doctor' | 'clinic_staff' {
  // Check realm roles from realm_access (standard Keycloak claim)
  const realmAccess = token.realm_access as { roles?: string[] } | undefined;
  const roles = realmAccess?.roles || [];

  // Check custom realm_roles claim (from our dedicated mapper)
  const customRealmRoles = token.realm_roles as string[] | undefined;

  // Check client-specific roles
  const resourceAccess = token.resource_access as Record<string, { roles?: string[] }> | undefined;
  const clientRoles = resourceAccess?.['clinic-portal']?.roles || [];

  const allRoles = [...roles, ...(customRealmRoles || []), ...clientRoles];

  if (allRoles.some(r => ['doctor', 'physician', 'prescriber'].includes(r.toLowerCase()))) {
    return 'doctor';
  }

  return 'clinic_staff';
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Initialize Keycloak on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init({
          onLoad: 'login-required',
          checkLoginIframe: false,
          pkceMethod: 'S256',
        });

        if (authenticated) {
          const extractedUser = extractUserFromKeycloak();
          setUser(extractedUser);
          if (extractedUser) {
            localStorage.setItem(USER_KEY, JSON.stringify(extractedUser));
          }
        }
      } catch (err) {
        console.error('Keycloak initialization failed:', err);
        setError('Authentication service unavailable. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    // Set up token refresh
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).then((refreshed) => {
        if (refreshed) {
          console.log('[Auth] Token refreshed successfully');
        }
      }).catch(() => {
        console.error('[Auth] Token refresh failed, redirecting to login');
        keycloak.login();
      });
    };

    // Handle auth errors
    keycloak.onAuthError = () => {
      setError('Authentication error occurred');
      setUser(null);
    };

    // Handle logout events
    keycloak.onAuthLogout = () => {
      setUser(null);
      localStorage.removeItem(USER_KEY);
    };

    initKeycloak();
  }, []);

  const login = useCallback(() => {
    keycloak.login();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
    keycloak.logout({
      redirectUri: window.location.origin + '/login',
    });
  }, []);

  const getToken = useCallback((): string | undefined => {
    return keycloak.token;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user && !!keycloak.authenticated,
    clearError,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
