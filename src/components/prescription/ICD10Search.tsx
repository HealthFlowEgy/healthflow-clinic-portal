import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// ICD-10 code structure from NLM API
export interface ICD10Code {
  code: string;
  description: string;
}

interface ICD10SearchProps {
  onSelect: (icd10: ICD10Code) => void;
  value?: ICD10Code | null;
  label?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  placeholder?: string;
}

// NLM Clinical Tables API for ICD-10-CM
// API Documentation: https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html
const ICD10_API_URL = 'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search';

async function searchICD10(query: string, maxResults: number = 25): Promise<ICD10Code[]> {
  try {
    const params = new URLSearchParams({
      sf: 'code,name', // Search fields
      terms: query,
      maxList: maxResults.toString(),
    });

    const response = await fetch(`${ICD10_API_URL}?${params}`);
    
    if (!response.ok) {
      throw new Error(`ICD-10 API error: ${response.status}`);
    }

    const data = await response.json();
    
    // NLM API returns: [totalCount, codes[], null, displayStrings[][]]
    // displayStrings is array of [code, name] arrays
    if (!Array.isArray(data) || data.length < 4) {
      return [];
    }

    const codes: string[] = data[1] || [];
    const displayStrings: string[][] = data[3] || [];

    const results: ICD10Code[] = codes.map((code, index) => ({
      code,
      description: displayStrings[index]?.[1] || displayStrings[index]?.[0] || code,
    }));

    return results;
  } catch (error) {
    console.error('ICD-10 search error:', error);
    return [];
  }
}

export default function ICD10Search({
  onSelect,
  value = null,
  label = 'Search Diagnosis (ICD-10)',
  disabled = false,
  error = false,
  helperText,
  placeholder = 'Type diagnosis or ICD-10 code...',
}: ICD10SearchProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ICD10Code[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedValue, setSelectedValue] = useState<ICD10Code | null>(value);

  // Use ref to track the latest search term
  const searchTermRef = useRef('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value
  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Fetch ICD-10 codes with debounce
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    searchTermRef.current = inputValue;

    if (inputValue.length < MIN_SEARCH_LENGTH) {
      setOptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      const currentSearchTerm = searchTermRef.current;

      try {
        const results = await searchICD10(currentSearchTerm, 25);

        if (searchTermRef.current === currentSearchTerm) {
          // Debug: Store for console inspection
          if (typeof window !== 'undefined') {
            (window as unknown as Record<string, unknown>).__icd10Debug = {
              searchTerm: currentSearchTerm,
              results,
              timestamp: new Date().toISOString(),
            };
          }

          setOptions(results);
        }
      } catch (err) {
        console.error('ICD-10 fetch error:', err);
        if (searchTermRef.current === currentSearchTerm) {
          setOptions([]);
        }
      } finally {
        if (searchTermRef.current === currentSearchTerm) {
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);
  }, [inputValue]);

  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, value: string, reason: string) => {
      if (reason === 'input') {
        setInputValue(value);
      } else if (reason === 'clear') {
        setInputValue('');
        setOptions([]);
      }
    },
    []
  );

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, value: ICD10Code | null) => {
      setSelectedValue(value);
      if (value) {
        onSelect(value);
      }
    },
    [onSelect]
  );

  const getOptionLabel = useCallback((option: ICD10Code | string): string => {
    if (typeof option === 'string') {
      return option;
    }
    return option ? `${option.code} - ${option.description}` : '';
  }, []);

  const isOptionEqualToValue = useCallback(
    (option: ICD10Code, value: ICD10Code): boolean => {
      if (!option || !value) return false;
      return option.code === value.code;
    },
    []
  );

  const getOptionKey = useCallback((option: ICD10Code): string => {
    return option.code || `${option.description}-${Math.random()}`;
  }, []);

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      value={selectedValue}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={options}
      loading={loading}
      disabled={disabled}
      getOptionLabel={getOptionLabel}
      getOptionKey={getOptionKey}
      isOptionEqualToValue={isOptionEqualToValue}
      filterOptions={(x) => x}
      clearOnBlur={false}
      selectOnFocus
      handleHomeEndKeys
      freeSolo={false}
      noOptionsText={
        inputValue.length < MIN_SEARCH_LENGTH
          ? 'Type at least 2 characters to search...'
          : loading
          ? 'Searching ICD-10 codes...'
          : 'No matching ICD-10 codes found'
      }
      renderOption={(props, option) => {
        const { key, ...restProps } = props as { key: string } & React.HTMLAttributes<HTMLLIElement>;
        return (
          <Box
            component="li"
            key={key}
            {...restProps}
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={option.code}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    bgcolor: 'warning.100',
                    color: 'warning.800',
                  }}
                />
              </Box>
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
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
          placeholder={placeholder}
          error={error}
          helperText={helperText}
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
