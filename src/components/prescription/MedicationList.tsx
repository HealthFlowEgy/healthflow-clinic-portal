import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  MenuItem,
  Grid,
  Tooltip,
  Chip,
  Divider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  MedicationLiquid as MedicineIcon,
} from '@mui/icons-material';
import { FREQUENCY_OPTIONS, DURATION_OPTIONS } from '../../config/constants';
import type { MedicationFormData } from '../../types';

interface MedicationListProps {
  medications: MedicationFormData[];
  onUpdate: (index: number, field: keyof MedicationFormData, value: string | number) => void;
  onRemove: (index: number) => void;
  errors?: Record<number, Record<string, string>>;
}

export default function MedicationList({
  medications,
  onUpdate,
  onRemove,
  errors = {},
}: MedicationListProps) {
  if (medications.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          borderStyle: 'dashed',
          borderColor: 'grey.300',
          bgcolor: 'grey.50',
        }}
      >
        <MedicineIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          No medications added yet
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Use the search above to add medications to this prescription
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {medications.map((medication, index) => {
        const fieldErrors = errors[index] || {};
        
        return (
          <Paper
            key={index}
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: Object.keys(fieldErrors).length > 0 ? 'error.main' : 'grey.200',
              borderRadius: 2,
              overflow: 'hidden',
              transition: 'border-color 0.2s',
              '&:hover': {
                borderColor: Object.keys(fieldErrors).length > 0 ? 'error.main' : 'primary.300',
              },
            }}
          >
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.5,
                bgcolor: 'grey.50',
                borderBottom: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    bgcolor: 'primary.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MedicineIcon sx={{ fontSize: 18, color: 'primary.600' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {medication.medicine?.commercialName || 'Unknown Medicine'}
                  </Typography>
                  {medication.medicine?.genericName && (
                    <Typography variant="caption" color="text.secondary">
                      {medication.medicine.genericName}
                    </Typography>
                  )}
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {medication.medicine?.strength && (
                  <Chip
                    label={medication.medicine.strength}
                    size="small"
                    sx={{ bgcolor: 'white', border: '1px solid', borderColor: 'grey.300' }}
                  />
                )}
                <Tooltip title="Remove medication">
                  <IconButton
                    size="small"
                    onClick={() => onRemove(index)}
                    sx={{
                      color: 'grey.500',
                      '&:hover': { color: 'error.main', bgcolor: 'error.50' },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Form Fields */}
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Dosage"
                    placeholder="e.g., 100mg"
                    value={medication.dosage}
                    onChange={(e) => onUpdate(index, 'dosage', e.target.value)}
                    error={!!fieldErrors.dosage}
                    helperText={fieldErrors.dosage}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    select
                    label="Frequency"
                    value={medication.frequency}
                    onChange={(e) => onUpdate(index, 'frequency', e.target.value)}
                    error={!!fieldErrors.frequency}
                    helperText={fieldErrors.frequency}
                  >
                    <MenuItem value="">
                      <em>Select frequency</em>
                    </MenuItem>
                    {FREQUENCY_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    select
                    label="Duration"
                    value={medication.duration}
                    onChange={(e) => onUpdate(index, 'duration', e.target.value)}
                    error={!!fieldErrors.duration}
                    helperText={fieldErrors.duration}
                  >
                    <MenuItem value="">
                      <em>Select duration</em>
                    </MenuItem>
                    {DURATION_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Quantity"
                    value={medication.quantity || ''}
                    onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 0)}
                    error={!!fieldErrors.quantity}
                    helperText={fieldErrors.quantity}
                    InputProps={{ inputProps: { min: 1 } }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Special Instructions (Optional)"
                    placeholder="e.g., Take with food, avoid alcohol..."
                    value={medication.instructions || ''}
                    onChange={(e) => onUpdate(index, 'instructions', e.target.value)}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </Box>
          </Paper>
        );
      })}
      
      <Divider sx={{ my: 1 }}>
        <Chip 
          label={`${medications.length} medication${medications.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{ bgcolor: 'primary.50', color: 'primary.700' }}
        />
      </Divider>
    </Box>
  );
}
