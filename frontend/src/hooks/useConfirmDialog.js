import { useState, useCallback } from 'react';

/**
 * Custom hook for managing confirmation dialog state
 *
 * Usage:
 * const { dialogProps, confirm, alert } = useConfirmDialog();
 *
 * // In your component:
 * <ConfirmDialog {...dialogProps} />
 *
 * // To show a confirmation:
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Delete Item',
 *     message: 'Are you sure you want to delete this item?',
 *     confirmText: 'Delete',
 *     confirmColor: 'error',
 *   });
 *   if (confirmed) {
 *     // perform delete
 *   }
 * };
 *
 * // To show an alert (no cancel button):
 * await alert({
 *   title: 'Success',
 *   message: 'Operation completed successfully!',
 *   severity: 'success',
 * });
 */
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmColor: 'primary',
    severity: 'warning',
    showCancel: true,
    resolve: null,
  });

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        title: options.title || 'Confirm Action',
        message: options.message || '',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        confirmColor: options.confirmColor || 'primary',
        severity: options.severity || 'warning',
        showCancel: true,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        title: options.title || 'Notice',
        message: options.message || '',
        confirmText: options.confirmText || 'OK',
        cancelText: 'Cancel',
        confirmColor: options.confirmColor || 'primary',
        severity: options.severity || 'info',
        showCancel: false,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(false);
    }
    setDialogState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [dialogState.resolve]);

  const handleConfirm = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(true);
    }
    setDialogState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [dialogState.resolve]);

  const dialogProps = {
    open: dialogState.open,
    onClose: handleClose,
    onConfirm: handleConfirm,
    title: dialogState.title,
    message: dialogState.message,
    confirmText: dialogState.confirmText,
    cancelText: dialogState.cancelText,
    confirmColor: dialogState.confirmColor,
    severity: dialogState.severity,
    showCancel: dialogState.showCancel,
  };

  return { dialogProps, confirm, alert };
}

export default useConfirmDialog;
