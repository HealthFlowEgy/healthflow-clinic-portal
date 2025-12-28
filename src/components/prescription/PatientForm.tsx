import {
  TextField,
  MenuItem,
  Grid,
  InputAdornment,
} from '@mui/material';
import {
  Person as PersonIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';
import type { PatientFormData } from '../../types';

interface PatientFormProps {
  data: PatientFormData;
  onChange: (field: keyof PatientFormData, value: string | number) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export default function PatientForm({
  data,
  onChange,
  errors = {},
  disabled = false,
}: PatientFormProps) {
  const validateNationalId = (value: string): string => {
    // Egyptian National ID is 14 digits
    return value.replace(/\D/g, '').slice(0, 14);
  };

  return (
    <Grid container spacing={2.5}>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Patient Name"
          placeholder="Enter full name"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          error={!!errors.name}
          helperText={errors.name}
          disabled={disabled}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonIcon sx={{ color: 'grey.500' }} />
              </InputAdornment>
            ),
          }}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="National ID"
          placeholder="14-digit National ID"
          value={data.nationalId}
          onChange={(e) => onChange('nationalId', validateNationalId(e.target.value))}
          error={!!errors.nationalId}
          helperText={errors.nationalId || 'Egyptian National ID (14 digits)'}
          disabled={disabled}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <BadgeIcon sx={{ color: 'grey.500' }} />
              </InputAdornment>
            ),
          }}
          inputProps={{
            maxLength: 14,
            inputMode: 'numeric',
          }}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          type="number"
          label="Age"
          placeholder="Years"
          value={data.age || ''}
          onChange={(e) => onChange('age', parseInt(e.target.value) || 0)}
          error={!!errors.age}
          helperText={errors.age}
          disabled={disabled}
          InputProps={{
            inputProps: { min: 0, max: 150 },
          }}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          select
          label="Gender"
          value={data.gender}
          onChange={(e) => onChange('gender', e.target.value)}
          error={!!errors.gender}
          helperText={errors.gender}
          disabled={disabled}
        >
          <MenuItem value="">
            <em>Select gender</em>
          </MenuItem>
          <MenuItem value="male">Male</MenuItem>
          <MenuItem value="female">Female</MenuItem>
        </TextField>
      </Grid>
    </Grid>
  );
}
