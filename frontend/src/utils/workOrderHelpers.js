/**
 * Shared helper functions for Work Orders and Jobs modules
 * Consolidates duplicated code across components
 */

// Status color mapping for work order status chips
export const getStatusColor = (status) => {
  const colors = {
    pending: 'warning',
    scheduled: 'info',
    in_progress: 'primary',
    completed: 'success',
    cancelled: 'error',
    delayed: 'default',  // Gray for delayed/on-hold jobs
  };
  return colors[status] || 'default';
};

// Priority color mapping
export const getPriorityColor = (priority) => {
  const colors = {
    low: 'success',
    normal: 'default',
    high: 'warning',
    urgent: 'error',
  };
  return colors[priority] || 'default';
};

// Material status color mapping
export const getMaterialStatusColor = (status) => {
  const colors = {
    planned: 'default',
    allocated: 'info',
    loaded: 'primary',
    used: 'success',
    returned: 'warning',
  };
  return colors[status] || 'default';
};

// Stock status color mapping
export const getStockStatusColor = (status) => {
  const colors = {
    in_stock: 'success',
    partial: 'warning',
    out_of_stock: 'error',
    checking: 'default',
  };
  return colors[status] || 'default';
};

// Format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
};

// Format date - short format (Dec 14, 2024)
// Parses YYYY-MM-DD as local time to avoid timezone shifting
export const formatDate = (dateString) => {
  if (!dateString) return 'Not scheduled';
  // Parse date as local time, not UTC, to avoid timezone shifting
  // Date string like "2025-01-05" should display as Jan 5, not Jan 4
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const date = new Date(parts[0], parts[1] - 1, parts[2]); // year, month (0-indexed), day
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  // Fallback for other formats
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Format date - long format (Saturday, Dec 14, 2024)
// Parses YYYY-MM-DD as local time to avoid timezone shifting
export const formatDateLong = (dateString) => {
  if (!dateString) return 'Not scheduled';
  // Parse date as local time, not UTC, to avoid timezone shifting
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const date = new Date(parts[0], parts[1] - 1, parts[2]); // year, month (0-indexed), day
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  // Fallback for other formats
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Format time (8:00 AM)
export const formatTime = (timeString) => {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// Format timestamp for relative display (5m ago, 2h ago, etc.)
export const formatRelativeTime = (timestamp) => {
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

// Format full timestamp (Dec 14, 2024 at 3:45 PM)
export const formatFullTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
};

// Group materials by category
export const groupMaterialsByCategory = (materials) => {
  const grouped = {};
  (materials || []).forEach(material => {
    const category = material.category || 'Uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(material);
  });
  return grouped;
};

// Parse assigned_to string into array of usernames
export const parseAssignedTo = (assignedTo) => {
  if (!assignedTo) return [];
  return assignedTo.split(',').map(u => u.trim()).filter(Boolean);
};

// Get assigned workers with employee data
export const getAssignedWorkers = (assignedTo, employees = []) => {
  const usernames = parseAssignedTo(assignedTo);
  return usernames.map(username => {
    const employee = employees.find(e => e.username === username);
    return employee || { username, full_name: username };
  });
};
