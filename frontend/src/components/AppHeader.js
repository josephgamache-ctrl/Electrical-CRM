import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Avatar,
  Paper,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Collapse,
  List,
} from '@mui/material';
import {
  Search as SearchIcon,
  Home as HomeIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Work as WorkIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  AccessTime as TimeIcon,
  Receipt as ReceiptIcon,
  RequestQuote as QuoteIcon,
  ShoppingCart as PurchaseIcon,
  Assessment as ReportsIcon,
  SupervisorAccount as AdminIcon,
  BeachAccess as PTOIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Apps as AppsIcon,
  LocalShipping as VanIcon,
  QrCodeScanner as ScannerIcon,
  AssignmentReturn as ReturnIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../api';
import NotificationCenter from './NotificationCenter';
import logger from '../utils/logger';
function AppHeader({ title, subtitle, showSearch = true, showNotifications = true, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);

  useEffect(() => {
    loadUserData();
  }, []);

  // Track navigation history for back/forward buttons
  useEffect(() => {
    // Check if we can go back - we can if there's history and we're not at the first entry
    // window.history.length > 1 means there's history, but we also check we're not on login
    const isLoginPage = location.pathname === '/login';
    setCanGoBack(window.history.length > 1 && !isLoginPage);

    // For forward, we track using sessionStorage
    const historyStack = JSON.parse(sessionStorage.getItem('navHistoryStack') || '[]');
    const historyIndex = parseInt(sessionStorage.getItem('navHistoryIndex') || '0', 10);

    // Update history stack on navigation
    const currentPath = location.pathname + location.search;

    if (historyStack.length === 0 || historyStack[historyIndex] !== currentPath) {
      // New navigation - truncate forward history and add new entry
      const newStack = historyStack.slice(0, historyIndex + 1);
      newStack.push(currentPath);

      // Keep only last 20 entries to avoid memory issues
      const trimmedStack = newStack.slice(-20);
      sessionStorage.setItem('navHistoryStack', JSON.stringify(trimmedStack));
      sessionStorage.setItem('navHistoryIndex', String(trimmedStack.length - 1));
      setCanGoForward(false);
    } else {
      // Navigating within existing history
      setCanGoForward(historyIndex < historyStack.length - 1);
    }
  }, [location]);

  const loadUserData = async () => {
    try {
      const userData = await getCurrentUser();
      setUserName(userData.full_name || userData.username);
      setUserRole(userData.role);
    } catch (err) {
      logger.error('Failed to load user data:', err);
    }
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setModulesOpen(false);
  };

  const handleModulesToggle = (e) => {
    e.stopPropagation();
    setModulesOpen(!modulesOpen);
  };

  const navigateToModule = (path) => {
    handleMenuClose();
    navigate(path);
  };

  // Define all modules with their access levels
  const getAvailableModules = () => {
    const allModules = [
      { name: 'Jobs', path: '/jobs', icon: <WorkIcon fontSize="small" />, roles: ['admin', 'manager', 'technician', 'office'] },
      { name: 'Work Orders', path: '/work-orders', icon: <WorkIcon fontSize="small" />, roles: ['admin', 'manager'] },
      { name: 'Schedule', path: '/schedule', icon: <ScheduleIcon fontSize="small" />, roles: ['admin', 'manager', 'technician', 'office'] },
      { name: 'Customers', path: '/customers', icon: <PeopleIcon fontSize="small" />, roles: ['admin', 'manager', 'technician', 'office'] },
      { name: 'Inventory', path: '/inventory', icon: <InventoryIcon fontSize="small" />, roles: ['admin', 'manager', 'technician', 'office'] },
      { name: 'Work Vans', path: '/vans', icon: <VanIcon fontSize="small" />, roles: ['admin', 'manager', 'technician', 'office'] },
      { name: 'Return Rack', path: '/return-rack', icon: <ReturnIcon fontSize="small" />, roles: ['admin', 'manager', 'office'] },
      { name: 'Job Scanner', path: '/job-scanner', icon: <ScannerIcon fontSize="small" />, roles: ['admin', 'manager', 'technician'] },
      { name: 'Timesheet', path: '/timesheet', icon: <TimeIcon fontSize="small" />, roles: ['admin', 'manager', 'technician', 'office'] },
      { name: 'Quotes', path: '/quotes', icon: <QuoteIcon fontSize="small" />, roles: ['admin', 'manager'] },
      { name: 'Invoices', path: '/invoices', icon: <ReceiptIcon fontSize="small" />, roles: ['admin', 'office'] },
      { name: 'Purchase Orders', path: '/purchase-orders', icon: <PurchaseIcon fontSize="small" />, roles: ['admin'] },
      { name: 'Reports', path: '/reports', icon: <ReportsIcon fontSize="small" />, roles: ['admin'] },
      { name: 'PTO Approval', path: '/admin/pto-approval', icon: <PTOIcon fontSize="small" />, roles: ['admin', 'manager'] },
      { name: 'User Management', path: '/admin/users', icon: <AdminIcon fontSize="small" />, roles: ['admin'] },
    ];

    return allModules.filter(module => module.roles.includes(userRole));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleHome = () => {
    handleMenuClose();
    navigate('/home');
  };

  const handleGoBack = () => {
    const historyStack = JSON.parse(sessionStorage.getItem('navHistoryStack') || '[]');
    const historyIndex = parseInt(sessionStorage.getItem('navHistoryIndex') || '0', 10);

    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      sessionStorage.setItem('navHistoryIndex', String(newIndex));
      navigate(historyStack[newIndex]);
    } else {
      // Fallback to browser history
      window.history.back();
    }
  };

  const handleGoForward = () => {
    const historyStack = JSON.parse(sessionStorage.getItem('navHistoryStack') || '[]');
    const historyIndex = parseInt(sessionStorage.getItem('navHistoryIndex') || '0', 10);

    if (historyIndex < historyStack.length - 1) {
      const newIndex = historyIndex + 1;
      sessionStorage.setItem('navHistoryIndex', String(newIndex));
      navigate(historyStack[newIndex]);
    }
  };

  const getRoleDisplay = () => {
    switch (userRole) {
      case 'admin':
        return 'Administrator';
      case 'manager':
        return 'Manager';
      case 'technician':
        return 'Technician';
      case 'office':
        return 'Office';
      default:
        return '';
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        bgcolor: 'secondary.dark',
        color: 'white',
        borderRadius: 0,
        px: 2,
        py: 1.5,
        position: 'sticky',
        top: 0,
        zIndex: 1100,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left side - Logo, Nav buttons, and Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            src="/icons/icon-96x96.png"
            alt="KJ"
            sx={{
              width: 48,
              height: 48,
              cursor: 'pointer',
              bgcolor: 'background.paper',
            }}
            onClick={handleMenuClick}
          />

          {/* Navigation buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
            <Tooltip title="Go back">
              <span>
                <IconButton
                  sx={{
                    color: canGoBack ? 'white' : 'rgba(255,255,255,0.3)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                  onClick={handleGoBack}
                  disabled={!canGoBack}
                  size="small"
                >
                  <ArrowBackIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Go forward">
              <span>
                <IconButton
                  sx={{
                    color: canGoForward ? 'white' : 'rgba(255,255,255,0.3)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                  onClick={handleGoForward}
                  disabled={!canGoForward}
                  size="small"
                >
                  <ArrowForwardIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Box sx={{ ml: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {subtitle}
              </Typography>
            ) : userRole && (
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {getRoleDisplay()}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right side - Action buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Custom action buttons passed as children */}
          {children}

          {showSearch && (
            <IconButton sx={{ color: 'white' }}>
              <SearchIcon />
            </IconButton>
          )}
          {showNotifications && (
            <NotificationCenter />
          )}
          <IconButton
            sx={{ color: 'white' }}
            onClick={handleHome}
          >
            <HomeIcon />
          </IconButton>
        </Box>
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 200,
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            src="/icons/icon-96x96.png"
            alt="KJ"
            sx={{ width: 40, height: 40, bgcolor: 'background.paper' }}
          />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {userName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getRoleDisplay()}
            </Typography>
          </Box>
        </Box>
        <Divider />
        <MenuItem onClick={handleHome}>
          <ListItemIcon>
            <HomeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Home</ListItemText>
        </MenuItem>

        {/* Pages Navigation Section */}
        <MenuItem onClick={handleModulesToggle}>
          <ListItemIcon>
            <AppsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Pages</ListItemText>
          {modulesOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </MenuItem>
        <Collapse in={modulesOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ bgcolor: 'action.hover' }}>
            {getAvailableModules().map((module) => (
              <MenuItem
                key={module.path}
                onClick={() => navigateToModule(module.path)}
                sx={{ pl: 4 }}
              >
                <ListItemIcon>
                  {module.icon}
                </ListItemIcon>
                <ListItemText primary={module.name} />
              </MenuItem>
            ))}
          </List>
        </Collapse>

        <Divider />
        <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); navigate('/settings'); }}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  );
}

export default AppHeader;
