import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { Layout, ProtectedRoute } from './components/common';
import {
  Login,
  Dashboard,
  CreatePrescription,
  PrescriptionHistory,
  PrescriptionDetail,
} from './pages';

// Create custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#0d7fa0',
      light: '#5bafc8',
      dark: '#084c60',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#e6a600',
      light: '#ffce4d',
      dark: '#b38100',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: '"Cairo", "Poppins", system-ui, sans-serif',
    h1: {
      fontFamily: '"Poppins", system-ui, sans-serif',
      fontWeight: 700,
    },
    h2: {
      fontFamily: '"Poppins", system-ui, sans-serif',
      fontWeight: 700,
    },
    h3: {
      fontFamily: '"Poppins", system-ui, sans-serif',
      fontWeight: 700,
    },
    h4: {
      fontFamily: '"Poppins", system-ui, sans-serif',
      fontWeight: 700,
    },
    h5: {
      fontFamily: '"Poppins", system-ui, sans-serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Poppins", system-ui, sans-serif',
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#f8fafc',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="prescriptions" element={<PrescriptionHistory />} />
              <Route path="prescriptions/new" element={<CreatePrescription />} />
              <Route path="prescriptions/:id" element={<PrescriptionDetail />} />
            </Route>

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
