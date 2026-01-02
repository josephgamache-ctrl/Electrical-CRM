import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../../api';
import logger from '../../utils/logger';
// Create the context
const ScheduleContext = createContext(null);

// Helper to get today's date in YYYY-MM-DD format
const getTodayStr = () => new Date().toISOString().split('T')[0];

/**
 * ScheduleProvider - Provides shared schedule data across all schedule tabs
 *
 * Simplified to track just: When (startDate/endDate), Who (employees), What (workOrders/scheduleEntries)
 */
export function ScheduleProvider({ children }) {
  // Date state - simplified to just start/end (single date = start === end)
  // Use lazy initializer to ensure we get the current date at mount time
  const [startDate, setStartDate] = useState(() => getTodayStr());
  const [endDate, setEndDate] = useState(() => getTodayStr());

  // Core data
  const [scheduleEntries, setScheduleEntries] = useState([]); // From /calendar/schedule
  const [employeeAvailability, setEmployeeAvailability] = useState([]); // Unavailability records
  const [workOrders, setWorkOrders] = useState([]); // All work orders
  const [employees, setEmployees] = useState([]); // All employees

  // Loading states
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState(null);

  // Refresh counter - increment to trigger refresh in child components
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load employees (once on mount)
  const loadEmployees = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const usersArray = Array.isArray(data) ? data : (data.users || []);
        const techs = usersArray.filter(u =>
          u.role === 'technician' || u.role === 'admin' || u.role === 'manager'
        );
        setEmployees(techs);
      }
    } catch (err) {
      logger.error('Error loading employees:', err);
      setError('Failed to load employees. Please refresh the page.');
    }
  }, []);

  // Load work orders
  const loadWorkOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/work-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWorkOrders(data.work_orders || []);
      }
    } catch (err) {
      logger.error('Error loading work orders:', err);
      setError('Failed to load work orders. Please refresh the page.');
    }
  }, []);

  // Load schedule entries for the current date range
  const loadScheduleData = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/calendar/schedule?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        // Flatten schedule entries into per-employee entries
        const entries = [];
        (data.schedule || []).forEach(scheduleItem => {
          const crew = scheduleItem.crew || [];
          crew.forEach(crewMember => {
            entries.push({
              schedule_id: scheduleItem.schedule_id,
              scheduled_date: scheduleItem.scheduled_date,
              start_time: scheduleItem.start_time,
              end_time: scheduleItem.end_time,
              day_status: scheduleItem.day_status,
              phase_name: scheduleItem.phase_name,
              work_order_id: scheduleItem.work_order_id,
              work_order_number: scheduleItem.work_order_number,
              job_description: scheduleItem.job_description,
              job_type: scheduleItem.job_type,
              job_status: scheduleItem.job_status,
              priority: scheduleItem.priority,
              service_address: scheduleItem.service_address,
              customer_name: scheduleItem.customer_name,
              customer_phone: scheduleItem.customer_phone,
              // Per-employee fields
              username: crewMember.username,
              full_name: crewMember.full_name,
              role: crewMember.role,
              is_lead: crewMember.is_lead,
              scheduled_hours: crewMember.scheduled_hours || 8,
              // Full crew list for showing "With:" avatars
              all_crew: crew,
            });
          });
        });
        setScheduleEntries(entries);

        // Also extract availability data from the response
        if (data.availability) {
          setEmployeeAvailability(data.availability);
        }
      }
    } catch (err) {
      logger.error('Error loading schedule data:', err);
      setError('Failed to load schedule data. Please refresh the page.');
    } finally {
      setScheduleLoading(false);
    }
  }, [startDate, endDate]);

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await Promise.all([loadEmployees(), loadWorkOrders()]);
      await loadScheduleData();
      setLoading(false);
    };
    loadInitialData();
  }, [loadEmployees, loadWorkOrders, loadScheduleData]);

  // Reload schedule data when date selection changes
  useEffect(() => {
    if (!loading) {
      loadScheduleData();
    }
  }, [startDate, endDate, loadScheduleData, loading]);

  // Refresh function - call this after making any schedule changes
  const refreshSchedule = useCallback(async () => {
    await Promise.all([loadWorkOrders(), loadScheduleData()]);
    setRefreshTrigger(prev => prev + 1);
  }, [loadWorkOrders, loadScheduleData]);

  // Unified date setter - single date when start === end, range otherwise
  const setDateRange = useCallback((start, end = start) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Alias for backward compatibility
  const selectDateRange = setDateRange;

  // Context value - simplified API
  const value = {
    // Date state (simplified)
    startDate,
    endDate,
    setDateRange,
    selectDateRange, // Alias for backward compatibility
    // Derived: is this a single date or a range?
    isSingleDate: startDate === endDate,
    // For backward compatibility during migration
    selectedDate: startDate,
    dateMode: startDate === endDate ? 'single' : 'range',
    setSelectedDate: (date) => setDateRange(date, date),
    setDateMode: (mode) => {
      if (mode === 'single') {
        setDateRange(startDate, startDate);
      }
      // For 'range', components should call setDateRange with actual dates
    },
    setStartDate,
    setEndDate,

    // Core data
    scheduleEntries,
    employeeAvailability,
    workOrders,
    employees,

    // Loading states
    loading,
    scheduleLoading,

    // Error state
    error,
    clearError: () => setError(null),

    // Refresh
    refreshSchedule,
    refreshTrigger,

    // Direct setters for components that need them
    setScheduleEntries,
    setWorkOrders,
    setEmployees,

    // Reload functions
    loadScheduleData,
    loadWorkOrders,
    loadEmployees,
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}

// Custom hook to use the schedule context
export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}

export default ScheduleContext;
