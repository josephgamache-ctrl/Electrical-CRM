import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Person as PersonIcon,
  SupervisorAccount as ManagerIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Engineering as TechnicianIcon,
} from '@mui/icons-material';
import {
  getManagers,
  getWorkers,
  getManagerWorkers,
  bulkAssignWorkersToManager,
  removeWorkerFromManager,
} from '../../api';
import AppHeader from '../AppHeader';

function ManagerWorkerAssignments() {
  const [managers, setManagers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedManager, setSelectedManager] = useState(null);
  const [managerWorkers, setManagerWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedWorkerUsernames, setSelectedWorkerUsernames] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [managersData, workersData] = await Promise.all([
        getManagers(),
        getWorkers(),
      ]);
      setManagers(managersData);
      setWorkers(workersData);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadManagerWorkers = async (managerUsername) => {
    setLoadingWorkers(true);
    try {
      const data = await getManagerWorkers(managerUsername);
      setManagerWorkers(data);
    } catch (err) {
      setError('Failed to load assigned workers: ' + err.message);
      setManagerWorkers([]);
    } finally {
      setLoadingWorkers(false);
    }
  };

  const handleSelectManager = async (manager) => {
    setSelectedManager(manager);
    await loadManagerWorkers(manager.username);
  };

  const handleOpenEditDialog = () => {
    // Pre-select current assigned workers
    setSelectedWorkerUsernames(managerWorkers.map(w => w.worker_username));
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedWorkerUsernames([]);
  };

  const handleToggleWorker = (workerUsername) => {
    setSelectedWorkerUsernames(prev => {
      if (prev.includes(workerUsername)) {
        return prev.filter(u => u !== workerUsername);
      } else {
        return [...prev, workerUsername];
      }
    });
  };

  const handleSaveAssignments = async () => {
    if (!selectedManager) return;

    setSaving(true);
    setError(null);
    try {
      await bulkAssignWorkersToManager(selectedManager.username, selectedWorkerUsernames);
      setSuccess(`Workers assigned to ${selectedManager.full_name} successfully`);
      handleCloseEditDialog();
      await loadManagerWorkers(selectedManager.username);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save assignments: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveWorker = async (assignmentId, workerName) => {
    if (!window.confirm(`Remove ${workerName} from ${selectedManager.full_name}?`)) {
      return;
    }
    try {
      await removeWorkerFromManager(assignmentId);
      setSuccess(`${workerName} removed from ${selectedManager.full_name}`);
      await loadManagerWorkers(selectedManager.username);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to remove worker: ' + err.message);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'technician': return '#1976d2';
      case 'employee': return '#388e3c';
      case 'office': return '#f57c00';
      default: return '#757575';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Manager Assignments" />
      <Box sx={{ p: 3 }}>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {managers.length === 0 ? (
        <Alert severity="info">
          No managers found. Create users with the "manager" role first.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {/* Managers List */}
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ManagerIcon color="primary" />
                Managers
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                {managers.map((manager) => (
                  <ListItem
                    key={manager.username}
                    button
                    selected={selectedManager?.username === manager.username}
                    onClick={() => handleSelectManager(manager)}
                    sx={{
                      borderRadius: 1,
                      mb: 1,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.light',
                        '&:hover': {
                          backgroundColor: 'primary.light',
                        },
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'secondary.dark' }}>
                        {manager.full_name?.charAt(0) || manager.username.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={manager.full_name || manager.username}
                      secondary={manager.email}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Assigned Workers */}
          <Grid item xs={12} md={8}>
            {selectedManager ? (
              <Paper elevation={2} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Workers Assigned to {selectedManager.full_name}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenEditDialog}
                  >
                    Edit Assignments
                  </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />

                {loadingWorkers ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : managerWorkers.length === 0 ? (
                  <Alert severity="info">
                    No workers assigned to this manager yet. Click "Edit Assignments" to add workers.
                  </Alert>
                ) : (
                  <Grid container spacing={2}>
                    {managerWorkers.map((worker) => (
                      <Grid item xs={12} sm={6} key={worker.worker_username}>
                        <Card variant="outlined">
                          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: getRoleColor(worker.worker_role) }}>
                              <TechnicianIcon />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                                {worker.worker_name}
                              </Typography>
                              <Chip
                                label={worker.worker_role}
                                size="small"
                                sx={{
                                  bgcolor: getRoleColor(worker.worker_role),
                                  color: 'white',
                                  fontSize: '0.7rem',
                                }}
                              />
                              {worker.phone && (
                                <Typography variant="body2" color="text.secondary">
                                  {worker.phone}
                                </Typography>
                              )}
                            </Box>
                            <Tooltip title="Remove from manager">
                              <IconButton
                                color="error"
                                onClick={() => handleRemoveWorker(worker.id, worker.worker_name)}
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Paper>
            ) : (
              <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
                <ManagerIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Select a manager to view and edit their assigned workers
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      {/* Edit Assignments Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Workers to {selectedManager?.full_name}
        </DialogTitle>
        <DialogContent dividers>
          {workers.length === 0 ? (
            <Alert severity="info">
              No workers available. Create users with technician, employee, or office roles first.
            </Alert>
          ) : (
            <List>
              {workers.map((worker) => (
                <ListItem key={worker.username} dense>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedWorkerUsernames.includes(worker.username)}
                        onChange={() => handleToggleWorker(worker.username)}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: getRoleColor(worker.role) }}>
                          {worker.full_name?.charAt(0) || worker.username.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body1">
                            {worker.full_name || worker.username}
                          </Typography>
                          <Chip
                            label={worker.role}
                            size="small"
                            sx={{
                              bgcolor: getRoleColor(worker.role),
                              color: 'white',
                              fontSize: '0.65rem',
                              height: 18,
                            }}
                          />
                        </Box>
                      </Box>
                    }
                    sx={{ width: '100%' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} startIcon={<CloseIcon />}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveAssignments}
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Assignments'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}

export default ManagerWorkerAssignments;
