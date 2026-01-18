import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  PauseCircle as PauseIcon,
  DateRange as DateRangeIcon,
  AllInclusive as InfiniteIcon,
} from '@mui/icons-material';
import { delayWorkOrder } from '../api';

/**
 * Dialog for delaying a job with options for date range or indefinite delay
 */
function DelayJobDialog({ open, onClose, onDelayed, workOrder }) {
  const [delayType, setDelayType] = useState('indefinite'); // 'indefinite' or 'daterange'
  const [delayStartDate, setDelayStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [delayEndDate, setDelayEndDate] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    // Reset form
    setDelayType('indefinite');
    setDelayStartDate(new Date().toISOString().split('T')[0]);
    setDelayEndDate('');
    setDelayReason('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const delayData = {
        delay_start_date: delayStartDate,
        delay_end_date: delayType === 'daterange' ? delayEndDate : null,
        delay_reason: delayReason || null,
      };

      // Validate date range
      if (delayType === 'daterange') {
        if (!delayEndDate) {
          setError('Please select an end date for the delay period');
          setLoading(false);
          return;
        }
        if (delayEndDate < delayStartDate) {
          setError('End date must be after start date');
          setLoading(false);
          return;
        }
      }

      const result = await delayWorkOrder(workOrder.id, delayData);

      // Pass result to parent for display
      if (onDelayed) {
        onDelayed(result);
      }
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!workOrder) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PauseIcon color="warning" />
        Delay Job - {workOrder.work_order_number}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Delaying a job will remove assigned crew from the schedule for the delay period.
        </Typography>

        <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
          <RadioGroup
            value={delayType}
            onChange={(e) => setDelayType(e.target.value)}
          >
            <Box
              sx={{
                border: '1px solid',
                borderColor: delayType === 'indefinite' ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 2,
                mb: 2,
                bgcolor: delayType === 'indefinite' ? 'primary.50' : 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => setDelayType('indefinite')}
            >
              <FormControlLabel
                value="indefinite"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfiniteIcon color={delayType === 'indefinite' ? 'primary' : 'action'} />
                    <Box>
                      <Typography fontWeight="bold">Delay Indefinitely</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Job will remain delayed until manually reactivated.
                        All crew will be removed from future scheduled dates.
                      </Typography>
                    </Box>
                  </Box>
                }
                sx={{ m: 0, alignItems: 'flex-start' }}
              />
            </Box>

            <Box
              sx={{
                border: '1px solid',
                borderColor: delayType === 'daterange' ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 2,
                bgcolor: delayType === 'daterange' ? 'primary.50' : 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => setDelayType('daterange')}
            >
              <FormControlLabel
                value="daterange"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DateRangeIcon color={delayType === 'daterange' ? 'primary' : 'action'} />
                    <Box>
                      <Typography fontWeight="bold">Delay for Date Range</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Job will automatically resume after the delay period.
                        Only crew scheduled during this period will be removed.
                      </Typography>
                    </Box>
                  </Box>
                }
                sx={{ m: 0, alignItems: 'flex-start' }}
              />
            </Box>
          </RadioGroup>
        </FormControl>

        {/* Date fields */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            label="Delay Start Date"
            type="date"
            value={delayStartDate}
            onChange={(e) => setDelayStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          {delayType === 'daterange' && (
            <TextField
              label="Delay End Date"
              type="date"
              value={delayEndDate}
              onChange={(e) => setDelayEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              inputProps={{ min: delayStartDate }}
            />
          )}
        </Box>

        {/* Reason field */}
        <TextField
          label="Reason for Delay"
          value={delayReason}
          onChange={(e) => setDelayReason(e.target.value)}
          multiline
          rows={2}
          fullWidth
          placeholder="e.g., Waiting for permit, Customer requested postponement, Materials on backorder..."
        />

        {/* Warning for indefinite delay */}
        {delayType === 'indefinite' && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Note:</strong> The job will remain delayed until you manually remove the delay.
              Check the Work Orders or Dispatch page to find and reactivate delayed jobs.
            </Typography>
          </Alert>
        )}

        {/* Info for date range delay */}
        {delayType === 'daterange' && delayEndDate && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              The job will automatically resume on{' '}
              <strong>
                {new Date(delayEndDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </strong>{' '}
              at midnight.
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="warning"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <PauseIcon />}
        >
          {loading ? 'Delaying...' : 'Delay Job'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DelayJobDialog;
