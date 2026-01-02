import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';

/**
 * Reusable confirmation dialog component to replace native window.confirm() and alert()
 *
 * Props:
 * - open: boolean - Whether the dialog is open
 * - onClose: function - Called when dialog is closed (cancel or backdrop click)
 * - onConfirm: function - Called when user confirms the action
 * - title: string - Dialog title
 * - message: string - Dialog message/content
 * - confirmText: string - Text for confirm button (default: "Confirm")
 * - cancelText: string - Text for cancel button (default: "Cancel")
 * - confirmColor: string - Color for confirm button (default: "primary")
 * - severity: string - "warning", "error", "info", "success" (affects icon and styling)
 * - showCancel: boolean - Whether to show cancel button (default: true, set false for alert-style)
 */
function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  severity = 'warning',
  showCancel = true,
}) {
  const getIcon = () => {
    switch (severity) {
      case 'error':
        return <ErrorIcon sx={{ fontSize: 48, color: 'error.main', mr: 2 }} />;
      case 'success':
        return <SuccessIcon sx={{ fontSize: 48, color: 'success.main', mr: 2 }} />;
      case 'info':
        return <InfoIcon sx={{ fontSize: 48, color: 'info.main', mr: 2 }} />;
      case 'warning':
      default:
        return <WarningIcon sx={{ fontSize: 48, color: 'warning.main', mr: 2 }} />;
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <DialogTitle id="confirm-dialog-title" sx={{ display: 'flex', alignItems: 'center' }}>
        {getIcon()}
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {showCancel && (
          <Button onClick={onClose} color="inherit">
            {cancelText}
          </Button>
        )}
        <Button onClick={handleConfirm} color={confirmColor} variant="contained" autoFocus>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;
