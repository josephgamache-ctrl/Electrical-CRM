import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  Fab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  Snackbar,
} from '@mui/material';
import {
  AccessTime as ClockIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { getAvailableJobsForTimecard, createTimeEntriesBatch } from '../api';
import AppHeader from './AppHeader';

function TimeEntry() {
  const [selectedDate, setSelectedDate] = useState('');
  const [jobs, setJobs] = useState(null);
  const [timeEntries, setTimeEntries] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize with today's date
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // Load jobs when date changes
  useEffect(() => {
    if (selectedDate) {
      loadJobsForDate(selectedDate);
    }
  }, [selectedDate]);

  const loadJobsForDate = async (date) => {
    setLoading(true);
    setError(null);
    try {
      const jobData = await getAvailableJobsForTimecard(date);
      setJobs(jobData);

      // Pre-populate time entries for jobs that already have entries today
      const newTimeEntries = {};
      Object.values(jobData).flat().forEach(job => {
        if (job.has_entry_today) {
          // This would ideally fetch the existing entry, but for now just mark it
          newTimeEntries[job.id] = { hours: '', notes: '' };
        }
      });
      setTimeEntries(newTimeEntries);
    } catch (err) {
      setError('Failed to load jobs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHoursChange = (jobId, hours) => {
    setTimeEntries(prev => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        hours: hours
      }
    }));
    setHasChanges(true);
  };

  const handleNotesChange = (jobId, notes) => {
    setTimeEntries(prev => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        notes: notes
      }
    }));
    setHasChanges(true);
  };

  const handleSubmit = async () => {
    // Validate that we have at least one entry with hours
    const entriesToSubmit = Object.entries(timeEntries)
      .filter(([_, entry]) => entry.hours && parseFloat(entry.hours) > 0)
      .map(([jobId, entry]) => ({
        work_order_id: jobId === 'general' ? 6 : parseInt(jobId), // Map 'general' to work order ID 6
        hours_worked: parseFloat(entry.hours),
        notes: entry.notes || '',
        break_minutes: 0
      }));

    if (entriesToSubmit.length === 0) {
      setError('Please enter hours for at least one job');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await createTimeEntriesBatch(selectedDate, entriesToSubmit);
      setSuccessMessage(`Successfully saved ${result.entries.length} time entries`);
      setHasChanges(false);
      // Clear the entries after successful submit
      setTimeEntries({});
      // Reload jobs to update "has_entry_today" status
      loadJobsForDate(selectedDate);
    } catch (err) {
      setError('Failed to save time entries: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderJobCard = (job) => {
    const hasHours = timeEntries[job.id]?.hours && parseFloat(timeEntries[job.id].hours) > 0;

    return (
      <Card
        key={job.id}
        sx={{
          mb: 2,
          border: hasHours ? '2px solid #4caf50' : '1px solid #ddd',
          backgroundColor: job.has_entry_today ? '#f0f7ff' : 'white'
        }}
      >
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={7}>
              <Typography variant="h6" gutterBottom>
                {job.customer_name}
                {job.has_entry_today && (
                  <Chip
                    label="Already Entered"
                    size="small"
                    color="info"
                    sx={{ ml: 1 }}
                  />
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {job.customer_address}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {job.job_type} • {job.status.replace('_', ' ').toUpperCase()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Hours Worked"
                type="number"
                fullWidth
                size="small"
                value={timeEntries[job.id]?.hours || ''}
                onChange={(e) => handleHoursChange(job.id, e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ClockIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  inputProps: {
                    min: 0,
                    max: 24,
                    step: 0.25
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              {hasHours && (
                <CheckIcon color="success" sx={{ fontSize: 40 }} />
              )}
            </Grid>
            {timeEntries[job.id]?.hours && (
              <Grid item xs={12}>
                <TextField
                  label="Notes (optional)"
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={timeEntries[job.id]?.notes || ''}
                  onChange={(e) => handleNotesChange(job.id, e.target.value)}
                  placeholder="Add any notes about the work performed..."
                />
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderJobSection = (sectionName, sectionJobs) => {
    if (!sectionJobs || sectionJobs.length === 0) return null;

    return (
      <Accordion defaultExpanded={sectionName === 'Assigned to You'} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">
            {sectionName}
            <Chip label={sectionJobs.length} size="small" sx={{ ml: 1 }} />
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            {sectionJobs.map(job => renderJobCard(job))}
          </Box>
        </AccordionDetails>
      </Accordion>
    );
  };

  const getTotalHours = () => {
    return Object.values(timeEntries)
      .filter(entry => entry.hours)
      .reduce((sum, entry) => sum + parseFloat(entry.hours || 0), 0)
      .toFixed(2);
  };

  const getEntryCount = () => {
    return Object.values(timeEntries)
      .filter(entry => entry.hours && parseFloat(entry.hours) > 0).length;
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppHeader title="Time Entry" />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Time Entry
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Enter your hours for the day. You can edit your timecard until the end of the week (Sunday night).
          </Typography>

        <Divider sx={{ my: 3 }} />

        {/* Date Selector */}
        <Box sx={{ mb: 4 }}>
          <TextField
            label="Work Date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            fullWidth
            sx={{ maxWidth: 300 }}
          />
        </Box>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* General/Misc Work - Always at Top */}
        {!loading && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>General Work:</strong> Use this for shop maintenance, training, errands, or any work not tied to a specific customer job.
            </Alert>
            <Card
              sx={{
                border: '2px solid #2196f3',
                backgroundColor: '#e3f2fd',
              }}
            >
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={7}>
                    <Typography variant="h6" gutterBottom sx={{ color: '#1976d2' }}>
                      General/Miscellaneous Work
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Shop maintenance, training, errands, warehouse work, etc.
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Hours Worked"
                      type="number"
                      fullWidth
                      size="small"
                      value={timeEntries['general']?.hours || ''}
                      onChange={(e) => handleHoursChange('general', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ClockIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        inputProps: {
                          min: 0,
                          max: 24,
                          step: 0.25
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    {timeEntries['general']?.hours && parseFloat(timeEntries['general'].hours) > 0 && (
                      <CheckIcon color="success" sx={{ fontSize: 40 }} />
                    )}
                  </Grid>
                  {timeEntries['general']?.hours && (
                    <Grid item xs={12}>
                      <TextField
                        label="Notes (optional)"
                        fullWidth
                        size="small"
                        multiline
                        rows={2}
                        value={timeEntries['general']?.notes || ''}
                        onChange={(e) => handleNotesChange('general', e.target.value)}
                        placeholder="Describe what you worked on..."
                      />
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Customer Jobs List */}
        {!loading && jobs && (
          <>
            <Divider sx={{ my: 3 }}>
              <Chip label="Customer Jobs" />
            </Divider>
            {renderJobSection('Assigned to You', jobs['Assigned to You'])}
            {renderJobSection('Active Jobs', jobs['Active Jobs'])}
            {renderJobSection('Scheduled Jobs', jobs['Scheduled Jobs'])}
            {renderJobSection('Other Jobs', jobs['Other Jobs'])}

            {Object.values(jobs).flat().length === 0 && (
              <Alert severity="info">
                No customer jobs available for this date.
              </Alert>
            )}
          </>
        )}

        {/* Summary Card */}
        {hasChanges && getEntryCount() > 0 && (
          <Card sx={{ mt: 3, backgroundColor: '#e3f2fd' }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={6}>
                  <Typography variant="h6">
                    Total Hours: {getTotalHours()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getEntryCount()} job{getEntryCount() > 1 ? 's' : ''}
                  </Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Date: {new Date(selectedDate).toLocaleDateString()}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}
      </Paper>

      {/* Floating Submit Button */}
      {hasChanges && getEntryCount() > 0 && (
        <Fab
          color="primary"
          variant="extended"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            px: 3
          }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <CircularProgress size={24} sx={{ mr: 1 }} />
          ) : (
            <SaveIcon sx={{ mr: 1 }} />
          )}
          {submitting ? 'Saving...' : 'Submit Time Entries'}
        </Fab>
      )}

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
      </Container>
    </Box>
  );
}

export default TimeEntry;
