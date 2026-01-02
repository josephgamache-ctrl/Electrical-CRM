import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  ViewList as ListIcon,
  LocalShipping as DispatchIcon,
  Map as MapIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { getCurrentUser } from '../api';
import { ScheduleProvider, useSchedule } from './schedule/ScheduleContext';
import ScheduleListDay from './schedule/ScheduleListDay';
import ScheduleCalendar from './schedule/ScheduleCalendar';
import ScheduleDispatch from './schedule/ScheduleDispatch';
import ScheduleMap from './schedule/ScheduleMap';
import EmployeeCalendar from './schedule/EmployeeCalendar';
import AppHeader from './AppHeader';
import './Schedule.css';
import logger from '../utils/logger';
// Inner component that has access to ScheduleContext
function ScheduleContent({ userRole }) {
  // Technicians only see: Map (0), Employee (1), Calendar (2)
  // Admins/Managers see all: List-Day (0), Calendar (1), Dispatch (2), Employee (3), Map (4)
  const isTechnician = userRole === 'technician' || userRole === 'employee';

  // Default tab: Map for technicians, Dispatch for admins/managers
  const [currentTab, setCurrentTab] = useState(isTechnician ? 0 : 2);
  const { setDateRange } = useSchedule();

  // Update default tab when userRole loads
  React.useEffect(() => {
    if (userRole) {
      const isTech = userRole === 'technician' || userRole === 'employee';
      setCurrentTab(isTech ? 0 : 2);
    }
  }, [userRole]);

  // Reset date to today when switching to Dispatch or Map views
  const handleTabChange = (event, newValue) => {
    if (isTechnician) {
      // For technicians: tab 0 = Map, needs date reset
      if (newValue === 0) {
        const today = new Date().toISOString().split('T')[0];
        setDateRange(today, today);
      }
    } else {
      // For admins/managers: tabs 2 (Dispatch) and 4 (Map) need date reset
      if (newValue === 2 || newValue === 4) {
        const today = new Date().toISOString().split('T')[0];
        setDateRange(today, today);
      }
    }
    setCurrentTab(newValue);
  };

  // Technician tabs: Map, Employee, Calendar only
  if (isTechnician) {
    return (
      <>
        <Paper elevation={2} sx={{ mb: 0, position: 'sticky', top: 64, zIndex: 1099 }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                textTransform: 'none',
                fontSize: '15px',
                fontWeight: 500,
              },
              '& .Mui-selected': {
                color: '#2c3e8f',
                fontWeight: 600,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#2c3e8f',
                height: 3,
              },
            }}
          >
            <Tab
              icon={<MapIcon />}
              iconPosition="start"
              label="Map"
            />
            <Tab
              icon={<PersonIcon />}
              iconPosition="start"
              label="Employee"
            />
            <Tab
              icon={<CalendarIcon />}
              iconPosition="start"
              label="Calendar"
            />
          </Tabs>
        </Paper>

        <Container maxWidth="xl" sx={{ py: 0, px: 0 }}>
          {currentTab === 0 && <ScheduleMap userRole={userRole} />}
          {currentTab === 1 && <EmployeeCalendar userRole={userRole} />}
          {currentTab === 2 && <ScheduleCalendar userRole={userRole} />}
        </Container>
      </>
    );
  }

  // Admin/Manager tabs: All views
  return (
    <>
      {/* Navigation Tabs - Sticky below header */}
      <Paper elevation={2} sx={{ mb: 0, position: 'sticky', top: 64, zIndex: 1099 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              minHeight: 64,
              textTransform: 'none',
              fontSize: '15px',
              fontWeight: 500,
            },
            '& .Mui-selected': {
              color: '#2c3e8f',
              fontWeight: 600,
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#2c3e8f',
              height: 3,
            },
          }}
        >
          <Tab
            icon={<ListIcon />}
            iconPosition="start"
            label="List - Day"
          />
          <Tab
            icon={<CalendarIcon />}
            iconPosition="start"
            label="Calendar"
          />
          <Tab
            icon={<DispatchIcon />}
            iconPosition="start"
            label="Dispatch"
          />
          <Tab
            icon={<PersonIcon />}
            iconPosition="start"
            label="Employee"
          />
          <Tab
            icon={<MapIcon />}
            iconPosition="start"
            label="Map"
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Container maxWidth="xl" sx={{ py: 0, px: 0 }}>
        {currentTab === 0 && <ScheduleListDay userRole={userRole} />}
        {currentTab === 1 && <ScheduleCalendar userRole={userRole} />}
        {currentTab === 2 && <ScheduleDispatch userRole={userRole} />}
        {currentTab === 3 && <EmployeeCalendar userRole={userRole} />}
        {currentTab === 4 && <ScheduleMap userRole={userRole} />}
      </Container>
    </>
  );
}

function Schedule() {
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await getCurrentUser();
      setUserRole(userData.role);
    } catch (err) {
      logger.error('Failed to load user data:', err);
    }
  };

  const getTabTitle = () => {
    if (userRole === 'admin' || userRole === 'manager') {
      return 'Team Schedule';
    }
    return 'My Schedule';
  };

  return (
    <ScheduleProvider>
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        {/* Header */}
        <AppHeader title={getTabTitle()} />

        <ScheduleContent userRole={userRole} />
      </Box>
    </ScheduleProvider>
  );
}

export default Schedule;
