/**
 * ModifyCrewDialog - Shared dialog for adding/modifying crew on a work order
 * Used by ScheduleDispatch, ScheduleCalendar, and ScheduleListDay
 *
 * Features:
 * - Add new workers to a job
 * - Click on existing crew members to modify their schedule
 * - Pre-selects dates when editing an existing crew member's schedule
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Chip,
  Paper,
  Alert,
  IconButton,
  useMediaQuery,
  useTheme,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  GroupAdd as GroupAddIcon,
  Close as CloseIcon,
  LocationOn as LocationIcon,
  DateRange as DateRangeIcon,
  OpenInNew as OpenInNewIcon,
  Edit as EditIcon,
  PersonRemove as RemoveIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  BeachAccess as PTOIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';
import { useSchedule } from './ScheduleContext';
import { formatTime, calculateHoursFromTimes, getStatusChipColor, getDatesInRange } from './scheduleHelpers';
import logger from '../../utils/logger';
function ModifyCrewDialog({
  open,
  onClose,
  workOrder,
  defaultDate = null,
  onSuccess = null,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { employees, refreshSchedule, scheduleEntries } = useSchedule();

  // State
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:30');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Multi-day scheduling state
  const [dateMode, setDateMode] = useState('single'); // 'single' or 'range'
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);

  // Edit mode state - for editing existing crew member's schedule
  const [editMode, setEditMode] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [originalDates, setOriginalDates] = useState([]); // Track original dates for comparison
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Conflict detection state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflicts, setConflicts] = useState([]); // Schedule conflicts (can be overridden)
  const [unavailabilityConflicts, setUnavailabilityConflicts] = useState([]); // PTO/unavailability (blocking)
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // Employee select dropdown state
  const [employeeSelectOpen, setEmployeeSelectOpen] = useState(false);

  // Get current crew usernames - check both workOrder.assigned_to AND scheduleEntries
  const currentCrew = useMemo(() => {
    const crewSet = new Set();

    // First try from workOrder.assigned_to
    if (workOrder?.assigned_to) {
      workOrder.assigned_to.split(',').map(u => u.trim()).filter(Boolean).forEach(u => crewSet.add(u));
    }

    // Also check scheduleEntries from context (more reliable for scheduled workers)
    if (workOrder?.id && scheduleEntries) {
      scheduleEntries
        .filter(entry => String(entry.work_order_id) === String(workOrder.id))
        .forEach(entry => {
          if (entry.username) {
            crewSet.add(entry.username);
          }
        });
    }

    return Array.from(crewSet);
  }, [workOrder, scheduleEntries]);

  // Available employees (not already on crew) - only show when NOT editing
  const availableEmployees = useMemo(() => {
    if (editMode) return []; // Don't show when editing existing crew member
    return employees.filter(emp => !currentCrew.includes(emp.username));
  }, [employees, currentCrew, editMode]);

  // Fetch scheduled dates for a specific employee on this job
  const fetchEmployeeSchedule = useCallback(async (username) => {
    if (!workOrder) return [];
    setLoadingSchedule(true);
    try {
      const token = localStorage.getItem('token');
      // Fetch schedule for a wide date range to get all scheduled dates
      const startDateSearch = new Date();
      startDateSearch.setMonth(startDateSearch.getMonth() - 1); // 1 month back
      const endDateSearch = new Date();
      endDateSearch.setMonth(endDateSearch.getMonth() + 3); // 3 months forward

      const searchStart = startDateSearch.toISOString().split('T')[0];
      const searchEnd = endDateSearch.toISOString().split('T')[0];

      logger.log(`[ModifyCrewDialog] Fetching schedule for ${username} on work order ${workOrder.id}`);
      logger.log(`[ModifyCrewDialog] Date range: ${searchStart} to ${searchEnd}`);

      const response = await fetch(
        `${API_BASE_URL}/calendar/schedule?start_date=${searchStart}&end_date=${searchEnd}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        logger.log(`[ModifyCrewDialog] API returned ${(data.schedule || []).length} schedule items`);
        logger.log(`[ModifyCrewDialog] Looking for work order ID: ${workOrder.id} (type: ${typeof workOrder.id})`);

        const scheduledDates = [];
        (data.schedule || []).forEach(scheduleItem => {
          logger.log(`[ModifyCrewDialog] Checking schedule item WO ID: ${scheduleItem.work_order_id} (type: ${typeof scheduleItem.work_order_id})`);
          // Check if this schedule item is for our work order - use == for type coercion
          if (String(scheduleItem.work_order_id) === String(workOrder.id)) {
            logger.log(`[ModifyCrewDialog] Found schedule for WO ${workOrder.id} on ${scheduleItem.scheduled_date}`, scheduleItem.crew);
            // Check if this user is in the crew for this date
            const crewMember = (scheduleItem.crew || []).find(c => c.username === username);
            if (crewMember) {
              logger.log(`[ModifyCrewDialog] ${username} is scheduled on ${scheduleItem.scheduled_date}`);
              scheduledDates.push(scheduleItem.scheduled_date);
            }
          }
        });

        logger.log(`[ModifyCrewDialog] Found ${scheduledDates.length} scheduled dates for ${username}:`, scheduledDates);
        return scheduledDates.sort();
      } else {
        logger.error(`[ModifyCrewDialog] API error: ${response.status}`);
      }
    } catch (err) {
      logger.error('Error fetching employee schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
    return [];
  }, [workOrder]);

  // Handle clicking on an existing crew member to edit their schedule
  const handleEditCrewMember = async (username) => {
    const emp = employees.find(e => e.username === username);
    if (!emp) return;

    logger.log(`[ModifyCrewDialog] handleEditCrewMember called for ${username}`);

    setEditMode(true);
    setEditingEmployee(emp);
    setSelectedEmployees([emp]);

    // Fetch their scheduled dates for this job
    const dates = await fetchEmployeeSchedule(username);
    logger.log(`[ModifyCrewDialog] Setting originalDates to:`, dates);
    setOriginalDates(dates);

    if (dates.length > 0) {
      // Set up date range to show their scheduled dates
      const sortedDates = [...dates].sort();
      const firstDate = sortedDates[0];
      const lastDate = sortedDates[sortedDates.length - 1];

      // Expand the range a bit to allow adding adjacent dates
      const rangeStart = new Date(firstDate + 'T00:00:00');
      rangeStart.setDate(rangeStart.getDate() - 7); // 1 week before
      const rangeEnd = new Date(lastDate + 'T00:00:00');
      rangeEnd.setDate(rangeEnd.getDate() + 14); // 2 weeks after

      const startStr = rangeStart.toISOString().split('T')[0];
      const endStr = rangeEnd.toISOString().split('T')[0];

      logger.log(`[ModifyCrewDialog] Setting date range: ${startStr} to ${endStr}`);
      logger.log(`[ModifyCrewDialog] Setting selectedDates to:`, dates);

      setDateMode('range');
      setStartDate(startStr);
      setEndDate(endStr);
      setSelectedDates([...dates]); // Pre-select their scheduled dates
    } else {
      // No dates scheduled yet, use default date
      const today = new Date().toISOString().split('T')[0];
      const date = defaultDate || workOrder?.scheduled_date || today;
      logger.log(`[ModifyCrewDialog] No dates found, using default: ${date}`);
      setDateMode('single');
      setSingleDate(date);
      setSelectedDates([date]);
    }
  };

  // Cancel edit mode and go back to add mode
  const handleCancelEdit = () => {
    setEditMode(false);
    setEditingEmployee(null);
    setSelectedEmployees([]);
    setOriginalDates([]);

    // Reset to default state
    const today = new Date().toISOString().split('T')[0];
    const date = defaultDate || workOrder?.scheduled_date || today;
    setDateMode('single');
    setSingleDate(date);
    setStartDate(date);
    setEndDate(date);
    setSelectedDates([date]);
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open && workOrder) {
      setSelectedEmployees([]);
      setStartTime(workOrder.scheduled_start_time || '07:00');
      setEndTime(workOrder.scheduled_end_time || '15:30');
      setError(null);
      setDateMode('single');
      setEditMode(false);
      setEditingEmployee(null);
      setOriginalDates([]);

      // Reset conflict state
      setConflictDialogOpen(false);
      setConflicts([]);
      setUnavailabilityConflicts([]);
      setCheckingConflicts(false);

      // Set default date
      const today = new Date().toISOString().split('T')[0];
      const date = defaultDate || workOrder.scheduled_date || today;
      setSingleDate(date);
      setStartDate(date);
      setEndDate(date);
      setSelectedDates([date]);
    }
  }, [open, workOrder, defaultDate]);

  // Generate calendar dates for range selection
  const calendarDates = useMemo(() => {
    if (!startDate || !endDate || dateMode !== 'range') return [];
    return getDatesInRange(startDate, endDate);
  }, [startDate, endDate, dateMode]);

  // Toggle date selection
  const toggleDateSelection = (dateStr) => {
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr].sort());
    }
  };

  // Select all dates in range
  const selectAllDates = () => {
    setSelectedDates([...calendarDates]);
  };

  // Clear all date selections
  const clearDateSelections = () => {
    setSelectedDates([]);
  };

  // Get dates to schedule
  const getDatesToSchedule = () => {
    if (dateMode === 'single') {
      return [singleDate];
    }
    return selectedDates;
  };

  // Check for schedule conflicts for selected employees
  // Returns { scheduleConflicts, unavailabilityConflicts }
  const checkForConflicts = async (employeesToCheck, datesToCheck) => {
    const token = localStorage.getItem('token');
    const scheduleConflicts = [];
    const ptoConflicts = [];

    logger.log('[ModifyCrewDialog] checkForConflicts called with:', {
      employeesToCheck: employeesToCheck.map(e => ({ username: e.username, full_name: e.full_name })),
      datesToCheck,
      startTime,
      endTime,
      exceptWorkOrderId: workOrder?.id
    });

    for (const emp of employeesToCheck) {
      try {
        const requestBody = {
          dates: datesToCheck,
          start_time: startTime,
          end_time: endTime,
          except_work_order_id: workOrder.id, // Don't flag conflicts with this job
        };
        logger.log(`[ModifyCrewDialog] Checking conflicts for ${emp.username}:`, requestBody);

        const response = await fetch(
          `${API_BASE_URL}/employees/${emp.username}/schedule-conflicts`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (response.ok) {
          const data = await response.json();
          logger.log(`[ModifyCrewDialog] Conflict check response for ${emp.username}:`, data);

          // Separate unavailability conflicts (blocking) from schedule conflicts (can override)
          if (data.unavailability_conflicts && data.unavailability_conflicts.length > 0) {
            data.unavailability_conflicts.forEach(conflict => {
              ptoConflicts.push({
                ...conflict,
                employee_username: emp.username,
                employee_name: emp.full_name || emp.username,
              });
            });
          }

          if (data.job_conflicts && data.job_conflicts.length > 0) {
            data.job_conflicts.forEach(conflict => {
              scheduleConflicts.push({
                ...conflict,
                employee_username: emp.username,
                employee_name: emp.full_name || emp.username,
              });
            });
          }
        } else {
          logger.error(`[ModifyCrewDialog] Conflict check failed for ${emp.username}: ${response.status}`);
        }
      } catch (err) {
        logger.error(`Error checking conflicts for ${emp.username}:`, err);
      }
    }

    logger.log('[ModifyCrewDialog] Schedule conflicts found:', scheduleConflicts);
    logger.log('[ModifyCrewDialog] Unavailability conflicts found:', ptoConflicts);
    return { scheduleConflicts, unavailabilityConflicts: ptoConflicts };
  };

  // Clear conflicts by adjusting existing schedules
  const clearConflicts = async (conflictsToResolve) => {
    const token = localStorage.getItem('token');

    // Group conflicts by employee
    const conflictsByEmployee = {};
    conflictsToResolve.forEach(conflict => {
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
              start_time: startTime,
              end_time: endTime,
              except_work_order_id: workOrder.id,
            }),
          }
        );
      } catch (err) {
        logger.error(`Error clearing conflicts for ${username}:`, err);
      }
    }
  };

  // Handle the initial submit - checks for conflicts first
  const handleSubmit = async () => {
    logger.log('[ModifyCrewDialog] handleSubmit called:', {
      workOrder: workOrder?.work_order_number,
      workOrderId: workOrder?.id,
      selectedEmployees: selectedEmployees.map(e => e.username),
      editMode,
      editingEmployee: editingEmployee?.username,
      originalDates
    });

    if (!workOrder || selectedEmployees.length === 0) {
      setError('Please select at least one employee');
      return;
    }

    const dates = getDatesToSchedule();
    logger.log('[ModifyCrewDialog] dates to schedule:', dates);

    // In edit mode, allow 0 dates (to remove all scheduled days)
    // In add mode, require at least one date
    if (!editMode && dates.length === 0) {
      setError('Please select at least one date');
      return;
    }

    // In edit mode with 0 dates, check if there are actually dates to remove
    if (editMode && dates.length === 0 && originalDates.length === 0) {
      setError('No changes to save');
      return;
    }

    setCheckingConflicts(true);
    setError(null);

    try {
      // Determine which dates to check for conflicts (only new dates)
      let datesToCheck = dates;
      if (editMode && editingEmployee) {
        // Only check dates that are being added, not already scheduled
        datesToCheck = dates.filter(d => !originalDates.includes(d));
        logger.log('[ModifyCrewDialog] Edit mode - filtering dates:', { dates, originalDates, datesToCheck });
      }

      logger.log('[ModifyCrewDialog] Will check conflicts for dates:', datesToCheck);

      // Check for conflicts if we have dates to check
      if (datesToCheck.length > 0) {
        const { scheduleConflicts, unavailabilityConflicts: ptoConflicts } = await checkForConflicts(selectedEmployees, datesToCheck);
        logger.log('[ModifyCrewDialog] Schedule conflicts found:', scheduleConflicts.length);
        logger.log('[ModifyCrewDialog] Unavailability conflicts found:', ptoConflicts.length);

        // Unavailability conflicts are blocking - cannot schedule on approved PTO
        if (ptoConflicts.length > 0) {
          setUnavailabilityConflicts(ptoConflicts);
          setConflicts(scheduleConflicts);
          setConflictDialogOpen(true);
          setCheckingConflicts(false);
          return; // Stop here and show conflict dialog
        }

        // Schedule conflicts can be overridden with user confirmation
        if (scheduleConflicts.length > 0) {
          setConflicts(scheduleConflicts);
          setUnavailabilityConflicts([]);
          setConflictDialogOpen(true);
          setCheckingConflicts(false);
          return; // Stop here and show conflict dialog
        }
      } else {
        logger.log('[ModifyCrewDialog] No dates to check, skipping conflict check');
      }

      // No conflicts, proceed with scheduling
      setCheckingConflicts(false);
      await proceedWithScheduling();
    } catch (err) {
      setError(err.message || 'Failed to check for conflicts');
      setCheckingConflicts(false);
    }
  };

  // Handle user confirming to proceed despite conflicts
  const handleProceedWithConflicts = async () => {
    setConflictDialogOpen(false);
    setLoading(true);

    try {
      // Clear the conflicting time slots first
      await clearConflicts(conflicts);
      // Then proceed with scheduling
      await proceedWithScheduling();
    } catch (err) {
      setError(err.message || 'Failed to resolve conflicts');
      setLoading(false);
    }
  };

  // The actual scheduling logic (called after conflict check passes or user confirms)
  const proceedWithScheduling = async () => {
    const dates = getDatesToSchedule();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const hours = calculateHoursFromTimes(startTime, endTime);

      if (editMode && editingEmployee) {
        // EDIT MODE: Modify existing crew member's schedule
        // Calculate dates to add and remove
        const datesToAdd = dates.filter(d => !originalDates.includes(d));
        const datesToRemove = originalDates.filter(d => !dates.includes(d));

        // First ensure all new schedule dates exist
        if (datesToAdd.length > 0) {
          await fetch(`${API_BASE_URL}/work-orders/${workOrder.id}/schedule-dates/bulk`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              work_order_id: workOrder.id,
              dates: datesToAdd,
              start_time: startTime,
              end_time: endTime,
              estimated_hours_per_day: hours,
            }),
          });

          // Add employee to new dates
          // Build employee_hours dict for proper backend processing
          const employeeHours = { [editingEmployee.username]: hours };
          await fetch(`${API_BASE_URL}/work-orders/${workOrder.id}/crew`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'add',
              employees: [editingEmployee.username],
              dates: datesToAdd,
              start_time: startTime,
              end_time: endTime,
              employee_hours: employeeHours,
            }),
          });
        }

        // Remove employee from removed dates
        if (datesToRemove.length > 0) {
          await fetch(`${API_BASE_URL}/work-orders/${workOrder.id}/crew`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'remove',
              employees: [editingEmployee.username],
              dates: datesToRemove,
            }),
          });
        }

        // Refresh shared schedule data
        await refreshSchedule();

        // Call success callback if provided
        if (onSuccess) {
          const addedCount = datesToAdd.length;
          const removedCount = datesToRemove.length;
          let message = `Updated ${editingEmployee.full_name || editingEmployee.username}'s schedule`;
          if (addedCount > 0 && removedCount > 0) {
            message += ` (+${addedCount} days, -${removedCount} days)`;
          } else if (addedCount > 0) {
            message += ` (+${addedCount} days)`;
          } else if (removedCount > 0) {
            message += ` (-${removedCount} days)`;
          }
          onSuccess({
            workOrder,
            employees: [editingEmployee],
            dates,
            message,
          });
        }

        onClose();
      } else {
        // ADD MODE: Add new workers to crew
        // First ensure schedule dates exist
        await fetch(`${API_BASE_URL}/work-orders/${workOrder.id}/schedule-dates/bulk`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            work_order_id: workOrder.id,
            dates: dates,
            start_time: startTime,
            end_time: endTime,
            estimated_hours_per_day: hours,
          }),
        });

        // Add selected employees to crew
        // Build employee_hours dict for proper backend processing
        const employeeHours = {};
        selectedEmployees.forEach(e => {
          employeeHours[e.username] = hours;
        });
        const response = await fetch(`${API_BASE_URL}/work-orders/${workOrder.id}/crew`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'add',
            employees: selectedEmployees.map(e => e.username),
            dates: dates,
            start_time: startTime,
            end_time: endTime,
            employee_hours: employeeHours,
          }),
        });

        if (response.ok) {
          // Refresh shared schedule data
          await refreshSchedule();

          // Call success callback if provided
          if (onSuccess) {
            onSuccess({
              workOrder,
              employees: selectedEmployees,
              dates,
              message: `Added ${selectedEmployees.length} worker(s) to ${workOrder.work_order_number}`,
            });
          }

          onClose();
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Failed to add crew');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to modify crew');
    } finally {
      setLoading(false);
    }
  };

  if (!workOrder) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ bgcolor: 'secondary.dark', color: 'secondary.contrastText', pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {editMode ? <EditIcon /> : <GroupAddIcon />}
          <Typography variant="h6">
            {editMode
              ? `Edit Schedule: ${editingEmployee?.full_name || editingEmployee?.username}`
              : 'Add Help to Job'}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Job Info */}
          <Paper sx={{ p: 2, bgcolor: 'background.default', position: 'relative' }}>
            {/* View Job Details Link - Top Right Corner */}
            <Button
              size="small"
              variant="text"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              onClick={() => window.location.href = `/jobs/${workOrder.id}`}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                fontSize: '0.7rem',
                color: 'primary.main',
                textTransform: 'none',
                minWidth: 'auto',
                p: 0.5,
              }}
            >
              View Job
            </Button>

            <Typography variant="subtitle1" fontWeight={600} sx={{ pr: 8 }}>
              {workOrder.work_order_number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {workOrder.job_description}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {workOrder.customer_name}
            </Typography>
            {workOrder.service_address && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <LocationIcon sx={{ fontSize: 14 }} />
                {workOrder.service_address}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Chip
                label={workOrder.status?.replace('_', ' ')}
                size="small"
                color={getStatusChipColor(workOrder.status)}
                sx={{ textTransform: 'capitalize' }}
              />
            </Box>

            {/* Current crew - clickable to edit their schedule */}
            {currentCrew.length > 0 && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderTopColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Currently assigned (click to edit schedule):
                </Typography>
                {loadingSchedule && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption">Loading schedule...</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {currentCrew.map(username => {
                    const emp = employees.find(e => e.username === username);
                    const isEditing = editMode && editingEmployee?.username === username;
                    return (
                      <Chip
                        key={username}
                        label={emp?.full_name || username}
                        size="small"
                        variant={isEditing ? 'filled' : 'outlined'}
                        color={isEditing ? 'warning' : 'default'}
                        icon={<EditIcon sx={{ fontSize: '14px !important' }} />}
                        onClick={() => !loadingSchedule && handleEditCrewMember(username)}
                        sx={{
                          fontSize: '0.7rem',
                          cursor: loadingSchedule ? 'wait' : 'pointer',
                          '&:hover': {
                            bgcolor: isEditing ? undefined : 'action.hover',
                            borderColor: 'primary.main',
                          },
                        }}
                      />
                    );
                  })}
                </Box>
                {editMode && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleCancelEdit}
                    sx={{ mt: 1, fontSize: '0.75rem' }}
                  >
                    Cancel Edit / Add New Workers Instead
                  </Button>
                )}
              </Box>
            )}
          </Paper>

          {/* Warning for completed jobs */}
          {workOrder.status === 'completed' && (
            <Alert severity="warning">
              This job is marked as <strong>Completed</strong>. Adding help will change the status back to <strong>Scheduled</strong>.
            </Alert>
          )}

          {/* Date Selection */}
          <Box sx={{ p: 2, bgcolor: 'secondary.light', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <DateRangeIcon sx={{ fontSize: 18 }} />
              Schedule Dates
            </Typography>

            {/* Date Mode Toggle */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                variant={dateMode === 'single' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => {
                  setDateMode('single');
                  // Only reset if not in edit mode
                  if (!editMode) {
                    setSelectedDates([singleDate]);
                  }
                }}
              >
                Single Day
              </Button>
              <Button
                variant={dateMode === 'range' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => {
                  setDateMode('range');
                  // Only reset if not in edit mode - preserve pre-selected dates when editing
                  if (!editMode) {
                    setSelectedDates([]);
                  }
                }}
              >
                Multiple Days
              </Button>
            </Box>

            {dateMode === 'single' ? (
              <TextField
                label="Date"
                type="date"
                value={singleDate}
                onChange={(e) => {
                  setSingleDate(e.target.value);
                  setSelectedDates([e.target.value]);
                }}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            ) : (
              <>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      setStartDate(newStartDate);
                      // In edit mode, filter selectedDates to only those in the new range
                      // In add mode, clear selections
                      if (editMode && selectedDates.length > 0) {
                        const newRange = getDatesInRange(newStartDate, endDate);
                        setSelectedDates(selectedDates.filter(d => newRange.includes(d)));
                      } else if (!editMode) {
                        setSelectedDates([]);
                      }
                    }}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      const newEndDate = e.target.value;
                      setEndDate(newEndDate);
                      // In edit mode, filter selectedDates to only those in the new range
                      // In add mode, clear selections
                      if (editMode && selectedDates.length > 0) {
                        const newRange = getDatesInRange(startDate, newEndDate);
                        setSelectedDates(selectedDates.filter(d => newRange.includes(d)));
                      } else if (!editMode) {
                        setSelectedDates([]);
                      }
                    }}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>

                {/* Calendar Grid */}
                {calendarDates.length > 0 && (
                  <>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Button size="small" variant="text" onClick={selectAllDates}>
                        Select All
                      </Button>
                      <Button size="small" variant="text" onClick={clearDateSelections}>
                        Clear
                      </Button>
                      <Chip
                        label={`${selectedDates.length} day(s) selected`}
                        size="small"
                        color={selectedDates.length > 0 ? 'primary' : 'default'}
                      />
                      {editMode && originalDates.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          (dates with dot = currently scheduled)
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {calendarDates.map(dateStr => {
                        const isSelected = selectedDates.includes(dateStr);
                        const isOriginal = editMode && originalDates.includes(dateStr);
                        const dayOfWeek = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                        const dayNum = new Date(dateStr + 'T00:00:00').getDate();
                        return (
                          <Box
                            key={dateStr}
                            onClick={() => toggleDateSelection(dateStr)}
                            sx={{
                              width: 50,
                              p: 0.5,
                              textAlign: 'center',
                              borderRadius: 1,
                              cursor: 'pointer',
                              bgcolor: isSelected ? 'primary.main' : 'background.paper',
                              color: isSelected ? 'primary.contrastText' : 'text.primary',
                              border: '2px solid',
                              borderColor: isSelected
                                ? 'primary.main'
                                : isOriginal
                                  ? 'warning.main'  // Orange border for originally scheduled dates
                                  : 'divider',
                              position: 'relative',
                              '&:hover': {
                                bgcolor: isSelected ? 'primary.dark' : 'action.hover',
                              },
                            }}
                          >
                            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem' }}>
                              {dayOfWeek}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {dayNum}
                            </Typography>
                            {/* Dot indicator for originally scheduled dates */}
                            {isOriginal && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: 2,
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  bgcolor: isSelected ? 'primary.contrastText' : 'warning.main',
                                }}
                              />
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </>
                )}
              </>
            )}
          </Box>

          {/* Time Selection */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {formatTime(startTime)} - {formatTime(endTime)} ({calculateHoursFromTimes(startTime, endTime).toFixed(1)} hours)
          </Typography>

          {/* Employee Selection - only show in add mode */}
          {!editMode && (
            <FormControl fullWidth>
              <InputLabel>Select Workers to Add</InputLabel>
              <Select
                multiple
                open={employeeSelectOpen}
                onOpen={() => setEmployeeSelectOpen(true)}
                onClose={() => setEmployeeSelectOpen(false)}
                value={selectedEmployees.map(e => e.username)}
                onChange={(e) => {
                  const usernames = e.target.value;
                  const selected = employees.filter(emp => usernames.includes(emp.username));
                  setSelectedEmployees(selected);
                }}
                input={<OutlinedInput label="Select Workers to Add" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((username) => {
                      const emp = employees.find(e => e.username === username);
                      return (
                        <Chip
                          key={username}
                          label={emp?.full_name || username}
                          size="small"
                        />
                      );
                    })}
                  </Box>
                )}
                MenuProps={{
                  PaperProps: {
                    sx: { maxHeight: 350 }
                  },
                  autoFocus: false,
                }}
              >
                {/* Done button at the top of the dropdown */}
                <Box sx={{
                  position: 'sticky',
                  top: 0,
                  bgcolor: 'background.paper',
                  zIndex: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                  p: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Typography variant="body2" color="text.secondary">
                    {selectedEmployees.length} selected
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEmployeeSelectOpen(false);
                    }}
                  >
                    Done
                  </Button>
                </Box>
                {availableEmployees.map((emp) => (
                  <MenuItem key={emp.username} value={emp.username}>
                    <Checkbox checked={selectedEmployees.some(e => e.username === emp.username)} />
                    <ListItemText
                      primary={emp.full_name || emp.username}
                      secondary={emp.role}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Edit mode info - show what's changing */}
          {editMode && editingEmployee && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="body2">
                Editing schedule for <strong>{editingEmployee.full_name || editingEmployee.username}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {originalDates.length > 0
                  ? `Currently scheduled for ${originalDates.length} day(s). Select/deselect dates to modify.`
                  : 'No dates currently scheduled. Select dates to add.'}
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderTopColor: 'divider' }}>
        <Button onClick={onClose} disabled={loading || checkingConflicts}>Cancel</Button>
        {editMode ? (
          <Button
            variant="contained"
            color={getDatesToSchedule().length === 0 ? 'error' : 'warning'}
            onClick={handleSubmit}
            disabled={
              // Disable if: no changes to make (0 selected AND 0 original), or loading
              (getDatesToSchedule().length === 0 && originalDates.length === 0) ||
              loading ||
              checkingConflicts
            }
            startIcon={checkingConflicts ? <CircularProgress size={20} color="inherit" /> : <EditIcon />}
          >
            {checkingConflicts
              ? 'Checking...'
              : loading
                ? 'Saving...'
                : getDatesToSchedule().length === 0
                  ? `Remove from ${originalDates.length} Day(s)`
                  : 'Update Schedule'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={selectedEmployees.length === 0 || getDatesToSchedule().length === 0 || loading || checkingConflicts}
            startIcon={checkingConflicts ? <CircularProgress size={20} color="inherit" /> : <GroupAddIcon />}
          >
            {checkingConflicts ? 'Checking...' : loading ? 'Adding...' : `Add ${selectedEmployees.length} Worker(s)`}
          </Button>
        )}
      </DialogActions>

      {/* Conflict Warning Dialog */}
      <Dialog
        open={conflictDialogOpen}
        onClose={() => setConflictDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          bgcolor: unavailabilityConflicts.length > 0 ? 'error.main' : 'warning.main',
          color: unavailabilityConflicts.length > 0 ? 'error.contrastText' : 'warning.contrastText',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          {unavailabilityConflicts.length > 0 ? <BlockIcon /> : <WarningIcon />}
          {unavailabilityConflicts.length > 0 ? 'Cannot Schedule - Time Off Approved' : 'Schedule Conflict Detected'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {/* Unavailability Conflicts (Blocking) */}
          {unavailabilityConflicts.length > 0 && (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>The following workers have approved time off</strong> during the requested dates.
                  You cannot schedule them on these days. Please select different dates or workers.
                </Typography>
              </Alert>

              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'error.main' }}>
                Approved Time Off:
              </Typography>

              <List dense sx={{ bgcolor: 'error.light', borderRadius: 1, mb: 2 }}>
                {unavailabilityConflicts.map((conflict, index) => (
                  <React.Fragment key={`pto-${conflict.employee_username}-${conflict.date}-${index}`}>
                    {index > 0 && <Divider />}
                    <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mb: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 'auto' }}>
                          <PTOIcon color="error" />
                        </ListItemIcon>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {conflict.employee_name}
                        </Typography>
                        <Chip
                          label={new Date(conflict.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric'
                          })}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                        <Chip
                          label={conflict.availability_type?.toUpperCase() || 'PTO'}
                          size="small"
                          color="error"
                          sx={{ ml: 'auto' }}
                        />
                      </Box>
                      <Box sx={{ pl: 4, width: '100%' }}>
                        <Typography variant="caption" color="error.main" display="block" sx={{ fontWeight: 500 }}>
                          {conflict.reason || `Approved ${conflict.availability_type}`}
                        </Typography>
                        {conflict.all_day ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            All day unavailable ({conflict.unavailable_start} to {conflict.unavailable_end})
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Unavailable: {formatTime(conflict.unavailable_start_time)} - {formatTime(conflict.unavailable_end_time)}
                          </Typography>
                        )}
                      </Box>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </>
          )}

          {/* Schedule Conflicts (Can be overridden) */}
          {conflicts.length > 0 && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                {unavailabilityConflicts.length > 0
                  ? 'Additionally, the following workers have scheduling conflicts that would need to be adjusted.'
                  : 'The following workers already have jobs scheduled during the requested time. Proceeding will adjust their existing schedules.'}
              </Alert>

              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Conflicting Assignments:
              </Typography>

              <List dense sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
                {conflicts.map((conflict, index) => (
                  <React.Fragment key={`sched-${conflict.employee_username}-${conflict.date}-${index}`}>
                    {index > 0 && <Divider />}
                    <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mb: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 'auto' }}>
                          <ScheduleIcon color="warning" />
                        </ListItemIcon>
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
                        <Typography variant="caption" color="primary" display="block">
                          New time: {formatTime(conflict.proposed_start_time)} - {formatTime(conflict.proposed_end_time)}
                        </Typography>
                      </Box>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </>
          )}

          {/* Info about what happens */}
          {unavailabilityConflicts.length === 0 && conflicts.length > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="caption">
                <strong>What happens if you proceed:</strong> Only the overlapping hours will be adjusted on the existing
                schedule. Hours outside the conflict window will remain unchanged.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderTopColor: 'divider' }}>
          <Button onClick={() => setConflictDialogOpen(false)}>
            {unavailabilityConflicts.length > 0 ? 'Go Back & Select Different Dates' : 'Cancel'}
          </Button>
          {unavailabilityConflicts.length === 0 && (
            <Button
              variant="contained"
              color="warning"
              onClick={handleProceedWithConflicts}
              startIcon={<WarningIcon />}
            >
              Proceed & Adjust Schedules
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export default ModifyCrewDialog;
