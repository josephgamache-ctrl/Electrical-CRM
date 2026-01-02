import React from 'react';
import { Box, Avatar, AvatarGroup, Tooltip, Typography } from '@mui/material';

/**
 * Reusable component to display assigned worker avatars on job cards
 * Can be used throughout the app wherever jobs are displayed
 *
 * @param {Array} assignedWorkers - Array of worker objects with username, full_name
 * @param {number} max - Maximum avatars to display before showing +N (default: 3)
 * @param {string} size - Avatar size: 'small' (24px), 'medium' (32px), 'large' (40px)
 * @param {boolean} showNames - Show names on hover tooltip (default: true)
 * @param {function} onAvatarClick - Optional click handler for avatars
 */
function AssignedAvatars({
  assignedWorkers = [],
  max = 3,
  size = 'small',
  showNames = true,
  onAvatarClick
}) {
  if (!assignedWorkers || assignedWorkers.length === 0) {
    return null;
  }

  const sizeMap = {
    small: 24,
    medium: 32,
    large: 40,
  };

  const avatarSize = sizeMap[size] || 24;
  const fontSize = size === 'small' ? '0.7rem' : size === 'medium' ? '0.85rem' : '1rem';

  // Generate a consistent color based on username
  const getAvatarColor = (username) => {
    const colors = [
      '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2',
      '#f57c00', '#0288d1', '#689f38', '#c2185b',
      '#512da8', '#00796b', '#455a64', '#5d4037'
    ];

    if (!username) return colors[0];

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (worker) => {
    if (worker.full_name) {
      const parts = worker.full_name.split(' ');
      if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
      }
      return worker.full_name.charAt(0).toUpperCase();
    }
    return worker.username?.charAt(0)?.toUpperCase() || '?';
  };

  const getDisplayName = (worker) => {
    return worker.full_name || worker.username || 'Unknown';
  };

  // For single worker, just show avatar without grouping
  if (assignedWorkers.length === 1) {
    const worker = assignedWorkers[0];
    const avatar = (
      <Avatar
        sx={{
          width: avatarSize,
          height: avatarSize,
          bgcolor: getAvatarColor(worker.username),
          fontSize: fontSize,
          cursor: onAvatarClick ? 'pointer' : 'default',
        }}
        onClick={onAvatarClick ? () => onAvatarClick(worker) : undefined}
      >
        {getInitials(worker)}
      </Avatar>
    );

    if (showNames) {
      return (
        <Tooltip title={getDisplayName(worker)} arrow>
          {avatar}
        </Tooltip>
      );
    }
    return avatar;
  }

  // For multiple workers, use AvatarGroup
  return (
    <Tooltip
      title={
        showNames ? (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Assigned Workers:
            </Typography>
            {assignedWorkers.map((worker, idx) => (
              <Typography key={idx} variant="caption" display="block">
                {getDisplayName(worker)}
              </Typography>
            ))}
          </Box>
        ) : ''
      }
      arrow
    >
      <AvatarGroup
        max={max}
        sx={{
          '& .MuiAvatar-root': {
            width: avatarSize,
            height: avatarSize,
            fontSize: fontSize,
            border: '2px solid white',
          },
        }}
      >
        {assignedWorkers.map((worker, index) => (
          <Avatar
            key={worker.username || index}
            sx={{
              bgcolor: getAvatarColor(worker.username),
              cursor: onAvatarClick ? 'pointer' : 'default',
            }}
            onClick={onAvatarClick ? () => onAvatarClick(worker) : undefined}
          >
            {getInitials(worker)}
          </Avatar>
        ))}
      </AvatarGroup>
    </Tooltip>
  );
}

export default AssignedAvatars;
