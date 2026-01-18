import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  GroupAdd as GroupAddIcon,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../Schedule.css';
import { API_BASE_URL } from '../../api';
import { useSchedule } from './ScheduleContext';
import {
  getStatusColor,
  STATUS_COLORS,
  formatDateDisplayLong,
} from './scheduleHelpers';
import ModifyCrewDialog from './ModifyCrewDialog';
import AssignedAvatars from '../common/AssignedAvatars';
import logger from '../../utils/logger';
// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons for different job statuses using DivIcon for colored markers
const createColoredIcon = (color, isEmergency = false) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 25px;
        height: 41px;
        position: relative;
      ">
        <svg viewBox="0 0 25 41" width="25" height="41" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5s12.5-19.1 12.5-28.5C25 5.6 19.4 0 12.5 0z"
                fill="${color}"
                stroke="#fff"
                stroke-width="2"/>
          <circle cx="12.5" cy="12.5" r="6" fill="#fff"/>
          ${isEmergency ? '<text x="12.5" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="red">!</text>' : ''}
        </svg>
      </div>
    `,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
  });
};

// Create icons dynamically based on status
const getStatusIcon = (status, isEmergency = false) => {
  const color = getStatusColor(status);
  return createColoredIcon(color, isEmergency);
};

const technicianIcon = L.divIcon({
  className: 'technician-marker',
  html: `
    <div style="
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background-color: #E91E63;
      border: 3px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    ">T</div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

// Component to handle map bounds
function MapBoundsHandler({ jobs, technicians }) {
  const map = useMap();

  useEffect(() => {
    const allCoords = [
      ...jobs.filter(j => j.latitude && j.longitude).map(j => [j.latitude, j.longitude]),
      ...technicians.filter(t => t.latitude && t.longitude).map(t => [t.latitude, t.longitude]),
    ];

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, jobs, technicians]);

  return null;
}

