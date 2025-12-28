import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Alert,
  Skeleton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as ApproveIcon,
  Cancel as CancelIcon,
  Print as PrintIcon,
  Person as PersonIcon,
  MedicalServices as DiagnosisIcon,
  MedicationLiquid as MedicineIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiService } from '../services/api';
import { StatusChip } from '../components/prescription';
import type { Prescription, PrescriptionHistoryItem, PrescriptionStatus } from '../types';

export default function PrescriptionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [history, setHistory] = useState<PrescriptionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      setLoading(true);
      setError('');

      try {
        const [prescriptionResponse, historyResponse] = await Promise.all([
          apiService.getPrescription(id),
          apiService.getPrescriptionHistory(id).catch(() => ({ success: true, data: [] })),
        ]);

        if (prescriptionResponse.success) {
          setPrescription(prescriptionResponse.data);
        } else {
          throw new Error('Prescription not found');
        }

        if (historyResponse.success) {
          setHistory(historyResponse.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch prescription:', err);
        setError('Failed to load prescription details.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleApprove = async () => {
    if (!prescription) return;

    setActionLoading(true);
    try {
      await apiService.updatePrescriptionStatus(prescription.id, 'approved');
      setSuccessMessage('Prescription approved successfully');
      // Refresh data
      const response = await apiService.getPrescription(prescription.id);
      if (response.success) {
        setPrescription(response.data);
      }
    } catch (err) {
      setError('Failed to approve prescription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!prescription) return;

    setActionLoading(true);
    try {
      await apiService.updatePrescriptionStatus(prescription.id, 'cancelled', cancelReason);
      setSuccessMessage('Prescription cancelled');
      setCancelDialogOpen(false);
      setCancelReason('');
      // Refresh data
      const response = await apiService.getPrescription(prescription.id);
      if (response.success) {
        setPrescription(response.data);
      }
    } catch (err) {
      setError('Failed to cancel prescription');
    } finally {
      setActionLoading(false);
    }
  };

  const canApprove = (status: PrescriptionStatus): boolean => {
    return status === 'draft' || status === 'pending_validation';
  };

  const canCancel = (status: PrescriptionStatus): boolean => {
    return status === 'draft' || status === 'approved';
  };

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 2 }} />
          <Skeleton width={200} height={32} />
        </Box>
        <Paper sx={{ p: 3 }}>
          <Skeleton height={40} sx={{ mb: 2 }} />
          <Skeleton height={200} />
        </Paper>
      </Box>
    );
  }

  if (!prescription) {
    return (
      <Box>
        <Alert severity="error">Prescription not found</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate(-1)}
            sx={{ borderRadius: 2 }}
          >
            Back
          </Button>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h4" fontWeight={700}>
                {prescription.prescriptionNumber}
              </Typography>
              <StatusChip status={prescription.status} size="medium" />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Created on {format(new Date(prescription.createdAt), 'MMMM dd, yyyy at HH:mm')}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            sx={{ borderRadius: 2 }}
            onClick={() => window.print()}
          >
            Print
          </Button>
          
          {canApprove(prescription.status) && (
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={handleApprove}
              disabled={actionLoading}
              sx={{ borderRadius: 2 }}
            >
              Approve
            </Button>
          )}
          
          {canCancel(prescription.status) && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => setCancelDialogOpen(true)}
              disabled={actionLoading}
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
          )}
        </Box>
      </Box>

      {/* Alerts */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} lg={8}>
          {/* Patient Information */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 2,
              mb: 3,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 3,
                py: 2,
                bgcolor: 'grey.50',
                borderBottom: '1px solid',
                borderColor: 'grey.200',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <PersonIcon sx={{ color: 'primary.500' }} />
              <Typography variant="h6" fontWeight={600}>
                Patient Information
              </Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Full Name
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {prescription.patient.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    National ID
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {prescription.patient.nationalId}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Age
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {prescription.patient.age} years
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Gender
                  </Typography>
                  <Typography variant="body1" fontWeight={500} sx={{ textTransform: 'capitalize' }}>
                    {prescription.patient.gender}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Diagnosis */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 2,
              mb: 3,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 3,
                py: 2,
                bgcolor: 'grey.50',
                borderBottom: '1px solid',
                borderColor: 'grey.200',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <DiagnosisIcon sx={{ color: 'warning.600' }} />
              <Typography variant="h6" fontWeight={600}>
                Diagnosis
              </Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <Typography variant="body1" fontWeight={500} sx={{ mb: 2 }}>
                {prescription.diagnosis}
              </Typography>
              {prescription.clinicalNotes && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Clinical Notes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {prescription.clinicalNotes}
                  </Typography>
                </>
              )}
            </Box>
          </Paper>

          {/* Medications */}
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
                py: 2,
                bgcolor: 'grey.50',
                borderBottom: '1px solid',
                borderColor: 'grey.200',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <MedicineIcon sx={{ color: 'success.600' }} />
              <Typography variant="h6" fontWeight={600}>
                Medications
              </Typography>
              <Chip
                label={prescription.medications.length}
                size="small"
                sx={{ ml: 1, bgcolor: 'success.100', color: 'success.700' }}
              />
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Medicine</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Dosage</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Frequency</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {prescription.medications.map((med, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {med.medicineName}
                        </Typography>
                        {med.medicineGenericName && (
                          <Typography variant="caption" color="text.secondary">
                            {med.medicineGenericName}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{med.dosage}</TableCell>
                      <TableCell>{med.frequency?.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{med.duration?.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{med.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Doctor Info */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 2,
              p: 3,
              mb: 3,
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Prescribing Doctor
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {prescription.doctor.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {prescription.doctor.specialty}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              License: {prescription.doctor.license}
            </Typography>
          </Paper>

          {/* History */}
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
                py: 2,
                bgcolor: 'grey.50',
                borderBottom: '1px solid',
                borderColor: 'grey.200',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <HistoryIcon sx={{ color: 'grey.600' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Activity History
              </Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              {history.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No history available
                </Typography>
              ) : (
                history.map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      py: 1.5,
                      borderBottom: index < history.length - 1 ? '1px solid' : 'none',
                      borderColor: 'grey.100',
                    }}
                  >
                    <Typography variant="body2" fontWeight={500}>
                      {item.action}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(item.timestamp), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                  </Box>
                ))
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Prescription</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Are you sure you want to cancel this prescription? This action cannot be undone.
          </Typography>
          <TextField
            fullWidth
            label="Reason for Cancellation (Optional)"
            placeholder="Enter reason..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCancelDialogOpen(false)}>
            Keep Prescription
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={actionLoading}
          >
            Cancel Prescription
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
