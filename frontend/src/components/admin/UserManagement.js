import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Snackbar,
  Grid,
  Switch,
  FormControlLabel,
  Tooltip,
  AppBar,
  Toolbar,
  Card,
  CardContent,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Home as HomeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Work as WorkIcon,
  AttachMoney as MoneyIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../api';
import AppHeader from '../AppHeader';
import ConfirmDialog from '../common/ConfirmDialog';
import logger from '../../utils/logger';

function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, username: null });
  const [activeTab, setActiveTab] = useState(0);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'technician',
    hourly_rate: '0.00',
    overtime_rate: '0.00',
    is_licensed: false,
    license_number: '',
    license_state: '',
    license_expiration: '',
    hire_date: '',
    employment_type: 'full-time',
    active: true,
    can_create_quotes: false,
    can_close_jobs: false,
    address: '',
    city: '',
    state: '',
    zip: '',
    ssn_last_4: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Handle both array and { users: [...] } response formats
        const usersArray = Array.isArray(data) ? data : (data.users || []);
        setUsers(usersArray);
      } else {
        showSnackbar('Failed to load users', 'error');
      }
    } catch (err) {
      logger.error('Error loading users:', err);
      showSnackbar('Error loading users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditMode(true);
      setSelectedUser(user);
      setFormData({
        username: user.username || '',
        password: '', // Don't populate password
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || 'technician',
        hourly_rate: user.hourly_rate || '0.00',
        overtime_rate: user.overtime_rate || '0.00',
        is_licensed: user.is_licensed || false,
        license_number: user.license_number || '',
        license_state: user.license_state || '',
        license_expiration: user.license_expiration || '',
        hire_date: user.hire_date || '',
        employment_type: user.employment_type || 'full-time',
        active: user.active !== false,
        can_create_quotes: user.can_create_quotes || false,
        can_close_jobs: user.can_close_jobs || false,
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        zip: user.zip || '',
        ssn_last_4: user.ssn_last_4 || '',
        emergency_contact_name: user.emergency_contact_name || '',
        emergency_contact_phone: user.emergency_contact_phone || '',
      });
    } else {
      setEditMode(false);
      setSelectedUser(null);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        email: '',
        phone: '',
        role: 'technician',
        hourly_rate: '0.00',
        overtime_rate: '0.00',
        is_licensed: false,
        license_number: '',
        license_state: '',
        license_expiration: '',
        hire_date: '',
        employment_type: 'full-time',
        active: true,
        can_create_quotes: false,
        can_close_jobs: false,
        address: '',
        city: '',
        state: '',
        zip: '',
        ssn_last_4: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditMode(false);
    setSelectedUser(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');

      // Validation
      if (!formData.username || !formData.full_name) {
        showSnackbar('Username and Full Name are required', 'error');
        return;
      }

      if (!editMode && !formData.password) {
        showSnackbar('Password is required for new users', 'error');
        return;
      }

      const url = editMode
        ? `${API_BASE_URL}/admin/users/${formData.username}`
        : `${API_BASE_URL}/admin/users`;

      const method = editMode ? 'PUT' : 'POST';

      // Parse numeric values properly
      const hourlyRate = parseFloat(formData.hourly_rate) || 0;
      const overtimeRate = parseFloat(formData.overtime_rate) || (hourlyRate * 1.5);

      // Build payload with proper types
      const payload = {
        full_name: formData.full_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        role: formData.role || 'technician',
        hourly_rate: hourlyRate,
        overtime_rate: overtimeRate,
        is_licensed: Boolean(formData.is_licensed),
        license_number: formData.license_number || null,
        license_state: formData.license_state || null,
        license_expiration: formData.license_expiration || null,
        hire_date: formData.hire_date || null,
        employment_type: formData.employment_type || 'full-time',
        active: Boolean(formData.active),
        can_create_quotes: Boolean(formData.can_create_quotes),
        can_close_jobs: Boolean(formData.can_close_jobs),
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip: formData.zip || null,
        ssn_last_4: formData.ssn_last_4 || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
      };

      // Add username only for new users (POST)
      if (!editMode) {
        payload.username = formData.username;
      }

      // Add password only if provided
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showSnackbar(`User ${editMode ? 'updated' : 'created'} successfully`, 'success');
        handleCloseDialog();
        loadUsers();
      } else {
        const error = await response.json();
        // Handle Pydantic validation errors (detail is an array) vs simple errors (detail is a string)
        let errorMessage = 'Failed to save user';
        if (error.detail) {
          if (typeof error.detail === 'string') {
            errorMessage = error.detail;
          } else if (Array.isArray(error.detail)) {
            // Pydantic returns array of {loc, msg, type} objects
            errorMessage = error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
          } else {
            errorMessage = JSON.stringify(error.detail);
          }
        }
        showSnackbar(errorMessage, 'error');
      }
    } catch (err) {
      logger.error('Error saving user:', err);
      showSnackbar('Error saving user', 'error');
    }
  };

  const handleDeleteClick = (username) => {
    setDeleteDialog({ open: true, username });
  };

  const handleDeleteConfirm = async () => {
    const username = deleteDialog.username;
    setDeleteDialog({ open: false, username: null });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/users/${username}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        showSnackbar('User deleted successfully', 'success');
        loadUsers();
      } else {
        showSnackbar('Failed to delete user', 'error');
      }
    } catch (err) {
      logger.error('Error deleting user:', err);
      showSnackbar('Error deleting user', 'error');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, username: null });
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'error',
      manager: 'warning',
      office: 'info',
      technician: 'success',
    };
    return colors[role] || 'default';
  };

  const isLicenseExpiring = (expirationDate) => {
    if (!expirationDate) return false;
    const expDate = new Date(expirationDate);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isLicenseExpired = (expirationDate) => {
    if (!expirationDate) return false;
    const expDate = new Date(expirationDate);
    const today = new Date();
    return expDate < today;
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const activeUsers = users.filter((u) => u.active !== false);
  const inactiveUsers = users.filter((u) => u.active === false);
  const displayUsers = activeTab === 0 ? activeUsers : inactiveUsers;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', pb: 8 }}>
      <AppHeader title="User Management">
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/manager-workers')}
          sx={{ mr: 1, color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
        >
          Manager Assignments
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
        >
          Add User
        </Button>
      </AppHeader>

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Active Users
                    </Typography>
                    <Typography variant="h4">{activeUsers.length}</Typography>
                  </Box>
                  <WorkIcon sx={{ fontSize: 48, color: '#1976d2', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Licensed
                    </Typography>
                    <Typography variant="h4">
                      {activeUsers.filter((u) => u.is_licensed).length}
                    </Typography>
                  </Box>
                  <BadgeIcon sx={{ fontSize: 48, color: '#2e7d32', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Avg Hourly Rate
                    </Typography>
                    <Typography variant="h4">
                      {formatCurrency(
                        activeUsers.reduce((sum, u) => sum + parseFloat(u.hourly_rate || 0), 0) /
                          (activeUsers.length || 1)
                      )}
                    </Typography>
                  </Box>
                  <MoneyIcon sx={{ fontSize: 48, color: '#ff6b00', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Expiring Licenses
                    </Typography>
                    <Typography variant="h4">
                      {activeUsers.filter((u) => isLicenseExpiring(u.license_expiration)).length}
                    </Typography>
                  </Box>
                  <WarningIcon sx={{ fontSize: 48, color: '#ed6c02', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* User List */}
        <Paper sx={{ p: 3 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
            <Tab label={`Active Users (${activeUsers.length})`} />
            <Tab label={`Inactive Users (${inactiveUsers.length})`} />
          </Tabs>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Username</strong></TableCell>
                  <TableCell><strong>Full Name</strong></TableCell>
                  <TableCell><strong>Role</strong></TableCell>
                  <TableCell><strong>Licensed</strong></TableCell>
                  <TableCell><strong>License Expiry</strong></TableCell>
                  <TableCell><strong>Hourly Rate</strong></TableCell>
                  <TableCell><strong>Employment</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No users found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayUsers.map((user) => (
                    <TableRow key={user.username} hover>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.full_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role}
                          color={getRoleColor(user.role)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {user.is_licensed ? (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label={user.license_state || 'Yes'}
                            color="success"
                            size="small"
                          />
                        ) : (
                          <Chip label="No" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        {user.license_expiration ? (
                          <Box>
                            <Typography variant="body2">
                              {new Date(user.license_expiration).toLocaleDateString()}
                            </Typography>
                            {isLicenseExpired(user.license_expiration) && (
                              <Chip label="Expired" color="error" size="small" />
                            )}
                            {isLicenseExpiring(user.license_expiration) && !isLicenseExpired(user.license_expiration) && (
                              <Chip label="Expiring Soon" color="warning" size="small" />
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(user.hourly_rate)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.employment_type || 'full-time'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenDialog(user)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(user.username)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>

      {/* Edit/Add User Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editMode ? `Edit User: ${selectedUser?.username}` : 'Add New User'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              {/* Basic Info */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Basic Information
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  disabled={editMode}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editMode}
                  helperText={editMode ? 'Leave blank to keep current password' : ''}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Full Name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    label="Role"
                  >
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="manager">Manager</MenuItem>
                    <MenuItem value="office">Office</MenuItem>
                    <MenuItem value="technician">Technician</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </Grid>

              {/* Employment Info */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Employment Information
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Hire Date"
                  name="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={handleInputChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Employment Type</InputLabel>
                  <Select
                    name="employment_type"
                    value={formData.employment_type}
                    onChange={handleInputChange}
                    label="Employment Type"
                  >
                    <MenuItem value="full-time">Full-Time</MenuItem>
                    <MenuItem value="part-time">Part-Time</MenuItem>
                    <MenuItem value="contract">Contract</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Hourly Rate"
                  name="hourly_rate"
                  type="number"
                  value={formData.hourly_rate}
                  onChange={handleInputChange}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Overtime Rate"
                  name="overtime_rate"
                  type="number"
                  value={formData.overtime_rate}
                  onChange={handleInputChange}
                  inputProps={{ step: '0.01', min: '0' }}
                  helperText="Defaults to 1.5x hourly"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="SSN Last 4"
                  name="ssn_last_4"
                  value={formData.ssn_last_4}
                  onChange={handleInputChange}
                  inputProps={{ maxLength: 4 }}
                />
              </Grid>

              {/* License Info */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  License Information
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_licensed}
                      onChange={handleInputChange}
                      name="is_licensed"
                    />
                  }
                  label="Licensed Electrician"
                />
              </Grid>

              {formData.is_licensed && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="License Number"
                      name="license_number"
                      value={formData.license_number}
                      onChange={handleInputChange}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="License State"
                      name="license_state"
                      value={formData.license_state}
                      onChange={handleInputChange}
                      inputProps={{ maxLength: 2 }}
                      helperText="2-letter state code (e.g., IL)"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="License Expiration"
                      name="license_expiration"
                      type="date"
                      value={formData.license_expiration}
                      onChange={handleInputChange}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </>
              )}

              {/* Address Info */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Address Information
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="State"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  inputProps={{ maxLength: 2 }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="ZIP"
                  name="zip"
                  value={formData.zip}
                  onChange={handleInputChange}
                />
              </Grid>

              {/* Emergency Contact */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Emergency Contact
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contact Name"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contact Phone"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleInputChange}
                />
              </Grid>

              {/* Permissions */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Permissions & Status
                </Typography>
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.active}
                      onChange={handleInputChange}
                      name="active"
                    />
                  }
                  label="Active"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.can_create_quotes}
                      onChange={handleInputChange}
                      name="can_create_quotes"
                    />
                  }
                  label="Can Create Quotes"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.can_close_jobs}
                      onChange={handleInputChange}
                      name="can_close_jobs"
                    />
                  }
                  label="Can Close Jobs"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message={deleteDialog.username ? `Are you sure you want to delete user "${deleteDialog.username}"? This cannot be undone.` : ''}
        confirmText="Delete"
        confirmColor="error"
        severity="warning"
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default UserManagement;
