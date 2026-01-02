import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  CircularProgress,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  PersonRemove as UnassignIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Close as CloseIcon,
  SelectAll as SelectAllIcon,
  PersonAdd as SendHelpIcon,
  Group as GroupIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  PersonOff as CallOutIcon,
  Sick as SickIcon,
  BeachAccess as VacationIcon,
  EventBusy as PersonalIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';
import AssignedAvatars from '../common/AssignedAvatars';
import ModifyCrewDialog from './ModifyCrewDialog';
import EmployeeCallOutDialog from './EmployeeCallOutDialog';
import { useSchedule } from './ScheduleContext';
import {
  formatDateDisplayLong,
  formatTime,
} from './scheduleHelpers';
import logger from '../../utils/logger';

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

function ScheduleDispatch({ userRole }) {
  // Mobile detection for responsive dialogs
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Use shared schedule context - single day view only for Dispatch
  const {
    employees,
    employeeAvailability,
    workOrders: allJobs,
    scheduleEntries,
    loading,
    selectedDate,
    setSelectedDate,
    refreshSchedule,
  } = useSchedule();

  // Get unavailability for a specific employee on the selected date
  const getEmployeeUnavailability = useCallback((username) => {
    if (!employeeAvailability) return null;
    return employeeAvailability.find(avail =>
      avail.employee_username === username &&
      selectedDate >= avail.start_date &&
      selectedDate <= avail.end_date
    );
  }, [employeeAvailability, selectedDate]);

  // Note: Date reset to today is handled in Schedule.js when switching to this tab

  // Bulk selection state
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState(new Set());
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkScheduledDate, setBulkScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkSelectedEmployees, setBulkSelectedEmployees] = useState([]);

  // Conflict detection state for bulk assign
  const [bulkConflictDialogOpen, setBulkConflictDialogOpen] = useState(false);
  const [bulkConflicts, setBulkConflicts] = useState([]);
  const [checkingBulkConflicts, setCheckingBulkConflicts] = useState(false);

  // Modify crew dialog state (uses shared ModifyCrewDialog component for ALL crew modifications)
  const [modifyCrewDialogOpen, setModifyCrewDialogOpen] = useState(false);
  const [jobToModify, setJobToModify] = useState(null);

  // Call-out dialog state
  const [callOutDialogOpen, setCallOutDialogOpen] = useState(false);
  const [employeeToCallOut, setEmployeeToCallOut] = useState(null);

  // Filter state - default to unassigned jobs
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('unassigned');

  // Drag and drop state
  const [draggedJob, setDraggedJob] = useState(null);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Get all jobs for dispatch, ordered by priority:
  // 1. Unassigned (pending/new jobs needing assignment)
  // 2. In Progress (active work)
  // 3. Scheduled (upcoming work)
  // 4. Completed (finished, shown last)
  const dispatchJobs = useMemo(() => {
    const getJobPriority = (job) => {
      if (!job.assigned_to) return 0; // Unassigned - highest priority
      if (job.status === 'in_progress') return 1; // Active work
      if (job.status === 'scheduled' || job.status === 'pending') return 2; // Scheduled
      if (job.status === 'completed') return 3; // Completed - lowest priority
      return 2; // Default
    };

    return [...allJobs].sort((a, b) => {
      const priorityDiff = getJobPriority(a) - getJobPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      // Secondary sort by date
      return (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
    });
  }, [allJobs]);

  // For backwards compatibility - unassigned jobs only
  const unassignedJobs = useMemo(() => {
    return allJobs.filter(wo => !wo.assigned_to && wo.status !== 'completed');
  }, [allJobs]);

  // Get jobs for a specific date by employee (used for single date view)
  const getJobsForEmployeeOnDate = useCallback((username, date = selectedDate) => {
    return allJobs.filter(job => {
      if (job.status === 'completed') return false;
      if (!job.assigned_to) return false;

      const assignees = job.assigned_to.split(',').map(u => u.trim());
      if (!assignees.includes(username)) return false;

      if (!job.scheduled_date) return false;
      return job.scheduled_date === date;
    });
  }, [allJobs, selectedDate]);

  // Get schedule entries for an employee for the selected date
  const getScheduleEntriesForEmployee = useCallback((username) => {
    return scheduleEntries.filter(entry =>
      entry.username === username && entry.scheduled_date === selectedDate
    );
  }, [scheduleEntries, selectedDate]);

  // Get other crew members for a schedule entry (excluding current employee)
  const getOtherCrewMembers = useCallback((entry, currentUsername) => {
    if (!entry.all_crew) return [];
    return entry.all_crew.filter(c => c.username !== currentUsername);
  }, []);

  // Get all active jobs (for "All Jobs" section)
  const allActiveJobs = useMemo(() => {
    return allJobs.filter(job => job.status !== 'completed');
  }, [allJobs]);

  // Count schedule entries for each employee in selection (uses per-employee data)
  const employeeJobCounts = useMemo(() => {
    const counts = {};
    employees.forEach(emp => {
      counts[emp.username] = getScheduleEntriesForEmployee(emp.username).length;
    });
    return counts;
  }, [employees, getScheduleEntriesForEmployee]);

  // Get assigned workers for a job (supports multiple workers)
  const getAssignedWorkers = useCallback((job) => {
    if (!job.assigned_to) return [];
    const usernames = job.assigned_to.split(',').map(u => u.trim()).filter(Boolean);
    return usernames.map(username => {
      const employee = employees.find(e => e.username === username);
      return employee || { username, full_name: username };
    });
  }, [employees]);

  // Filter jobs for dispatch panel (all jobs, filtered and ordered)
  const filteredUnassignedJobs = useMemo(() => {
    return dispatchJobs.filter(job => {
      if (filterPriority !== 'all' && job.priority !== filterPriority) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'unassigned') {
          if (job.assigned_to) return false;
        } else if (job.status !== filterStatus) {
          return false;
        }
      }
      return true;
    });
  }, [dispatchJobs, filterPriority, filterStatus]);

  // Simple single-day navigation
  const goToPreviousDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // Open ModifyCrewDialog for assigning or modifying crew on a job
  // Uses shared ModifyCrewDialog component for consistent behavior across all schedule views
  const handleOpenAssignDialog = (job) => {
    setJobToModify(job);
    setModifyCrewDialogOpen(true);
  };

  // Open Call-Out dialog for an employee (sick day, PTO, etc.)
  const handleOpenCallOutDialog = (employee) => {
    setEmployeeToCallOut(employee);
    setCallOutDialogOpen(true);
  };

  // Handle call-out success - refresh schedule
  const handleCallOutSuccess = () => {
    refreshSchedule();
    setSnackbar({
      open: true,
      message: `${employeeToCallOut?.full_name || 'Employee'} marked unavailable and removed from scheduled jobs`,
      severity: 'warning',
    });
  };

  // Handle unassign job
  const handleUnassignJob = async (job) => {
    try {
      const token = localStorage.getItem('token');

      const crewResponse = await fetch(`${API_BASE_URL}/work-orders/${job.id}/crew`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set',
          employees: [],
          sync_to_dates: true,
        }),
      });

      if (crewResponse.ok) {
        await fetch(`${API_BASE_URL}/work-orders/${job.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assigned_to: null,
            status: 'pending',
          }),
        });

        setSnackbar({
          open: true,
          message: `Job ${job.work_order_number} unassigned`,
          severity: 'success'
        });
        refreshSchedule();
      } else {
        setSnackbar({ open: true, message: 'Failed to unassign job', severity: 'error' });
      }
    } catch (err) {
      logger.error('Error unassigning job:', err);
      setSnackbar({ open: true, message: 'Error unassigning job', severity: 'error' });
    }
  };

  // Bulk selection handlers
  const handleToggleBulkSelect = () => {
    setBulkSelectMode(!bulkSelectMode);
    setSelectedJobIds(new Set());
  };

  const handleToggleJobSelection = (jobId) => {
    const newSelected = new Set(selectedJobIds);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobIds(newSelected);
  };

  const handleSelectAllJobs = () => {
    if (selectedJobIds.size === filteredUnassignedJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(filteredUnassignedJobs.map(j => j.id)));
    }
  };

  // Bulk assignment
  const handleOpenBulkAssignDialog = () => {
    if (selectedJobIds.size === 0) return;
    setBulkSelectedEmployees([]);
    setBulkScheduledDate(selectedDate);
    setBulkAssignDialogOpen(true);
  };

  // Check for schedule conflicts before bulk assign
  const checkBulkConflicts = async () => {
    if (selectedJobIds.size === 0 || bulkSelectedEmployees.length === 0) return;

    setCheckingBulkConflicts(true);
    const token = localStorage.getItem('token');
    const allConflicts = [];

    // Check each employee for conflicts on the scheduled date
    for (const emp of bulkSelectedEmployees) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/employees/${emp.username}/schedule-conflicts`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dates: [bulkScheduledDate],
              start_time: '07:00',
              end_time: '15:30',
              // Don't exclude any jobs - we want to see all conflicts
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.has_conflicts) {
            data.conflicts.forEach(conflict => {
              // Only add if not one of the jobs being assigned
              if (!selectedJobIds.has(conflict.work_order_id)) {
                allConflicts.push({
                  ...conflict,
                  employee_username: emp.username,
                  employee_name: emp.full_name || emp.username,
                });
              }
            });
          }
        }
      } catch (err) {
        logger.error(`Error checking conflicts for ${emp.username}:`, err);
      }
    }

    setCheckingBulkConflicts(false);

    if (allConflicts.length > 0) {
      setBulkConflicts(allConflicts);
      setBulkConflictDialogOpen(true);
      return false; // Has conflicts
    }

    return true; // No conflicts
  };

  // Clear conflicts for bulk assign
  const clearBulkConflicts = async () => {
    const token = localStorage.getItem('token');

    // Group conflicts by employee
    const conflictsByEmployee = {};
    bulkConflicts.forEach(conflict => {
      if (!conflictsByEmployee[conflict.employee_username]) {
        conflictsByEmployee[conflict.employee_username] = [];
      }
      conflictsByEmployee[conflict.employee_username].push(conflict);
    });

    // Clear conflicts for each employee
    for (const [username, empConflicts] of Object.entries(conflictsByEmployee)) {
      const dates = [...new Set(empConflicts.map(c => c.date))];

      try {
        await fetch(
          `${API_BASE_URL}/employees/${username}/clear-schedule-conflicts`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dates: dates,
              start_time: '07:00',
              end_time: '15:30',
            }),
          }
        );
      } catch (err) {
        logger.error(`Error clearing conflicts for ${username}:`, err);
      }
    }
  };

  // Handle bulk assign - checks for conflicts first
  const handleBulkAssign = async () => {
    if (selectedJobIds.size === 0 || bulkSelectedEmployees.length === 0) return;

    // Check for conflicts first
    const noConflicts = await checkBulkConflicts();
    if (!noConflicts) {
      return; // Conflict dialog will be shown
    }

    // No conflicts, proceed with assignment
    await executeBulkAssign();
  };

  // Handle proceeding with bulk assign after confirming conflicts
  const handleProceedBulkAssignWithConflicts = async () => {
    setBulkConflictDialogOpen(false);

    // Clear the conflicting schedules first
    await clearBulkConflicts();

    // Then proceed with the assignment
    await executeBulkAssign();
  };

  // Execute the actual bulk assignment
  const executeBulkAssign = async () => {
    try {
      const token = localStorage.getItem('token');
      const assignedUsernames = bulkSelectedEmployees.map(e => e.username);

      const updatePromises = Array.from(selectedJobIds).map(async (jobId) => {
        await fetch(`${API_BASE_URL}/work-orders/${jobId}/crew`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'set',
            employees: assignedUsernames,
            sync_to_dates: true,
          }),
        });

        return fetch(`${API_BASE_URL}/work-orders/${jobId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assigned_to: assignedUsernames.join(','),
            status: 'scheduled',
            scheduled_date: bulkScheduledDate,
          }),
        });
      });

      await Promise.all(updatePromises);

      setSnackbar({
        open: true,
        message: `${selectedJobIds.size} job(s) assigned to ${bulkSelectedEmployees.length} worker(s)`,
        severity: 'success'
      });

      setBulkAssignDialogOpen(false);
      setBulkSelectMode(false);
      setSelectedJobIds(new Set());
      setBulkSelectedEmployees([]);
      refreshSchedule();
    } catch (err) {
      logger.error('Error bulk assigning jobs:', err);
      setSnackbar({ open: true, message: 'Error bulk assigning jobs', severity: 'error' });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnEmployee = (e, employee) => {
    e.preventDefault();
    if (!draggedJob) return;

    // Open the ModifyCrewDialog - it handles its own state internally
    setJobToModify(draggedJob);
    setModifyCrewDialogOpen(true);
    setDraggedJob(null);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
  };

  // Handle success from ModifyCrewDialog
  const handleModifyCrewSuccess = (result) => {
    setSnackbar({
      open: true,
      message: result.message,
      severity: 'success'
    });
    setJobToModify(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'scheduled': return 'info';
      case 'pending': return 'warning';
      case 'delayed':
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  // Count total assigned workers for the day
  const totalWorkersWithJobs = employees.filter(emp => employeeJobCounts[emp.username] > 0).length;
  const totalWorkersAvailable = employees.length - totalWorkersWithJobs;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, bgcolor: '#f5f5f5', minHeight: 'calc(100vh - 180px)' }}>
      {/* Date Navigation Header - Single Day View */}
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          {/* Date Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={goToPreviousDay} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <TextField
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              size="small"
              sx={{ width: { xs: 130, sm: 150 } }}
            />
            <IconButton onClick={goToNextDay} size="small">
              <ChevronRightIcon />
            </IconButton>
            {!isToday && (
              <Button
                variant="text"
                size="small"
                startIcon={<TodayIcon />}
                onClick={goToToday}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                Today
              </Button>
            )}
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 500,
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                display: { xs: 'none', sm: 'block' }
              }}
            >
              {formatDateDisplayLong(selectedDate)}
            </Typography>
          </Box>

          {/* Stats */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              icon={<GroupIcon />}
              label={`${totalWorkersWithJobs}`}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ '& .MuiChip-label': { px: { xs: 0.5, sm: 1 } } }}
            />
            <Chip
              label={`${totalWorkersAvailable} free`}
              color="success"
              variant="outlined"
              size="small"
              sx={{ '& .MuiChip-label': { px: { xs: 0.5, sm: 1 } } }}
            />
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={{ xs: 1, sm: 2 }}>
        {/* Left Panel - All Jobs */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, height: { xs: 'auto', md: 'calc(100vh - 320px)' }, maxHeight: { xs: 300, md: 'none' }, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">
                Jobs ({filteredUnassignedJobs.length})
              </Typography>
              <Tooltip title={bulkSelectMode ? 'Exit bulk mode' : 'Bulk select'}>
                <IconButton
                  size="small"
                  onClick={handleToggleBulkSelect}
                  color={bulkSelectMode ? 'primary' : 'default'}
                >
                  <SelectAllIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={filterPriority}
                  label="Priority"
                  onChange={(e) => setFilterPriority(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Jobs</MenuItem>
                  <MenuItem value="unassigned">Unassigned</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="scheduled">Scheduled</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Bulk action bar */}
            {bulkSelectMode && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSelectAllJobs}
                >
                  {selectedJobIds.size === filteredUnassignedJobs.length ? 'Deselect' : 'Select All'}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleOpenBulkAssignDialog}
                  disabled={selectedJobIds.size === 0}
                >
                  Assign ({selectedJobIds.size})
                </Button>
              </Box>
            )}

            <Divider sx={{ mb: 2 }} />

            {/* Job List */}
            <List sx={{ flex: 1, overflow: 'auto' }}>
              {filteredUnassignedJobs.map((job) => {
                const isUnassigned = !job.assigned_to;
                const isCompleted = job.status === 'completed';
                const isInProgress = job.status === 'in_progress';

                // Determine card styling based on status
                const getCardBgColor = () => {
                  if (selectedJobIds.has(job.id)) return '#e3f2fd';
                  if (isCompleted) return '#f5f5f5'; // Muted gray for completed
                  if (isUnassigned) return '#fff3e0'; // Light orange for unassigned (needs attention)
                  if (isInProgress) return '#e8f5e9'; // Light green for in progress
                  return '#fff';
                };

                const getBorderColor = () => {
                  if (draggedJob?.id === job.id || selectedJobIds.has(job.id)) return '#1976d2';
                  if (isCompleted) return '#bdbdbd';
                  if (isUnassigned) return '#ff9800';
                  if (isInProgress) return '#4caf50';
                  return '#e0e0e0';
                };

                return (
                  <ListItem
                    key={job.id}
                    draggable={!bulkSelectMode}
                    onDragStart={(e) => handleDragStart(e, job)}
                    onDragEnd={handleDragEnd}
                    sx={{
                      mb: 1,
                      bgcolor: getCardBgColor(),
                      borderRadius: '8px',
                      border: `${draggedJob?.id === job.id || selectedJobIds.has(job.id) ? '2px' : '1px'} solid ${getBorderColor()}`,
                      cursor: bulkSelectMode ? 'pointer' : 'grab',
                      opacity: isCompleted ? 0.7 : 1,
                      '&:hover': {
                        bgcolor: selectedJobIds.has(job.id) ? '#bbdefb' : (isCompleted ? '#eeeeee' : '#f5f5f5'),
                      },
                      p: 1,
                    }}
                    onClick={bulkSelectMode ? () => handleToggleJobSelection(job.id) : undefined}
                  >
                    {bulkSelectMode && (
                      <Checkbox
                        checked={selectedJobIds.has(job.id)}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                    )}
                    {!bulkSelectMode && (
                      <DragIcon sx={{ mr: 1, color: 'text.secondary', cursor: 'grab', fontSize: 18 }} />
                    )}
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {job.work_order_number}
                          </Typography>
                          {job.priority === 'high' && (
                            <Chip label="!" size="small" color="error" sx={{ height: 16, fontSize: '0.65rem', minWidth: 20 }} />
                          )}
                          {isCompleted && (
                            <Chip label="Done" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#9e9e9e', color: '#fff' }} />
                          )}
                          {isInProgress && (
                            <Chip label="Active" size="small" color="success" sx={{ height: 16, fontSize: '0.6rem' }} />
                          )}
                          {job.assigned_to && !isCompleted && !isInProgress && (
                            <Chip label="Scheduled" size="small" color="info" sx={{ height: 16, fontSize: '0.6rem' }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {job.customer_name}
                          </Typography>
                          {job.assigned_to && (
                            <Typography variant="caption" color="primary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                              {job.assigned_to.split(',').length} worker(s) • {job.scheduled_date || 'No date'}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    {!bulkSelectMode && (
                      <Tooltip title="Add/Modify Crew">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAssignDialog(job);
                          }}
                          color="primary"
                        >
                          <GroupIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </ListItem>
                );
              })}
              {filteredUnassignedJobs.length === 0 && (
                <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                  No jobs match filters
                </Typography>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Right Panel - Employee Cards for Selected Day */}
        <Grid item xs={12} md={9}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            <ScheduleIcon color="primary" />
            Daily Dispatch
          </Typography>

          <Grid container spacing={{ xs: 1, sm: 2 }}>
            {employees.map((employee) => {
              // Use per-employee schedule entries (each employee has their own card for their hours on a job)
              const entriesInRange = getScheduleEntriesForEmployee(employee.username);
              const hasEntries = entriesInRange.length > 0;

              // Check for unavailability
              const unavailability = getEmployeeUnavailability(employee.username);
              const isUnavailable = !!unavailability;

              // Get unavailability icon and color
              const getUnavailabilityConfig = (type) => {
                switch (type) {
                  case 'sick':
                    return { icon: <SickIcon />, color: '#f44336', label: 'Sick' };
                  case 'vacation':
                    return { icon: <VacationIcon />, color: '#2196f3', label: 'Vacation' };
                  case 'personal':
                    return { icon: <PersonalIcon />, color: '#9c27b0', label: 'Personal' };
                  case 'emergency':
                    return { icon: <WarningIcon />, color: '#ff9800', label: 'Emergency' };
                  default:
                    return { icon: <CallOutIcon />, color: '#607d8b', label: 'Unavailable' };
                }
              };

              const unavailConfig = unavailability ? getUnavailabilityConfig(unavailability.availability_type) : null;

              // Calculate total scheduled hours for this employee
              const totalHours = entriesInRange.reduce((sum, e) => sum + (e.scheduled_hours || 0), 0);


              // Render a single schedule entry card
              const renderEntryCard = (entry, key) => {
                const otherCrew = getOtherCrewMembers(entry, employee.username);
                const jobForModify = allJobs.find(j => j.id === entry.work_order_id) || {
                  id: entry.work_order_id,
                  work_order_number: entry.work_order_number,
                  assigned_to: entry.all_crew?.map(c => c.username).join(','),
                };

                return (
                  <Box
                    key={key}
                    sx={{
                      mb: 1,
                      bgcolor: '#f5f5f5',
                      borderRadius: '6px',
                      border: '1px solid #e0e0e0',
                      py: 1,
                      px: 1.5,
                    }}
                  >
                    <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {entry.work_order_number}
                        </Typography>
                        <Chip
                          label={entry.job_status?.replace('_', ' ')}
                          size="small"
                          color={getStatusColor(entry.job_status)}
                          sx={{ height: 18, fontSize: '0.6rem' }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Add/Modify Crew">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenAssignDialog(jobForModify)}
                          >
                            <SendHelpIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Unassign">
                          <IconButton
                            size="small"
                            onClick={() => handleUnassignJob(jobForModify)}
                          >
                            <UnassignIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    {/* Show scheduled hours for this employee */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Chip
                        label={`${entry.scheduled_hours || 8}h`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      {entry.start_time && entry.end_time && (
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                        </Typography>
                      )}
                      {entry.is_lead && (
                        <Chip
                          label="Lead"
                          size="small"
                          color="warning"
                          sx={{ height: 18, fontSize: '0.6rem' }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {entry.customer_name}
                    </Typography>
                    {entry.service_address && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                        📍 {entry.service_address}
                      </Typography>
                    )}
                    {/* Show other crew members on this job */}
                    {otherCrew.length > 0 && (
                      <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">With:</Typography>
                        <AssignedAvatars
                          assignedWorkers={otherCrew.map(c => ({
                            username: c.username,
                            full_name: c.full_name,
                          }))}
                          size="small"
                          max={3}
                        />
                      </Box>
                    )}
                  </Box>
                );
              };

              return (
                <Grid item xs={12} sm={6} lg={4} key={employee.id || employee.username}>
                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      height: { xs: 'auto', sm: 280 },
                      minHeight: { xs: 150, sm: 'auto' },
                      maxHeight: { xs: 280, sm: 'none' },
                      display: 'flex',
                      flexDirection: 'column',
                      bgcolor: isUnavailable
                        ? '#ffebee'  // Red tint for unavailable
                        : draggedJob
                          ? (hasEntries ? '#fff' : '#e8f5e9')
                          : '#fff',
                      border: isUnavailable
                        ? `2px solid ${unavailConfig?.color || '#f44336'}`
                        : hasEntries
                          ? '2px solid #2196f3'
                          : '1px solid #e0e0e0',
                      transition: 'all 0.2s',
                      overflow: 'hidden',
                      opacity: isUnavailable ? 0.85 : 1,
                    }}
                    onDragOver={isUnavailable ? undefined : handleDragOver}
                    onDrop={isUnavailable ? undefined : (e) => handleDropOnEmployee(e, employee)}
                  >
                    {/* Unavailability Banner */}
                    {isUnavailable && unavailConfig && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          bgcolor: unavailConfig.color,
                          color: 'white',
                          px: 1.5,
                          py: 0.5,
                          mx: -2,
                          mt: -2,
                          mb: 1.5,
                        }}
                      >
                        {unavailConfig.icon}
                        <Typography variant="body2" fontWeight={500}>
                          {unavailConfig.label}
                        </Typography>
                        {unavailability.reason && (
                          <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.9 }}>
                            {unavailability.reason}
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Employee Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Badge
                        badgeContent={isUnavailable ? '!' : entriesInRange.length}
                        color={isUnavailable ? 'error' : hasEntries ? 'primary' : 'default'}
                        overlap="circular"
                      >
                        <Avatar sx={{ bgcolor: isUnavailable ? unavailConfig?.color : hasEntries ? '#2196f3' : '#9e9e9e' }}>
                          {employee.full_name?.charAt(0) || employee.username.charAt(0)}
                        </Avatar>
                      </Badge>
                      <Box sx={{ ml: 1.5, flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                          {employee.full_name || employee.username}
                        </Typography>
                        <Typography variant="caption" color={isUnavailable ? 'error' : hasEntries ? 'primary' : 'text.secondary'}>
                          {isUnavailable
                            ? `Unavailable - ${unavailConfig?.label}`
                            : hasEntries
                              ? `${entriesInRange.length} job(s), ${totalHours}h today`
                              : 'No jobs assigned'}
                        </Typography>
                      </Box>
                      {/* Call-out / Set Time Off button - hide if already unavailable */}
                      {!isUnavailable && (
                        <Tooltip title="Mark Unavailable / Set Vacation">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleOpenCallOutDialog(employee)}
                            sx={{
                              '&:hover': { bgcolor: '#fff3e0' },
                            }}
                          >
                            <CallOutIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>

                    <Divider sx={{ mb: 1 }} />

                    {/* Schedule Entries List */}
                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                      {hasEntries ? (
                        <List dense sx={{ py: 0 }}>
                          {entriesInRange.map((entry, idx) => (
                            <ListItem
                              key={`${entry.schedule_id}-${entry.username}-${idx}`}
                              sx={{ p: 0, display: 'block' }}
                            >
                              {renderEntryCard(entry, `${entry.schedule_id}-${entry.username}-${idx}`)}
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Box
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px dashed #e0e0e0',
                            borderRadius: 2,
                            bgcolor: draggedJob ? '#e3f2fd' : 'transparent',
                          }}
                        >
                          <Typography variant="body2" color="text.secondary" align="center">
                            {draggedJob ? 'Drop job here' : 'No jobs for this day'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" align="center">
                            Drag a job or use Assign
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

        </Grid>
      </Grid>

      {/* Bulk Assignment Dialog */}
      <Dialog open={bulkAssignDialogOpen} onClose={() => setBulkAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Bulk Assign {selectedJobIds.size} Job(s)
            </Typography>
            <IconButton onClick={() => setBulkAssignDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              multiple
              options={employees}
              disableCloseOnSelect
              value={bulkSelectedEmployees}
              onChange={(event, newValue) => setBulkSelectedEmployees(newValue)}
              getOptionLabel={(option) => option.full_name || option.username}
              renderOption={(props, option, { selected }) => {
                const { key, ...rest } = props;
                return (
                  <li key={key} {...rest}>
                    <Checkbox
                      icon={icon}
                      checkedIcon={checkedIcon}
                      style={{ marginRight: 8 }}
                      checked={selected}
                    />
                    <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.75rem' }}>
                      {option.full_name?.charAt(0) || option.username?.charAt(0)}
                    </Avatar>
                    {option.full_name || option.username}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Workers"
                  placeholder="Search employees..."
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...rest } = getTagProps({ index });
                  return (
                    <Chip
                      key={key}
                      avatar={
                        <Avatar sx={{ width: 20, height: 20 }}>
                          {option.full_name?.charAt(0) || option.username?.charAt(0)}
                        </Avatar>
                      }
                      label={option.full_name || option.username}
                      size="small"
                      {...rest}
                    />
                  );
                })
              }
              sx={{ mb: 3 }}
            />

            <TextField
              label="Scheduled Date"
              type="date"
              value={bulkScheduledDate}
              onChange={(e) => setBulkScheduledDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkAssignDialogOpen(false)} disabled={checkingBulkConflicts}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBulkAssign}
            disabled={bulkSelectedEmployees.length === 0 || checkingBulkConflicts}
            startIcon={checkingBulkConflicts ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {checkingBulkConflicts
              ? 'Checking...'
              : `Assign All (${selectedJobIds.size} jobs to ${bulkSelectedEmployees.length} worker${bulkSelectedEmployees.length !== 1 ? 's' : ''})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Assign Conflict Warning Dialog */}
      <Dialog
        open={bulkConflictDialogOpen}
        onClose={() => setBulkConflictDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#ff9800', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon />
          Schedule Conflict Detected
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            The following workers already have jobs scheduled during this time.
            Proceeding will adjust their existing schedules to accommodate this assignment.
          </Alert>

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Conflicting Assignments:
          </Typography>

          <List dense sx={{ bgcolor: '#f5f5f5', borderRadius: 1 }}>
            {bulkConflicts.map((conflict, index) => (
              <React.Fragment key={`${conflict.employee_username}-${conflict.date}-${index}`}>
                {index > 0 && <Divider />}
                <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mb: 0.5 }}>
                    <ScheduleIcon color="warning" sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {conflict.employee_name}
                    </Typography>
                    <Chip
                      label={new Date(conflict.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric'
                      })}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  </Box>
                  <Box sx={{ pl: 4, width: '100%' }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      <strong>Current:</strong> {conflict.work_order_number} - {conflict.job_description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {conflict.customer_name}
                    </Typography>
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                      Overlap: {formatTime(conflict.existing_start_time)} - {formatTime(conflict.existing_end_time)}
                      {' '}({conflict.overlap_hours} hrs conflict)
                    </Typography>
                  </Box>
                </ListItem>
              </React.Fragment>
            ))}
          </List>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              <strong>What happens if you proceed:</strong> Only the overlapping hours will be adjusted on the existing
              schedule. Hours outside the conflict window will remain unchanged.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #eee' }}>
          <Button onClick={() => setBulkConflictDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleProceedBulkAssignWithConflicts}
            startIcon={<WarningIcon />}
          >
            Proceed & Adjust Schedules
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modify Crew Dialog - Using shared component (allows multi-day scheduling) */}
      <ModifyCrewDialog
        open={modifyCrewDialogOpen}
        onClose={() => {
          setModifyCrewDialogOpen(false);
          setJobToModify(null);
        }}
        workOrder={jobToModify}
        defaultDate={selectedDate}
        onSuccess={handleModifyCrewSuccess}
      />

      {/* Employee Call-Out Dialog */}
      <EmployeeCallOutDialog
        open={callOutDialogOpen}
        onClose={() => {
          setCallOutDialogOpen(false);
          setEmployeeToCallOut(null);
        }}
        employee={employeeToCallOut}
        selectedDate={selectedDate}
        onSuccess={handleCallOutSuccess}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ScheduleDispatch;
