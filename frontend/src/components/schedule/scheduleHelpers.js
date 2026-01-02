/**
 * Shared utilities for the Schedule module
 * Consolidates common constants and functions used across schedule components
 */

// Status colors for work orders/jobs
export const STATUS_COLORS = {
  pending: { bg: '#fff3e0', border: '#ffc107', text: '#e65100', chip: '#FFA500' },
  scheduled: { bg: '#f3e5f5', border: '#9c27b0', text: '#6a1b9a', chip: '#9c27b0' },
  in_progress: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0', chip: '#2196f3' },
  delayed: { bg: '#eceff1', border: '#607d8b', text: '#455a64', chip: '#607d8b' },  // Blue-gray for delayed
  completed: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32', chip: '#4caf50' },
  invoiced: { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1', chip: '#1976d2' },
  paid: { bg: '#e8f5e9', border: '#388e3c', text: '#1b5e20', chip: '#388e3c' },
  cancelled: { bg: '#fafafa', border: '#9e9e9e', text: '#616161', chip: '#9e9e9e' },
};

// Priority colors
export const PRIORITY_COLORS = {
  high: '#f44336',
  normal: '#2196f3',
  low: '#9e9e9e',
};

/**
 * Get status colors for a given status
 * @param {string} status - The job/work order status
 * @returns {object} Color object with bg, border, text, chip properties
 */
export const getStatusColors = (status) => {
  return STATUS_COLORS[status] || STATUS_COLORS.pending;
};

/**
 * Get chip color name for MUI Chip component based on status
 * @param {string} status - The job/work order status
 * @returns {string} MUI color name
 */
export const getStatusChipColor = (status) => {
  switch (status) {
    case 'completed':
    case 'paid':
      return 'success';
    case 'in_progress':
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

/**
 * Get the primary hex color for a status (for backgrounds, markers, chips)
 * This is the single source of truth for status colors across all components
 * @param {string} status - The job/work order status
 * @returns {string} Hex color code
 */
export const getStatusColor = (status) => {
  return STATUS_COLORS[status]?.chip || '#9e9e9e';
};

// Alias for backward compatibility
export const getStatusHexColor = getStatusColor;

/**
 * Format time from 24h format to 12h format with AM/PM
 * @param {string} time - Time string in HH:MM format
 * @returns {string} Formatted time string (e.g., "2:30 PM")
 */
export const formatTime = (time) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

/**
 * Format time in short format (for mobile displays)
 * @param {string} time - Time string in HH:MM format
 * @returns {string} Short formatted time (e.g., "2p")
 */
export const formatTimeShort = (time) => {
  if (!time) return '';
  const [hours] = time.split(':');
  const hour = parseInt(hours, 10);
  const displayHour = hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'p' : 'a';
  return `${displayHour}${ampm}`;
};

/**
 * Format time from hour and minutes (for calendar time slots)
 * @param {number} hour - Hour (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @returns {string} Formatted time string (e.g., "2:30 PM")
 */
export const formatTimeFromHourMinutes = (hour, minutes) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Calculate hours between start and end time
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @param {number} defaultHours - Default hours if inputs are missing or result is invalid (default: 8)
 * @returns {number} Number of hours (decimal), minimum 0.5
 */
export const calculateHoursFromTimes = (startTime, endTime, defaultHours = 8) => {
  if (!startTime || !endTime) return defaultHours;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  // Return at least 0.5 hours, or default if negative/zero
  return hours > 0 ? Math.max(0.5, hours) : defaultHours;
};

/**
 * Calculate end time from start time and duration
 * @param {string} startTime - Start time in HH:MM format
 * @param {number} durationHours - Duration in hours
 * @returns {string} End time in HH:MM format
 */
export const calculateEndTime = (startTime, durationHours) => {
  if (!startTime) return '15:30';
  const [startH, startM] = startTime.split(':').map(Number);
  const totalMinutes = startH * 60 + startM + (durationHours * 60);
  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;
  // Cap at 10 PM
  if (endH >= 22) return '22:00';
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
};

/**
 * Parse time string to hour and minutes
 * @param {string} timeString - Time string in HH:MM format
 * @returns {object} Object with hour and minutes properties
 */
export const parseTime = (timeString) => {
  if (!timeString) return { hour: 8, minutes: 0 };
  const parts = timeString.split(':');
  return {
    hour: parseInt(parts[0], 10) || 8,
    minutes: parseInt(parts[1], 10) || 0,
  };
};

/**
 * Format a date for display (short format without year)
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date string (e.g., "Mon, Dec 14")
 */
export const formatDateDisplay = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/**
 * Format a date for display (long format with year)
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date string (e.g., "Monday, December 14, 2025")
 */
export const formatDateDisplayLong = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

/**
 * Format a date for short display (mobile calendar headers)
 * @param {Date} date - Date object
 * @returns {object} Object with weekday and day properties
 */
export const formatDateShort = (date) => {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const day = date.getDate();
  return { weekday, day };
};

/**
 * Format a date to YYYY-MM-DD string (using local timezone)
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const formatDateValue = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get the start of week (Monday) for a given date
 * @param {Date} date - Date object
 * @returns {Date} Monday of the week containing the date
 */
export const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  return new Date(d.setDate(diff));
};

/**
 * Get day letter abbreviation from date
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Single letter day abbreviation (S, M, T, W, T, F, S)
 */
export const getDayLetter = (dateStr) => {
  const day = new Date(dateStr + 'T00:00:00').getDay();
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day];
};

/**
 * Check if a date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is today
 */
export const isToday = (date) => {
  const today = new Date();
  const checkDate = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return checkDate.toDateString() === today.toDateString();
};

/**
 * Get assigned workers from a comma-separated string
 * @param {string} assignedTo - Comma-separated usernames
 * @param {Array} employees - Array of employee objects
 * @returns {Array} Array of employee objects or username objects
 */
export const getAssignedWorkers = (assignedTo, employees = []) => {
  if (!assignedTo) return [];
  const usernames = assignedTo.split(',').map(u => u.trim()).filter(Boolean);
  return usernames.map(username => {
    const employee = employees.find(e => e.username === username);
    return employee || { username, full_name: username };
  });
};

/**
 * Get invoice status for display
 * @param {object} workOrder - Work order object
 * @returns {object|null} Object with label and color, or null
 */
export const getInvoiceStatus = (workOrder) => {
  if (workOrder.invoice_status === 'paid') {
    return { label: 'PAID', color: 'paid' };
  } else if (workOrder.invoice_status === 'sent' || workOrder.invoice_id) {
    return { label: 'INVOICED', color: 'invoiced' };
  }
  return null;
};

/**
 * Get array of date strings in a range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Array<string>} Array of date strings in YYYY-MM-DD format
 */
export const getDatesInRange = (startDate, endDate) => {
  if (!startDate) return [];
  if (!endDate || startDate === endDate) return [startDate];

  const dates = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/**
 * Check if a date is within a selection range
 * @param {string} dateStr - Date to check in YYYY-MM-DD format
 * @param {string} startDate - Start of range in YYYY-MM-DD format
 * @param {string} endDate - End of range in YYYY-MM-DD format (optional, defaults to startDate)
 * @returns {boolean} True if date is in the selection
 */
export const isDateInSelection = (dateStr, startDate, endDate = startDate) => {
  if (!dateStr || !startDate) return false;
  return dateStr >= startDate && dateStr <= endDate;
};

/**
 * Navigate to previous day/period
 * @param {string} currentDate - Current date in YYYY-MM-DD format
 * @param {boolean} isSingleDate - Whether in single date mode
 * @param {string} rangeStartDate - Current range start (for range mode)
 * @param {string} rangeEndDate - Current range end (for range mode)
 * @returns {object} New date(s): { startDate, endDate }
 */
export const navigatePrevious = (currentDate, isSingleDate = true, rangeStartDate, rangeEndDate) => {
  if (isSingleDate) {
    const date = new Date(currentDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    const newDate = date.toISOString().split('T')[0];
    return { startDate: newDate, endDate: newDate };
  } else {
    const start = new Date(rangeStartDate + 'T00:00:00');
    const end = new Date(rangeEndDate + 'T00:00:00');
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    start.setDate(start.getDate() - days);
    end.setDate(end.getDate() - days);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }
};

/**
 * Navigate to next day/period
 * @param {string} currentDate - Current date in YYYY-MM-DD format
 * @param {boolean} isSingleDate - Whether in single date mode
 * @param {string} rangeStartDate - Current range start (for range mode)
 * @param {string} rangeEndDate - Current range end (for range mode)
 * @returns {object} New date(s): { startDate, endDate }
 */
export const navigateNext = (currentDate, isSingleDate = true, rangeStartDate, rangeEndDate) => {
  if (isSingleDate) {
    const date = new Date(currentDate + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    const newDate = date.toISOString().split('T')[0];
    return { startDate: newDate, endDate: newDate };
  } else {
    const start = new Date(rangeStartDate + 'T00:00:00');
    const end = new Date(rangeEndDate + 'T00:00:00');
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    start.setDate(start.getDate() + days);
    end.setDate(end.getDate() + days);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }
};

/**
 * Navigate to today
 * @param {boolean} isSingleDate - Whether in single date mode
 * @param {number} rangeDays - Number of days for range mode (default 7)
 * @returns {object} New date(s): { startDate, endDate }
 */
export const navigateToday = (isSingleDate = true, rangeDays = 7) => {
  const today = new Date().toISOString().split('T')[0];
  if (isSingleDate) {
    return { startDate: today, endDate: today };
  } else {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + rangeDays - 1);
    return {
      startDate: today,
      endDate: endDate.toISOString().split('T')[0],
    };
  }
};

/**
 * Parse a comma-separated assigned_to string into an array of usernames
 * @param {string} assignedTo - Comma-separated usernames string
 * @returns {Array<string>} Array of trimmed usernames
 */
export const parseAssignedTo = (assignedTo) => {
  if (!assignedTo) return [];
  return assignedTo.split(',').map(u => u.trim()).filter(Boolean);
};

/**
 * Format an array of usernames back to comma-separated string
 * @param {Array<string>} usernames - Array of usernames
 * @returns {string} Comma-separated string
 */
export const formatAssignedTo = (usernames) => {
  if (!usernames || !Array.isArray(usernames)) return '';
  return usernames.filter(Boolean).join(', ');
};

/**
 * Truncate text with ellipsis if it exceeds maxLength
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default 100)
 * @returns {string} Truncated text with ellipsis if needed
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

/**
 * Generate time slot options for dropdowns
 * @param {number} startHour - Start hour (0-23), default 6
 * @param {number} endHour - End hour (0-23), default 22
 * @param {number} intervalMinutes - Interval in minutes (default 30)
 * @returns {Array<{value: string, label: string}>} Array of time options
 */
export const generateTimeOptions = (startHour = 6, endHour = 22, intervalMinutes = 30) => {
  const options = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min = 0; min < 60; min += intervalMinutes) {
      if (hour === endHour && min > 0) break;
      const value = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      const label = `${displayHour}:${min.toString().padStart(2, '0')} ${period}`;
      options.push({ value, label });
    }
  }
  return options;
};

/**
 * Generate time slots for calendar grids
 * @param {number} startHour - Start hour (0-23), default 0
 * @param {number} endHour - End hour (0-23), default 24
 * @param {number} intervalMinutes - Interval in minutes (default 30)
 * @returns {Array<{hour: number, minutes: number, label: string}>} Array of time slots
 */
export const generateTimeSlots = (startHour = 0, endHour = 24, intervalMinutes = 30) => {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += intervalMinutes) {
      slots.push({
        hour,
        minutes: min,
        label: formatTimeFromHourMinutes(hour, min),
      });
    }
  }
  return slots;
};
