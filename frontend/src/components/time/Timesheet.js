import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ChevronLeft,
  ChevronRight,
  Send as SendIcon,
  Home as HomeIcon,
  MoreTime as MoreTimeIcon,
  Sick as SickIcon,
  BeachAccess as VacationIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, employeeCallOut, requestPTO } from '../../api';
import AppHeader from '../AppHeader';
import logger from '../../utils/logger';
// Non-job time type labels
const NON_JOB_TIME_TYPES = {
  shop: { label: 'Shop Time', color: '#9c27b0' },
  office: { label: 'Office Time', color: '#2196f3' },
  training: { label: 'Training', color: '#ff9800' },
  travel: { label: 'Travel', color: '#4caf50' },
  meeting: { label: 'Meeting', color: '#607d8b' },
  other: { label: 'Other', color: '#795548' },
};

function Timesheet() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(null);
  const [weekDates, setWeekDates] = useState([]);
  const [timeEntries, setTimeEntries] = useState({});
  const [nonJobTimeEntries, setNonJobTimeEntries] = useState({});
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [selectedNonJobTypes, setSelectedNonJobTypes] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nonJobMenuAnchor, setNonJobMenuAnchor] = useState(null);

  // Call-out (sick day) state
  const [callOutDialogOpen, setCallOutDialogOpen] = useState(false);
  const [callOutLoading, setCallOutLoading] = useState(false);
  const [callOutResult, setCallOutResult] = useState(null);

  // PTO Request state
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [ptoLoading, setPtoLoading] = useState(false);
  const [ptoResult, setPtoResult] = useState(null);
  const [ptoForm, setPtoForm] = useState({
    start_date: '',
    end_date: '',
    availability_type: 'vacation',
    reason: '',
  });

  // Get Monday of current week
  const getMondayOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  };

  // Generate week dates (Mon-Sun)
  const generateWeekDates = (monday) => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format date for API (YYYY-MM-DD)
  const formatDateForAPI = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Get day name
  const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  useEffect(() => {
    const monday = getMondayOfWeek(new Date());
    setCurrentWeekStart(monday);
    setWeekDates(generateWeekDates(monday));
  }, []);

  useEffect(() => {
    if (currentWeekStart) {
      loadTimesheet();
    }
  }, [currentWeekStart]);

  const loadTimesheet = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const weekStart = formatDateForAPI(currentWeekStart);
      const weekEnd = formatDateForAPI(weekDates[6] || currentWeekStart);

      // Load time entries for the week
      const response = await fetch(
        `${API_BASE_URL}/time-entries?start_date=${weekStart}&end_date=${weekEnd}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Organize entries by work_order_id and date (for job entries)
        const organized = {};
        // Organize non-job entries by time_type and date
        const nonJobOrganized = {};

        data.forEach((entry) => {
          if (entry.work_order_id) {
            // Job entry
            if (!organized[entry.work_order_id]) {
              organized[entry.work_order_id] = {
                work_order_number: entry.work_order_number,
                customer_name: entry.customer_name,
                hours: {},
                is_locked: entry.is_locked,
              };
            }
            organized[entry.work_order_id].hours[entry.work_date] = {
              id: entry.id,
              hours: entry.hours_worked,
            };
          } else {
            // Non-job entry
            const timeType = entry.time_type || 'other';
            if (!nonJobOrganized[timeType]) {
              nonJobOrganized[timeType] = {
                hours: {},
                is_locked: entry.is_locked,
              };
            }
            nonJobOrganized[timeType].hours[entry.work_date] = {
              id: entry.id,
              hours: entry.hours_worked,
              notes: entry.notes,
            };
          }
        });

        setTimeEntries(organized);
        setNonJobTimeEntries(nonJobOrganized);

        // Check if week is locked
        if (data.length > 0) {
          setIsLocked(data[0].is_locked);
        }

        // Get list of jobs already in timesheet
        const jobIds = Object.keys(organized).map(Number);
        setSelectedJobs(jobIds);

        // Get list of non-job types already in timesheet
        const nonJobTypes = Object.keys(nonJobOrganized);
        setSelectedNonJobTypes(nonJobTypes);
      }
    } catch (err) {
      logger.error('Error loading timesheet:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableJobs = async () => {
    try {
      const token = localStorage.getItem('token');

      // Get current user info
      const userResponse = await fetch(`${API_BASE_URL}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userResponse.ok) {
        logger.error('Failed to get user info');
        return;
      }

      const user = await userResponse.json();

      // Get all work orders
      const response = await fetch(`${API_BASE_URL}/work-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const orders = data.work_orders || [];

        // Separate assigned vs unassigned jobs
        const assigned = orders.filter(
          (wo) => wo.assigned_to === user.username && !selectedJobs.includes(wo.id)
        );

        const others = orders.filter(
          (wo) => wo.assigned_to !== user.username && !selectedJobs.includes(wo.id)
        );

        // Sort others by status
        const statusOrder = { in_progress: 1, scheduled: 2, pending: 3, completed: 4 };
        others.sort((a, b) => {
          return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        });

        setAssignedJobs(assigned);
        setAvailableJobs(others);
      }
    } catch (err) {
      logger.error('Error loading jobs:', err);
    }
  };

  const handleAddJobClick = () => {
    loadAvailableJobs();
    setJobModalOpen(true);
  };

  const handleSelectJob = (job) => {
    // Add job to timesheet
    setTimeEntries((prev) => ({
      ...prev,
      [job.id]: {
        work_order_number: job.work_order_number,
        customer_name: job.customer_name,
        hours: {},
        is_locked: false,
      },
    }));
    setSelectedJobs((prev) => [...prev, job.id]);
    setJobModalOpen(false);
  };

  const handleRemoveJob = (workOrderId) => {
    if (isLocked) return;

    setTimeEntries((prev) => {
      const updated = { ...prev };
      delete updated[workOrderId];
      return updated;
    });
    setSelectedJobs((prev) => prev.filter((id) => id !== Number(workOrderId)));
  };

  const handleHoursChange = (workOrderId, date, value) => {
    if (isLocked) return;

    const hours = parseFloat(value) || 0;

    setTimeEntries((prev) => ({
      ...prev,
      [workOrderId]: {
        ...prev[workOrderId],
        hours: {
          ...prev[workOrderId].hours,
          [date]: {
            id: prev[workOrderId].hours[date]?.id,
            hours: hours,
          },
        },
      },
    }));
  };

  // Non-job time handlers
  const handleAddNonJobTimeClick = (event) => {
    setNonJobMenuAnchor(event.currentTarget);
  };

  const handleNonJobMenuClose = () => {
    setNonJobMenuAnchor(null);
  };

  const handleSelectNonJobType = (timeType) => {
    if (!selectedNonJobTypes.includes(timeType)) {
      setNonJobTimeEntries((prev) => ({
        ...prev,
        [timeType]: {
          hours: {},
          is_locked: false,
        },
      }));
      setSelectedNonJobTypes((prev) => [...prev, timeType]);
    }
    handleNonJobMenuClose();
  };

  const handleRemoveNonJobType = (timeType) => {
    if (isLocked) return;

    setNonJobTimeEntries((prev) => {
      const updated = { ...prev };
      delete updated[timeType];
      return updated;
    });
    setSelectedNonJobTypes((prev) => prev.filter((t) => t !== timeType));
  };

  const handleNonJobHoursChange = (timeType, date, value) => {
    if (isLocked) return;

    const hours = parseFloat(value) || 0;

    setNonJobTimeEntries((prev) => ({
      ...prev,
      [timeType]: {
        ...prev[timeType],
        hours: {
          ...prev[timeType].hours,
          [date]: {
            id: prev[timeType].hours[date]?.id,
            hours: hours,
          },
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Get current user info
      const userResponse = await fetch(`${API_BASE_URL}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userResponse.ok) {
        logger.error('Failed to get user info');
        setSaving(false);
        return;
      }

      const user = await userResponse.json();

      // Prepare job time entries for submission
      const entries = [];
      Object.keys(timeEntries).forEach((workOrderId) => {
        const job = timeEntries[workOrderId];
        Object.keys(job.hours).forEach((date) => {
          const entry = job.hours[date];
          if (entry.hours > 0) {
            entries.push({
              id: entry.id,
              work_order_id: Number(workOrderId),
              work_date: date,
              hours_worked: entry.hours,
              employee_username: user.username,
              time_type: 'job',
            });
          }
        });
      });

      // Prepare non-job time entries for submission
      Object.keys(nonJobTimeEntries).forEach((timeType) => {
        const typeEntry = nonJobTimeEntries[timeType];
        Object.keys(typeEntry.hours).forEach((date) => {
          const entry = typeEntry.hours[date];
          if (entry.hours > 0) {
            entries.push({
              id: entry.id,
              work_order_id: null,
              work_date: date,
              hours_worked: entry.hours,
              employee_username: user.username,
              time_type: timeType,
            });
          }
        });
      });

      // Save each entry
      for (const entry of entries) {
        if (entry.id) {
          // Update existing
          await fetch(`${API_BASE_URL}/time-entries/${entry.id}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(entry),
          });
        } else {
          // Create new
          await fetch(`${API_BASE_URL}/time-entries`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(entry),
          });
        }
      }

      // Reload timesheet
      await loadTimesheet();
    } catch (err) {
      logger.error('Error saving timesheet:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    // Save first
    await handleSave();

    try {
      const token = localStorage.getItem('token');
      const weekEnd = formatDateForAPI(weekDates[6]);

      // Lock the week
      await fetch(`${API_BASE_URL}/time-entries/lock-week`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ week_ending_date: weekEnd }),
      });

      setIsLocked(true);
      alert('Timesheet submitted successfully!');
    } catch (err) {
      logger.error('Error submitting timesheet:', err);
      alert('Error submitting timesheet');
    }
  };

  const handlePreviousWeek = () => {
    const prevMonday = new Date(currentWeekStart);
    prevMonday.setDate(prevMonday.getDate() - 7);
    setCurrentWeekStart(prevMonday);
    setWeekDates(generateWeekDates(prevMonday));
  };

  const handleNextWeek = () => {
    const nextMonday = new Date(currentWeekStart);
    nextMonday.setDate(nextMonday.getDate() + 7);
    setCurrentWeekStart(nextMonday);
    setWeekDates(generateWeekDates(nextMonday));
  };

  const getTotalHours = (workOrderId) => {
    const job = timeEntries[workOrderId];
    if (!job) return 0;
    return Object.values(job.hours).reduce((sum, entry) => sum + (entry.hours || 0), 0);
  };

  const getNonJobTotalHours = (timeType) => {
    const typeEntry = nonJobTimeEntries[timeType];
    if (!typeEntry) return 0;
    return Object.values(typeEntry.hours).reduce((sum, entry) => sum + (entry.hours || 0), 0);
  };

  const getDailyTotal = (date) => {
    // Sum job entries
    const jobTotal = Object.values(timeEntries).reduce((sum, job) => {
      return sum + (job.hours[date]?.hours || 0);
    }, 0);
    // Sum non-job entries
    const nonJobTotal = Object.values(nonJobTimeEntries).reduce((sum, entry) => {
      return sum + (entry.hours[date]?.hours || 0);
    }, 0);
    return jobTotal + nonJobTotal;
  };

  const getWeekTotal = () => {
    return weekDates.reduce((sum, date) => sum + getDailyTotal(formatDateForAPI(date)), 0);
  };

  // Handle quick call-out (sick day) for today
  const handleCallOutToday = async () => {
    const today = new Date().toISOString().split('T')[0];
    const username = localStorage.getItem('username');

    if (!username) {
      alert('Unable to determine current user');
      return;
    }

    setCallOutLoading(true);
    try {
      const result = await employeeCallOut(username, {
        start_date: today,
        end_date: today,
        availability_type: 'sick',
        reason: 'Called out sick',
        remove_from_schedule: true,
      });
      setCallOutResult(result);
      setCallOutDialogOpen(true);
    } catch (err) {
      logger.error('Error calling out:', err);
      alert('Error recording call-out: ' + err.message);
    } finally {
      setCallOutLoading(false);
    }
  };

  // Handle PTO request submission
  const handlePtoRequest = async () => {
    const username = localStorage.getItem('username');

    if (!username) {
      alert('Unable to determine current user');
      return;
    }

    if (!ptoForm.start_date || !ptoForm.end_date) {
      alert('Please select start and end dates');
      return;
    }

    if (ptoForm.start_date > ptoForm.end_date) {
      alert('End date must be after start date');
      return;
    }

    setPtoLoading(true);
    try {
      const result = await requestPTO(username, {
        start_date: ptoForm.start_date,
        end_date: ptoForm.end_date,
        availability_type: ptoForm.availability_type,
        reason: ptoForm.reason || null,
      });
      setPtoResult(result);
    } catch (err) {
      logger.error('Error requesting PTO:', err);
      alert('Error submitting PTO request: ' + err.message);
    } finally {
      setPtoLoading(false);
    }
  };

  // Open PTO dialog with default dates
  const handleOpenPtoDialog = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    setPtoForm({
      start_date: tomorrowStr,
      end_date: tomorrowStr,
      availability_type: 'vacation',
      reason: '',
    });
    setPtoResult(null);
    setPtoDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppHeader title="Timesheet" />

      <Box sx={{ p: 2 }}>
        {/* Header - stacked on mobile, side by side on desktop */}
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 2,
          mb: 2
        }}>
          {/* Week Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <IconButton onClick={handlePreviousWeek} disabled={isLocked}>
              <ChevronLeft />
            </IconButton>
            <Typography variant="h6" sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
              Week of {currentWeekStart && formatDate(currentWeekStart)} - {weekDates[6] && formatDate(weekDates[6])}
            </Typography>
            <IconButton onClick={handleNextWeek}>
              <ChevronRight />
            </IconButton>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-end' } }}>
            {/* Request PTO button */}
            <Button
              variant="outlined"
              startIcon={<VacationIcon />}
              onClick={handleOpenPtoDialog}
              color="primary"
              size="small"
            >
              Request PTO
            </Button>
            {/* Call Out Sick button - always visible */}
            <Button
              variant="outlined"
              startIcon={callOutLoading ? <CircularProgress size={16} /> : <SickIcon />}
              onClick={handleCallOutToday}
              color="warning"
              size="small"
              disabled={callOutLoading}
            >
              {callOutLoading ? 'Processing...' : 'Call Out Sick'}
            </Button>
            {!isLocked && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddJobClick}
                  size="small"
                >
                  Add Job
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<MoreTimeIcon />}
                  onClick={handleAddNonJobTimeClick}
                  color="secondary"
                  size="small"
                >
                  Add Other Time
                </Button>
                <Menu
                  anchorEl={nonJobMenuAnchor}
                  open={Boolean(nonJobMenuAnchor)}
                  onClose={handleNonJobMenuClose}
                >
                  {Object.entries(NON_JOB_TIME_TYPES).map(([key, { label }]) => (
                    <MenuItem
                      key={key}
                      onClick={() => handleSelectNonJobType(key)}
                      disabled={selectedNonJobTypes.includes(key)}
                    >
                      {label}
                    </MenuItem>
                  ))}
                </Menu>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<SendIcon />}
                onClick={handleSubmit}
                disabled={saving}
                size="small"
              >
                {saving ? 'Submitting...' : 'Submit'}
              </Button>
            </>
          )}
          </Box>
        </Box>

      {isLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This timesheet has been submitted and is locked. Please contact your manager for changes.
        </Alert>
      )}

      {/* Timesheet Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>Job</TableCell>
              {weekDates.map((date, index) => (
                <TableCell key={index} align="center" sx={{ minWidth: 80 }}>
                  <Box>
                    <Typography variant="caption" display="block">
                      {getDayName(date)}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {formatDate(date)}
                    </Typography>
                  </Box>
                </TableCell>
              ))}
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                Total
              </TableCell>
              {!isLocked && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(timeEntries).map((workOrderId) => {
              const job = timeEntries[workOrderId];
              return (
                <TableRow key={workOrderId}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {job.work_order_number}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {job.customer_name}
                    </Typography>
                  </TableCell>
                  {weekDates.map((date, index) => {
                    const dateStr = formatDateForAPI(date);
                    const hours = job.hours[dateStr]?.hours || '';
                    return (
                      <TableCell key={index} align="center">
                        <TextField
                          type="number"
                          value={hours}
                          onChange={(e) => handleHoursChange(workOrderId, dateStr, e.target.value)}
                          disabled={isLocked}
                          size="small"
                          inputProps={{
                            min: 0,
                            max: 24,
                            step: 0.5,
                            style: { textAlign: 'center', padding: '6px' },
                          }}
                          sx={{ width: 70 }}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell align="center">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {getTotalHours(workOrderId).toFixed(1)}
                    </Typography>
                  </TableCell>
                  {!isLocked && (
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveJob(workOrderId)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}

            {/* Non-Job Time Rows */}
            {Object.keys(nonJobTimeEntries).map((timeType) => {
              const typeEntry = nonJobTimeEntries[timeType];
              const typeConfig = NON_JOB_TIME_TYPES[timeType] || { label: timeType, color: '#607d8b' };
              return (
                <TableRow key={`non-job-${timeType}`} sx={{ bgcolor: '#fafafa' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: typeConfig.color,
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: typeConfig.color }}>
                        {typeConfig.label}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Non-billable
                    </Typography>
                  </TableCell>
                  {weekDates.map((date, index) => {
                    const dateStr = formatDateForAPI(date);
                    const hours = typeEntry.hours[dateStr]?.hours || '';
                    return (
                      <TableCell key={index} align="center">
                        <TextField
                          type="number"
                          value={hours}
                          onChange={(e) => handleNonJobHoursChange(timeType, dateStr, e.target.value)}
                          disabled={isLocked}
                          size="small"
                          inputProps={{
                            min: 0,
                            max: 24,
                            step: 0.5,
                            style: { textAlign: 'center', padding: '6px' },
                          }}
                          sx={{ width: 70 }}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell align="center">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: typeConfig.color }}>
                      {getNonJobTotalHours(timeType).toFixed(1)}
                    </Typography>
                  </TableCell>
                  {!isLocked && (
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveNonJobType(timeType)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}

            {/* Daily Totals Row */}
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Daily Total</TableCell>
              {weekDates.map((date, index) => (
                <TableCell key={index} align="center" sx={{ fontWeight: 'bold' }}>
                  {getDailyTotal(formatDateForAPI(date)).toFixed(1)}
                </TableCell>
              ))}
              <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                {getWeekTotal().toFixed(1)}
              </TableCell>
              {!isLocked && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {Object.keys(timeEntries).length === 0 && Object.keys(nonJobTimeEntries).length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">
            No time entries yet. Click "Add Job" for job time or "Add Other Time" for shop, office, or training time.
          </Typography>
        </Box>
      )}

      {/* Job Selection Modal */}
      <Dialog open={jobModalOpen} onClose={() => setJobModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Job to Timesheet</DialogTitle>
        <DialogContent>
          {assignedJobs.length > 0 && (
            <>
              <Typography variant="subtitle2" color="primary" sx={{ mt: 1, mb: 1 }}>
                Your Assigned Jobs
              </Typography>
              <List>
                {assignedJobs.map((job) => (
                  <ListItem
                    key={job.id}
                    button
                    onClick={() => handleSelectJob(job)}
                    sx={{
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: '#e3f2fd',
                    }}
                  >
                    <ListItemText
                      primary={job.work_order_number}
                      secondary={job.customer_name}
                    />
                    <Chip label={job.status} size="small" color="primary" />
                  </ListItem>
                ))}
              </List>
              <Divider sx={{ my: 2 }} />
            </>
          )}

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            All Other Jobs
          </Typography>
          <List>
            {availableJobs.map((job) => (
              <ListItem
                key={job.id}
                button
                onClick={() => handleSelectJob(job)}
                sx={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemText
                  primary={job.work_order_number}
                  secondary={job.customer_name}
                />
                <Chip label={job.status} size="small" />
              </ListItem>
            ))}
          </List>

          {assignedJobs.length === 0 && availableJobs.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
              No jobs available
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJobModalOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Call-Out Result Dialog */}
      <Dialog
        open={callOutDialogOpen}
        onClose={() => {
          setCallOutDialogOpen(false);
          setCallOutResult(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SickIcon color="warning" />
          Call-Out Recorded
        </DialogTitle>
        <DialogContent>
          {callOutResult && (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                You have been marked as <strong>{callOutResult.availability_type}</strong> for{' '}
                {callOutResult.unavailable_from === callOutResult.unavailable_to
                  ? callOutResult.unavailable_from
                  : `${callOutResult.unavailable_from} to ${callOutResult.unavailable_to}`
                }
              </Alert>

              {callOutResult.total_affected_jobs > 0 ? (
                <>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    You have been removed from <strong>{callOutResult.total_affected_jobs}</strong> scheduled job(s):
                  </Typography>
                  <List dense>
                    {callOutResult.affected_jobs.map((job, idx) => (
                      <ListItem key={idx} sx={{ bgcolor: '#f5f5f5', borderRadius: 1, mb: 0.5 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight="bold">
                              {job.work_order_number} - {job.customer_name || 'N/A'}
                            </Typography>
                          }
                          secondary={
                            <>
                              <Typography variant="caption" display="block">
                                {job.service_address}
                              </Typography>
                              <Typography variant="caption" display="block">
                                {job.scheduled_date} @ {job.start_time?.slice(0, 5) || 'TBD'}
                              </Typography>
                              {job.remaining_crew_count > 0 ? (
                                <Typography variant="caption" color="text.secondary">
                                  Remaining crew: {job.remaining_crew?.map(c => c.full_name).join(', ')}
                                </Typography>
                              ) : (
                                <Typography variant="caption" color="error.main" fontWeight="bold">
                                  This job now has no crew assigned
                                </Typography>
                              )}
                            </>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Your manager has been notified and will handle reassignments.
                  </Alert>
                </>
              ) : (
                <Typography color="text.secondary">
                  You had no scheduled jobs for this period.
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              setCallOutDialogOpen(false);
              setCallOutResult(null);
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* PTO Request Dialog */}
      <Dialog
        open={ptoDialogOpen}
        onClose={() => {
          if (!ptoLoading) {
            setPtoDialogOpen(false);
            setPtoResult(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#e3f2fd' }}>
          <VacationIcon color="primary" />
          {ptoResult ? 'PTO Request Submitted' : 'Request Time Off'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {ptoResult ? (
            // Success view
            <Alert severity="success">
              <Typography variant="body1">
                Your PTO request has been submitted for approval.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Dates:</strong> {ptoResult.start_date} to {ptoResult.end_date}
              </Typography>
              <Typography variant="body2">
                <strong>Type:</strong> {ptoResult.availability_type.charAt(0).toUpperCase() + ptoResult.availability_type.slice(1)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Your manager will review and approve or deny this request.
                You'll see the status in the PTO Approval section.
              </Typography>
            </Alert>
          ) : (
            // Form view
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="info" sx={{ mb: 1 }}>
                Request time off for future dates. Your manager will approve or deny this request.
                For same-day call-outs (sick, emergency), use the "Call Out Sick" button instead.
              </Alert>

              <TextField
                select
                label="Type of Time Off"
                value={ptoForm.availability_type}
                onChange={(e) => setPtoForm({ ...ptoForm, availability_type: e.target.value })}
                fullWidth
              >
                <MenuItem value="vacation">Vacation</MenuItem>
                <MenuItem value="personal">Personal Day</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={ptoForm.start_date}
                  onChange={(e) => setPtoForm({ ...ptoForm, start_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  inputProps={{
                    min: new Date().toISOString().split('T')[0]
                  }}
                />
                <TextField
                  label="End Date"
                  type="date"
                  value={ptoForm.end_date}
                  onChange={(e) => setPtoForm({ ...ptoForm, end_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  inputProps={{
                    min: ptoForm.start_date || new Date().toISOString().split('T')[0]
                  }}
                />
              </Box>

              <TextField
                label="Reason (optional)"
                value={ptoForm.reason}
                onChange={(e) => setPtoForm({ ...ptoForm, reason: e.target.value })}
                multiline
                rows={2}
                fullWidth
                placeholder="e.g., Family vacation, appointment..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {ptoResult ? (
            <Button
              variant="contained"
              onClick={() => {
                setPtoDialogOpen(false);
                setPtoResult(null);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setPtoDialogOpen(false)}
                disabled={ptoLoading}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handlePtoRequest}
                disabled={ptoLoading || !ptoForm.start_date || !ptoForm.end_date}
                startIcon={ptoLoading ? <CircularProgress size={16} /> : <VacationIcon />}
              >
                {ptoLoading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}

export default Timesheet;
