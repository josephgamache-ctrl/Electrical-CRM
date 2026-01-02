import React, { useState, useEffect } from 'react';
import {
  Assignment as AssignmentIcon,
  CalendarMonth as ScheduleIcon,
  People as CustomersIcon,
  Assessment as ReportsIcon,
  AccessTime as TimeIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../api';
import logger from '../utils/logger';
import './BottomNav.css';

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    loadUserRole();
  }, []);

  const loadUserRole = async () => {
    try {
      const userData = await getCurrentUser();
      setUserRole(userData.role);
    } catch (err) {
      logger.error('Failed to load user role:', err);
    }
  };

  const navItems = [
    { icon: <HomeIcon />, label: 'Home', path: '/home' },
    { icon: <AssignmentIcon />, label: 'Jobs', path: '/jobs' },
    { icon: <ScheduleIcon />, label: 'Schedule', path: '/schedule' },
    { icon: <CustomersIcon />, label: 'Customers', path: '/customers' },
    { icon: <TimeIcon />, label: 'Timesheet', path: '/timesheet' },
  ];

  // Add Reports for admin users
  if (userRole === 'admin') {
    navItems.splice(4, 0, { icon: <ReportsIcon />, label: 'Reports', path: '/reports' });
  }

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="bottom-nav-container">
      <div className="bottom-nav">
        {navItems.map((item, idx) => {
          if (item.adminOnly && userRole !== 'admin') return null;
          const active = isActive(item.path);
          return (
            <button
              key={idx}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default BottomNav;
