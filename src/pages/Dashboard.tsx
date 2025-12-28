import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Description as PrescriptionIcon,
  CheckCircle as ApprovedIcon,
  Pending as PendingIcon,
  LocalShipping as DispensedIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiService } from '../services/api';
import { StatusChip } from '../components/prescription';
import type { Prescription, DashboardStats } from '../types';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  loading?: boolean;
}

function StatCard({ title, value, icon, color, bgColor, loading }: StatCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: '1px solid',
        borderColor: 'grey.200',
        borderRadius: 2,
        height: '100%',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: color,
          boxShadow: `0 4px 12px ${bgColor}`,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
            {title}
          </Typography>
          {loading ? (
            <Skeleton width={60} height={40} />
          ) : (
            <Typography variant="h3" fontWeight={700} sx={{ color }}>
              {value}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(icon as React.ReactElement, {
            sx: { fontSize: 24, color },
          })}
        </Box>
      </Box>
    </Paper>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    approved: 0,
    pending: 0,
    dispensed: 0,
    cancelled: 0,
  });
  const [recentPrescriptions, setRecentPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Fetch stats and recent prescriptions in parallel
        const [statsData, prescriptionsResponse] = await Promise.all([
          apiService.getDashboardStats(),
          apiService.listPrescriptions({ limit: 10 }),
        ]);

        setStats(statsData);
        
        if (prescriptionsResponse.success) {
          setRecentPrescriptions(prescriptionsResponse.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = [
    {
      title: 'Total Prescriptions',
      value: stats.total,
      icon: <PrescriptionIcon />,
      color: '#0d7fa0',
      bgColor: 'rgba(13, 127, 160, 0.1)',
    },
    {
      title: 'Approved',
      value: stats.approved,
      icon: <ApprovedIcon />,
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
    },
    {
      title: 'Pending',
      value: stats.pending,
      icon: <PendingIcon />,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
    },
    {
      title: 'Dispensed',
      value: stats.dispensed,
      icon: <DispensedIcon />,
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.1)',
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Overview of your prescription activity
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/prescriptions/new')}
          sx={{
            px: 3,
            py: 1.25,
            borderRadius: 2,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #0d7fa0 0%, #084c60 100%)',
            boxShadow: '0 4px 14px rgba(13, 127, 160, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #0a6680 0%, #053340 100%)',
            },
          }}
        >
          New Prescription
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat) => (
          <Grid item xs={12} sm={6} lg={3} key={stat.title}>
            <StatCard {...stat} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {/* Recent Prescriptions */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'grey.200',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2.5,
            borderBottom: '1px solid',
            borderColor: 'grey.200',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TrendingIcon sx={{ color: 'primary.500' }} />
            <Typography variant="h6" fontWeight={600}>
              Recent Prescriptions
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => navigate('/prescriptions')}
            sx={{ fontWeight: 600 }}
          >
            View All
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Rx Number</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Diagnosis</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                // Loading skeletons
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton width={100} /></TableCell>
                    <TableCell><Skeleton width={120} /></TableCell>
                    <TableCell><Skeleton width={150} /></TableCell>
                    <TableCell><Skeleton width={80} /></TableCell>
                    <TableCell><Skeleton width={90} /></TableCell>
                  </TableRow>
                ))
              ) : recentPrescriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <PrescriptionIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
                    <Typography color="text.secondary">
                      No prescriptions yet
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/prescriptions/new')}
                      sx={{ mt: 2 }}
                    >
                      Create First Prescription
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                recentPrescriptions.map((prescription) => (
                  <TableRow
                    key={prescription.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/prescriptions/${prescription.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'primary.600' }}>
                        {prescription.prescriptionNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{prescription.patient.name}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {prescription.diagnosis}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={prescription.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(prescription.createdAt), 'MMM dd, yyyy')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
