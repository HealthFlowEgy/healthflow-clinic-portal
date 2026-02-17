import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Divider,
  Alert,
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  Login as LoginIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

/**
 * Login page - now uses Keycloak SSO from the HCP Registry.
 * Instead of a username/password form, this page provides a
 * "Sign in with HealthFlow Registry" button that redirects
 * to the Keycloak login page.
 */
export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading, error: authError, clearError } = useAuth();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSSOLogin = () => {
    clearError();
    login();
  };

  // Show loading while Keycloak initializes
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d7fa0 0%, #053340 100%)',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={48} sx={{ color: 'white', mb: 2 }} />
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
            Connecting to HealthFlow Registry...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0d7fa0 0%, #053340 100%)',
        p: 2,
      }}
    >
      {/* Decorative elements */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '-10%',
            right: '-5%',
            width: '40%',
            height: '50%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '-15%',
            left: '-10%',
            width: '50%',
            height: '60%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
          }}
        />
      </Box>

      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 4,
            pb: 3,
            textAlign: 'center',
            background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #0d7fa0 0%, #084c60 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
              boxShadow: '0 4px 14px rgba(13, 127, 160, 0.4)',
            }}
          >
            <HospitalIcon sx={{ fontSize: 40, color: 'white' }} />
          </Box>
          
          <Typography 
            variant="h4" 
            fontWeight={700}
            sx={{
              background: 'linear-gradient(135deg, #0d7fa0 0%, #053340 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 0.5,
            }}
          >
            HealthFlow
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            Clinic Portal
          </Typography>
        </Box>

        <Divider />

        {/* SSO Login Section */}
        <Box sx={{ p: 4 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
            Welcome
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in with your HealthFlow Registry credentials to access the National Digital Prescription platform
          </Typography>

          {authError && (
            <Alert 
              severity="error" 
              sx={{ mb: 3, borderRadius: 2 }}
              onClose={clearError}
            >
              {authError}
            </Alert>
          )}

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<LoginIcon />}
            onClick={handleSSOLogin}
            sx={{
              py: 1.5,
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '1rem',
              background: 'linear-gradient(135deg, #0d7fa0 0%, #084c60 100%)',
              boxShadow: '0 4px 14px rgba(13, 127, 160, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0a6680 0%, #053340 100%)',
                boxShadow: '0 6px 20px rgba(13, 127, 160, 0.5)',
              },
            }}
          >
            Sign in with HealthFlow Registry
          </Button>

          {/* SSO Info */}
          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 2,
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'grey.200',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
            }}
          >
            <SecurityIcon sx={{ color: 'primary.main', fontSize: 20, mt: 0.25 }} />
            <Box>
              <Typography variant="caption" fontWeight={600} color="text.primary">
                Secure Single Sign-On (SSO)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                You will be redirected to the HealthFlow Registry Keycloak login page. 
                Use your registered HCP credentials to authenticate securely via OpenID Connect.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 4,
            py: 2.5,
            bgcolor: 'grey.50',
            borderTop: '1px solid',
            borderColor: 'grey.200',
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Egyptian Drug Authority (EDA) & Ministry of Health
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            National Digital Prescription Platform
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
