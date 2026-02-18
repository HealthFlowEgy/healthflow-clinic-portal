import { useState, useEffect, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import { MedicationLiquid as MedicineIcon } from '@mui/icons-material';
import { apiService } from '../../services/api';
import type { Medicine } from '../../types';

interface MedicineSearchProps {
  onSelect: (medicine: Medicine) => void;
  label?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

export default function MedicineSearch({
  onSelect,
  label = 'Search Medicine',
  disabled = false,
  error = false,
  helperText,
}: MedicineSearchProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  // Use a key to force re-mount the Autocomplete after each selection
  const [resetKey, setResetKey] = useState(0);

  // Search medicines with direct API call
  useEffect(() => {
    // Clear options if input is too short
    if (inputValue.length < 2) {
      setOptions([]);
      return;
    }

    // Set loading state
    setLoading(true);

    // Debounce timer
    const timer = setTimeout(async () => {
      try {
        console.log('[MedicineSearch] Searching for:', inputValue);
        
        // Make API call
        const response = await apiService.searchMedicines(inputValue, 25);
        
        console.log('[MedicineSearch] API response:', response);
        
        // Extract medicines from response
        let medicines: Medicine[] = [];
        
        if (response && response.success && Array.isArray(response.data)) {
          medicines = response.data;
        } else if (response && Array.isArray(response.data)) {
          medicines = response.data;
        } else if (Array.isArray(response)) {
          medicines = response as Medicine[];
        }
        
        console.log('[MedicineSearch] Extracted medicines:', medicines.length);
        
        // Update options
        setOptions(medicines);
      } catch (error) {
        console.error('[MedicineSearch] Error:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    // Cleanup
    return () => {
      clearTimeout(timer);
    };
  }, [inputValue]);

  const handleInputChange = useCallback((_event: React.SyntheticEvent, value: string) => {
    console.log('[MedicineSearch] Input changed to:', value);
    setInputValue(value);
  }, []);

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, value: Medicine | null) => {
      if (value) {
        console.log('[MedicineSearch] Medicine selected:', value);
        onSelect(value);
        // Force full reset: clear state and re-mount the Autocomplete
        setInputValue('');
        setOptions([]);
        setOpen(false);
        setResetKey((prev) => prev + 1);
      }
    },
    [onSelect]
  );

  return (
    <Autocomplete
      key={resetKey}
      value={null}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      loading={loading}
      disabled={disabled}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleChange}
      getOptionLabel={(option) => option.commercialName || ''}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      filterOptions={(x) => x} // Disable client-side filtering
      clearOnBlur={false}
      blurOnSelect={false}
      noOptionsText={
        inputValue.length < 2
          ? 'Type at least 2 characters to search...'
          : loading
          ? 'Searching...'
          : 'No medicines found'
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText || 'Search and select a medicine to add. You can add multiple medications.'}
          placeholder="Type medicine name to search..."
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
            <MedicineIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {option.commercialName}
              </Typography>
              {option.searchName && (
                <Typography variant="caption" color="text.secondary">
                  {option.searchName}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      )}
    />
  );
}
