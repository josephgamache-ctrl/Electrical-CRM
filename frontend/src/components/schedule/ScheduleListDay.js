import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Add as AddIcon,
  FiberManualRecord as DotIcon,
  GroupAdd as GroupAddIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import CreateWorkOrderDialog from '../CreateWorkOrderDialog';
import AssignedAvatars from '../common/AssignedAvatars';
import ModifyCrewDialog from './ModifyCrewDialog';
import { useSchedule } from './ScheduleContext';
import {
  getStatusHexColor,
  formatTime,
  getInvoiceStatus,
  getAssignedWorkers,
  isToday,
} from './scheduleHelpers';

function ScheduleListDay({ userRole }) {
  const navigate = useNavigate();

  // Use shared schedule context for synchronized data across all schedule tabs
  const {
    employees,
    workOrders: allWorkOrders,
    loading,
    setDateRange,
  } = useSchedule();

  const [localSelectedDate, setLocalSelectedDate] = useState(new Date());
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [weekDays, setWeekDays] = useState([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  // Modify Crew Dialog state
  const [modifyCrewDialogOpen, setModifyCrewDialogOpen] = useState(false);

  // Sync local date to context (single date = start and end are the same)
  useEffect(() => {
    const dateStr = localSelectedDate.toISOString().split('T')[0];
    setDateRange(dateStr); // Single date mode
  }, [localSelectedDate, setDateRange]);

  // Generate week days when date changes (starting from Monday)
  useEffect(() => {
    const days = [];
    const d = new Date(localSelectedDate);
    const day = d.getDay();
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); // Start from Monday

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      days.push(dayDate);
    }
    setWeekDays(days);
  }, [localSelectedDate]);

  // Filter work orders for selected date
  const workOrders = useMemo(() => {
    const dateStr = localSelectedDate.toISOString().split('T')[0];
    let orders = allWorkOrders.filter(wo => {
      if (!wo.scheduled_date) return false;
      return wo.scheduled_date === dateStr;
    });

    // Sort by time
    orders.sort((a, b) => {
      const timeA = a.scheduled_start_time || '00:00';
      const timeB = b.scheduled_start_time || '00:00';
      return timeA.localeCompare(timeB);
    });

    return orders;
  }, [allWorkOrders, localSelectedDate]);

  const formatTimeRange = (workOrder) => {
    if (workOrder.scheduled_start_time) {
      return formatTime(workOrder.scheduled_start_time);
    }
    return 'All Day';
  };

  const handleDayClick = (date) => {
    setLocalSelectedDate(date);
  };

  const handleJobClick = (workOrderId) => {
    navigate(`/jobs/${workOrderId}`);
  };

  const handleCreateNew = () => {
    setCreateDialogOpen(true);
  };

  const handleWorkOrderCreated = () => {
    setCreateDialogOpen(false);
  };

  // Menu handlers
  const handleMenuOpen = (event, workOrder) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedWorkOrder(workOrder);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  // Open modify crew dialog
  const handleOpenModifyCrewDialog = () => {
    if (!selectedWorkOrder) return;
    setModifyCrewDialogOpen(true);
    handleMenuClose();
  };

  // Handle success from ModifyCrewDialog
  const handleModifyCrewSuccess = (result) => {
    setSuccess(result.message);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: 'calc(100vh - 180px)' }}>
      {/* Day Selector */}
      <Box className="day-selector">
        {weekDays.map((day, idx) => (
          <Box
            key={idx}
            className={`day-item ${day.toDateString() === localSelectedDate.toDateString() ? 'selected' : ''} ${isToday(day) ? 'today' : ''}`}
            onClick={() => handleDayClick(day)}
          >
            <Typography className="day-label">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][idx]}
            </Typography>
            <Typography className="day-number">
              {day.getDate()}
            </Typography>
            {isToday(day) && (
              <DotIcon sx={{ fontSize: 8, mt: 0.5, color: 'inherit' }} />
            )}
          </Box>
        ))}
      </Box>

      {/* Jobs List */}
      <Box sx={{ px: 2, py: 2 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {workOrders.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No jobs scheduled for {localSelectedDate.toLocaleDateString()}
            </Typography>
          </Box>
        ) : (
          workOrders.map((workOrder) => {
            const invoiceStatus = getInvoiceStatus(workOrder);
            const statusColor = getStatusHexColor(workOrder.status);
            const workers = getAssignedWorkers(workOrder.assigned_to, employees);

            return (
              <Box
                key={workOrder.id}
                className="job-card"
                onClick={() => handleJobClick(workOrder.id)}
              >
                <Box
                  className={`job-card-border status-${workOrder.status}`}
                  style={{ backgroundColor: statusColor }}
                />
                {/* Time */}
                <Box sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                    {formatTimeRange(workOrder)}
                  </Typography>
                </Box>

                {/* Job Title */}
                <Typography variant="h6" sx={{ mb: 0.5, fontSize: 16, fontWeight: 600 }}>
                  {workOrder.job_description || `Work Order #${workOrder.work_order_number}`}
                </Typography>

                {/* Customer */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {workOrder.customer_name}
                </Typography>

                {/* Address */}
                {workOrder.service_address && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                    {workOrder.service_address}
                  </Typography>
                )}

                {/* Assigned Employees */}
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {workers.length > 0 ? (
                      <>
                        <AssignedAvatars
                          assignedWorkers={workers}
                          size="medium"
                          max={4}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 500, ml: 1 }}>
                          {workers.length > 1
                            ? `${workers.length} workers`
                            : workers[0]?.full_name || workOrder.assigned_to}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Unassigned
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={workOrder.status.replace('_', ' ')}
                    size="small"
                    sx={{
                      textTransform: 'capitalize',
                      bgcolor: `${statusColor}20`,
                      color: statusColor,
                      fontWeight: 600,
                    }}
                  />
                </Box>

                {/* Invoice Status Badge */}
                {invoiceStatus && (
                  <Box className={`job-status-badge ${invoiceStatus.color}`}>
                    {invoiceStatus.label}
                  </Box>
                )}

                {/* More Menu Icon */}
                <IconButton
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                  }}
                  onClick={(e) => handleMenuOpen(e, workOrder)}
                >
                  <MoreIcon />
                </IconButton>
              </Box>
            );
          })
        )}
      </Box>

      {/* Create New Button */}
      <Fab
        color="primary"
        aria-label="create new"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          bgcolor: '#4caf50',
          '&:hover': {
            bgcolor: '#66bb6a',
          },
        }}
        onClick={handleCreateNew}
      >
        <AddIcon />
      </Fab>

      {/* Create Work Order Dialog */}
      <CreateWorkOrderDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={handleWorkOrderCreated}
      />

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {(userRole === 'admin' || userRole === 'manager') && (
          <MenuItem onClick={handleOpenModifyCrewDialog}>
            <ListItemIcon>
              <GroupAddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Modify Crew</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => {
          handleMenuClose();
          if (selectedWorkOrder) navigate(`/jobs/${selectedWorkOrder.id}`);
        }}>
          <ListItemIcon>
            <OpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
      </Menu>

      {/* Modify Crew Dialog - Using shared component */}
      <ModifyCrewDialog
        open={modifyCrewDialogOpen}
        onClose={() => setModifyCrewDialogOpen(false)}
        workOrder={selectedWorkOrder}
        defaultDate={localSelectedDate.toISOString().split('T')[0]}
        onSuccess={handleModifyCrewSuccess}
      />
    </Box>
  );
}

export default ScheduleListDay;
