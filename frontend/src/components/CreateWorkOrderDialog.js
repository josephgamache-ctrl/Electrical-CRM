import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { fetchCustomers, createWorkOrder, createCustomer, API_BASE_URL } from '../api';
import AddMaterialDialog from './AddMaterialDialog';
import logger from '../utils/logger';
function CreateWorkOrderDialog({ open, onClose, onCreated }) {
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [addMaterialDialogOpen, setAddMaterialDialogOpen] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    first_name: '',
    last_name: '',
    phone_primary: '',
    email: '',
    service_street: '',
    service_city: '',
    service_state: 'MA',
    service_zip: '',
  });
  const [formData, setFormData] = useState({
    customer_id: '',
    job_type: 'Service Call',
    job_description: '',
    scope_of_work: '',
    scheduled_date: '',
    scheduled_start_time: '08:00',
    estimated_duration_hours: 2,
    assigned_to: '',
    priority: 'normal',
    quoted_labor_hours: 0,
    quoted_labor_rate: 95,
  });

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadEmployees();
    }
  }, [open]);

  const loadEmployees = async () => {
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
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await fetchCustomers();
      setCustomers(data.customers || []);
    } catch (err) {
      logger.error('Error loading customers:', err);
      setError('Failed to load customers');
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-calculate labor cost
    if (field === 'quoted_labor_hours' || field === 'quoted_labor_rate') {
      const hours = field === 'quoted_labor_hours' ? value : formData.quoted_labor_hours;
      const rate = field === 'quoted_labor_rate' ? value : formData.quoted_labor_rate;
      const materialCost = materials.reduce((sum, m) => sum + (m.quantity_needed * m.unit_price), 0);
      setFormData(prev => ({
        ...prev,
        quoted_labor_cost: hours * rate,
        quoted_material_cost: materialCost,
        quoted_subtotal: hours * rate + materialCost
      }));
    }
  };

  const handleAddMaterial = (material) => {
    setMaterials(prev => [...prev, material]);
    // Update material cost
    const materialCost = [...materials, material].reduce((sum, m) => sum + (m.quantity_needed * m.unit_price), 0);
    const laborCost = formData.quoted_labor_hours * formData.quoted_labor_rate;
    setFormData(prev => ({
      ...prev,
      quoted_material_cost: materialCost,
      quoted_subtotal: laborCost + materialCost
    }));
  };

  const handleRemoveMaterial = (index) => {
    const newMaterials = materials.filter((_, i) => i !== index);
    setMaterials(newMaterials);
    // Update material cost
    const materialCost = newMaterials.reduce((sum, m) => sum + (m.quantity_needed * m.unit_price), 0);
    const laborCost = formData.quoted_labor_hours * formData.quoted_labor_rate;
    setFormData(prev => ({
      ...prev,
      quoted_material_cost: materialCost,
      quoted_subtotal: laborCost + materialCost
    }));
  };

  const handleCreateCustomer = async () => {
    try {
      setLoading(true);
      const result = await createCustomer(newCustomer);
      // Add new customer to list and select it
      setCustomers(prev => [...prev, result.customer]);
      setFormData(prev => ({ ...prev, customer_id: result.customer_id }));
      // Reset form
      setNewCustomer({
        first_name: '',
        last_name: '',
        phone_primary: '',
        email: '',
        service_street: '',
        service_city: '',
        service_state: 'MA',
        service_zip: '',
      });
      setShowNewCustomerForm(false);
      setError(null);
    } catch (err) {
      logger.error('Error creating customer:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get selected customer info
      const customer = customers.find(c => c.id === formData.customer_id);
      if (!customer) {
        setError('Please select a customer');
        return;
      }

      const materialCost = materials.reduce((sum, m) => sum + (m.quantity_needed * m.unit_price), 0);
      const laborCost = formData.quoted_labor_hours * formData.quoted_labor_rate;

      const workOrderData = {
        ...formData,
        service_address: `${customer.service_street}, ${customer.service_city}, ${customer.service_state} ${customer.service_zip}`,
        quoted_labor_cost: laborCost,
        quoted_material_cost: materialCost,
        quoted_subtotal: laborCost + materialCost,
        materials: materials,
      };

      const result = await createWorkOrder(workOrderData);
      onCreated(result);
      handleClose();
    } catch (err) {
      logger.error('Error creating work order:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      customer_id: '',
      job_type: 'Service Call',
      job_description: '',
      scope_of_work: '',
      scheduled_date: '',
      scheduled_start_time: '08:00',
      estimated_duration_hours: 2,
      assigned_to: '',
      priority: 'normal',
      quoted_labor_hours: 0,
      quoted_labor_rate: 95,
    });
    setMaterials([]);
    setError(null);
    onClose();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Work Order</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          {!showNewCustomerForm ? (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Customer"
                  value={formData.customer_id}
                  onChange={(e) => handleChange('customer_id', e.target.value)}
                  required
                >
                  <MenuItem value="">Select Customer</MenuItem>
                  {customers.map((customer) => (
                    <MenuItem key={customer.id} value={customer.id}>
                      {customer.first_name} {customer.last_name}
                      {customer.company_name ? ` (${customer.company_name})` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<AddIcon />}
                  onClick={() => setShowNewCustomerForm(true)}
                  sx={{ height: '56px' }}
                >
                  New Customer
                </Button>
              </Grid>
            </>
          ) : (
            <>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">New Customer</Typography>
                  <Button size="small" onClick={() => setShowNewCustomerForm(false)}>
                    Cancel
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={newCustomer.first_name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={newCustomer.last_name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Company Name"
                  value={newCustomer.company_name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, company_name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={newCustomer.phone_primary}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, phone_primary: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Street Address"
                  value={newCustomer.service_street}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, service_street: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="City"
                  value={newCustomer.service_city}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, service_city: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="State"
                  value={newCustomer.service_state}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, service_state: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="ZIP Code"
                  value={newCustomer.service_zip}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, service_zip: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleCreateCustomer}
                  fullWidth
                >
                  Save Customer & Continue
                </Button>
              </Grid>
            </>
          )}

          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Job Type"
              value={formData.job_type}
              onChange={(e) => handleChange('job_type', e.target.value)}
            >
              <MenuItem value="Service Call">Service Call</MenuItem>
              <MenuItem value="Panel Upgrade">Panel Upgrade</MenuItem>
              <MenuItem value="New Construction">New Construction</MenuItem>
              <MenuItem value="Repair">Repair</MenuItem>
              <MenuItem value="Maintenance">Maintenance</MenuItem>
              <MenuItem value="Installation">Installation</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Job Description"
              value={formData.job_description}
              onChange={(e) => handleChange('job_description', e.target.value)}
              required
              multiline
              rows={2}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Scope of Work (Optional)"
              value={formData.scope_of_work}
              onChange={(e) => handleChange('scope_of_work', e.target.value)}
              multiline
              rows={3}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="Scheduled Date"
              value={formData.scheduled_date}
              onChange={(e) => handleChange('scheduled_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="time"
              label="Start Time"
              value={formData.scheduled_start_time}
              onChange={(e) => handleChange('scheduled_start_time', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Est. Duration (hours)"
              value={formData.estimated_duration_hours}
              onChange={(e) => handleChange('estimated_duration_hours', parseFloat(e.target.value))}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Priority"
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Assign To"
              value={formData.assigned_to}
              onChange={(e) => handleChange('assigned_to', e.target.value)}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
              {employees.map((emp) => (
                <MenuItem key={emp.username} value={emp.username}>
                  {emp.full_name || emp.username}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Labor Hours"
              value={formData.quoted_labor_hours}
              onChange={(e) => handleChange('quoted_labor_hours', parseFloat(e.target.value))}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Labor Rate ($/hr)"
              value={formData.quoted_labor_rate}
              onChange={(e) => handleChange('quoted_labor_rate', parseFloat(e.target.value))}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Labor Cost"
              value={(formData.quoted_labor_hours * formData.quoted_labor_rate).toFixed(2)}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          {/* Materials Section */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Materials ({materials.length} items)
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setAddMaterialDialogOpen(true)}
                size="small"
              >
                Add Material
              </Button>
            </Box>

            {materials.length > 0 ? (
              <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                {materials.map((material, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton edge="end" onClick={() => handleRemoveMaterial(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {material.item_id}
                          </Typography>
                          <Typography variant="body2">
                            {material.brand} - {material.description}
                          </Typography>
                          <Chip
                            label={`Qty: ${material.quantity_needed}`}
                            size="small"
                            color="primary"
                          />
                          <Chip
                            label={`${material.available_qty} available`}
                            size="small"
                            color={material.available_qty >= material.quantity_needed ? 'success' : 'warning'}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          Unit: {formatCurrency(material.unit_price)} |
                          Total: {formatCurrency(material.quantity_needed * material.unit_price)}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No materials added yet. Click "Add Material" to add items to this work order.
              </Typography>
            )}

            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Material Cost</Typography>
                  <Typography variant="h6">
                    {formatCurrency(materials.reduce((sum, m) => sum + (m.quantity_needed * m.unit_price), 0))}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Labor Cost</Typography>
                  <Typography variant="h6">
                    {formatCurrency(formData.quoted_labor_hours * formData.quoted_labor_rate)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Total Quote</Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(
                      (formData.quoted_labor_hours * formData.quoted_labor_rate) +
                      materials.reduce((sum, m) => sum + (m.quantity_needed * m.unit_price), 0)
                    )}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>
        </Grid>

        <AddMaterialDialog
          open={addMaterialDialogOpen}
          onClose={() => setAddMaterialDialogOpen(false)}
          onAdd={handleAddMaterial}
          workOrderId={null}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !formData.customer_id || !formData.job_description}
        >
          {loading ? <CircularProgress size={24} /> : 'Create Work Order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreateWorkOrderDialog;
