import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as ResolvedIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Schedule as ScheduleIcon,
  AccessTime as TimeIcon,
  Compare as CompareIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';
import AppHeader from '../AppHeader';

function ContradictionsReport() {
  const [contradictions, setContradictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [weekEndingFilter, setWeekEndingFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('false'); // Show unresolved by default

  // Resolve dialog
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedContradiction, setSelectedContradiction] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadContradictions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (weekEndingFilter) params.append('week_ending', weekEndingFilter);
      if (employeeFilter) params.append('employee_username', employeeFilter);
      if (resolvedFilter !== 'all') params.append('resolved', resolvedFilter);

      const response = await fetch(
        `${API_BASE_URL}/schedule-contradictions?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setContradictions(data.contradictions || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || 'Failed to load contradictions');
      }
    } catch (err) {
      setError('Failed to load contradictions: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [weekEndingFilter, employeeFilter, resolvedFilter]);

  useEffect(() => {
    loadContradictions();
  }, [loadContradictions]);

  const openResolveDialog = (contradiction) => {
    setSelectedContradiction(contradiction);
    setResolutionNotes('');
    setResolveDialogOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedContradiction) return;

    setResolving(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/schedule-contradictions/${selectedContradiction.id}/resolve`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ resolution_notes: resolutionNotes }),
        }
      );

      if (response.ok) {
        setSuccessMessage('Contradiction marked as resolved');
        setResolveDialogOpen(false);
        loadContradictions();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || 'Failed to resolve contradiction');
      }
    } catch (err) {
      setError('Failed to resolve contradiction: ' + err.message);
    } finally {
      setResolving(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'missing_schedule':
        return <ScheduleIcon color="warning" />;
      case 'missing_time_entry':
        return <TimeIcon color="error" />;
      case 'hours_mismatch':
        return <CompareIcon color="info" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'missing_schedule':
        return 'Not Scheduled';
      case 'missing_time_entry':
        return 'No Time Logged';
      case 'hours_mismatch':
        return 'Hours Mismatch';
      default:
        return type;
    }
  };

  const getTypeDescription = (c) => {
    switch (c.contradiction_type) {
      case 'missing_schedule':
        return `Employee logged ${c.actual_hours}h but was not scheduled for this job on this date`;
      case 'missing_time_entry':
        return `Employee was scheduled for ${c.scheduled_hours}h but did not log any time`;
      case 'hours_mismatch':
        const diff = parseFloat(c.actual_hours) - parseFloat(c.scheduled_hours);
        return `Scheduled: ${c.scheduled_hours}h, Logged: ${c.actual_hours}h (${diff > 0 ? '+' : ''}${diff.toFixed(2)}h)`;
      default:
        return c.notes || 'Unknown discrepancy';
    }
  };

  // Calculate stats
  const stats = {
    total: contradictions.length,
    unresolved: contradictions.filter((c) => !c.resolved).length,
    missingSchedule: contradictions.filter(
      (c) => c.contradiction_type === 'missing_schedule' && !c.resolved
    ).length,
    missingTime: contradictions.filter(
      (c) => c.contradiction_type === 'missing_time_entry' && !c.resolved
    ).length,
    hoursMismatch: contradictions.filter(
      (c) => c.contradiction_type === 'hours_mismatch' && !c.resolved
    ).length,
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppHeader title="Schedule Contradictions" />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <WarningIcon color="warning" fontSize="large" />
              <Typography variant="h4">Schedule Contradictions</Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadContradictions}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {successMessage && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
              {successMessage}
            </Alert>
          )}

          {/* Stats Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="warning.main">
                    {stats.unresolved}
                  </Typography>
                  <Typography variant="caption">Unresolved</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="warning.main">
                    {stats.missingSchedule}
                  </Typography>
                  <Typography variant="caption">Not Scheduled</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="error.main">
                    {stats.missingTime}
                  </Typography>
                  <Typography variant="caption">No Time Logged</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="info.main">
                    {stats.hoursMismatch}
                  </Typography>
                  <Typography variant="caption">Hours Mismatch</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="text.secondary">
                    {stats.total}
                  </Typography>
                  <Typography variant="caption">Total Records</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#fafafa' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FilterIcon color="action" />
              <TextField
                type="date"
                label="Week Ending"
                value={weekEndingFilter}
                onChange={(e) => setWeekEndingFilter(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              <TextField
                label="Employee"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                size="small"
                placeholder="Username"
                sx={{ width: 150 }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={resolvedFilter}
                  label="Status"
                  onChange={(e) => setResolvedFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="false">Unresolved</MenuItem>
                  <MenuItem value="true">Resolved</MenuItem>
                </Select>
              </FormControl>
              <Tooltip title="Clear Filters">
                <IconButton
                  size="small"
                  onClick={() => {
                    setWeekEndingFilter('');
                    setEmployeeFilter('');
                    setResolvedFilter('false');
                  }}
                >
                  <ClearIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>

          {/* Table */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : contradictions.length === 0 ? (
            <Alert severity="success" icon={<ResolvedIcon />}>
              No contradictions found. All schedules and time entries are in sync!
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Employee</strong></TableCell>
                    <TableCell><strong>Work Order</strong></TableCell>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Details</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contradictions.map((c) => (
                    <TableRow
                      key={c.id}
                      sx={{ bgcolor: c.resolved ? '#f5f5f5' : 'inherit' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getTypeIcon(c.contradiction_type)}
                          <Typography variant="caption">
                            {getTypeLabel(c.contradiction_type)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{c.employee_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.employee_username}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{c.work_order_number}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.customer_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {new Date(c.scheduled_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 300 }}>
                          {getTypeDescription(c)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {c.resolved ? (
                          <Chip
                            label="Resolved"
                            size="small"
                            color="success"
                            icon={<ResolvedIcon />}
                          />
                        ) : (
                          <Chip
                            label="Pending"
                            size="small"
                            color="warning"
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {!c.resolved && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openResolveDialog(c)}
                          >
                            Resolve
                          </Button>
                        )}
                        {c.resolved && c.resolution_notes && (
                          <Tooltip title={`Resolved by ${c.resolved_by}: ${c.resolution_notes}`}>
                            <IconButton size="small">
                              <ResolvedIcon color="success" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Resolve Dialog */}
        <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Resolve Contradiction</DialogTitle>
          <DialogContent>
            {selectedContradiction && (
              <>
                <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1, mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Employee:</strong> {selectedContradiction.employee_name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Work Order:</strong> {selectedContradiction.work_order_number}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Date:</strong>{' '}
                    {new Date(selectedContradiction.scheduled_date).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Issue:</strong> {getTypeDescription(selectedContradiction)}
                  </Typography>
                </Box>
                <TextField
                  label="Resolution Notes"
                  multiline
                  rows={3}
                  fullWidth
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Explain how this was resolved..."
                />
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResolveDialogOpen(false)} disabled={resolving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleResolve}
              disabled={resolving}
              startIcon={resolving ? <CircularProgress size={16} /> : <ResolvedIcon />}
            >
              {resolving ? 'Resolving...' : 'Mark Resolved'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}

export default ContradictionsReport;
