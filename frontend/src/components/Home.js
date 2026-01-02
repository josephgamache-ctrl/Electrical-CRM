import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  Work as WorkIcon,
  AdminPanelSettings as AdminIcon,
  CalendarToday as TimecardIcon,
  Assessment as ReportsIcon,
  PhoneAndroid as MobileIcon,
  CalendarMonth as ScheduleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../api';
import BottomNav from './BottomNav';
import AppHeader from './AppHeader';
import logger from '../utils/logger';
function Home() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userData = await getCurrentUser();
      setUserRole(userData.role);
      setUserName(userData.full_name || userData.username);
    } catch (err) {
      logger.error('Error loading user info:', err);
      // If can't load user, redirect to login
      localStorage.removeItem('token');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppHeader title="Pem2 Services" showSearch={false} />

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
          Welcome back, {userName}!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Select an option to get started
        </Typography>

        <Grid container spacing={3}>
          {/* Inventory - Available to all roles */}
          <Grid item xs={12} sm={6} md={4}>
            <Card elevation={3} sx={{ height: '100%' }}>
              <CardActionArea onClick={() => navigate('/inventory')} sx={{ height: '100%', p: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <InventoryIcon sx={{ fontSize: 80, color: '#1976d2', mb: 2 }} />
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Inventory
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View and manage inventory items, stock levels, and locations
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          {/* Jobs - Available to all roles */}
          <Grid item xs={12} sm={6} md={4}>
            <Card elevation={3} sx={{ height: '100%' }}>
              <CardActionArea onClick={() => navigate('/jobs')} sx={{ height: '100%', p: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <WorkIcon sx={{ fontSize: 80, color: '#FF6B00', mb: 2 }} />
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Jobs
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View job details, pull materials, and document work
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          {/* Schedule - Available to all roles */}
          <Grid item xs={12} sm={6} md={4}>
            <Card elevation={3} sx={{ height: '100%' }}>
              <CardActionArea onClick={() => navigate('/schedule')} sx={{ height: '100%', p: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <ScheduleIcon sx={{ fontSize: 80, color: '#2c3e8f', mb: 2 }} />
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Schedule
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View and manage job schedules, dispatch, and calendar
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          {/* Timesheet - Available to all roles */}
          <Grid item xs={12} sm={6} md={4}>
            <Card elevation={3} sx={{ height: '100%' }}>
              <CardActionArea onClick={() => navigate('/timesheet')} sx={{ height: '100%', p: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <TimecardIcon sx={{ fontSize: 80, color: '#9c27b0', mb: 2 }} />
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Timesheet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Enter hours and manage your weekly timesheet
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          {/* Work Orders - Admin and Manager */}
          {(userRole === 'admin' || userRole === 'manager') && (
            <Grid item xs={12} sm={6} md={4}>
              <Card elevation={3} sx={{ height: '100%' }}>
                <CardActionArea onClick={() => navigate('/work-orders')} sx={{ height: '100%', p: 3 }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <AssignmentIcon sx={{ fontSize: 80, color: '#2e7d32', mb: 2 }} />
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Work Orders
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create and manage work orders
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          )}

          {/* Admin Panel - Admin only */}
          {userRole === 'admin' && (
            <Grid item xs={12} sm={6} md={4}>
              <Card elevation={3} sx={{ height: '100%' }}>
                <CardActionArea onClick={() => navigate('/admin/users')} sx={{ height: '100%', p: 3 }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <AdminIcon sx={{ fontSize: 80, color: '#d32f2f', mb: 2 }} />
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Admin
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage users, roles, and system settings
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          )}

          {/* Reports & Analytics - Admin only */}
          {userRole === 'admin' && (
            <Grid item xs={12} sm={6} md={4}>
              <Card elevation={3} sx={{ height: '100%' }}>
                <CardActionArea onClick={() => navigate('/reports')} sx={{ height: '100%', p: 3 }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <ReportsIcon sx={{ fontSize: 80, color: '#667eea', mb: 2 }} />
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Reports
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Financial snapshots, job profitability, and analytics
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          )}

          {/* Mobile Dashboard - All roles */}
          <Grid item xs={12} sm={6} md={4}>
            <Card elevation={3} sx={{ height: '100%' }}>
              <CardActionArea onClick={() => navigate('/mobile-dashboard')} sx={{ height: '100%', p: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <MobileIcon sx={{ fontSize: 80, color: '#1e2656', mb: 2 }} />
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Pem2 Dashboard
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Mobile-optimized view with today's activity and quick actions
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>

        {/* Role-specific welcome message */}
        <Box sx={{ mt: 6, p: 3, bgcolor: 'white', borderRadius: 2, boxShadow: 1 }}>
          {userRole === 'admin' && (
            <>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Admin Access
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You have full access to all features including work orders with financial data and user management.
              </Typography>
            </>
          )}
          {userRole === 'manager' && (
            <>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Manager Access
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You have access to inventory and job management features.
              </Typography>
            </>
          )}
          {(userRole === 'office' || userRole === 'technician') && (
            <>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                {userRole === 'technician' ? 'Technician Access' : 'Office Access'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You can view inventory and manage jobs. Use the Jobs section to pull materials and document your work.
              </Typography>
            </>
          )}
        </Box>
      </Container>
      <BottomNav />
    </Box>
  );
}

export default Home;
