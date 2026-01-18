import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Alert,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  useMediaQuery,
  useTheme,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Add as AddIcon,
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
  GroupAdd as GroupAddIcon,
  CalendarMonth as CalendarMonthIcon,
  CalendarViewWeek as WeekIcon,
  CalendarViewMonth as MonthIcon,
  Today as TodayIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';
import AssignedAvatars from '../common/AssignedAvatars';
import { useSchedule } from './ScheduleContext';
import ModifyCrewDialog from './ModifyCrewDialog';
import { PRIORITY_COLORS, getStatusColor } from './scheduleHelpers';

function ScheduleCalendar({ userRole }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Use shared schedule context for synchronized data across all schedule tabs
  const {
    employees,
    workOrders: allWorkOrders,
    scheduleEntries,
    loading,
    refreshSchedule,
    selectDateRange,
  } = useSchedule();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // Always default to month view
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [jobSelectorOpen, setJobSelectorOpen] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modify Crew Dialog state - unified dialog for all crew modifications
  const [modifyCrewDialogOpen, setModifyCrewDialogOpen] = useState(false);
  const [jobToModify, setJobToModify] = useState(null);

  // No longer auto-switching view mode - user controls it

  const getDateRange = useCallback(() => {
    if (viewMode === 'week') {
      // Get start of week (Sunday)
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return {
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0],
      };
    } else {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
      };
    }
  }, [currentDate, viewMode]);

  // Update context date range when view changes
  useEffect(() => {
    const { start, end } = getDateRange();
    selectDateRange(start, end);
  }, [currentDate, viewMode, getDateRange, selectDateRange]);

  // Get active work orders for assignment dropdown
  const workOrders = useMemo(() => {
    return allWorkOrders.filter(
      (wo) => !['completed', 'invoiced', 'paid', 'canceled'].includes(wo.status)
    );
  }, [allWorkOrders]);

  // Build schedule array from scheduleEntries (grouped by date/work_order)
  const schedule = useMemo(() => {
    // Group entries by schedule_id to get unique schedule items
    const scheduleMap = new Map();
    scheduleEntries.forEach(entry => {
      if (!scheduleMap.has(entry.schedule_id)) {
        scheduleMap.set(entry.schedule_id, {
          schedule_id: entry.schedule_id,
          scheduled_date: entry.scheduled_date,
          start_time: entry.start_time,
          end_time: entry.end_time,
          day_status: entry.day_status,
          phase_name: entry.phase_name,
          work_order_id: entry.work_order_id,
          work_order_number: entry.work_order_number,
          job_description: entry.job_description,
          job_type: entry.job_type,
          job_status: entry.job_status,
          priority: entry.priority,
          service_address: entry.service_address,
          customer_name: entry.customer_name,
          customer_phone: entry.customer_phone,
          crew: entry.all_crew || [],
        });
      }
    });
    return Array.from(scheduleMap.values());
  }, [scheduleEntries]);

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push(date);
    }
    return days;
  };

  const getJobsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return schedule.filter((item) => item.scheduled_date === dateStr);
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date) => {
    if (!date) return;
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDay({ date, dateStr, jobs: getJobsForDate(date) });
    setDayDialogOpen(true);
  };

  // Open job selector to pick a job, then open ModifyCrewDialog
  const handleOpenJobSelector = () => {
    setDayDialogOpen(false);
    setJobSelectorOpen(true);
  };

  // When a job is selected from the job selector, open ModifyCrewDialog
  const handleJobSelected = (job) => {
    setJobSelectorOpen(false);
    setJobToModify(job);
    setModifyCrewDialogOpen(true);
  };

  const handleRemoveScheduleDate = async (workOrderId, dateStr) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/work-orders/${workOrderId}/schedule-dates/${dateStr}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        setSuccess('Schedule date removed');
        refreshSchedule();
        setDayDialogOpen(false);
      } else {
        throw new Error('Failed to remove date');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Open modify crew dialog for a job
  const handleOpenModifyCrewDialog = (job) => {
    // Transform schedule entry data to work order format for the shared dialog
    setJobToModify({
      id: job.work_order_id,
      work_order_number: job.work_order_number,
      job_description: job.job_description,
      customer_name: job.customer_name,
      service_address: job.service_address,
      status: job.job_status,
      scheduled_date: job.scheduled_date,
      scheduled_start_time: job.start_time,
      scheduled_end_time: job.end_time,
      assigned_to: job.crew?.map(c => c.username).join(',') || '',
    });
    setModifyCrewDialogOpen(true);
  };

  // Handle success from ModifyCrewDialog
  const handleModifyCrewSuccess = async (result) => {
    setSuccess(result.message);
    // Ensure schedule data is refreshed to show updates
    await refreshSchedule();
    // Update selected day's jobs after refresh
    if (selectedDay) {
      const updatedJobs = schedule.filter(s => s.scheduled_date === selectedDay.dateStr);
      setSelectedDay({ ...selectedDay, jobs: updatedJobs });
    }
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getHeaderText = () => {
    if (viewMode === 'week') {
      const days = getWeekDays();
      const start = days[0];
      const end = days[6];
      const options = { month: 'short', day: 'numeric' };
      return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Render a single day cell
  const renderDayCell = (date, isWeekView = false) => {
    if (!date) {
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            minHeight: isWeekView ? 'calc(100vh - 280px)' : { xs: 48, sm: 70, md: 120 },
            borderRadius: 1,
          }}
        />
      );
    }

    const jobs = getJobsForDate(date);
    const today = isToday(date);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();

    return (
      <Paper
        onClick={() => handleDayClick(date)}
        elevation={today ? 4 : 1}
        sx={{
          minHeight: isWeekView ? 'calc(100vh - 280px)' : { xs: 48, sm: 70, md: 120 },
          p: isWeekView ? 1.5 : { xs: 0.25, sm: 0.5, md: 1 },
          bgcolor: today ? 'primary.light' : 'background.paper',
          cursor: 'pointer',
          border: today ? '2px solid' : '1px solid',
          borderColor: today ? 'primary.main' : 'divider',
          borderRadius: { xs: 0.5, md: 1 },
          overflow: 'hidden',
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: 'action.hover',
            transform: 'scale(1.01)',
            boxShadow: 3,
          },
        }}
      >
        {/* Day Header */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: isWeekView ? 'column' : 'row',
            alignItems: isWeekView ? 'center' : 'flex-start',
            justifyContent: 'space-between',
            mb: { xs: 0, md: 0.5 },
            pb: isWeekView ? 1 : 0,
            borderBottom: isWeekView ? 1 : 0,
            borderBottomStyle: 'solid',
            borderBottomColor: 'divider',
          }}
        >
          {isWeekView && (
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 500,
                color: today ? 'primary.main' : 'text.secondary',
                textTransform: 'uppercase',
              }}
            >
              {dayOfWeek}
            </Typography>
          )}
          <Typography
            sx={{
              fontSize: isWeekView ? 24 : { xs: 11, sm: 13, md: 16 },
              fontWeight: today ? 700 : 500,
              color: today && isWeekView ? 'primary.contrastText' : today ? 'primary.main' : 'text.primary',
              bgcolor: today && isWeekView ? 'primary.main' : 'transparent',
              borderRadius: '50%',
              width: isWeekView ? 40 : { xs: 20, md: 'auto' },
              height: isWeekView ? 40 : { xs: 20, md: 'auto' },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {dayNum}
          </Typography>
          {jobs.length > 0 && !isWeekView && (
            <Chip
              label={jobs.length}
              size="small"
              color="primary"
              sx={{
                height: { xs: 14, sm: 16, md: 18 },
                fontSize: { xs: 9, md: 10 },
                minWidth: { xs: 14, md: 'auto' },
                '& .MuiChip-label': {
                  px: { xs: 0.5, md: 1 },
                },
              }}
            />
          )}
        </Box>

        {/* Jobs List */}
        <Box sx={{ overflow: 'auto', maxHeight: isWeekView ? 'calc(100% - 60px)' : { xs: 18, sm: 35, md: 70 } }}>
          {jobs.length === 0 ? (
            isWeekView && (
              <Typography
                sx={{
                  fontSize: 12,
                  color: 'text.disabled',
                  textAlign: 'center',
                  mt: 2,
                }}
              >
                No jobs
              </Typography>
            )
          ) : (
            jobs.slice(0, isWeekView ? 10 : (isMobile ? 1 : 3)).map((job) => (
              <Box
                key={`${job.work_order_id}-${job.scheduled_date}`}
                sx={{
                  bgcolor: getStatusColor(job.job_status),
                  borderLeft: `3px solid ${PRIORITY_COLORS[job.priority] || '#1976d2'}`,
                  borderRadius: 0.5,
                  p: isWeekView ? 1 : { xs: 0.25, md: 0.5 },
                  mb: 0.25,
                  color: 'white',
                }}
              >
                <Typography
                  sx={{
                    fontSize: isWeekView ? 13 : { xs: 8, sm: 9, md: 11 },
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                >
                  {isMobile && !isWeekView ? job.work_order_number?.slice(-4) : job.work_order_number}
                </Typography>
                {isWeekView && (
                  <>
                    <Typography
                      sx={{
                        fontSize: 11,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: 0.9,
                      }}
                    >
                      {job.job_description?.substring(0, 40)}...
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 10,
                        opacity: 0.8,
                        mt: 0.5,
                      }}
                    >
                      {job.customer_name}
                    </Typography>
                    {job.crew && job.crew.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <AssignedAvatars
                          assignedWorkers={job.crew.map(c => ({ username: c.username, full_name: c.full_name }))}
                          size="small"
                          max={3}
                        />
                      </Box>
                    )}
                  </>
                )}
              </Box>
            ))
          )}
          {jobs.length > (isWeekView ? 10 : (isMobile ? 1 : 3)) && (
            <Typography sx={{ fontSize: { xs: 8, md: 10 }, color: 'text.secondary', textAlign: 'center' }}>
              +{jobs.length - (isWeekView ? 10 : (isMobile ? 1 : 3))}
            </Typography>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 180px)' }}>
      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ m: 1 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ m: 1 }}>
          {success}
        </Alert>
      )}

      {/* Calendar Header */}
      <Paper
        elevation={2}
        sx={{
          p: { xs: 1, md: 2 },
          m: { xs: 1, md: 2 },
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {/* Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={handlePrev} size={isMobile ? 'small' : 'medium'}>
            <PrevIcon />
          </IconButton>
          <Typography
            variant={isMobile ? 'subtitle1' : 'h6'}
            sx={{ fontWeight: 600, minWidth: { xs: 150, md: 250 }, textAlign: 'center' }}
          >
            {getHeaderText()}
          </Typography>
          <IconButton onClick={handleNext} size={isMobile ? 'small' : 'medium'}>
            <NextIcon />
          </IconButton>
        </Box>

        {/* View Toggle & Today Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TodayIcon />}
            onClick={handleToday}
          >
            Today
          </Button>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newView) => newView && setViewMode(newView)}
            size="small"
          >
            <ToggleButton value="week">
              <WeekIcon sx={{ mr: { xs: 0, sm: 0.5 } }} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Week</Box>
            </ToggleButton>
            <ToggleButton value="month">
              <MonthIcon sx={{ mr: { xs: 0, sm: 0.5 } }} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Month</Box>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Calendar Grid */}
      <Box sx={{ p: { xs: 1, md: 2 } }}>
        {viewMode === 'week' ? (
          /* Week View */
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 1,
            }}
          >
            {getWeekDays().map((date, index) => (
              <Box key={index}>{renderDayCell(date, true)}</Box>
            ))}
          </Box>
        ) : (
          /* Month View */
          <>
            {/* Day Headers */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 1,
                mb: 1,
              }}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <Typography
                  key={day}
                  align="center"
                  sx={{
                    fontWeight: 600,
                    color: 'text.secondary',
                    fontSize: { xs: 11, md: 14 },
                    py: 0.5,
                  }}
                >
                  {isMobile ? day.charAt(0) : day}
                </Typography>
              ))}
            </Box>

            {/* Month Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: { xs: 0.25, sm: 0.5, md: 1 },
              }}
            >
              {getMonthDays().map((date, index) => (
                <Box key={index}>{renderDayCell(date, false)}</Box>
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* Day Detail Dialog */}
      <Dialog
        open={dayDialogOpen}
        onClose={() => setDayDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: 'secondary.dark', color: 'secondary.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonthIcon />
            {selectedDay &&
              selectedDay.date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedDay?.jobs.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <ScheduleIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 2 }} />
              <Typography color="text.secondary">No jobs scheduled for this day</Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {selectedDay?.jobs.map((job) => (
                <ListItem
                  key={`${job.work_order_id}-${job.scheduled_date}`}
                  secondaryAction={
                    (userRole === 'admin' || userRole === 'manager') && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Add/Modify Crew">
                          <IconButton
                            edge="end"
                            color="primary"
                            onClick={() => handleOpenModifyCrewDialog(job)}
                          >
                            <GroupAddIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove from schedule">
                          <IconButton
                            edge="end"
                            color="error"
                            onClick={() => handleRemoveScheduleDate(job.work_order_id, job.scheduled_date)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )
                  }
                  sx={{
                    borderBottom: 1,
                    borderBottomColor: 'divider',
                    borderLeft: 4,
                    borderLeftStyle: 'solid',
                    borderLeftColor: PRIORITY_COLORS[job.priority] || 'primary.main',
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: getStatusColor(job.job_status) }}>
                      <ScheduleIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography fontWeight={600}>{job.work_order_number}</Typography>
                        <Chip
                          label={job.job_status}
                          size="small"
                          sx={{
                            bgcolor: getStatusColor(job.job_status),
                            color: 'white',
                            height: 20,
                            fontSize: 10,
                          }}
                        />
                        {job.start_time && (
                          <Chip
                            icon={<TimeIcon sx={{ fontSize: 14 }} />}
                            label={`${job.start_time} - ${job.end_time || '15:30'}`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: 10 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {job.job_description}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                          {job.customer_name} - {job.service_address}
                        </Typography>
                        {job.crew && job.crew.length > 0 && (
                          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AssignedAvatars
                              assignedWorkers={job.crew.map(c => ({ username: c.username, full_name: c.full_name }))}
                              size="medium"
                              max={5}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {job.crew.length} worker{job.crew.length !== 1 ? 's' : ''}
                              {job.crew.find(c => c.is_lead) && ` (Lead: ${job.crew.find(c => c.is_lead).full_name})`}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderTopColor: 'divider' }}>
          <Button onClick={() => setDayDialogOpen(false)}>Close</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenJobSelector}>
            Schedule Job
          </Button>
        </DialogActions>
      </Dialog>

      {/* Job Selector Dialog - picks a job then opens ModifyCrewDialog */}
      <Dialog
        open={jobSelectorOpen}
        onClose={() => setJobSelectorOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: 'secondary.dark', color: 'secondary.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon />
            Select Job to Schedule
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a job to add workers and schedule dates:
            </Typography>
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {workOrders.map((wo) => (
                <ListItem
                  key={wo.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => handleJobSelected(wo)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'secondary.dark' }}>
                      <ScheduleIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography fontWeight={600}>{wo.work_order_number}</Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {wo.job_description?.substring(0, 60)}...
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {wo.customer_name} - {wo.service_address}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
              {workOrders.length === 0 && (
                <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                  No active jobs to schedule
                </Typography>
              )}
            </List>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderTopColor: 'divider' }}>
          <Button onClick={() => setJobSelectorOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Modify Crew Dialog - Using shared component */}
      <ModifyCrewDialog
        open={modifyCrewDialogOpen}
        onClose={() => setModifyCrewDialogOpen(false)}
        workOrder={jobToModify}
        defaultDate={selectedDay?.dateStr}
        onSuccess={handleModifyCrewSuccess}
      />
    </Box>
  );
}

export default ScheduleCalendar;
