import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protected route wrapper that checks Keycloak SSO authentication.
 * If not authenticated, redirects to the login page.
 * Shows a loading spinner while Keycloak is initializing.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: '#f8fafc',
          gap: 2,
        }}
      >
        <CircularProgress size={48} sx={{ color: 'primary.500' }} />
        <Typography variant="body2" color="text.secondary">
          Authenticating with HealthFlow Registry...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login while saving the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
