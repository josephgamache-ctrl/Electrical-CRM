import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Badge,
  Popover,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Button,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Inventory as InventoryIcon,
  Assignment as WorkOrderIcon,
  Schedule as ScheduleIcon,
  Badge as LicenseIcon,
  Receipt as InvoiceIcon,
  AccessTime as TimesheetIcon,
  Settings as SystemIcon,
  Close as CloseIcon,
  DoneAll as DoneAllIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
} from '../api';
import logger from '../utils/logger';

// Map notification types to icons
const typeIcons = {
  inventory: InventoryIcon,
  work_order: WorkOrderIcon,
  schedule: ScheduleIcon,
  license: LicenseIcon,
  invoice: InvoiceIcon,
  timesheet: TimesheetIcon,
  system: SystemIcon,
};

// Map severity to colors and icons
const severityConfig = {
  info: { color: 'info', icon: InfoIcon },
  warning: { color: 'warning', icon: WarningIcon },
  error: { color: 'error', icon: ErrorIcon },
  success: { color: 'success', icon: SuccessIcon },
};

function NotificationCenter() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const open = Boolean(anchorEl);

  // Fetch unread count on mount and periodically
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await getNotificationCount();
      setUnreadCount(data.unread_count);
    } catch (err) {
      logger.error('Failed to fetch notification count:', err);
    }
  }, []);

  // Fetch full notifications list
  const fetchNotificationsList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications(false, null, 50);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      logger.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial count fetch and polling
  useEffect(() => {
    fetchUnreadCount();

    // Poll for new notifications every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch full list when popover opens
  useEffect(() => {
    if (open) {
      fetchNotificationsList();
    }
  }, [open, fetchNotificationsList]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        logger.error('Failed to mark notification as read:', err);
      }
    }

    // Navigate if action_url is provided
    if (notification.action_url) {
      handleClose();
      navigate(notification.action_url);
    }
  };

  const handleDismiss = async (e, notificationId) => {
    e.stopPropagation();
    try {
      await dismissNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Update unread count if dismissed notification was unread
      const dismissed = notifications.find(n => n.id === notificationId);
      if (dismissed && !dismissed.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      logger.error('Failed to dismiss notification:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      logger.error('Failed to mark all as read:', err);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
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

  const getTypeIcon = (type) => {
    const Icon = typeIcons[type] || SystemIcon;
    return Icon;
  };

  const getSeverityIcon = (severity) => {
    const config = severityConfig[severity] || severityConfig.info;
    return config.icon;
  };

  const getSeverityColor = (severity) => {
    const config = severityConfig[severity] || severityConfig.info;
    return config.color;
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          sx={{ color: 'white' }}
          onClick={handleClick}
          aria-label={`${unreadCount} unread notifications`}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={handleMarkAllRead}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* Content */}
        <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : error ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="error">{error}</Typography>
              <Button onClick={fetchNotificationsList} sx={{ mt: 1 }}>
                Retry
              </Button>
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                No notifications
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((notification, index) => {
                const TypeIcon = getTypeIcon(notification.notification_type);
                const SeverityIcon = getSeverityIcon(notification.severity);
                const severityColor = getSeverityColor(notification.severity);

                return (
                  <React.Fragment key={notification.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      button
                      onClick={() => handleNotificationClick(notification)}
                      sx={{
                        bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                        '&:hover': {
                          bgcolor: 'action.selected',
                        },
                        py: 1.5,
                        pr: 6,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <SeverityIcon
                              sx={{
                                fontSize: 14,
                                color: `${severityColor}.main`,
                                bgcolor: 'background.paper',
                                borderRadius: '50%',
                              }}
                            />
                          }
                        >
                          <TypeIcon color="action" />
                        </Badge>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: notification.is_read ? 400 : 600,
                                flex: 1,
                              }}
                            >
                              {notification.title}
                            </Typography>
                            {notification.action_url && (
                              <OpenIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {notification.message}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={notification.notification_type.replace('_', ' ')}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  textTransform: 'capitalize',
                                }}
                              />
                              <Typography variant="caption" color="text.disabled">
                                {formatTimeAgo(notification.created_at)}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Dismiss">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={(e) => handleDismiss(e, notification.id)}
                            sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Box>

        {/* Footer */}
        {notifications.length > 0 && (
          <Box sx={{
            p: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            textAlign: 'center',
          }}>
            <Typography variant="caption" color="text.secondary">
              Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        )}
      </Popover>
    </>
  );
}

export default NotificationCenter;
