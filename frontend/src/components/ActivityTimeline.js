import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Task as TaskIcon,
  Note as NoteIcon,
  Photo as PhotoIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import logger from '../utils/logger';

function ActivityTimeline({ workOrderId, onError }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [workOrderId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/work-orders/${workOrderId}/activity`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load activity log');
      }

      const data = await response.json();
      setActivities(data);
    } catch (err) {
      logger.error('Error loading activities:', err);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (activityType) => {
    const iconMap = {
      'task_added': <AddIcon />,
      'task_completed': <CheckCircleIcon />,
      'task_uncompleted': <TaskIcon />,
      'task_deleted': <DeleteIcon />,
      'note_added': <NoteIcon />,
      'note_deleted': <DeleteIcon />,
      'photo_uploaded': <PhotoIcon />,
      'photo_deleted': <DeleteIcon />,
      'material_assigned': <AssignmentIcon />,
      'material_returned': <AssignmentIcon />,
    };
    return iconMap[activityType] || <TimelineIcon />;
  };

  const getActivityColor = (activityType) => {
    const colorMap = {
      'task_added': 'primary',
      'task_completed': 'success',
      'task_uncompleted': 'warning',
      'task_deleted': 'error',
      'note_added': 'info',
      'note_deleted': 'error',
      'photo_uploaded': 'secondary',
      'photo_deleted': 'error',
      'material_assigned': 'primary',
      'material_returned': 'warning',
    };
    return colorMap[activityType] || 'default';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const formatFullTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <TimelineIcon sx={{ mr: 1, color: '#FF6B00' }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Activity Timeline
        </Typography>
        <Chip
          label={`${activities.length} activities`}
          size="small"
          sx={{ ml: 2 }}
        />
      </Box>

      {activities.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          No activity yet. Actions will appear here as work progresses.
        </Typography>
      ) : (
        <List sx={{ width: '100%' }}>
          {activities.map((activity, index) => (
            <React.Fragment key={activity.id}>
              {index > 0 && <Divider variant="inset" component="li" />}
              <ListItem alignItems="flex-start" sx={{ py: 2 }}>
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor: getActivityColor(activity.activity_type) === 'success' ? '#4CAF50' :
                               getActivityColor(activity.activity_type) === 'error' ? '#f44336' :
                               getActivityColor(activity.activity_type) === 'warning' ? '#ff9800' :
                               '#FF6B00',
                    }}
                  >
                    {getActivityIcon(activity.activity_type)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {activity.activity_description}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#FF6B00' }}>
                        {activity.performed_by}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {' • '}
                        {formatTimestamp(activity.performed_at)}
                        {' '}
                        ({new Date(activity.performed_at).toLocaleDateString()} at{' '}
                        {new Date(activity.performed_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })})
                      </Typography>
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {Object.entries(activity.metadata).map(([key, value]) => (
                            <Chip
                              key={key}
                              label={`${key}: ${value}`}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
}

export default ActivityTimeline;
