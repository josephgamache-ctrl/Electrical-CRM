import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Lock as LockedIcon,
  Send as SubmitIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { getMyWeekTimecard, updateTimeEntry, deleteTimeEntry, API_BASE_URL } from '../api';
import AppHeader from './AppHeader';

function MyTimecard() {
  const [weekEnding, setWeekEnding] = useState('');
  const [timecard, setTimecard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [editValues, setEditValues] = useState({ hours: '', notes: '' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  // Submit week state
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // Calculate current week ending (next Sunday)
  const calculateWeekEnding = (date) => {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7;
    d.setDate(d.getDate() + daysUntilSunday);
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    const today = new Date();
    const currentWeekEnding = calculateWeekEnding(today);
    setWeekEnding(currentWeekEnding);
  }, []);

  useEffect(() => {
    if (weekEnding) {
      loadTimecard();
    }
  }, [weekEnding]);

  const loadTimecard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyWeekTimecard(weekEnding);
      setTimecard(data);
    } catch (err) {
      setError('Failed to load timecard: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    const d = new Date(weekEnding);
    d.setDate(d.getDate() - 7);
    setWeekEnding(d.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const d = new Date(weekEnding);
    d.setDate(d.getDate() + 7);
    setWeekEnding(d.toISOString().split('T')[0]);
  };

  const startEditing = (entry) => {
    setEditingEntry(entry.id);
    setEditValues({
      hours: entry.hours_worked,
      notes: entry.notes || ''
    });
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setEditValues({ hours: '', notes: '' });
  };

  const saveEdit = async (entryId) => {
    try {
      await updateTimeEntry(entryId, {
        hours_worked: parseFloat(editValues.hours),
        notes: editValues.notes
      });
      setSuccessMessage('Time entry updated successfully');
      setEditingEntry(null);
      loadTimecard();
    } catch (err) {
      setError('Failed to update entry: ' + err.message);
    }
  };

  const confirmDelete = (entry) => {
    setEntryToDelete(entry);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await deleteTimeEntry(entryToDelete.id);
      setSuccessMessage('Time entry deleted successfully');
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
      loadTimecard();
    } catch (err) {
      setError('Failed to delete entry: ' + err.message);
      setDeleteConfirmOpen(false);
    }
  };

  // Submit week function
  const handleSubmitWeek = async () => {
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/time-entries/submit-week`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          week_ending_date: weekEnding,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSubmitResult(result);

        if (result.contradictions_found === 0) {
          setSuccessMessage('Week submitted successfully! All entries synced with schedule.');
          setSubmitDialogOpen(false);
          loadTimecard();
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || 'Failed to submit week');
        setSubmitDialogOpen(false);
      }
    } catch (err) {
      setError('Failed to submit week: ' + err.message);
      setSubmitDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getWeekDateRange = () => {
    if (!weekEnding) return '';
    const sunday = new Date(weekEnding);
    const monday = new Date(sunday);
    monday.setDate(monday.getDate() - 6);
    return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  if (loading && !timecard) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppHeader title="My Timecard" />
        <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="My Timecard" />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            My Timecard
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <IconButton onClick={handlePreviousWeek} color="primary">
              <PrevIcon />
            </IconButton>
            <Typography variant="h6">
              Week of {getWeekDateRange()}
            </Typography>
            <IconButton onClick={handleNextWeek} color="primary">
              <NextIcon />
            </IconButton>
            {timecard && timecard.totals && !timecard.totals.is_locked && timecard.entries?.length > 0 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<SubmitIcon />}
                onClick={() => setSubmitDialogOpen(true)}
                sx={{ ml: 2 }}
              >
                Submit Week
              </Button>
            )}
          </Box>
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

        {timecard && timecard.totals && timecard.totals.is_locked && (
          <Alert severity="warning" sx={{ mb: 3 }} icon={<LockedIcon />}>
            This week has been locked for payroll processing. You cannot edit these entries.
          </Alert>
        )}

        {/* Summary Cards */}
        {timecard && timecard.totals && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {timecard.totals.total_hours || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Hours
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="success.main">
                    {timecard.totals.entry_count || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Time Entries
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="h4">
                    {timecard.totals.is_locked ? (
                      <Chip label="Locked" color="warning" icon={<LockedIcon />} />
                    ) : (
                      <Chip label="Editable" color="success" />
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Time Entries Table */}
        {timecard && timecard.entries && timecard.entries.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Job</strong></TableCell>
                  <TableCell><strong>Customer</strong></TableCell>
                  <TableCell><strong>Hours</strong></TableCell>
                  <TableCell><strong>Notes</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {timecard.entries.map((entry) => (
                  <TableRow key={entry.id} sx={{ backgroundColor: entry.is_locked ? 'action.disabledBackground' : 'inherit' }}>
                    <TableCell>{formatDate(entry.work_date)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{entry.work_order_number}</Typography>
                      <Typography variant="caption" color="text.secondary">{entry.job_type}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{entry.customer_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{entry.customer_address}</Typography>
                    </TableCell>
                    <TableCell>
                      {editingEntry === entry.id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editValues.hours}
                          onChange={(e) => setEditValues({ ...editValues, hours: e.target.value })}
                          inputProps={{ min: 0, max: 24, step: 0.25 }}
                          sx={{ width: 80 }}
                        />
                      ) : (
                        <Typography variant="body1">{entry.hours_worked}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingEntry === entry.id ? (
                        <TextField
                          size="small"
                          fullWidth
                          multiline
                          rows={2}
                          value={editValues.notes}
                          onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                          placeholder="Add notes..."
                        />
                      ) : (
                        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.notes || '-'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {!entry.is_locked && (
                        <>
                          {editingEntry === entry.id ? (
                            <>
                              <IconButton onClick={() => saveEdit(entry.id)} color="primary" size="small">
                                <SaveIcon />
                              </IconButton>
                              <IconButton onClick={cancelEditing} size="small">
                                <CancelIcon />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton onClick={() => startEditing(entry)} color="primary" size="small">
                                <EditIcon />
                              </IconButton>
                              <IconButton onClick={() => confirmDelete(entry)} color="error" size="small">
                                <DeleteIcon />
                              </IconButton>
                            </>
                          )}
                        </>
                      )}
                      {entry.is_locked && (
                        <Chip label="Locked" size="small" icon={<LockedIcon />} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">
            No time entries for this week. Use the "Time Entry" page to add hours.
          </Alert>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Time Entry?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this time entry?
          </Typography>
          {entryToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2"><strong>Date:</strong> {formatDate(entryToDelete.work_date)}</Typography>
              <Typography variant="body2"><strong>Job:</strong> {entryToDelete.work_order_number}</Typography>
              <Typography variant="body2"><strong>Hours:</strong> {entryToDelete.hours_worked}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Submit Week Dialog */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => !submitting && setSubmitDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SubmitIcon color="primary" />
            <Typography variant="h6">Submit Timecard for Week</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {!submitResult ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Submitting your timecard will sync your time entries with the scheduling system.
                Any discrepancies between your logged hours and scheduled hours will be flagged for review.
              </Alert>

              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mb: 2 }}>
                <Typography variant="subtitle2">Week: {getWeekDateRange()}</Typography>
                <Typography variant="body2">
                  Total Hours: {timecard?.totals?.total_hours || 0}
                </Typography>
                <Typography variant="body2">
                  Entries: {timecard?.totals?.entry_count || 0}
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary">
                This will:
              </Typography>
              <ul>
                <li><Typography variant="body2">Update the schedule with your actual hours worked</Typography></li>
                <li><Typography variant="body2">Create schedule entries for unscheduled work</Typography></li>
                <li><Typography variant="body2">Flag any contradictions for admin review</Typography></li>
              </ul>
            </>
          ) : (
            <>
              {submitResult.contradictions_found === 0 ? (
                <Alert severity="success" icon={<SuccessIcon />} sx={{ mb: 2 }}>
                  Week submitted successfully! All entries have been synced with the schedule.
                </Alert>
              ) : (
                <>
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                    Week submitted with {submitResult.contradictions_found} discrepancies found.
                    These have been sent to admin for review.
                  </Alert>

                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Discrepancies:</Typography>
                  {submitResult.contradictions.map((c, idx) => (
                    <Paper key={idx} sx={{ p: 2, mb: 1, bgcolor: '#fff3e0' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {c.work_order_number} - {c.date}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.type === 'missing_schedule' && `Logged ${c.actual_hours}h but was not scheduled`}
                        {c.type === 'missing_time_entry' && `Scheduled for ${c.scheduled_hours}h but no time logged`}
                        {c.type === 'hours_mismatch' && `Scheduled ${c.scheduled_hours}h, logged ${c.actual_hours}h (${c.difference > 0 ? '+' : ''}${c.difference}h)`}
                      </Typography>
                    </Paper>
                  ))}
                </>
              )}

              {submitResult.schedules_created > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Created {submitResult.schedules_created} new schedule entries from your time entries.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {!submitResult ? (
            <>
              <Button onClick={() => setSubmitDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitWeek}
                variant="contained"
                color="primary"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} /> : <SubmitIcon />}
              >
                {submitting ? 'Submitting...' : 'Submit Week'}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                setSubmitDialogOpen(false);
                setSubmitResult(null);
                loadTimecard();
              }}
              variant="contained"
            >
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
      </Container>
    </Box>
  );
}

export default MyTimecard;
