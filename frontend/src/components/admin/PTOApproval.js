import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as DenyIcon,
  BeachAccess as VacationIcon,
  EventBusy as PersonalIcon,
  Help as OtherIcon,
  Sick as SickIcon,
  Warning as WarningIcon,
  Work as WorkIcon,
  Refresh as RefreshIcon,
  CalendarMonth as CalendarIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  getPendingPTORequests,
  approvePTORequest,
  getAllPTORecords,
} from '../../api';
import logger from '../../utils/logger';

// Helper to get the icon and color for availability type
const getTypeConfig = (type) => {
  switch (type) {
    case 'vacation':
      return { icon: <VacationIcon />, color: '#2196f3', label: 'Vacation' };
    case 'personal':
      return { icon: <PersonalIcon />, color: '#9c27b0', label: 'Personal' };
    case 'sick':
      return { icon: <SickIcon />, color: '#f44336', label: 'Sick' };
    default:
      return { icon: <OtherIcon />, color: '#607d8b', label: 'Other' };
  }
};

function PTOApproval() {
  const [activeTab, setActiveTab] = useState(0);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Approval dialog state
  const [approvalDialog, setApprovalDialog] = useState({
    open: false,
    request: null,
    approving: true, // true = approve, false = deny
  });
  const [adminNotes, setAdminNotes] = useState('');
  const [removeFromSchedule, setRemoveFromSchedule] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Result dialog state (shows affected jobs after approval)
  const [resultDialog, setResultDialog] = useState({
    open: false,
    result: null,
  });

  const loadPendingRequests = useCallback(async () => {
    try {
      const data = await getPendingPTORequests();
      setPendingRequests(data.pending_requests || []);
    } catch (error) {
      logger.error('Error loading pending PTO requests:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load pending PTO requests',
        severity: 'error',
      });
    }
  }, []);

  const loadAllRecords = useCallback(async () => {
    try {
      const data = await getAllPTORecords({ include_pending: true });
      setAllRecords(data.pto_records || []);
    } catch (error) {
      logger.error('Error loading PTO records:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load PTO records',
        severity: 'error',
      });
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPendingRequests(), loadAllRecords()]);
    setLoading(false);
  }, [loadPendingRequests, loadAllRecords]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenApprovalDialog = (request, approving) => {
    setApprovalDialog({
      open: true,
      request,
      approving,
    });
    setAdminNotes('');
    setRemoveFromSchedule(true);
  };

  const handleCloseApprovalDialog = () => {
    setApprovalDialog({ open: false, request: null, approving: true });
    setAdminNotes('');
  };

  const handleSubmitApproval = async () => {
    if (!approvalDialog.request) return;

    setProcessing(true);
    try {
      const result = await approvePTORequest(approvalDialog.request.id, {
        approved: approvalDialog.approving,
        admin_notes: adminNotes,
        remove_from_schedule: removeFromSchedule,
      });

      handleCloseApprovalDialog();

      if (result.status === 'approved' && result.affected_jobs?.length > 0) {
        // Show result dialog with affected jobs
        setResultDialog({
          open: true,
          result,
        });
      } else {
        setSnackbar({
          open: true,
          message: `PTO request ${result.status} for ${result.employee_name}`,
          severity: result.status === 'approved' ? 'success' : 'info',
        });
      }

      // Refresh data
      await loadData();
    } catch (error) {
      logger.error('Error processing PTO request:', error);
      setSnackbar({
        open: true,
        message: `Failed to process PTO request: ${error.message}`,
        severity: 'error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab
            label={
              <Badge badgeContent={pendingRequests.length} color="warning">
                Pending Approval
              </Badge>
            }
          />
          <Tab label="All PTO Records" />
        </Tabs>
      </Box>

      {/* Refresh Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          startIcon={<RefreshIcon />}
          onClick={loadData}
          variant="outlined"
          size="small"
        >
          Refresh
        </Button>
      </Box>

      {/* Pending Approval Tab */}
      {activeTab === 0 && (
        <>
          {pendingRequests.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              No pending PTO requests at this time.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell>Employee</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Dates</TableCell>
                    <TableCell>Days</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Conflicts</TableCell>
                    <TableCell>Requested</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingRequests.map((request) => {
                    const typeConfig = getTypeConfig(request.availability_type);
                    return (
                      <TableRow key={request.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonIcon fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight={500}>
                              {request.employee_name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={typeConfig.icon}
                            label={typeConfig.label}
                            size="small"
                            sx={{
                              bgcolor: typeConfig.color,
                              color: 'white',
                              '& .MuiChip-icon': { color: 'white' },
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              {formatDateShort(request.start_date)} - {formatDateShort(request.end_date)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${request.days_requested} day${request.days_requested !== 1 ? 's' : ''}`}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200 }}>
                            {request.reason || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {request.scheduled_jobs_affected > 0 ? (
                            <Chip
                              icon={<WarningIcon />}
                              label={`${request.scheduled_jobs_affected} job${request.scheduled_jobs_affected !== 1 ? 's' : ''}`}
                              size="small"
                              color="warning"
                            />
                          ) : (
                            <Chip label="None" size="small" color="success" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(request.created_at).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Tooltip title="Approve">
                              <IconButton
                                color="success"
                                onClick={() => handleOpenApprovalDialog(request, true)}
                                size="small"
                              >
                                <ApproveIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Deny">
                              <IconButton
                                color="error"
                                onClick={() => handleOpenApprovalDialog(request, false)}
                                size="small"
                              >
                                <DenyIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* All Records Tab */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell>Employee</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Dates</TableCell>
                <TableCell>Days</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Approved By</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      No PTO records found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                allRecords.map((record) => {
                  const typeConfig = getTypeConfig(record.availability_type);
                  return (
                    <TableRow key={record.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {record.employee_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={typeConfig.icon}
                          label={typeConfig.label}
                          size="small"
                          sx={{
                            bgcolor: typeConfig.color,
                            color: 'white',
                            '& .MuiChip-icon': { color: 'white' },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {formatDateShort(record.start_date)} - {formatDateShort(record.end_date)}
                      </TableCell>
                      <TableCell>{record.days_requested}</TableCell>
                      <TableCell>
                        {record.approved ? (
                          <Chip label="Approved" size="small" color="success" />
                        ) : (
                          <Chip label="Pending" size="small" color="warning" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {record.approved_by || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200 }}>
                          {record.notes || record.reason || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Approval/Denial Dialog */}
      <Dialog
        open={approvalDialog.open}
        onClose={handleCloseApprovalDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            bgcolor: approvalDialog.approving ? '#e8f5e9' : '#ffebee',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {approvalDialog.approving ? (
            <ApproveIcon color="success" />
          ) : (
            <DenyIcon color="error" />
          )}
          {approvalDialog.approving ? 'Approve' : 'Deny'} PTO Request
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {approvalDialog.request && (
            <Box>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {approvalDialog.request.employee_name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {formatDate(approvalDialog.request.start_date)} to{' '}
                    {formatDate(approvalDialog.request.end_date)}
                  </Typography>
                  <Chip
                    label={`${approvalDialog.request.days_requested} day${approvalDialog.request.days_requested !== 1 ? 's' : ''}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
                {approvalDialog.request.reason && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Reason: {approvalDialog.request.reason}
                  </Typography>
                )}
              </Paper>

              {approvalDialog.approving && approvalDialog.request.scheduled_jobs_affected > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  This employee has {approvalDialog.request.scheduled_jobs_affected} scheduled job(s)
                  during this period. They will be removed from these jobs if approved.
                </Alert>
              )}

              {approvalDialog.approving && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={removeFromSchedule}
                      onChange={(e) => setRemoveFromSchedule(e.target.checked)}
                      color="warning"
                    />
                  }
                  label="Remove from scheduled jobs"
                  sx={{ mb: 2 }}
                />
              )}

              <TextField
                label={approvalDialog.approving ? 'Admin Notes (Optional)' : 'Reason for Denial'}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                multiline
                rows={2}
                fullWidth
                placeholder={
                  approvalDialog.approving
                    ? 'Optional notes about this approval...'
                    : 'Please provide a reason for denying this request...'
                }
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseApprovalDialog} disabled={processing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={approvalDialog.approving ? 'success' : 'error'}
            onClick={handleSubmitApproval}
            disabled={processing}
            startIcon={
              processing ? (
                <CircularProgress size={16} color="inherit" />
              ) : approvalDialog.approving ? (
                <ApproveIcon />
              ) : (
                <DenyIcon />
              )
            }
          >
            {processing
              ? 'Processing...'
              : approvalDialog.approving
              ? 'Approve'
              : 'Deny'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Result Dialog - Shows affected jobs after approval */}
      <Dialog
        open={resultDialog.open}
        onClose={() => setResultDialog({ open: false, result: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#e8f5e9' }}>
          PTO Approved - Schedule Updated
        </DialogTitle>
        <DialogContent>
          {resultDialog.result && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography>
                  <strong>{resultDialog.result.employee_name}</strong>'s PTO has been approved
                  from {formatDate(resultDialog.result.start_date)} to{' '}
                  {formatDate(resultDialog.result.end_date)}.
                </Typography>
              </Alert>

              {resultDialog.result.affected_jobs?.length > 0 && (
                <>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                    Affected Jobs ({resultDialog.result.total_affected_jobs})
                  </Typography>

                  {resultDialog.result.jobs_needing_reassignment > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      {resultDialog.result.jobs_needing_reassignment} job(s) now have no crew
                      assigned and need reassignment!
                    </Alert>
                  )}

                  <List dense sx={{ bgcolor: '#f5f5f5', borderRadius: 1 }}>
                    {resultDialog.result.affected_jobs.map((job, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <Divider />}
                        <ListItem
                          sx={{
                            bgcolor: job.needs_reassignment ? '#ffebee' : 'transparent',
                          }}
                        >
                          <ListItemIcon>
                            {job.needs_reassignment ? (
                              <WarningIcon color="error" />
                            ) : (
                              <WorkIcon color="primary" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography fontWeight={500}>
                                  {job.work_order_number}
                                </Typography>
                                <Chip
                                  label={job.priority}
                                  size="small"
                                  color={job.priority === 'high' ? 'error' : 'default'}
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                                {job.was_lead && (
                                  <Chip
                                    label="Was Lead"
                                    size="small"
                                    color="warning"
                                    sx={{ height: 18, fontSize: '0.65rem' }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {job.customer_name} - {formatDate(job.scheduled_date)}
                                </Typography>
                                {job.needs_reassignment ? (
                                  <Typography variant="caption" color="error" fontWeight={500}>
                                    No crew remaining - needs reassignment!
                                  </Typography>
                                ) : job.new_lead_assigned ? (
                                  <Typography variant="caption" color="success.main">
                                    {job.new_lead_assigned} promoted to lead
                                  </Typography>
                                ) : null}
                              </Box>
                            }
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setResultDialog({ open: false, result: null })}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default PTOApproval;
