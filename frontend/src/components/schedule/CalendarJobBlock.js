import React from 'react';
import { Box, Typography, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { getStatusColors, parseTime } from './scheduleHelpers';

function CalendarJobBlock({ workOrder, slotHeight, startHour, onClick }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { hour, minutes } = parseTime(workOrder.scheduled_start_time);
  const duration = workOrder.estimated_duration_hours || 1;

  // Calculate position
  const startSlots = (hour - startHour) * 2 + (minutes / 30);
  const heightSlots = duration * 2;

  // Ensure minimum height and handle out-of-bounds
  const top = Math.max(0, startSlots * slotHeight);
  const height = Math.max(slotHeight - 4, heightSlots * slotHeight - 4);

  const colors = getStatusColors(workOrder.status);

  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="subtitle2">{workOrder.work_order_number}</Typography>
      <Typography variant="body2">{workOrder.customer_name}</Typography>
      <Typography variant="caption">
        {workOrder.scheduled_start_time} - {duration}h
      </Typography>
      {workOrder.job_description && (
        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
          {workOrder.job_description.substring(0, 100)}
          {workOrder.job_description.length > 100 ? '...' : ''}
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} arrow placement="right">
      <Box
        className="calendar-job-block"
        onClick={(e) => {
          e.stopPropagation();
          onClick && onClick(workOrder);
        }}
        sx={{
          position: 'absolute',
          top: `${top}px`,
          left: isMobile ? '1px' : '2px',
          right: isMobile ? '1px' : '2px',
          height: `${height}px`,
          backgroundColor: colors.bg,
          borderLeft: `3px solid ${colors.border}`,
          borderRadius: isMobile ? '2px' : '3px',
          padding: isMobile ? '1px 2px' : '2px 4px',
          cursor: 'pointer',
          overflow: 'hidden',
          zIndex: 10,
          transition: 'all 0.2s',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'scale(1.02)',
            zIndex: 20,
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: colors.text,
            display: 'block',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: isMobile ? '0.6rem' : '0.65rem',
          }}
        >
          {isMobile ? workOrder.work_order_number?.slice(-4) : workOrder.work_order_number}
        </Typography>
        {height > (isMobile ? 20 : 18) && (
          <Typography
            variant="caption"
            sx={{
              color: colors.text,
              opacity: 0.8,
              display: 'block',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: isMobile ? '0.5rem' : '0.55rem',
            }}
          >
            {isMobile
              ? workOrder.customer_name?.split(' ')[0]?.slice(0, 8)
              : workOrder.customer_name}
          </Typography>
        )}
        {height > (isMobile ? 36 : 32) && (
          <Typography
            variant="caption"
            sx={{
              color: colors.text,
              opacity: 0.7,
              display: 'block',
              lineHeight: 1.1,
              fontSize: '0.5rem',
              mt: 0.15,
            }}
          >
            {duration}h
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

export default CalendarJobBlock;
