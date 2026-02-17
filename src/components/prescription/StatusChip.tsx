import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import {
  CheckCircle as ApprovedIcon,
  Pending as PendingIcon,
  Cancel as CancelledIcon,
  LocalShipping as DispensedIcon,
  Edit as DraftIcon,
  Block as RejectedIcon,
  Schedule as ExpiredIcon,
} from '@mui/icons-material';
import type { PrescriptionStatus } from '../../types';

interface StatusChipProps {
  status: PrescriptionStatus;
  size?: ChipProps['size'];
}

const statusConfig: Record<PrescriptionStatus, {
  label: string;
  color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  icon: React.ReactElement;
  bgcolor: string;
}> = {
  draft: {
    label: 'Draft',
    color: 'default',
    icon: <DraftIcon />,
    bgcolor: '#f1f5f9',
  },
  pending_validation: {
    label: 'Pending',
    color: 'warning',
    icon: <PendingIcon />,
    bgcolor: '#fef3c7',
  },
  active: {
    label: 'Active',
    color: 'success',
    icon: <ApprovedIcon />,
    bgcolor: '#d1fae5',
  },
  approved: {
    label: 'Approved',
    color: 'success',
    icon: <ApprovedIcon />,
    bgcolor: '#d1fae5',
  },
  dispensed: {
    label: 'Dispensed',
    color: 'info',
    icon: <DispensedIcon />,
    bgcolor: '#dbeafe',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'error',
    icon: <CancelledIcon />,
    bgcolor: '#fee2e2',
  },
  rejected: {
    label: 'Rejected',
    color: 'error',
    icon: <RejectedIcon />,
    bgcolor: '#fee2e2',
  },
  expired: {
    label: 'Expired',
    color: 'default',
    icon: <ExpiredIcon />,
    bgcolor: '#e2e8f0',
  },
};

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      icon={React.cloneElement(config.icon, { 
        style: { fontSize: size === 'small' ? 16 : 20 } 
      })}
      sx={{
        fontWeight: 600,
        '& .MuiChip-icon': {
          color: 'inherit',
        },
      }}
    />
  );
}
