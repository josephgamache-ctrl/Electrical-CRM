import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Work as WorkIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Inventory as InventoryIcon,
  AdminPanelSettings as AdminIcon,
  Receipt as ReceiptIcon,
  GroupAdd as GroupAddIcon,
  ShoppingCart as ShoppingCartIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getMyDashboardJobs, API_BASE_URL } from '../api';
import AppHeader from './AppHeader';
import AssignedAvatars from './common/AssignedAvatars';
import ModifyCrewDialog from './schedule/ModifyCrewDialog';
import { ScheduleProvider } from './schedule/ScheduleContext';
import './DesktopDashboard.css';
import logger from '../utils/logger';
function DesktopDashboard() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    stats: {
      todayJobs: 0,
      inProgressJobs: 0,
      completedThisWeek: 0,
      pendingJobs: 0,
      totalCustomers: 0,
      outstandingBalance: 0,
      serviceCalls: 0,
    },
    todaySchedule: [],
    serviceCalls: [],
    upcomingJobs: [],
  });

  // ModifyCrewDialog state
  const [modifyCrewDialogOpen, setModifyCrewDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  // Track mounted state for safe async updates
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    loadDashboardData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const userData = await getCurrentUser();
      setUserRole(userData.role);

      // Load role-based dashboard jobs
      const myDashboard = await getMyDashboardJobs();

      // Process my jobs - sorted by date/time from backend (earliest first)
      const todayScheduleList = (myDashboard.my_jobs || []).map(job => ({
        id: job.id,
        number: job.work_order_number,
        description: job.job_description || 'No description',
        customer: job.customer_name || 'Unknown',
        status: job.status,
        priority: job.priority,
        scheduledDate: job.scheduled_date,
        scheduledStartTime: job.scheduled_start_time,
        address: [job.service_address, job.service_city, job.service_state].filter(Boolean).join(', '),
        crew: (job.crew || []).map(c => ({
          username: c.username,
          full_name: c.full_name,
          role: c.role,
          is_lead: c.is_lead
        })),
        workOrder: job,
      }));

      // Process service calls - sorted by priority/date from backend
      const serviceCallsList = (myDashboard.service_calls || []).map(job => ({
        id: job.id,
        number: job.work_order_number,
        description: job.job_description || 'No description',
        customer: job.customer_name || 'Unknown',
        status: job.status,
        priority: job.priority,
        scheduledDate: job.scheduled_date,
        address: [job.service_address, job.service_city, job.service_state].filter(Boolean).join(', '),
        crew: (job.crew || []).map(c => ({
          username: c.username,
          full_name: c.full_name,
          role: c.role,
          is_lead: c.is_lead
        })),
        workOrder: job,
      }));

      // Also load additional stats
      await Promise.all([
        loadCustomerStats(token),
        loadFinancialStats(token),
      ]);

      if (isMountedRef.current) {
        setDashboardData(prev => ({
          ...prev,
          todaySchedule: todayScheduleList,
          serviceCalls: serviceCallsList,
          stats: {
            ...prev.stats,
            todayJobs: todayScheduleList.length,
            serviceCalls: serviceCallsList.length,
            inProgressJobs: todayScheduleList.filter(j => j.status === 'in_progress').length,
          }
        }));
      }

    } catch (err) {
      if (isMountedRef.current) {
        logger.error('Failed to load dashboard data:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Load crew data from calendar/schedule endpoint and update todaySchedule
  const loadTodayCrewData = async (token) => {
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `${API_BASE_URL}/calendar/schedule?start_date=${todayDate}&end_date=${todayDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const scheduleItems = data.schedule || [];

        // Create a map of work_order_id to crew for today
        const crewByWorkOrder = {};
        scheduleItems.forEach((item) => {
          if (item.crew && item.crew.length > 0) {
            crewByWorkOrder[item.work_order_id] = item.crew;
          }
        });

        // Update today's schedule with crew data
        setDashboardData((prev) => ({
          ...prev,
          todaySchedule: prev.todaySchedule.map((job) => ({
            ...job,
            crew: crewByWorkOrder[job.id] || [],
          })),
          serviceCalls: prev.serviceCalls.map((job) => ({
            ...job,
            crew: crewByWorkOrder[job.id] || [],
          })),
        }));
      }
    } catch (err) {
      logger.error('Failed to load today crew data:', err);
    }
  };

  const loadWorkOrderStats = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/work-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const workOrders = data.work_orders || [];
        const todayDate = new Date().toISOString().split('T')[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];

        // Calculate stats - Today's Jobs: on or past scheduled date, not delayed/completed/cancelled
        const todayJobs = workOrders.filter(
          (wo) => {
            const isOnOrPastScheduledDate = wo.scheduled_date && wo.scheduled_date <= todayDate;
            const isActive = wo.status !== 'completed' && wo.status !== 'cancelled' && wo.status !== 'delayed';
            return isOnOrPastScheduledDate && isActive;
          }
        );
        const inProgress = workOrders.filter((wo) => wo.status === 'in_progress');
        const completedThisWeek = workOrders.filter(
          (wo) =>
            wo.status === 'completed' &&
            wo.scheduled_date &&
            wo.scheduled_date >= weekAgoStr
        );
        const pending = workOrders.filter((wo) => wo.status === 'pending');

        // Service Calls - on or past scheduled date and not completed/cancelled
        const serviceCallsList = workOrders
          .filter((wo) => {
            const isServiceCall = wo.job_type === 'Service Call' || wo.emergency_call === true;
            const isNotCompleted = wo.status !== 'completed' && wo.status !== 'cancelled';
            const isOnOrPastScheduledDate = wo.scheduled_date && wo.scheduled_date <= todayDate;
            return isServiceCall && isNotCompleted && isOnOrPastScheduledDate;
          })
          .sort((a, b) => {
            const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
            const aPriority = priorityOrder[a.priority] ?? 2;
            const bPriority = priorityOrder[b.priority] ?? 2;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
          })
          .slice(0, 5);

        // Get upcoming jobs (next 7 days)
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const upcoming = workOrders
          .filter((wo) => {
            if (!wo.scheduled_date) return false;
            const schedDate = new Date(wo.scheduled_date);
            // Include both pending and scheduled jobs with future dates
            return schedDate > today && schedDate <= nextWeek &&
                   ['pending', 'scheduled', 'in_progress'].includes(wo.status);
          })
          .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
          .slice(0, 5);

        setDashboardData((prev) => ({
          ...prev,
          stats: {
            ...prev.stats,
            todayJobs: todayJobs.length,
            inProgressJobs: inProgress.length,
            completedThisWeek: completedThisWeek.length,
            pendingJobs: pending.length,
            serviceCalls: serviceCallsList.length,
          },
          todaySchedule: todayJobs.map((wo) => ({
            id: wo.id,
            number: wo.work_order_number,
            description: wo.job_description || 'No description',
            customer: wo.customer_name || 'Unknown',
            status: wo.status,
            assignedTo: wo.assigned_to,
            priority: wo.priority,
            crew: [],
            // Store full work order for ModifyCrewDialog
            workOrder: wo,
          })),
          serviceCalls: serviceCallsList.map((wo) => ({
            id: wo.id,
            number: wo.work_order_number,
            description: wo.job_description || 'No description',
            customer: wo.customer_name || 'Unknown',
            status: wo.status,
            assignedTo: wo.assigned_to,
            priority: wo.priority,
            scheduledDate: wo.scheduled_date,
            crew: [],
            workOrder: wo,
          })),
          upcomingJobs: upcoming.map((wo) => ({
            id: wo.id,
            number: wo.work_order_number,
            description: wo.job_description || 'No description',
            customer: wo.customer_name || 'Unknown',
            date: wo.scheduled_date,
            assignedTo: wo.assigned_to,
            crew: [],
            workOrder: wo,
          })),
        }));
      }
    } catch (err) {
      logger.error('Failed to load work order stats:', err);
    }
  };

  const loadCustomerStats = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const customers = data.customers || [];
        setDashboardData((prev) => ({
          ...prev,
          stats: {
            ...prev.stats,
            totalCustomers: customers.length,
          },
        }));
      }
    } catch (err) {
      logger.error('Failed to load customer stats:', err);
    }
  };

  const loadFinancialStats = async (token) => {
    try {
      // Only load for admin/manager
      if (userRole !== 'admin' && userRole !== 'manager') return;

      // Use financial snapshot endpoint instead
      const response = await fetch(`${API_BASE_URL}/reports/financial-snapshot`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const snapshot = await response.json();
        const outstanding = snapshot.outstanding_invoices || 0;

        setDashboardData((prev) => ({
          ...prev,
          stats: {
            ...prev.stats,
            outstandingBalance: outstanding,
          },
        }));
      }
    } catch (err) {
      logger.error('Failed to load financial stats:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'in_progress':
      case 'in progress':
        return 'primary';
      case 'scheduled':
        return 'info';
      case 'pending':
        return 'warning';
      case 'delayed':
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  // Open ModifyCrewDialog for a work order
  const handleOpenModifyCrew = (job, e) => {
    e.stopPropagation(); // Prevent navigation to job detail
    setSelectedWorkOrder(job.workOrder);
    setModifyCrewDialogOpen(true);
  };

  // Handle success from ModifyCrewDialog
  const handleCrewModifySuccess = () => {
    setModifyCrewDialogOpen(false);
    setSelectedWorkOrder(null);
    // Reload dashboard data to reflect changes
    loadDashboardData();
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Top AppBar */}
      <AppHeader title="Dashboard" showSearch={false} />

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Stats Cards Row */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Today's Jobs */}
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ScheduleIcon sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                      {dashboardData.stats.todayJobs}
                    </Typography>
                    <Typography variant="body2">Today's Jobs</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* In Progress */}
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <WorkIcon sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                      {dashboardData.stats.inProgressJobs}
                    </Typography>
                    <Typography variant="body2">In Progress</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Completed This Week */}
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CheckCircleIcon sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                      {dashboardData.stats.completedThisWeek}
                    </Typography>
                    <Typography variant="body2">Completed This Week</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Pending Jobs */}
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <WarningIcon sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                      {dashboardData.stats.pendingJobs}
                    </Typography>
                    <Typography variant="body2">Pending Jobs</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Second Row - Additional Stats */}
        {(userRole === 'admin' || userRole === 'manager') && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={4}>
              <Card elevation={2} sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <MoneyIcon sx={{ fontSize: 48, color: '#4caf50', mr: 2 }} />
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                        ${dashboardData.stats.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Outstanding Balance
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Card elevation={2} sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PeopleIcon sx={{ fontSize: 48, color: '#2196f3', mr: 2 }} />
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                        {dashboardData.stats.totalCustomers}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Customers
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Card elevation={2} sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/reports')}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TrendingUpIcon sx={{ fontSize: 48, color: '#ff9800', mr: 2 }} />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                        View Reports
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Financial & Analytics
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Main Content Row */}
        <Grid container spacing={3}>
          {/* Today's Schedule */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#667eea' }}>
                Today's Schedule
              </Typography>
              {dashboardData.todaySchedule.length > 0 ? (
                <List>
                  {dashboardData.todaySchedule.map((job, idx) => (
                    <React.Fragment key={job.id}>
                      <ListItem
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                {job.number}
                              </Typography>
                              <Chip label={job.status} size="small" color={getStatusColor(job.status)} />
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" color="text.primary">
                                {job.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Customer: {job.customer}
                              </Typography>
                            </>
                          }
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
                          <AssignedAvatars assignedWorkers={job.crew} size="small" max={3} />
                          {(userRole === 'admin' || userRole === 'manager') && (
                            <Tooltip title="Modify Crew">
                              <IconButton
                                size="small"
                                onClick={(e) => handleOpenModifyCrew(job, e)}
                                sx={{ color: '#667eea' }}
                              >
                                <GroupAddIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </ListItem>
                      {idx < dashboardData.todaySchedule.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <ScheduleIcon sx={{ fontSize: 60, opacity: 0.3, mb: 2 }} />
                  <Typography>No jobs scheduled for today</Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Service Calls */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#f5576c' }}>
                Service Calls
              </Typography>
              {dashboardData.serviceCalls.length > 0 ? (
                <List>
                  {dashboardData.serviceCalls.map((job, idx) => (
                    <React.Fragment key={job.id}>
                      <ListItem
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                {job.number}
                              </Typography>
                              <Chip label={job.status} size="small" color={getStatusColor(job.status)} />
                              {job.priority === 'urgent' && (
                                <Chip label="URGENT" size="small" color="error" />
                              )}
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" color="text.primary">
                                {job.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Customer: {job.customer}
                              </Typography>
                            </>
                          }
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
                          <AssignedAvatars assignedWorkers={job.crew} size="small" max={3} />
                          {(userRole === 'admin' || userRole === 'manager') && (
                            <Tooltip title="Modify Crew">
                              <IconButton
                                size="small"
                                onClick={(e) => handleOpenModifyCrew(job, e)}
                                sx={{ color: '#f5576c' }}
                              >
                                <GroupAddIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </ListItem>
                      {idx < dashboardData.serviceCalls.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <WarningIcon sx={{ fontSize: 60, opacity: 0.3, mb: 2 }} />
                  <Typography>No service calls</Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Upcoming Jobs Row */}
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#667eea' }}>
                Upcoming Jobs (Next 7 Days)
              </Typography>
              {dashboardData.upcomingJobs.length > 0 ? (
                <List sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {dashboardData.upcomingJobs.map((job) => (
                    <Card
                      key={job.id}
                      elevation={2}
                      sx={{
                        flex: '1 1 calc(33% - 16px)',
                        minWidth: 280,
                        cursor: 'pointer',
                        '&:hover': { boxShadow: 4 },
                      }}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {job.number}
                          </Typography>
                          <Chip
                            label={new Date(job.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                            size="small"
                            color="info"
                          />
                        </Box>
                        <Typography variant="body2" color="text.primary" sx={{ mb: 1 }}>
                          {job.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Customer: {job.customer}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                          <AssignedAvatars assignedWorkers={job.crew} size="small" max={3} />
                          {(userRole === 'admin' || userRole === 'manager') && (
                            <Tooltip title="Modify Crew">
                              <IconButton
                                size="small"
                                onClick={(e) => handleOpenModifyCrew(job, e)}
                                sx={{ color: '#667eea' }}
                              >
                                <GroupAddIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <WorkIcon sx={{ fontSize: 60, opacity: 0.3, mb: 2 }} />
                  <Typography>No upcoming jobs scheduled</Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Quick Actions */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            {/* Work Orders - Admin/Manager only */}
            {(userRole === 'admin' || userRole === 'manager') && (
              <Grid item xs={6} sm={3}>
                <Card
                  elevation={2}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  }}
                  onClick={() => navigate('/work-orders')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <WorkIcon sx={{ fontSize: 48, color: '#667eea', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Work Orders
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            <Grid item xs={6} sm={3}>
              <Card
                elevation={2}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                }}
                onClick={() => navigate('/customers')}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <PeopleIcon sx={{ fontSize: 48, color: '#2196f3', mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    Customers
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card
                elevation={2}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                }}
                onClick={() => navigate('/inventory')}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <InventoryIcon sx={{ fontSize: 48, color: '#4caf50', mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    Inventory
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card
                elevation={2}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                }}
                onClick={() => navigate('/schedule')}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <ScheduleIcon sx={{ fontSize: 48, color: '#2c3e8f', mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    Schedule
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {/* Quotes - Admin/Manager only */}
            {(userRole === 'admin' || userRole === 'manager') && (
              <Grid item xs={6} sm={3}>
                <Card
                  elevation={2}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  }}
                  onClick={() => navigate('/quotes')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <DescriptionIcon sx={{ fontSize: 48, color: '#ff9800', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Quotes
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {/* Invoices - Admin only */}
            {userRole === 'admin' && (
              <Grid item xs={6} sm={3}>
                <Card
                  elevation={2}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  }}
                  onClick={() => navigate('/invoices')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <ReceiptIcon sx={{ fontSize: 48, color: '#9c27b0', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Invoices
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            <Grid item xs={6} sm={3}>
              <Card
                elevation={2}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                }}
                onClick={() => navigate('/my-timecard')}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <ScheduleIcon sx={{ fontSize: 48, color: '#ff9800', mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    My Timecard
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {/* Admin Panel - Admin only */}
            {userRole === 'admin' && (
              <Grid item xs={6} sm={3}>
                <Card
                  elevation={2}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  }}
                  onClick={() => navigate('/admin/users')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <AdminIcon sx={{ fontSize: 48, color: '#d32f2f', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Admin
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {/* Purchase Orders - Admin only */}
            {userRole === 'admin' && (
              <Grid item xs={6} sm={3}>
                <Card
                  elevation={2}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  }}
                  onClick={() => navigate('/purchase-orders')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <ShoppingCartIcon sx={{ fontSize: 48, color: '#00796b', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Purchase Orders
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Order Planning - Admin only */}
            {userRole === 'admin' && (
              <Grid item xs={6} sm={3}>
                <Card
                  elevation={2}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  }}
                  onClick={() => navigate('/order-planning')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <InventoryIcon sx={{ fontSize: 48, color: '#f57c00', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Order Planning
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
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

export default DesktopDashboard;
