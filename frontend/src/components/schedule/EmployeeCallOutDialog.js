import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Paper,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Sick as SickIcon,
  BeachAccess as VacationIcon,
  Event as PersonalIcon,
  Warning as EmergencyIcon,
  Work as WorkIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PersonOff as PersonOffIcon,
  Group as GroupIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import {
  employeeCallOut,
  getEmployeesAvailableForDate,
} from '../../api';
import logger from '../../utils/logger';

const UNAVAILABILITY_TYPES = [
  { value: 'sick', label: 'Sick', icon: <SickIcon />, color: '#f44336' },
  { value: 'vacation', label: 'Vacation', icon: <VacationIcon />, color: '#2196f3' },
  { value: 'personal', label: 'Personal', icon: <PersonalIcon />, color: '#9c27b0' },
  { value: 'emergency', label: 'Emergency', icon: <EmergencyIcon />, color: '#ff9800' },
  { value: 'other', label: 'Other', icon: <PersonOffIcon />, color: '#607d8b' },
];

function EmployeeCallOutDialog({ open, onClose, employee, selectedDate, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Form state
  const [availabilityType, setAvailabilityType] = useState('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [removeFromSchedule, setRemoveFromSchedule] = useState(true);

  // Available replacements
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const today = selectedDate || new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
      setAvailabilityType('sick');
      setReason('');
      setRemoveFromSchedule(true);
      setResult(null);
      setError(null);
      setShowAvailable(false);
      setAvailableEmployees([]);
    }
  }, [open, selectedDate]);

  // Fetch available employees when dates change
  const fetchAvailableEmployees = async () => {
    if (!startDate) return;

    setLoadingAvailable(true);
    try {
      const data = await getEmployeesAvailableForDate(startDate);
      // Filter out the employee who is calling out
      const filtered = data.available_employees?.filter(
        e => e.username !== employee?.username
      ) || [];
      setAvailableEmployees(filtered);
    } catch (err) {
      logger.error('Error fetching available employees:', err);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleSubmit = async () => {
    if (!employee?.username) return;

    setLoading(true);
    setError(null);

    try {
      const callOutResult = await employeeCallOut(employee.username, {
        start_date: startDate,
        end_date: endDate,
        availability_type: availabilityType,
        reason: reason || null,
        remove_from_schedule: removeFromSchedule,
      });

      setResult(callOutResult);

      // Fetch available employees if there are affected jobs
      if (callOutResult.affected_jobs?.length > 0) {
        await fetchAvailableEmployees();
        setShowAvailable(true);
      }

      // Only call onSuccess after showing results
      // User will close dialog after reviewing
    } catch (err) {
      setError(err.message || 'Failed to process call-out');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (result?.success) {
      onSuccess?.();
    }
    onClose();
  };

  const getTypeConfig = (type) => {
    return UNAVAILABILITY_TYPES.find(t => t.value === type) || UNAVAILABILITY_TYPES[4];
  };

  const selectedTypeConfig = getTypeConfig(availabilityType);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: result ? '60vh' : 'auto' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonOffIcon color="warning" />
        {result
          ? `Call-Out Processed: ${employee?.full_name || employee?.username}`
          : `Mark ${employee?.full_name || employee?.username} Unavailable`
        }
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!result ? (
          // Form View
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              {UNAVAILABILITY_TYPES.map(type => (
                <Chip
                  key={type.value}
                  icon={type.icon}
                  label={type.label}
                  onClick={() => setAvailabilityType(type.value)}
                  variant={availabilityType === type.value ? 'filled' : 'outlined'}
                  sx={{
                    bgcolor: availabilityType === type.value ? type.color : 'transparent',
                    color: availabilityType === type.value ? 'white' : 'inherit',
                    borderColor: type.color,
                    '&:hover': { bgcolor: type.color, color: 'white' },
                  }}
                />
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>

            <TextField
              label="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              multiline
              rows={2}
              fullWidth
              placeholder="e.g., Doctor's appointment, family emergency..."
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={removeFromSchedule}
                  onChange={(e) => setRemoveFromSchedule(e.target.checked)}
                  color="warning"
                />
              }
              label={
                <Box>
                  <Typography variant="body1">Remove from scheduled jobs</Typography>
                  <Typography variant="caption" color="text.secondary">
                    When enabled, employee will be removed from all jobs during this period
                  </Typography>
                </Box>
              }
            />

            {removeFromSchedule && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  {employee?.full_name || employee?.username} will be removed from all scheduled
                  jobs between {startDate} and {endDate}. You'll see a list of affected jobs
                  that may need reassignment.
                </Typography>
              </Alert>
            )}
          </Box>
        ) : (
          // Results View
          <Box>
            <Alert
              severity="success"
              sx={{ mb: 2 }}
              icon={selectedTypeConfig.icon}
            >
              <Typography variant="body1">
                <strong>{result.employee_name}</strong> marked as {result.availability_type}
                from {result.unavailable_from} to {result.unavailable_to}
              </Typography>
            </Alert>

            {result.total_affected_jobs > 0 ? (
              <>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WorkIcon color="warning" />
                      Affected Jobs ({result.total_affected_jobs})
                    </Typography>
                    {result.jobs_needing_full_reassignment > 0 && (
                      <Chip
                        label={`${result.jobs_needing_full_reassignment} need crew`}
                        color="error"
                        size="small"
                      />
                    )}
                  </Box>

                  <List dense sx={{ maxHeight: 250, overflow: 'auto' }}>
                    {result.affected_jobs.map((job, idx) => (
                      <ListItem
                        key={idx}
                        sx={{
                          bgcolor: job.needs_reassignment ? '#ffebee' : '#fff',
                          borderRadius: 1,
                          mb: 0.5,
                          border: job.needs_reassignment ? '1px solid #ffcdd2' : '1px solid #e0e0e0',
                        }}
                      >
                        <ListItemIcon>
                          {job.needs_reassignment ? (
                            <EmergencyIcon color="error" />
                          ) : (
                            <GroupIcon color="primary" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight="bold">
                                {job.work_order_number}
                              </Typography>
                              <Chip
                                label={job.priority}
                                size="small"
                                color={job.priority === 'urgent' ? 'error' : 'default'}
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                              {job.was_lead && (
                                <Chip
                                  label="Was Lead"
                                  size="small"
                                  color="warning"
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {job.customer_name} - {job.scheduled_date} @ {job.start_time?.slice(0,5) || 'TBD'}
                              </Typography>
                              {job.needs_reassignment ? (
                                <Typography variant="caption" color="error.main" fontWeight="bold">
                                  No crew remaining - needs assignment!
                                </Typography>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  Remaining crew: {job.remaining_crew?.map(c => c.full_name || c.employee_username).join(', ')}
                                  {job.new_lead_assigned && ` (${job.new_lead_assigned} promoted to lead)`}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>

                {/* Available Employees Section */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      if (!showAvailable && availableEmployees.length === 0) {
                        fetchAvailableEmployees();
                      }
                      setShowAvailable(!showAvailable);
                    }}
                  >
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupIcon color="primary" />
                      Available for Reassignment
                    </Typography>
                    <IconButton size="small">
                      {showAvailable ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>

                  <Collapse in={showAvailable}>
                    {loadingAvailable ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : availableEmployees.length > 0 ? (
                      <List dense sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
                        {availableEmployees.map((emp, idx) => (
                          <ListItem
                            key={idx}
                            sx={{
                              bgcolor: emp.is_free ? '#e8f5e9' : '#fff3e0',
                              borderRadius: 1,
                              mb: 0.5,
                            }}
                          >
                            <ListItemIcon>
                              <GroupIcon color={emp.is_free ? 'success' : 'warning'} />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" fontWeight="bold">
                                    {emp.full_name}
                                  </Typography>
                                  {emp.is_free ? (
                                    <Chip label="Free" size="small" color="success" sx={{ height: 18 }} />
                                  ) : (
                                    <Chip label={`${emp.scheduled_hours}h scheduled`} size="small" color="warning" sx={{ height: 18 }} />
                                  )}
                                </Box>
                              }
                              secondary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {emp.phone && (
                                    <>
                                      <PhoneIcon sx={{ fontSize: 12 }} />
                                      <Typography variant="caption">{emp.phone}</Typography>
                                    </>
                                  )}
                                  {!emp.is_free && emp.scheduled_jobs?.length > 0 && (
                                    <Typography variant="caption" color="text.secondary">
                                      On: {emp.scheduled_jobs.map(j => j.work_order_number).join(', ')}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        No other employees are available for this date.
                      </Alert>
                    )}
                  </Collapse>
                </Paper>
              </>
            ) : (
              <Alert severity="info">
                {result.employee_name} had no scheduled jobs for this period.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleSubmit}
              disabled={loading || !startDate || !endDate}
              startIcon={loading ? <CircularProgress size={16} /> : selectedTypeConfig.icon}
            >
              {loading ? 'Processing...' : `Mark ${availabilityType.charAt(0).toUpperCase() + availabilityType.slice(1)}`}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default EmployeeCallOutDialog;
