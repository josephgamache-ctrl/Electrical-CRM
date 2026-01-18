import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  Chip,
  Alert,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Today as TodayIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';
import CalendarJobBlock from './CalendarJobBlock';
import ModifyCrewDialog from './ModifyCrewDialog';
import { useSchedule } from './ScheduleContext';
import {
  getStartOfWeek,
  formatDateValue,
  formatDateDisplay,
  formatDateShort,
  formatTimeFromHourMinutes,
  calculateHoursFromTimes,
} from './scheduleHelpers';
import './EmployeeCalendar.css';

// Configuration - Full 24-hour day, scrollable with default view starting at 7 AM
const TIME_CONFIG = {
  startHour: 0,    // 12:00 AM (midnight)
  endHour: 24,     // 12:00 AM (next day) - full 24 hours
  slotMinutes: 30, // 30-minute increments
  defaultScrollHour: 7, // Scroll to 7 AM on initial load
};

// Slot heights for the calendar grid
const SLOT_HEIGHT_DESKTOP = 20; // pixels per slot on desktop
const SLOT_HEIGHT_MOBILE = 24;  // pixels per slot on mobile

// Generate time slots array
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = TIME_CONFIG.startHour; hour < TIME_CONFIG.endHour; hour++) {
    slots.push({ hour, minutes: 0, label: formatTimeFromHourMinutes(hour, 0) });
    slots.push({ hour, minutes: 30, label: formatTimeFromHourMinutes(hour, 30) });
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// Generate week days array
const generateWeekDays = (weekStart) => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    days.push(date);
  }
  return days;
};

