import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Skeleton,
  Tooltip,
  FormControl,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  Cancel as CancelIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiService } from '../services/api';
import { StatusChip } from '../components/prescription';
import { useDebounce } from '../hooks';
import { SEARCH_DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from '../config/constants';
import type { Prescription, PrescriptionStatus } from '../types';

const statusOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_validation', label: 'Pending Validation' },
  { value: 'approved', label: 'Approved' },
  { value: 'dispensed', label: 'Dispensed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

export default function PrescriptionHistory() {
  const navigate = useNavigate();
  const location = useLocation();

  // Data state
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);

  // UI state
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  // Check for success message from navigation state
  useEffect(() => {
    const state = location.state as { success?: string } | null;
    if (state?.success) {
      setSuccessMessage(state.success);
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiService.listPrescriptions({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      });

      if (response.success) {
        let data = response.data || [];

        // Apply client-side filtering (in production, this should be server-side)
        if (statusFilter !== 'all') {
          data = data.filter((p) => p.status === statusFilter);
        }

        if (debouncedSearch) {
          const search = debouncedSearch.toLowerCase();
          data = data.filter(
            (p) =>
              p.prescriptionNumber.toLowerCase().includes(search) ||
              p.patient.name.toLowerCase().includes(search) ||
              p.diagnosis.toLowerCase().includes(search)
          );
        }

        setPrescriptions(data);
        setTotal(response.total || data.length);
      }
    } catch (err) {
      console.error('Failed to fetch prescriptions:', err);
      setError('Failed to load prescriptions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const handleActionMenuOpen = (event: React.MouseEvent<HTMLElement>, prescription: Prescription) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setSelectedPrescription(prescription);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setSelectedPrescription(null);
  };

  const handleStatusUpdate = async (status: 'approved' | 'cancelled') => {
    if (!selectedPrescription) return;

    setActionLoading(true);
    handleActionMenuClose();

    try {
      await apiService.updatePrescriptionStatus(selectedPrescription.id, status);
      setSuccessMessage(`Prescription ${status === 'approved' ? 'approved' : 'cancelled'} successfully`);
      fetchPrescriptions();
    } catch (err) {
      console.error('Failed to update prescription status:', err);
      setError('Failed to update prescription status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDetails = () => {
    if (selectedPrescription) {
      navigate(`/prescriptions/${selectedPrescription.id}`);
    }
    handleActionMenuClose();
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const canApprove = (status: PrescriptionStatus): boolean => {
    return status === 'draft' || status === 'pending_validation';
  };

  const canCancel = (status: PrescriptionStatus): boolean => {
    return status === 'draft' || status === 'approved';
  };

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
          <Typography variant="h4" fontWeight={700}>
            Prescription History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage all prescriptions
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
          }}
        >
          New Prescription
        </Button>
      </Box>

      {/* Alerts */}
      {successMessage && (
        <Alert
          severity="success"
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setSuccessMessage('')}
        >
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'grey.200',
          borderRadius: 2,
          mb: 3,
        }}
      >
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <TextField
            placeholder="Search by Rx#, patient name, or diagnosis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ minWidth: 300, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'grey.500' }} />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              displayEmpty
              startAdornment={
                <InputAdornment position="start">
                  <FilterIcon sx={{ color: 'grey.500', fontSize: 20 }} />
                </InputAdornment>
              }
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="Refresh">
            <IconButton onClick={fetchPrescriptions} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Table */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'grey.200',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>Rx Number</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Diagnosis</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Medications</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 60 }} align="center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton width={100} /></TableCell>
                    <TableCell><Skeleton width={120} /></TableCell>
                    <TableCell><Skeleton width={150} /></TableCell>
                    <TableCell><Skeleton width={40} /></TableCell>
                    <TableCell><Skeleton width={80} /></TableCell>
                    <TableCell><Skeleton width={90} /></TableCell>
                    <TableCell><Skeleton width={32} /></TableCell>
                  </TableRow>
                ))
              ) : prescriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                      {searchQuery || statusFilter !== 'all'
                        ? 'No prescriptions match your filters'
                        : 'No prescriptions found'}
                    </Typography>
                    {!searchQuery && statusFilter === 'all' && (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/prescriptions/new')}
                      >
                        Create First Prescription
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                prescriptions.map((prescription) => (
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
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {prescription.patient.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {prescription.patient.nationalId}
                      </Typography>
                    </TableCell>
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
                      <Chip
                        label={prescription.medications.length}
                        size="small"
                        sx={{
                          minWidth: 32,
                          bgcolor: 'grey.100',
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={prescription.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(prescription.createdAt), 'MMM dd, yyyy')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(prescription.createdAt), 'HH:mm')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleActionMenuOpen(e, prescription)}
                        disabled={actionLoading}
                      >
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleViewDetails}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>

        {selectedPrescription && canApprove(selectedPrescription.status) && (
          <MenuItem onClick={() => handleStatusUpdate('approved')}>
            <ListItemIcon>
              <ApproveIcon fontSize="small" sx={{ color: 'success.main' }} />
            </ListItemIcon>
            <ListItemText>Approve</ListItemText>
          </MenuItem>
        )}

        {selectedPrescription && canCancel(selectedPrescription.status) && (
          <MenuItem onClick={() => handleStatusUpdate('cancelled')}>
            <ListItemIcon>
              <CancelIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Cancel</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
