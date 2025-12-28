import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { LocalHospital as DiagnosisIcon } from '@mui/icons-material';
import { MIN_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS } from '../../config/constants';
import type { ICD10Code } from '../../types';

// Common ICD-10 codes for Egyptian healthcare context
// This is a subset - in production, use a full ICD-10 API
const COMMON_ICD10_CODES: ICD10Code[] = [
  // Endocrine, nutritional and metabolic diseases (E00-E89)
  { code: 'E10', description: 'Type 1 diabetes mellitus', category: 'Diabetes mellitus' },
  { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', category: 'Diabetes mellitus' },
  { code: 'E11', description: 'Type 2 diabetes mellitus', category: 'Diabetes mellitus' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Diabetes mellitus' },
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Diabetes mellitus' },
  { code: 'E78.0', description: 'Pure hypercholesterolemia', category: 'Metabolic disorders' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Metabolic disorders' },
  { code: 'E66.9', description: 'Obesity, unspecified', category: 'Metabolic disorders' },
  
  // Diseases of the circulatory system (I00-I99)
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Hypertensive diseases' },
  { code: 'I11.9', description: 'Hypertensive heart disease without heart failure', category: 'Hypertensive diseases' },
  { code: 'I20.9', description: 'Angina pectoris, unspecified', category: 'Ischemic heart diseases' },
  { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', category: 'Ischemic heart diseases' },
  { code: 'I25.10', description: 'Atherosclerotic heart disease', category: 'Ischemic heart diseases' },
  { code: 'I48.91', description: 'Atrial fibrillation, unspecified', category: 'Cardiac arrhythmias' },
  { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Heart failure' },
  { code: 'I63.9', description: 'Cerebral infarction, unspecified', category: 'Cerebrovascular diseases' },
  
  // Diseases of the respiratory system (J00-J99)
  { code: 'J00', description: 'Acute nasopharyngitis (common cold)', category: 'Acute upper respiratory infections' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified', category: 'Acute upper respiratory infections' },
  { code: 'J03.90', description: 'Acute tonsillitis, unspecified', category: 'Acute upper respiratory infections' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Acute upper respiratory infections' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism', category: 'Pneumonia' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', category: 'Lower respiratory infections' },
  { code: 'J30.9', description: 'Allergic rhinitis, unspecified', category: 'Allergic conditions' },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified', category: 'COPD' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated', category: 'Asthma' },
  
  // Diseases of the digestive system (K00-K95)
  { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis', category: 'Esophageal diseases' },
  { code: 'K25.9', description: 'Gastric ulcer, unspecified', category: 'Peptic ulcer' },
  { code: 'K29.70', description: 'Gastritis, unspecified, without bleeding', category: 'Gastritis' },
  { code: 'K30', description: 'Functional dyspepsia', category: 'Gastric disorders' },
  { code: 'K59.00', description: 'Constipation, unspecified', category: 'Intestinal disorders' },
  { code: 'K76.0', description: 'Fatty (change of) liver, not elsewhere classified', category: 'Liver diseases' },
  
  // Diseases of the musculoskeletal system (M00-M99)
  { code: 'M54.5', description: 'Low back pain', category: 'Dorsopathies' },
  { code: 'M54.2', description: 'Cervicalgia', category: 'Dorsopathies' },
  { code: 'M79.3', description: 'Panniculitis, unspecified', category: 'Soft tissue disorders' },
  { code: 'M25.50', description: 'Pain in unspecified joint', category: 'Joint disorders' },
  { code: 'M17.9', description: 'Osteoarthritis of knee, unspecified', category: 'Osteoarthritis' },
  { code: 'M81.0', description: 'Age-related osteoporosis without current pathological fracture', category: 'Osteoporosis' },
  
  // Mental and behavioral disorders (F00-F99)
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', category: 'Mood disorders' },
  { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'Anxiety disorders' },
  { code: 'F41.9', description: 'Anxiety disorder, unspecified', category: 'Anxiety disorders' },
  { code: 'F51.01', description: 'Primary insomnia', category: 'Sleep disorders' },
  
  // Diseases of the genitourinary system (N00-N99)
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', category: 'Urinary tract disorders' },
  { code: 'N40.0', description: 'Benign prostatic hyperplasia without lower urinary tract symptoms', category: 'Prostate disorders' },
  { code: 'N18.9', description: 'Chronic kidney disease, unspecified', category: 'Kidney diseases' },
  
  // Diseases of the skin (L00-L99)
  { code: 'L30.9', description: 'Dermatitis, unspecified', category: 'Dermatitis' },
  { code: 'L50.9', description: 'Urticaria, unspecified', category: 'Urticaria' },
  { code: 'L70.0', description: 'Acne vulgaris', category: 'Acne' },
  
  // Infectious diseases (A00-B99)
  { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified', category: 'Intestinal infections' },
  { code: 'B34.9', description: 'Viral infection, unspecified', category: 'Viral infections' },
  
  // Symptoms and signs (R00-R99)
  { code: 'R05', description: 'Cough', category: 'Symptoms' },
  { code: 'R50.9', description: 'Fever, unspecified', category: 'Symptoms' },
  { code: 'R51', description: 'Headache', category: 'Symptoms' },
  { code: 'R10.9', description: 'Unspecified abdominal pain', category: 'Symptoms' },
  { code: 'R53.83', description: 'Other fatigue', category: 'Symptoms' },
  { code: 'R42', description: 'Dizziness and giddiness', category: 'Symptoms' },
  
  // Pregnancy related (O00-O99)
  { code: 'O80', description: 'Encounter for full-term uncomplicated delivery', category: 'Pregnancy' },
  { code: 'Z34.00', description: 'Encounter for supervision of normal first pregnancy, unspecified trimester', category: 'Pregnancy supervision' },
  
  // Injuries (S00-T88)
  { code: 'S00.93XA', description: 'Unspecified superficial injury of head, initial encounter', category: 'Injuries' },
  { code: 'S61.419A', description: 'Unspecified open wound of right hand, initial encounter', category: 'Injuries' },
];

interface DiagnosisSearchProps {
  onSelect: (diagnosis: ICD10Code) => void;
  value?: string;
  label?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  required?: boolean;
}

export default function DiagnosisSearch({
  onSelect,
  value = '',
  label = 'Diagnosis (ICD-10)',
  disabled = false,
  error = false,
  helperText,
  required = false,
}: DiagnosisSearchProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ICD10Code[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [searchTerm, setSearchTerm] = useState('');

  // Memoize the ICD-10 codes for filtering
  const icd10Database = useMemo(() => COMMON_ICD10_CODES, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(inputValue);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Filter ICD-10 codes based on search term
  useEffect(() => {
    if (searchTerm.length < MIN_SEARCH_LENGTH) {
      setOptions([]);
      return;
    }

    setLoading(true);

    // Simulate async search (can be replaced with actual API call)
    const timer = setTimeout(() => {
      const searchLower = searchTerm.toLowerCase();
      
      const filtered = icd10Database.filter(
        (icd) =>
          icd.code.toLowerCase().includes(searchLower) ||
          icd.description.toLowerCase().includes(searchLower) ||
          (icd.category && icd.category.toLowerCase().includes(searchLower))
      );

      // Sort by relevance: exact code match first, then by description match
      filtered.sort((a, b) => {
        const aCodeMatch = a.code.toLowerCase().startsWith(searchLower);
        const bCodeMatch = b.code.toLowerCase().startsWith(searchLower);
        if (aCodeMatch && !bCodeMatch) return -1;
        if (!aCodeMatch && bCodeMatch) return 1;
        return a.description.localeCompare(b.description);
      });

      setOptions(filtered.slice(0, 20)); // Limit to 20 results
      setLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [searchTerm, icd10Database]);

  const handleInputChange = useCallback((_event: React.SyntheticEvent, newValue: string) => {
    setInputValue(newValue);
  }, []);

  const handleChange = useCallback((_event: React.SyntheticEvent, newValue: ICD10Code | string | null) => {
    if (newValue && typeof newValue !== 'string') {
      onSelect(newValue);
      // Keep the selected value displayed
      setInputValue(`${newValue.code} - ${newValue.description}`);
    }
  }, [onSelect]);

  const getOptionLabel = useCallback((option: ICD10Code | string): string => {
    if (typeof option === 'string') {
      return option;
    }
    return `${option.code} - ${option.description}`;
  }, []);

  const isOptionEqualToValue = useCallback((option: ICD10Code, val: ICD10Code): boolean => {
    if (!option || !val) return false;
    return option.code === val.code;
  }, []);

  const getNoOptionsText = () => {
    if (loading) {
      return 'Searching...';
    }
    if (inputValue.length < MIN_SEARCH_LENGTH) {
      return 'Type at least 2 characters to search ICD-10 codes...';
    }
    return 'No matching diagnosis found';
  };

  return (
    <Autocomplete
      freeSolo
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      value={null}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={options}
      loading={loading}
      disabled={disabled}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      filterOptions={(x) => x}
      clearOnBlur={false}
      selectOnFocus
      noOptionsText={getNoOptionsText()}
      loadingText="Searching ICD-10 codes..."
      renderOption={(props, option) => {
        const { key, ...otherProps } = props as { key: string } & React.HTMLAttributes<HTMLLIElement>;
        return (
          <Box
            component="li"
            key={key || option.code}
            {...otherProps}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              py: 1.5,
              px: 2,
              '&:hover': {
                bgcolor: 'warning.50',
              },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                bgcolor: 'warning.100',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              <DiagnosisIcon sx={{ fontSize: 20, color: 'warning.700' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip
                  label={option.code}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    bgcolor: 'warning.100',
                    color: 'warning.800',
                  }}
                />
                {option.category && (
                  <Typography variant="caption" color="text.secondary">
                    {option.category}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" fontWeight={500}>
                {option.description}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="Search by ICD-10 code or diagnosis name..."
          error={error}
          helperText={helperText || 'Search ICD-10 codes (e.g., E11, diabetes, hypertension)'}
          required={required}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="warning" size={20} sx={{ mr: 1 }} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      sx={{
        '& .MuiAutocomplete-listbox': {
          maxHeight: 350,
        },
      }}
    />
  );
}