function EmployeeCalendar({ userRole }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const SLOT_HEIGHT = isMobile ? SLOT_HEIGHT_MOBILE : SLOT_HEIGHT_DESKTOP;

  // Ref for the calendar grid container (for scrolling to default time)
  const calendarGridRef = useRef(null);

  // Use shared schedule context for synchronized data across all schedule tabs
  const {
    employees,
    workOrders: allWorkOrders,
    scheduleEntries,
    loading,
    refreshSchedule,
    selectDateRange,
    refreshTrigger,
  } = useSchedule();

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [searchTerm, setSearchTerm] = useState('');

  // Job selector dialog state (for picking a job when clicking time slot)
  const [jobSelectorOpen, setJobSelectorOpen] = useState(false);

  // Modify Crew Dialog state - unified dialog for all crew modifications
  const [modifyCrewDialogOpen, setModifyCrewDialogOpen] = useState(false);
  const [selectedJobForCrew, setSelectedJobForCrew] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const weekDays = useMemo(() => generateWeekDays(weekStart), [weekStart]);

  // Function to scroll to default time (7 AM)
  const scrollToDefaultTime = useCallback(() => {
    if (calendarGridRef.current) {
      // Calculate scroll position: each hour has 2 slots (30-min each)
      const slotsToDefaultHour = TIME_CONFIG.defaultScrollHour * 2;
      const scrollPosition = slotsToDefaultHour * SLOT_HEIGHT;
      calendarGridRef.current.scrollTop = scrollPosition;
    }
  }, [SLOT_HEIGHT]);

  // Scroll to default time (7 AM) on initial load and when week changes
  useEffect(() => {
    if (!loading && calendarGridRef.current) {
      // Small delay to ensure DOM is fully rendered
      const scrollTimer = setTimeout(() => {
        scrollToDefaultTime();
      }, 100);

      return () => clearTimeout(scrollTimer);
    }
  }, [loading, scrollToDefaultTime, weekStart]);

  // Set default employee when employees load
  useEffect(() => {
    if (employees.length > 0 && !selectedEmployee) {
      setSelectedEmployee(employees[0].username);
    }
  }, [employees, selectedEmployee]);

  // Update context date range when week changes (so schedule entries are loaded for this week)
  useEffect(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    selectDateRange(formatDateValue(weekStart), formatDateValue(weekEnd));
  }, [weekStart, selectDateRange]);

  // Get schedule entries for selected employee for the current week
  // These contain the actual start_time, end_time, and scheduled_hours from job_schedule_crew
  const employeeScheduleEntries = useMemo(() => {
    if (!selectedEmployee) return [];

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = formatDateValue(weekStart);
    const weekEndStr = formatDateValue(weekEnd);

    return scheduleEntries.filter(entry => {
      if (entry.username !== selectedEmployee) return false;
      if (!entry.scheduled_date) return false;
      return entry.scheduled_date >= weekStartStr && entry.scheduled_date <= weekEndStr;
    });
  }, [scheduleEntries, selectedEmployee, weekStart, refreshTrigger]);

  // Keep workOrders for backward compatibility with unassigned jobs filtering
  const workOrders = useMemo(() => {
    if (!selectedEmployee) return [];

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = formatDateValue(weekStart);
    const weekEndStr = formatDateValue(weekEnd);

    return allWorkOrders.filter(wo => {
      if (!wo.scheduled_date || wo.status === 'completed') return false;
      if (!wo.assigned_to) return false;
      const assignees = wo.assigned_to.split(',').map(u => u.trim());
      if (!assignees.includes(selectedEmployee)) return false;
      return wo.scheduled_date >= weekStartStr && wo.scheduled_date <= weekEndStr;
    });
  }, [allWorkOrders, selectedEmployee, weekStart]);

  // Get unassigned jobs - jobs that need crew assignment
  const unassignedJobs = useMemo(() => {
    const excludedStatuses = ['completed', 'cancelled', 'canceled', 'invoiced', 'paid'];

    return allWorkOrders.filter(wo => {
      // Must not be in excluded statuses
      if (excludedStatuses.includes(wo.status)) return false;

      // Handle delayed status with new delay system
      if (wo.status === 'delayed') {
        // If indefinitely delayed (no end date), exclude from unassigned
        if (wo.delay_start_date && !wo.delay_end_date) return false;
        // Date-range delays: still show in unassigned (crew can be scheduled outside delay range)
      }

      // Must have start_date set
      if (!wo.start_date && !wo.scheduled_date) return false;

      // Must not have assigned_to (legacy field) or have no crew scheduled
      return !wo.assigned_to;
    });
  }, [allWorkOrders]);

  // Get all active jobs for multi-day scheduling
  const allActiveJobs = useMemo(() => {
    return allWorkOrders.filter(wo =>
      wo.status !== 'completed' && wo.status !== 'canceled'
    );
  }, [allWorkOrders]);

  const handleWeekChange = (direction) => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(weekStart.getDate() + (direction * 7));
    setWeekStart(newWeekStart);
    // Note: scrollToDefaultTime is called by the useEffect when weekStart changes
  };

  const handleTodayClick = () => {
    setWeekStart(getStartOfWeek(new Date()));
    // Note: scrollToDefaultTime is called by the useEffect when weekStart changes
  };

  // Click on time slot - open job selector to pick a job
  // Check if user can modify crew
  const canModifyCrew = userRole === 'admin' || userRole === 'manager';

  const handleTimeSlotClick = (date, slot) => {
    if (!canModifyCrew) return; // Technicians can't add to schedule
    setJobSelectorOpen(true);
  };

  // Click on unassigned job - open ModifyCrewDialog directly
  const handleUnassignedJobClick = (job) => {
    if (!canModifyCrew) return; // Technicians can't assign crew
    setSelectedJobForCrew(job);
    setModifyCrewDialogOpen(true);
  };

  // When a job is selected from the job selector, open ModifyCrewDialog
  const handleJobSelected = (job) => {
    setJobSelectorOpen(false);
    setSelectedJobForCrew(job);
    setModifyCrewDialogOpen(true);
  };

  const handleJobBlockClick = (workOrder) => {
    if (!canModifyCrew) return; // Technicians can't modify crew
    // Open Modify Crew dialog for scheduling - this is a scheduling-focused view
    setSelectedJobForCrew({
      id: workOrder.id,
      work_order_number: workOrder.work_order_number,
      job_description: workOrder.job_description,
      customer_name: workOrder.customer_name,
      service_address: workOrder.service_address,
      status: workOrder.status,
      scheduled_date: workOrder.scheduled_date,
      scheduled_start_time: workOrder.scheduled_start_time,
      scheduled_end_time: workOrder.scheduled_end_time,
      assigned_to: '', // Will be populated from schedule entries
    });
    setModifyCrewDialogOpen(true);
  };

  // Handle success from ModifyCrewDialog
  const handleModifyCrewSuccess = async (result) => {
    setSuccess(result.message);
    setTimeout(() => setSuccess(null), 3000);
    // Ensure schedule data is refreshed to show updates in the calendar
    await refreshSchedule();
  };

  // Get schedule entries for a specific day (uses per-employee schedule data with times)
  const getJobsForDay = (date) => {
    const dateStr = formatDateValue(date);
    // Use employeeScheduleEntries which has start_time, end_time, scheduled_hours
    return employeeScheduleEntries.filter(entry => entry.scheduled_date === dateStr).map(entry => ({
      // Map schedule entry to format expected by CalendarJobBlock
      id: entry.work_order_id,
      work_order_number: entry.work_order_number,
      customer_name: entry.customer_name,
      job_description: entry.job_description,
      status: entry.job_status,
      scheduled_date: entry.scheduled_date,
      scheduled_start_time: entry.start_time || '07:00',
      // Calculate duration from scheduled_hours or from start/end time
      estimated_duration_hours: entry.scheduled_hours || calculateHoursFromTimes(entry.start_time, entry.end_time),
      // Include other useful fields
      service_address: entry.service_address,
      priority: entry.priority,
      schedule_id: entry.schedule_id,
    }));
  };

  // Filter unassigned jobs by search
  const filteredUnassignedJobs = useMemo(() => {
    if (!searchTerm) return unassignedJobs;
    const lower = searchTerm.toLowerCase();
    return unassignedJobs.filter(job =>
      job.work_order_number?.toLowerCase().includes(lower) ||
      job.customer_name?.toLowerCase().includes(lower) ||
      job.job_description?.toLowerCase().includes(lower)
    );
  }, [unassignedJobs, searchTerm]);

  const selectedEmployeeData = employees.find(e => e.username === selectedEmployee);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="employee-calendar-container">
      {/* Header */}
      <Paper className="calendar-header" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: { xs: 1, sm: 2 }
        }}>
          {/* Employee Selector */}
          <FormControl sx={{ minWidth: { xs: '100%', sm: 250 }, order: { xs: 1, sm: 1 } }}>
            <InputLabel>Select Employee</InputLabel>
            <Select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              label="Select Employee"
              size="small"
            >
              {employees.map((emp) => (
                <MenuItem key={emp.username} value={emp.username}>
                  {emp.full_name || emp.username}
                  <Chip
                    label={emp.role}
                    size="small"
                    sx={{ ml: 1, textTransform: 'capitalize' }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Week Navigation */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            order: { xs: 2, sm: 2 },
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'space-between', sm: 'flex-start' }
          }}>
            <IconButton onClick={() => handleWeekChange(-1)} title="Previous Week" size="small">
              <PrevIcon />
            </IconButton>
            <Button
              variant="outlined"
              startIcon={<TodayIcon />}
              onClick={handleTodayClick}
              size="small"
            >
              Today
            </Button>
            <IconButton onClick={() => handleWeekChange(1)} title="Next Week" size="small">
              <NextIcon />
            </IconButton>
            {/* Week Display - inline on mobile */}
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                display: { xs: 'block', sm: 'none' },
                ml: 1,
                whiteSpace: 'nowrap',
                fontSize: '0.8rem'
              }}
            >
              {formatDateDisplay(weekStart)} - {formatDateDisplay(weekDays[6])}
            </Typography>
          </Box>

          {/* Week Display - separate line on desktop */}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              display: { xs: 'none', sm: 'block' },
              order: 3
            }}
          >
            {formatDateDisplay(weekStart)} - {formatDateDisplay(weekDays[6])}
          </Typography>
        </Box>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Calendar Grid - Full 24 hours, scrollable, starts at 7 AM */}
      <Paper ref={calendarGridRef} className="calendar-grid-container" sx={{ mb: 2, overflow: 'auto' }}>
        <Box className="calendar-grid">
          {/* Header Row - Days */}
          <Box className="calendar-header-row">
            <Box className="time-column-header"></Box>
            {weekDays.map((day, idx) => {
              const isToday = formatDateValue(day) === formatDateValue(new Date());
              const { weekday, day: dayNum } = formatDateShort(day);
              return (
                <Box
                  key={idx}
                  className={`day-header ${isToday ? 'today' : ''}`}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: isToday ? 700 : 500,
                      display: 'block',
                      lineHeight: 1.2,
                      fontSize: { xs: '0.65rem', sm: '0.75rem' },
                    }}
                  >
                    {isMobile ? weekday.charAt(0) : weekday}
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: isToday ? 700 : 600,
                      fontSize: { xs: '0.85rem', sm: '1rem' },
                    }}
                  >
                    {dayNum}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Time Slots Grid */}
          <Box className="calendar-body">
            {/* Time Column */}
            <Box className="time-column">
              {TIME_SLOTS.map((slot, idx) => {
                // Format mobile time: 12a, 1a, 2a... 12p, 1p, 2p...
                const mobileHour = slot.hour === 0 ? 12 : slot.hour > 12 ? slot.hour - 12 : slot.hour;
                const mobilePeriod = slot.hour >= 12 ? 'p' : 'a';
                const mobileTimeLabel = `${mobileHour}${mobilePeriod}`;

                return (
                  <Box
                    key={idx}
                    className="time-label"
                    style={{ height: SLOT_HEIGHT }}
                  >
                    {slot.minutes === 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.6rem', sm: '0.75rem' } }}
                      >
                        {isMobile ? mobileTimeLabel : slot.label}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* Day Columns */}
            {weekDays.map((day, dayIdx) => {
              const dayJobs = getJobsForDay(day);
              const isToday = formatDateValue(day) === formatDateValue(new Date());

              return (
                <Box
                  key={dayIdx}
                  className={`day-column ${isToday ? 'today' : ''}`}
                >
                  {/* Time Slots */}
                  {TIME_SLOTS.map((slot, slotIdx) => (
                    <Box
                      key={slotIdx}
                      className="time-slot"
                      style={{ height: SLOT_HEIGHT }}
                      onClick={() => handleTimeSlotClick(day, slot)}
                    />
                  ))}

                  {/* Job Blocks */}
                  {dayJobs.map((job) => (
                    <CalendarJobBlock
                      key={job.id}
                      workOrder={job}
                      slotHeight={SLOT_HEIGHT}
                      startHour={TIME_CONFIG.startHour}
                      onClick={() => handleJobBlockClick(job)}
                    />
                  ))}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Paper>

      {/* Unassigned Jobs Panel - Only visible to admins and managers */}
      {canModifyCrew && (
      <Paper className="unassigned-jobs-panel" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}>
          <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Unassigned Jobs ({filteredUnassignedJobs.length})
          </Typography>
          <TextField
            size="small"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
        </Box>

        <Box className="unassigned-jobs-list">
          {filteredUnassignedJobs.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No unassigned jobs
            </Typography>
          ) : (
            filteredUnassignedJobs.map((job) => (
              <Paper
                key={job.id}
                className="unassigned-job-card"
                elevation={1}
                onClick={() => handleUnassignedJobClick(job)}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'background.default',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.2s',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {job.work_order_number}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {job.customer_name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip
                    label={job.status || 'pending'}
                    size="small"
                    className={`status-chip status-${job.status || 'pending'}`}
                  />
                  {job.estimated_duration_hours && (
                    <Typography variant="caption" color="text.secondary">
                      Est: {job.estimated_duration_hours}h
                    </Typography>
                  )}
                </Box>
              </Paper>
            ))
          )}
        </Box>
      </Paper>
      )}

      {/* Job Selector Dialog - for when clicking on time slots */}
      <Dialog
        open={jobSelectorOpen}
        onClose={() => setJobSelectorOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: 'secondary.dark', color: 'secondary.contrastText' }}>
          Select Job to Schedule
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a job to add workers and schedule dates:
            </Typography>
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {allActiveJobs.map((job) => (
                <ListItem
                  key={job.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => handleJobSelected(job)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'secondary.dark' }}>
                      {job.work_order_number?.charAt(0) || 'J'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography fontWeight={600}>{job.work_order_number}</Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {job.job_description?.substring(0, 60)}...
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {job.customer_name}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
              {allActiveJobs.length === 0 && (
                <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                  No active jobs available
                </Typography>
              )}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJobSelectorOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Modify Crew Dialog - unified dialog for all crew modifications */}
      <ModifyCrewDialog
        open={modifyCrewDialogOpen}
        onClose={() => setModifyCrewDialogOpen(false)}
        workOrder={selectedJobForCrew}
        defaultDate={selectedJobForCrew?.scheduled_date}
        onSuccess={handleModifyCrewSuccess}
      />
    </Box>
  );
}

export default EmployeeCalendar;
