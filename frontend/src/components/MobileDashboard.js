import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Avatar,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Work as WorkIcon,
  Inventory as InventoryIcon,
  AccessTime as TimeIcon,
  Assignment as AssignmentIcon,
  Assessment as ReportsIcon,
  AdminPanelSettings as AdminIcon,
  Receipt as ReceiptIcon,
  GroupAdd as GroupAddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getMyDashboardJobs, API_BASE_URL } from '../api';
import AssignedAvatars from './common/AssignedAvatars';
import ModifyCrewDialog from './schedule/ModifyCrewDialog';
import { ScheduleProvider } from './schedule/ScheduleContext';
import AppHeader from './AppHeader';
import './MobileDashboard.css';
import logger from '../utils/logger';
function MobileDashboard() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    jobsCompleted: 0,
    totalJobs: 0,
    activeJobs: 0,
    serviceCalls: 0,
    scheduledThisWeek: 0
  });
  const [todayJobs, setTodayJobs] = useState([]);
  const [serviceCalls, setServiceCalls] = useState([]);

  // ModifyCrewDialog state
  const [modifyCrewDialogOpen, setModifyCrewDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const userData = await getCurrentUser();
      setUserRole(userData.role);
      setUserName(userData.full_name || userData.username);

      // Load role-based dashboard jobs (my jobs + service calls)
      const dashboardData = await getMyDashboardJobs();

      // Process my jobs - already sorted by date/time from backend
      const myJobsList = (dashboardData.my_jobs || []).map(job => ({
        id: job.id,
        title: job.job_description || `Work Order #${job.work_order_number}`,
        customer: job.customer_name || 'Unknown Customer',
        status: job.status || 'Pending',
        statusColor: getStatusColor(job.status),
        scheduledDate: job.scheduled_date,
        scheduledStartTime: job.scheduled_start_time,
        crew: job.crew || [],
        workOrder: job,
      }));

      // Process service calls - already sorted by priority/date from backend
      const serviceCallsList = (dashboardData.service_calls || []).map(job => ({
        id: job.id,
        title: job.job_description || `Work Order #${job.work_order_number}`,
        customer: job.customer_name || 'Unknown Customer',
        status: job.status || 'Pending',
        statusColor: getStatusColor(job.status),
        jobType: job.job_type,
        priority: job.priority,
        scheduledDate: job.scheduled_date,
        crew: job.crew || [],
        workOrder: job,
      }));

      setTodayJobs(myJobsList.slice(0, 6)); // Show up to 6 jobs
      setServiceCalls(serviceCallsList.slice(0, 4)); // Show up to 4 service calls

      // Update stats
      setStats({
        jobsCompleted: 0, // Could add completed count from backend
        totalJobs: myJobsList.length,
        activeJobs: myJobsList.length,
        serviceCalls: serviceCallsList.length,
        scheduledThisWeek: myJobsList.length // Simplified
      });

    } catch (err) {
      logger.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load today's crew data from calendar/schedule endpoint
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

        // Update today's jobs with crew data
        setTodayJobs((prev) =>
          prev.map((job) => ({
            ...job,
            crew: crewByWorkOrder[job.id] || [],
          }))
        );

        // Update service calls with crew data
        setServiceCalls((prev) =>
          prev.map((job) => ({
            ...job,
            crew: crewByWorkOrder[job.id] || [],
          }))
        );
      }
    } catch (err) {
      logger.error('Failed to load today crew data:', err);
    }
  };

  const loadTodayStats = async (token) => {
    try {
      // Get all work orders to calculate stats
      const response = await fetch(`${API_BASE_URL}/work-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const workOrders = data.work_orders || [];
        const todayDate = new Date().toISOString().split('T')[0];

        // Calculate start of this week (Sunday)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek);
        const weekStartStr = weekStart.toISOString().split('T')[0];

        // Calculate end of this week (Saturday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        // Active Jobs = All jobs with status 'in_progress' or 'scheduled' (any date)
        const activeJobs = workOrders.filter(wo =>
          wo.status === 'in_progress' || wo.status === 'scheduled'
        );

        // Today's Jobs = All active jobs (same as activeJobs)
        const todayJobs = activeJobs;

        const completedToday = workOrders.filter(wo =>
          wo.scheduled_date && wo.scheduled_date.startsWith(todayDate) && wo.status === 'completed'
        ).length;

        // Service Calls = Jobs with job_type 'Service Call' or emergency_call true
        // that are on or past scheduled date and not completed/cancelled
        const serviceCalls = workOrders.filter(wo => {
          const isServiceCall = wo.job_type === 'Service Call' || wo.emergency_call === true;
          const isNotCompleted = wo.status !== 'completed' && wo.status !== 'cancelled';
          const isOnOrPastScheduledDate = wo.scheduled_date && wo.scheduled_date <= todayDate;
          return isServiceCall && isNotCompleted && isOnOrPastScheduledDate;
        }).length;

        // Jobs Scheduled This Week
        const scheduledThisWeek = workOrders.filter(wo =>
          wo.scheduled_date &&
          wo.scheduled_date >= weekStartStr &&
          wo.scheduled_date <= weekEndStr
        ).length;

        setStats({
          jobsCompleted: completedToday,
          totalJobs: todayJobs.length,
          activeJobs: activeJobs.length,
          serviceCalls: serviceCalls,
          scheduledThisWeek: scheduledThisWeek
        });
      }
    } catch (err) {
      logger.error('Failed to load today stats:', err);
    }
  };

  const loadTodayJobs = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/work-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const workOrders = data.work_orders || [];

        // Filter active jobs (in_progress or scheduled status)
        const activeJobsList = workOrders
          .filter(wo => wo.status === 'in_progress' || wo.status === 'scheduled')
          .slice(0, 4) // Get top 4
          .map(wo => ({
            id: wo.id,
            title: wo.job_description || `Work Order #${wo.work_order_number}`,
            customer: wo.customer_name || 'Unknown Customer',
            status: wo.status || 'Pending',
            statusColor: getStatusColor(wo.status),
            crew: [],
            workOrder: wo, // Store full work order for ModifyCrewDialog
          }));

        setTodayJobs(activeJobsList);
      }
    } catch (err) {
      logger.error('Failed to load today jobs:', err);
    }
  };

  const loadServiceCalls = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/work-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const workOrders = data.work_orders || [];
        const todayDate = new Date().toISOString().split('T')[0];

        // Filter service calls:
        // - Job type is "Service Call" or emergency_call is true
        // - Scheduled date is on or before today (not future scheduled)
        // - Status is NOT completed or cancelled
        const serviceCallsList = workOrders
          .filter(wo => {
            const isServiceCall = wo.job_type === 'Service Call' || wo.emergency_call === true;
            const isNotCompleted = wo.status !== 'completed' && wo.status !== 'cancelled';
            const isOnOrPastScheduledDate = wo.scheduled_date && wo.scheduled_date <= todayDate;
            return isServiceCall && isNotCompleted && isOnOrPastScheduledDate;
          })
          .sort((a, b) => {
            // Sort by priority (urgent first) then by date
            const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
            const aPriority = priorityOrder[a.priority] ?? 2;
            const bPriority = priorityOrder[b.priority] ?? 2;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
          })
          .slice(0, 4) // Get top 4
          .map(wo => ({
            id: wo.id,
            title: wo.job_description || `Work Order #${wo.work_order_number}`,
            customer: wo.customer_name || 'Unknown Customer',
            status: wo.status || 'Pending',
            statusColor: getStatusColor(wo.status),
            jobType: wo.job_type,
            priority: wo.priority,
            scheduledDate: wo.scheduled_date,
            crew: [],
            workOrder: wo, // Store full work order for ModifyCrewDialog
          }));

        setServiceCalls(serviceCallsList);
      }
    } catch (err) {
      logger.error('Failed to load service calls:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
      case 'completed':
        return '#4caf50';
      case 'In Progress':
      case 'in_progress':
        return '#2196f3';
      case 'Scheduled':
      case 'scheduled':
        return '#9c27b0';
      case 'Delayed':
      case 'delayed':
        return '#607d8b';
      case 'Cancelled':
      case 'cancelled':
        return '#9e9e9e';
      case 'Pending':
      case 'pending':
      default:
        return '#ffc107';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
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

  const completionPercentage = Math.round((stats.jobsCompleted / stats.totalJobs) * 100);

  // Build nav items based on role
  const isTechnician = userRole === 'technician' || userRole === 'employee';
  const bottomNavItems = [
    { icon: <AssignmentIcon />, label: 'Schedule', path: '/schedule' },
    // Technicians see Jobs, admins/managers see Work Orders
    { icon: <WorkIcon />, label: isTechnician ? 'Jobs' : 'Work', path: isTechnician ? '/jobs' : '/work-orders' },
    { icon: <InventoryIcon />, label: 'Inventory', path: '/inventory' },
    { icon: <ReceiptIcon />, label: 'Invoices', path: '/invoices', adminOnly: true },
    { icon: <ReportsIcon />, label: 'Reports', path: '/reports', adminOnly: true },
    { icon: <TimeIcon />, label: 'Timesheets', path: '/my-timecard' },
    { icon: <AdminIcon />, label: 'Admin', path: '/admin/users', adminOnly: true },
  ];

  if (loading) {
    return (
      <Box className="mobile-dashboard loading">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className="mobile-dashboard">
      {/* Header - Use shared AppHeader for consistency */}
      <AppHeader title="Pem2 Dashboard" showSearch={false} />

      {/* Content */}
      <div className="mobile-content">
        {/* Stats Section */}
        <div className="stats-section">
          <div className="stats-header">
            <Typography variant="h6" className="stats-title">Today</Typography>
          </div>

          <div className="completion-circle-container">
            <div className="completion-circle">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r="60"
                  fill="none"
                  stroke="#2a2f5a"
                  strokeWidth="12"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="60"
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="12"
                  strokeDasharray={`${completionPercentage * 3.77} 377`}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                  className="progress-circle"
                />
              </svg>
              <div className="circle-content">
                <div className="circle-value">{stats.jobsCompleted}/{stats.totalJobs}</div>
                <div className="circle-label">Jobs Completed Today</div>
              </div>
            </div>

            <div className="today-stats">
              <div className="stat-item">
                <div className="stat-value">{stats.activeJobs}</div>
                <div className="stat-label">Active Jobs</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.serviceCalls}</div>
                <div className="stat-label">Service Calls</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.scheduledThisWeek}</div>
                <div className="stat-label">Jobs Scheduled This Week</div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Jobs */}
        <div className="section">
          <div className="section-header">
            <Typography variant="h6" className="section-title">Today's Jobs</Typography>
            <button className="create-btn" onClick={() => navigate('/jobs')}>View All</button>
          </div>
          <div className="jobs-list">
            {todayJobs.length > 0 ? (
              todayJobs.map((job, idx) => (
                <div key={idx} className="job-item" onClick={() => navigate(`/jobs/${job.id}`)}>
                  <div className="job-info">
                    <div className="job-title">{job.title}</div>
                    <div className="job-customer">{job.customer}</div>
                  </div>
                  <div className="job-actions">
                    <AssignedAvatars assignedWorkers={job.crew} size="small" max={2} />
                    {(userRole === 'admin' || userRole === 'manager') && (
                      <Tooltip title="Modify Crew">
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenModifyCrew(job, e)}
                          sx={{ color: '#667eea', ml: 0.5 }}
                        >
                          <GroupAddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <div className="job-status" style={{ color: job.statusColor }}>
                      {job.status}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                No jobs scheduled for today
              </div>
            )}
          </div>
          <button className="view-more-btn" onClick={() => navigate('/jobs')}>View More</button>
        </div>

        {/* Service Calls */}
        <div className="section">
          <div className="section-header">
            <Typography variant="h6" className="section-title">Service Calls</Typography>
            <button className="create-btn" onClick={() => navigate('/jobs')}>View All</button>
          </div>
          <div className="jobs-list">
            {serviceCalls.length > 0 ? (
              serviceCalls.map((call, idx) => (
                <div key={idx} className="job-item" onClick={() => navigate(`/jobs/${call.id}`)}>
                  <div className="job-info">
                    <div className="job-title">{call.title}</div>
                    <div className="job-customer">{call.customer}</div>
                  </div>
                  <div className="job-actions">
                    <AssignedAvatars assignedWorkers={call.crew} size="small" max={2} />
                    {(userRole === 'admin' || userRole === 'manager') && (
                      <Tooltip title="Modify Crew">
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenModifyCrew(call, e)}
                          sx={{ color: '#f5576c', ml: 0.5 }}
                        >
                          <GroupAddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <div className="job-status" style={{ color: call.statusColor }}>
                      {call.status}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                No service calls
              </div>
            )}
          </div>
          <button className="view-more-btn" onClick={() => navigate('/jobs')}>View More</button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bottom-nav">
        {bottomNavItems.map((item, idx) => {
          if (item.adminOnly && userRole !== 'admin') return null;
          return (
            <button
              key={idx}
              className="nav-item"
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>

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
    </div>
  );
}

export default MobileDashboard;
