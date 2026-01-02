import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Chip,
  MenuItem,
  Select,
  FormControl,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardActions,
  Grid,
  useMediaQuery,
  Button,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { fetchWorkOrders, API_BASE_URL } from '../api';
import { useTheme } from '@mui/material/styles';
import AppHeader from './AppHeader';
import AssignedAvatars from './common/AssignedAvatars';
import logger from '../utils/logger';
function JobsList() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [workOrders, setWorkOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadWorkOrders();
    loadEmployees();
  }, [statusFilter]);

  const loadEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const usersArray = Array.isArray(data) ? data : (data.users || []);
        setEmployees(usersArray);
      }
    } catch (err) {
      logger.error('Error loading employees:', err);
    }
  };

  // Helper to get assigned workers for a job
  const getAssignedWorkers = (assignedTo) => {
    if (!assignedTo) return [];
    const usernames = assignedTo.split(',').map(u => u.trim()).filter(Boolean);
    return usernames.map(username => {
      const employee = employees.find(e => e.username === username);
      return employee || { username, full_name: username };
    });
  };

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

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppHeader title="Jobs">
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
            <MenuItem value="">All Jobs</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="scheduled">Scheduled</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="delayed">Delayed</MenuItem>
          </Select>
        </FormControl>
      </AppHeader>

      <Container maxWidth="lg" sx={{ mt: 3, mb: 4, flexGrow: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
            <CircularProgress />
          </Box>
        ) : workOrders.length === 0 ? (
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <AssignmentIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No jobs found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {statusFilter ? 'Try changing the status filter' : 'No work orders available'}
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {workOrders.map((wo) => (
              <Grid item xs={12} sm={6} md={4} key={wo.id}>
                <Card
                  elevation={3}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 6,
                      transform: 'translateY(-2px)',
                      transition: 'all 0.2s'
                    }
                  }}
                  onClick={() => navigate(`/jobs/${wo.id}`)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#FF6B00' }}>
                        {wo.work_order_number}
                      </Typography>
                      <Chip
                        label={wo.status?.replace('_', ' ').toUpperCase()}
                        color={getStatusColor(wo.status)}
                        size="small"
                      />
                    </Box>

                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {wo.job_type}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {wo.job_description}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PersonIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {wo.first_name} {wo.last_name}
                      </Typography>
                    </Box>

                    {wo.service_address && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                        <LocationIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary', mt: 0.3 }} />
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {wo.service_address}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <CalendarIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {formatDate(wo.scheduled_date)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip
                        label={wo.priority?.toUpperCase()}
                        color={getPriorityColor(wo.priority)}
                        size="small"
                        variant="outlined"
                      />
                      {wo.material_count > 0 && (
                        <Chip
                          label={`${wo.material_count} items`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {wo.assigned_to && (
                        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                          <AssignedAvatars
                            assignedWorkers={getAssignedWorkers(wo.assigned_to)}
                            size="small"
                            max={3}
                          />
                        </Box>
                      )}
                    </Box>
                  </CardContent>

                  <CardActions>
                    <Button
                      size="small"
                      fullWidth
                      variant="contained"
                      sx={{ bgcolor: '#FF6B00', '&:hover': { bgcolor: '#ff8533' } }}
                      onClick={() => navigate(`/jobs/${wo.id}`)}
                    >
                      View Job Details
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Total: {workOrders.length} job{workOrders.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default JobsList;
