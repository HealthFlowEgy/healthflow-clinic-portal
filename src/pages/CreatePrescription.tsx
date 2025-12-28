import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Save as SaveIcon,
  Check as CheckIcon,
  Person as PersonIcon,
  MedicalServices as DiagnosisIcon,
  MedicationLiquid as MedicineIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import {
  PatientForm,
  MedicineSearch,
  MedicationList,
  DiagnosisSearch,
} from '../components/prescription';
import type {
  PatientFormData,
  MedicationFormData,
  Medicine,
  PrescriptionCreatePayload,
  ICD10Code,
} from '../types';

// Simple UUID generator fallback
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const steps = [
  { label: 'Patient Information', icon: <PersonIcon /> },
  { label: 'Diagnosis', icon: <DiagnosisIcon /> },
  { label: 'Medications', icon: <MedicineIcon /> },
];

export default function CreatePrescription() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form state
  const [patient, setPatient] = useState<PatientFormData>({
    name: '',
    age: 0,
    gender: '' as 'male' | 'female',
    nationalId: '',
  });
  const [diagnosis, setDiagnosis] = useState('');
  const [selectedICD10, setSelectedICD10] = useState<ICD10Code | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [medications, setMedications] = useState<MedicationFormData[]>([]);

  // UI state
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<{
    patient?: Record<string, string>;
    diagnosis?: string;
    medications?: Record<number, Record<string, string>>;
  }>({});

  const handlePatientChange = (field: keyof PatientFormData, value: string | number) => {
    setPatient((prev) => ({ ...prev, [field]: value }));
    // Clear field error
    if (errors.patient?.[field]) {
      const newPatientErrors = { ...errors.patient };
      delete newPatientErrors[field];
      setErrors((prev) => ({
        ...prev,
        patient: Object.keys(newPatientErrors).length > 0 ? newPatientErrors : undefined,
      }));
    }
  };

  const handleMedicineSelect = (medicine: Medicine) => {
    setMedications((prev) => [
      ...prev,
      {
        medicine,
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 0,
        instructions: '',
      },
    ]);
  };

  const handleMedicationUpdate = (
    index: number,
    field: keyof MedicationFormData,
    value: string | number
  ) => {
    setMedications((prev) =>
      prev.map((med, i) => (i === index ? { ...med, [field]: value } : med))
    );
    // Clear field error
    if (errors.medications?.[index]?.[field]) {
      const newMedErrors = { ...errors.medications };
      const indexErrors = { ...newMedErrors[index] };
      delete indexErrors[field];
      if (Object.keys(indexErrors).length > 0) {
        newMedErrors[index] = indexErrors;
      } else {
        delete newMedErrors[index];
      }
      setErrors((prev) => ({
        ...prev,
        medications: Object.keys(newMedErrors).length > 0 ? newMedErrors : undefined,
      }));
    }
  };

  const handleMedicationRemove = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Validate patient
    const patientErrors: Record<string, string> = {};
    if (!patient.name.trim()) patientErrors.name = 'Patient name is required';
    if (!patient.nationalId || patient.nationalId.length !== 14) {
      patientErrors.nationalId = 'National ID must be 14 digits';
    }
    if (!patient.age || patient.age <= 0) patientErrors.age = 'Valid age is required';
    if (!patient.gender) patientErrors.gender = 'Gender is required';

    if (Object.keys(patientErrors).length > 0) {
      newErrors.patient = patientErrors;
    }

    // Validate diagnosis
    if (!diagnosis.trim()) {
      newErrors.diagnosis = 'Diagnosis is required';
    }

    // Validate medications
    if (medications.length === 0) {
      setError('At least one medication is required');
      setErrors(newErrors);
      return false;
    }

    const medicationErrors: Record<number, Record<string, string>> = {};
    medications.forEach((med, index) => {
      const medErrors: Record<string, string> = {};
      if (!med.dosage.trim()) medErrors.dosage = 'Required';
      if (!med.frequency) medErrors.frequency = 'Required';
      if (!med.duration) medErrors.duration = 'Required';
      if (!med.quantity || med.quantity <= 0) medErrors.quantity = 'Required';

      if (Object.keys(medErrors).length > 0) {
        medicationErrors[index] = medErrors;
      }
    });

    if (Object.keys(medicationErrors).length > 0) {
      newErrors.medications = medicationErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (approve: boolean) => {
    setError('');

    if (!validateForm()) {
      setError('Please correct the errors in the form');
      return;
    }

    setLoading(true);

    try {
      // Build prescription payload
      const payload: PrescriptionCreatePayload = {
        doctor: {
          id: user?.id || generateUUID(),
          name: user?.name || 'Doctor',
          license: user?.license || 'LIC-000',
          specialty: user?.specialty || 'General Medicine',
        },
        patient: {
          id: generateUUID(),
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          nationalId: patient.nationalId,
        },
        diagnosis,
        icdCode: selectedICD10?.code,
        clinicalNotes: clinicalNotes || undefined,
        medications: medications.map((med) => ({
          medicineId: med.medicine?.id || generateUUID(),
          medicineName: med.medicine?.commercialName || '',
          drugId: med.medicine?.drugId,
          medicineGenericName: med.medicine?.genericName,
          medicineStrength: med.medicine?.strength,
          medicineForm: med.medicine?.form,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          quantity: med.quantity,
          instructions: med.instructions,
          icd: selectedICD10?.code, // Include ICD code in each medication
        })),
      };

      // Create prescription
      const response = await apiService.createPrescription(payload);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create prescription');
      }

      const prescriptionId = response.data.id;

      // If approve is requested, update status
      if (approve) {
        await apiService.updatePrescriptionStatus(prescriptionId, 'approved');
      }

      // Navigate to the prescription detail or history
      navigate('/prescriptions', {
        state: { success: `Prescription created${approve ? ' and approved' : ''} successfully!` },
      });
    } catch (err: unknown) {
      console.error('Failed to create prescription:', err);
      const errorMessage =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as Error)?.message ||
        'Failed to create prescription. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!(
          patient.name.trim() &&
          patient.nationalId.length === 14 &&
          patient.age > 0 &&
          patient.gender
        );
      case 1:
        return !!diagnosis.trim();
      case 2:
        return medications.length > 0 &&
          medications.every(
            (med) => med.dosage && med.frequency && med.duration && med.quantity > 0
          );
      default:
        return false;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 4,
        }}
      >
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => navigate(-1)}
          sx={{ borderRadius: 2 }}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            New Prescription
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a new electronic prescription
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Stepper */}
        <Grid item xs={12} lg={3}>
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 2,
              p: 3,
              position: 'sticky',
              top: 80,
            }}
          >
            <Stepper activeStep={activeStep} orientation="vertical">
              {steps.map((step, index) => (
                <Step key={step.label} completed={isStepValid(index)}>
                  <StepLabel
                    onClick={() => setActiveStep(index)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <Typography fontWeight={activeStep === index ? 600 : 400}>
                      {step.label}
                    </Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="caption" color="text.secondary">
                      {index === 0 && 'Enter patient details'}
                      {index === 1 && 'Add diagnosis information'}
                      {index === 2 && 'Add medications'}
                    </Typography>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Paper>
        </Grid>

        {/* Form Content */}
        <Grid item xs={12} lg={9}>
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {/* Section 1: Patient Information */}
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: 'primary.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PersonIcon sx={{ color: 'primary.600' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                  Patient Information
                </Typography>
              </Box>
              <PatientForm
                data={patient}
                onChange={handlePatientChange}
                errors={errors.patient}
                disabled={loading}
              />
            </Box>

            <Divider />

            {/* Section 2: Diagnosis */}
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: 'warning.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <DiagnosisIcon sx={{ color: 'warning.700' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                  Diagnosis
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <DiagnosisSearch
                    label="Search ICD-10 Diagnosis"
                    value={diagnosis}
                    onSelect={(icd10) => {
                      setSelectedICD10(icd10);
                      // Auto-fill diagnosis with ICD-10 description
                      setDiagnosis(`${icd10.code} - ${icd10.description}`);
                      if (errors.diagnosis) {
                        setErrors((prev) => ({ ...prev, diagnosis: undefined }));
                      }
                    }}
                    disabled={loading}
                    helperText="Search by diagnosis name or ICD-10 code (optional)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Diagnosis Description"
                    placeholder="Enter primary diagnosis or select from ICD-10 above..."
                    value={diagnosis}
                    onChange={(e) => {
                      setDiagnosis(e.target.value);
                      if (errors.diagnosis) {
                        setErrors((prev) => ({ ...prev, diagnosis: undefined }));
                      }
                    }}
                    error={!!errors.diagnosis}
                    helperText={errors.diagnosis || (selectedICD10 ? `ICD-10 Code: ${selectedICD10.code}` : '')}
                    disabled={loading}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Clinical Notes (Optional)"
                    placeholder="Additional clinical observations..."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    disabled={loading}
                    multiline
                    rows={3}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Section 3: Medications */}
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: 'success.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MedicineIcon sx={{ color: 'success.700' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                  Medications
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <MedicineSearch
                  onSelect={handleMedicineSelect}
                  label="Search and Add Medicine"
                  disabled={loading}
                />
              </Box>

              <MedicationList
                medications={medications}
                onUpdate={handleMedicationUpdate}
                onRemove={handleMedicationRemove}
                errors={errors.medications}
              />
            </Box>

            <Divider />

            {/* Actions */}
            <Box
              sx={{
                p: 3,
                bgcolor: 'grey.50',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Button
                variant="outlined"
                startIcon={loading ? <CircularProgress size={18} /> : <SaveIcon />}
                onClick={() => handleSubmit(false)}
                disabled={loading}
                sx={{ borderRadius: 2, px: 3 }}
              >
                Save as Draft
              </Button>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CheckIcon />}
                onClick={() => handleSubmit(true)}
                disabled={loading}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  },
                }}
              >
                Submit & Approve
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
