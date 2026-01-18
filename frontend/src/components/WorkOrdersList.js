import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Chip,
  IconButton,
  Button,
  MenuItem,
  Select,
  FormControl,
  CircularProgress,
  Alert,
  Tooltip,
  Collapse,
  Badge,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Visibility as VisibilityIcon,
  Add as AddIcon,
  GroupAdd as GroupAddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  EventBusy as EventBusyIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { fetchWorkOrders } from '../api';
import CreateWorkOrderDialog from './CreateWorkOrderDialog';
import ModifyCrewDialog from './schedule/ModifyCrewDialog';
import { ScheduleProvider } from './schedule/ScheduleContext';
import AppHeader from './AppHeader';
import logger from '../utils/logger';
function WorkOrdersList() {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // ModifyCrewDialog state
  const [modifyCrewDialogOpen, setModifyCrewDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  // Needs Date section state
  const [needsDateExpanded, setNeedsDateExpanded] = useState(true);

  // Filter work orders that need a date (no start_date/scheduled_date set)
  // Exclude completed, cancelled, invoiced, paid statuses
  const needsDateWorkOrders = useMemo(() => {
    const excludedStatuses = ['completed', 'cancelled', 'invoiced', 'paid'];
    return workOrders.filter(wo => {
      // Must not have a scheduled_date (which maps to start_date in the backend)
      if (wo.scheduled_date) return false;
      // Exclude terminal statuses
      if (excludedStatuses.includes(wo.status)) return false;
      return true;
    });
  }, [workOrders]);

  // Work orders that have dates (for the main grid)
  const scheduledWorkOrders = useMemo(() => {
    return workOrders.filter(wo => wo.scheduled_date);
  }, [workOrders]);

  useEffect(() => {
    loadWorkOrders();
  }, [statusFilter]);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkOrders(statusFilter || null);
      setWorkOrders(data.work_orders || []);
      setError(null);
    } catch (err) {
      logger.error('Error loading work orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      scheduled: 'info',
      in_progress: 'primary',
      completed: 'success',
      cancelled: 'error',
      delayed: 'default',
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'success',
      normal: 'default',
      high: 'warning',
      urgent: 'error',
    };
    return colors[priority] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Open ModifyCrewDialog for a work order
  const handleOpenModifyCrew = (workOrder, e) => {
    e.stopPropagation(); // Prevent navigation to work order detail
    // Transform the work order data to match what ModifyCrewDialog expects
    setSelectedWorkOrder({
      id: workOrder.id,
      work_order_number: workOrder.work_order_number,
      job_description: workOrder.job_description || workOrder.job_type,
      customer_name: workOrder.customer_name,
      service_address: workOrder.service_address,
      status: workOrder.status,
      scheduled_date: workOrder.scheduled_date,
      scheduled_start_time: workOrder.scheduled_start_time,
      assigned_to: workOrder.assigned_to,
    });
    setModifyCrewDialogOpen(true);
  };

  // Handle success from ModifyCrewDialog
  const handleCrewModifySuccess = () => {
    setModifyCrewDialogOpen(false);
    setSelectedWorkOrder(null);
    // Reload work orders to reflect changes
    loadWorkOrders();
  };

  // Columns for the Needs Date section (no scheduled date column)
  const needsDateColumns = [
    {
      field: 'service_address',
      headerName: 'Address',
      width: 220,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {params.value || 'No Address'}
        </Typography>
      ),
    },
    {
      field: 'work_order_number',
      headerName: 'WO #',
      width: 130,
    },
    {
      field: 'customer_name',
      headerName: 'Customer',
      width: 180,
    },
    {
      field: 'job_type',
      headerName: 'Job Type',
      width: 150,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value?.replace('_', ' ').toUpperCase()}
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value?.toUpperCase()}
          color={getPriorityColor(params.value)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 120,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="View Details">
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/work-orders/${params.row.id}`);
            }}
            size="small"
            color="primary"
          >
            <VisibilityIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const columns = [
    {
      field: 'service_address',
      headerName: 'Address',
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {params.value || 'No Address'}
        </Typography>
      ),
    },
    {
      field: 'work_order_number',
      headerName: 'WO #',
      width: 130,
    },
    {
      field: 'customer_name',
      headerName: 'Customer',
      width: 160,
    },
    {
      field: 'job_type',
      headerName: 'Job Type',
      width: 130,
    },
    {
      field: 'scheduled_date',
      headerName: 'Scheduled',
      width: 120,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value?.replace('_', ' ').toUpperCase()}
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value?.toUpperCase()}
          color={getPriorityColor(params.value)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'material_count',
      headerName: 'Items',
      width: 80,
      type: 'number',
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value || 0} ({params.row.total_items || 0})
        </Typography>
      ),
    },
    {
      field: 'quoted_subtotal',
      headerName: 'Quote Total',
      width: 120,
      type: 'number',
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'assigned_to',
      headerName: 'Assigned To',
      width: 120,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Modify Crew">
            <IconButton
              onClick={(e) => handleOpenModifyCrew(params.row, e)}
              size="small"
              color="primary"
            >
              <GroupAddIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Details">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/work-orders/${params.row.id}`);
              }}
              size="small"
              color="primary"
            >
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Work Orders">
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{
            mr: 1,
            bgcolor: 'success.main',
            color: 'success.contrastText',
            '&:hover': { bgcolor: 'success.light' },
            textTransform: 'none',
          }}
        >
          New
        </Button>
        <FormControl size="small" sx={{ minWidth: 120, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            displayEmpty
            sx={{
              color: 'white',
              '.MuiOutlinedInput-notchedOutline': { border: 'none' },
              '.MuiSvgIcon-root': { color: 'white' },
            }}
          >
            <MenuItem value="">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="scheduled">Scheduled</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="delayed">Delayed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>
      </AppHeader>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        <CreateWorkOrderDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onCreated={(result) => {
            setCreateDialogOpen(false);
            loadWorkOrders();
            navigate(`/work-orders/${result.work_order_id}`);
          }}
        />
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Needs Date Section - Jobs without a scheduled start date */}
        {!loading && needsDateWorkOrders.length > 0 && (
          <Paper elevation={2} sx={{ mb: 3 }}>
            <Box
              onClick={() => setNeedsDateExpanded(!needsDateExpanded)}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                bgcolor: 'warning.light',
                borderRadius: needsDateExpanded ? '4px 4px 0 0' : '4px',
                '&:hover': { bgcolor: 'warning.main' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <EventBusyIcon sx={{ color: 'warning.contrastText' }} />
                <Typography variant="h6" sx={{ color: 'warning.contrastText', fontWeight: 'bold' }}>
                  Needs Date
                </Typography>
                <Badge
                  badgeContent={needsDateWorkOrders.length}
                  color="error"
                  sx={{ ml: 1 }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'warning.contrastText' }}>
                  {needsDateWorkOrders.length} job{needsDateWorkOrders.length !== 1 ? 's' : ''} without scheduled date
                </Typography>
                {needsDateExpanded ? (
                  <ExpandLessIcon sx={{ color: 'warning.contrastText' }} />
                ) : (
                  <ExpandMoreIcon sx={{ color: 'warning.contrastText' }} />
                )}
              </Box>
            </Box>
            <Collapse in={needsDateExpanded}>
              <Box sx={{ height: Math.min(300, 52 + needsDateWorkOrders.length * 52), width: '100%' }}>
                <DataGrid
                  rows={needsDateWorkOrders}
                  columns={needsDateColumns}
                  pageSize={5}
                  rowsPerPageOptions={[5, 10, 25]}
                  disableSelectionOnClick
                  density="compact"
                  sx={{
                    border: 'none',
                    '& .MuiDataGrid-row:hover': {
                      cursor: 'pointer',
                      backgroundColor: 'rgba(255, 152, 0, 0.08)',
                    },
                  }}
                  onRowClick={(params) => navigate(`/work-orders/${params.row.id}`)}
                />
              </Box>
            </Collapse>
          </Paper>
        )}

        {/* Main Work Orders Grid */}
        <Paper elevation={3} sx={{ height: needsDateWorkOrders.length > 0 && needsDateExpanded ? 'calc(100vh - 500px)' : 'calc(100vh - 200px)', width: '100%' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={statusFilter ? workOrders : scheduledWorkOrders}
              columns={columns}
              pageSize={25}
              rowsPerPageOptions={[10, 25, 50, 100]}
              disableSelectionOnClick
              sx={{
                '& .MuiDataGrid-row:hover': {
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255, 107, 0, 0.08)',
                },
              }}
              onRowClick={(params) => navigate(`/work-orders/${params.row.id}`)}
            />
          )}
        </Paper>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Total: {workOrders.length} work order{workOrders.length !== 1 ? 's' : ''}
            {!statusFilter && needsDateWorkOrders.length > 0 && ` (${needsDateWorkOrders.length} needs date, ${scheduledWorkOrders.length} scheduled)`}
          </Typography>
        </Box>
      </Container>

      {/* ModifyCrewDialog wrapped in ScheduleProvider */}
      {modifyCrewDialogOpen && (
        <ScheduleProvider>
          <ModifyCrewDialog
            open={modifyCrewDialogOpen}
            onClose={() => {
              setModifyCrewDialogOpen(false);
              setSelectedWorkOrder(null);
            }}
            workOrder={selectedWorkOrder}
            onSuccess={handleCrewModifySuccess}
          />
        </ScheduleProvider>
      )}
    </Box>
  );
}

export default WorkOrdersList;