function ScheduleMap({ userRole }) {
  // Use shared schedule context - single day view only for Map
  const {
    scheduleEntries,
    workOrders,
    refreshTrigger,
    refreshSchedule,
    // Date state - Map uses single day only (selectedDate = startDate = endDate)
    selectedDate,
    setSelectedDate,
    loading: contextLoading,
  } = useSchedule();

  // Note: Date reset to today is handled in Schedule.js when switching to this tab

  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showTechnicians, setShowTechnicians] = useState(true);

  // Modify Crew Dialog state
  const [modifyCrewDialogOpen, setModifyCrewDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch technician locations
  const fetchTechnicians = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const techResponse = await fetch(`${API_BASE_URL}/map/technicians`, { headers });
      if (techResponse.ok) {
        const techData = await techResponse.json();
        setTechnicians(techData.technicians || []);
      }
    } catch (err) {
      logger.error('Error fetching technician data:', err);
      setError('Failed to load technician locations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load technicians on mount and when refresh trigger changes
  useEffect(() => {
    fetchTechnicians();
  }, [fetchTechnicians, refreshTrigger]);

  // Get work orders that have scheduled workers on the selected date
  // Single day view only - shows jobs if anyone is scheduled for that day
  const scheduledWorkOrderIds = useMemo(() => {
    const ids = new Set();

    scheduleEntries.forEach(entry => {
      if (entry.scheduled_date === selectedDate) {
        ids.add(entry.work_order_id);
      }
    });

    return ids;
  }, [scheduleEntries, selectedDate]);

  // Filter work orders - only those with workers scheduled on selected date(s)
  const filteredJobs = useMemo(() => {
    return workOrders.filter(wo => {
      // Must have scheduled workers on the selected date(s)
      if (!scheduledWorkOrderIds.has(wo.id)) return false;

      // Apply status filter
      if (statusFilter !== 'all' && wo.status !== statusFilter) return false;

      return true;
    });
  }, [workOrders, scheduledWorkOrderIds, statusFilter]);

  // Filter jobs that have valid coordinates
  const validJobs = useMemo(() => {
    return filteredJobs.filter(job => job.latitude && job.longitude);
  }, [filteredJobs]);

  // Calculate center of Massachusetts as default
  const defaultCenter = [42.4072, -71.3824]; // Massachusetts center

  const mapCenter = useMemo(() => {
    if (validJobs.length > 0) {
      const avgLat = validJobs.reduce((sum, j) => sum + j.latitude, 0) / validJobs.length;
      const avgLng = validJobs.reduce((sum, j) => sum + j.longitude, 0) / validJobs.length;
      return [avgLat, avgLng];
    }
    return defaultCenter;
  }, [validJobs]);

  // Simple single-day navigation
  const goToPreviousDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // Get crew info for a work order from schedule entries (for the selected date)
  const getCrewForWorkOrder = useCallback((workOrderId) => {
    const crewMap = new Map();

    scheduleEntries
      .filter(entry => entry.work_order_id === workOrderId && entry.scheduled_date === selectedDate)
      .forEach(entry => {
        if (!crewMap.has(entry.username)) {
          crewMap.set(entry.username, {
            username: entry.username,
            full_name: entry.full_name,
          });
        }
      });

    return Array.from(crewMap.values());
  }, [scheduleEntries, selectedDate]);

  // Open Modify Crew dialog for a job
  const handleOpenModifyCrewDialog = (job) => {
    setSelectedWorkOrder(job);
    setModifyCrewDialogOpen(true);
  };

  // Handle success from ModifyCrewDialog
  const handleModifyCrewSuccess = (result) => {
    setSuccess(result.message);
    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(null), 3000);
  };

  const isDataLoading = loading || contextLoading;

  return (
    <Box sx={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
      {/* Date Navigation Header - Single Day View */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Top row: Date Navigation and Status Filter */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          {/* Date Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={goToPreviousDay} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <TextField
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              size="small"
              sx={{ width: { xs: 130, sm: 150 } }}
            />
            <IconButton onClick={goToNextDay} size="small">
              <ChevronRightIcon />
            </IconButton>
            {!isToday && (
              <Button
                variant="text"
                size="small"
                startIcon={<TodayIcon />}
                onClick={goToToday}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                Today
              </Button>
            )}
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 500,
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                display: { xs: 'none', sm: 'block' }
              }}
            >
              {formatDateDisplayLong(selectedDate)}
            </Typography>
          </Box>

          {/* Status Filter and Refresh */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="canceled">Canceled</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title="Refresh Map">
              <IconButton onClick={refreshSchedule} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats and Legend Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          {/* Stats */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {validJobs.length} jobs on map
              {filteredJobs.length > validJobs.length && ` (${filteredJobs.length - validJobs.length} without coordinates)`}
            </Typography>
            {technicians.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                | {technicians.length} technicians
              </Typography>
            )}
          </Box>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ mr: 0.5 }}>Legend:</Typography>
            {Object.entries(STATUS_COLORS).map(([status, colors]) => (
              <Chip
                key={status}
                label={status.replace('_', ' ')}
                size="small"
                sx={{
                  bgcolor: colors.chip,
                  color: 'white',
                  fontSize: '0.65rem',
                  height: 20,
                  textTransform: 'capitalize',
                }}
              />
            ))}
            <Chip
              label="Tech"
              size="small"
              sx={{
                bgcolor: '#E91E63',
                color: 'white',
                fontSize: '0.65rem',
                height: 20,
              }}
            />
          </Box>
        </Box>
      </Paper>

      {/* Map Container */}
      <Paper sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        {isDataLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
              zIndex: 1000,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 1001 }}>
            {success}
          </Alert>
        )}

        <MapContainer
          center={mapCenter}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBoundsHandler jobs={validJobs} technicians={technicians} />

          {/* Job Markers */}
          {validJobs.map((job) => {
            const crew = getCrewForWorkOrder(job.id);
            return (
              <Marker
                key={`job-${job.id}`}
                position={[job.latitude, job.longitude]}
                icon={getStatusIcon(job.status, job.priority === 'high')}
              >
                <Popup>
                  <Box sx={{ minWidth: 220 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {job.work_order_number}
                    </Typography>
                    {job.customer_name && (
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        <strong>Customer:</strong> {job.customer_name}
                      </Typography>
                    )}
                    {job.service_address && (
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        <strong>Address:</strong> {job.service_address}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      <strong>Status:</strong>{' '}
                      <Chip
                        label={job.status?.replace('_', ' ')}
                        size="small"
                        sx={{
                          bgcolor: getStatusColor(job.status),
                          color: 'white',
                          fontSize: '0.7rem',
                          height: 18,
                          textTransform: 'capitalize',
                        }}
                      />
                    </Typography>
                    {crew.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                          Scheduled Crew ({crew.length}):
                        </Typography>
                        <AssignedAvatars
                          assignedWorkers={crew}
                          size="small"
                          max={5}
                          showNames
                        />
                      </Box>
                    )}
                    {job.job_description && (
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 1 }}>
                        {job.job_description.length > 100
                          ? `${job.job_description.substring(0, 100)}...`
                          : job.job_description}
                      </Typography>
                    )}
                    {job.priority === 'high' && (
                      <Chip
                        label="HIGH PRIORITY"
                        size="small"
                        color="error"
                        sx={{ mt: 1 }}
                      />
                    )}
                    {/* Modify Crew Button - Admin/Manager only */}
                    {(userRole === 'admin' || userRole === 'manager') && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<GroupAddIcon />}
                        onClick={() => handleOpenModifyCrewDialog(job)}
                        sx={{ mt: 1.5, width: '100%' }}
                      >
                        Modify Crew
                      </Button>
                    )}
                  </Box>
                </Popup>
              </Marker>
            );
          })}

          {/* Technician Markers */}
          {showTechnicians && technicians.map((tech) => (
            tech.latitude && tech.longitude && (
              <Marker
                key={`tech-${tech.username}`}
                position={[tech.latitude, tech.longitude]}
                icon={technicianIcon}
              >
                <Popup>
                  <Box sx={{ minWidth: 150 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {tech.name || tech.username}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      <strong>Role:</strong> {tech.role}
                    </Typography>
                    {tech.address && (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Home: {tech.address}, {tech.city}
                      </Typography>
                    )}
                  </Box>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      </Paper>

      {/* Modify Crew Dialog - allows multi-day scheduling even though map view is single-day */}
      <ModifyCrewDialog
        open={modifyCrewDialogOpen}
        onClose={() => setModifyCrewDialogOpen(false)}
        workOrder={selectedWorkOrder}
        defaultDate={selectedDate}
        onSuccess={handleModifyCrewSuccess}
      />
    </Box>
  );
}

export default ScheduleMap;
