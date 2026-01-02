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
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  Snackbar,
  Tooltip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import AppHeader from './AppHeader';
import ConfirmDialog from './common/ConfirmDialog';
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api';

const EMPTY_CUSTOMER = {
  first_name: '',
  last_name: '',
  company_name: '',
  customer_type: 'residential',
  phone_primary: '',
  phone_secondary: '',
  email: '',
  preferred_contact: 'phone',
  service_street: '',
  service_city: '',
  service_state: 'MA',
  service_zip: '',
  service_notes: '',
  billing_same_as_service: true,
  billing_street: '',
  billing_city: '',
  billing_state: '',
  billing_zip: '',
  payment_terms: 'due_on_receipt',
  active: true,
};

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState(EMPTY_CUSTOMER);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, customer: null });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers();
      setCustomers(data.customers || []);
    } catch (err) {
      setError('Error loading customers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (customer = null) => {
    if (customer) {
      setEditMode(true);
      setSelectedCustomer(customer);
      setFormData({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        company_name: customer.company_name || '',
        customer_type: customer.customer_type || 'residential',
        phone_primary: customer.phone_primary || '',
        phone_secondary: customer.phone_secondary || '',
        email: customer.email || '',
        preferred_contact: customer.preferred_contact || 'phone',
        service_street: customer.service_street || '',
        service_city: customer.service_city || '',
        service_state: customer.service_state || 'MA',
        service_zip: customer.service_zip || '',
        service_notes: customer.service_notes || '',
        billing_same_as_service: customer.billing_same_as_service !== false,
        billing_street: customer.billing_street || '',
        billing_city: customer.billing_city || '',
        billing_state: customer.billing_state || '',
        billing_zip: customer.billing_zip || '',
        payment_terms: customer.payment_terms || 'due_on_receipt',
        active: customer.active !== false,
      });
    } else {
      setEditMode(false);
      setSelectedCustomer(null);
      setFormData(EMPTY_CUSTOMER);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditMode(false);
    setSelectedCustomer(null);
    setFormData(EMPTY_CUSTOMER);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editMode) {
        await updateCustomer(selectedCustomer.id, formData);
        showSnackbar('Customer updated successfully', 'success');
      } else {
        await createCustomer(formData);
        showSnackbar('Customer created successfully', 'success');
      }
      handleCloseDialog();
      loadCustomers();
    } catch (err) {
      showSnackbar(err.message || 'Failed to save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (customer) => {
    setDeleteDialog({ open: true, customer });
  };

  const handleDeleteConfirm = async () => {
    const customer = deleteDialog.customer;
    setDeleteDialog({ open: false, customer: null });

    try {
      await deleteCustomer(customer.id);
      showSnackbar('Customer deleted successfully', 'success');
      loadCustomers();
    } catch (err) {
      showSnackbar(err.message || 'Failed to delete customer', 'error');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, customer: null });
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        <AppHeader title="Customers" />
        <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppHeader title="Customers" />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Customers
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {customers.length} total customers
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Customer
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Customer #</strong></TableCell>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell><strong>Phone</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Service Address</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} hover>
                    <TableCell>{customer.customer_number}</TableCell>
                    <TableCell>
                      {customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={customer.customer_type || 'N/A'}
                        size="small"
                        color={customer.customer_type === 'commercial' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{customer.phone_primary || 'N/A'}</TableCell>
                    <TableCell>{customer.email || 'N/A'}</TableCell>
                    <TableCell>
                      {customer.service_street ? (
                        <>
                          {customer.service_street}
                          {customer.service_city && `, ${customer.service_city}`}
                          {customer.service_state && `, ${customer.service_state}`}
                          {customer.service_zip && ` ${customer.service_zip}`}
                        </>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenDialog(customer)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(customer)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {customers.length === 0 && !error && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No customers found. Click "Add Customer" to get started.
              </Typography>
            </Box>
          )}
        </Paper>
      </Container>

      {/* Edit/Add Customer Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editMode ? `Edit Customer: ${selectedCustomer?.customer_number}` : 'Add New Customer'}
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
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Company Name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Customer Type"
                  name="customer_type"
                  value={formData.customer_type}
                  onChange={handleInputChange}
                >
                  <MenuItem value="residential">Residential</MenuItem>
                  <MenuItem value="commercial">Commercial</MenuItem>
                  <MenuItem value="industrial">Industrial</MenuItem>
                </TextField>
              </Grid>

              {/* Contact Info */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Contact Information
                </Typography>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Primary Phone"
                  name="phone_primary"
                  value={formData.phone_primary}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Secondary Phone"
                  name="phone_secondary"
                  value={formData.phone_secondary}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  fullWidth
                  label="Preferred Contact"
                  name="preferred_contact"
                  value={formData.preferred_contact}
                  onChange={handleInputChange}
                >
                  <MenuItem value="phone">Phone</MenuItem>
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="text">Text</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </Grid>

              {/* Service Address */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Service Address
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Street Address"
                  name="service_street"
                  value={formData.service_street}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="City"
                  name="service_city"
                  value={formData.service_city}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="State"
                  name="service_state"
                  value={formData.service_state}
                  onChange={handleInputChange}
                  inputProps={{ maxLength: 2 }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="ZIP Code"
                  name="service_zip"
                  value={formData.service_zip}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Service Notes"
                  name="service_notes"
                  value={formData.service_notes}
                  onChange={handleInputChange}
                  multiline
                  rows={2}
                  placeholder="Gate code, parking instructions, etc."
                />
              </Grid>

              {/* Billing */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Billing Information
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.billing_same_as_service}
                      onChange={handleInputChange}
                      name="billing_same_as_service"
                    />
                  }
                  label="Billing address same as service address"
                />
              </Grid>

              {!formData.billing_same_as_service && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Billing Street"
                      name="billing_street"
                      value={formData.billing_street}
                      onChange={handleInputChange}
                    />
                  </Grid>

                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      label="Billing City"
                      name="billing_city"
                      value={formData.billing_city}
                      onChange={handleInputChange}
                    />
                  </Grid>

                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Billing State"
                      name="billing_state"
                      value={formData.billing_state}
                      onChange={handleInputChange}
                      inputProps={{ maxLength: 2 }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Billing ZIP"
                      name="billing_zip"
                      value={formData.billing_zip}
                      onChange={handleInputChange}
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Payment Terms"
                  name="payment_terms"
                  value={formData.payment_terms}
                  onChange={handleInputChange}
                >
                  <MenuItem value="due_on_receipt">Due on Receipt</MenuItem>
                  <MenuItem value="net_15">Net 15</MenuItem>
                  <MenuItem value="net_30">Net 30</MenuItem>
                  <MenuItem value="net_45">Net 45</MenuItem>
                  <MenuItem value="net_60">Net 60</MenuItem>
                </TextField>
              </Grid>

              {editMode && (
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.active}
                        onChange={handleInputChange}
                        name="active"
                      />
                    }
                    label="Active Customer"
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || !formData.first_name || !formData.last_name || !formData.phone_primary}
          >
            {saving ? <CircularProgress size={24} /> : (editMode ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer"
        message={deleteDialog.customer ? `Are you sure you want to delete ${deleteDialog.customer.first_name} ${deleteDialog.customer.last_name}?` : ''}
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

export default Customers;
