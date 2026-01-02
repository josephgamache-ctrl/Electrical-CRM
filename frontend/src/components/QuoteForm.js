import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, Grid, Divider, TextField,
  FormControl, InputLabel, Select, MenuItem, Autocomplete,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, CardHeader, CircularProgress, Alert, Stepper, Step,
  StepLabel, Checkbox, FormControlLabel, InputAdornment, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Switch
} from '@mui/material';
import {
  ArrowBack as BackIcon, Save as SaveIcon, Add as AddIcon,
  Delete as DeleteIcon, Search as SearchIcon, Inventory as InventoryIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { getCurrentUser, API_BASE_URL } from '../api';
import AppHeader from './AppHeader';
import logger from '../utils/logger';

const jobTypes = [
  { value: 'service_call', label: 'Service Call' },
  { value: 'panel_upgrade', label: 'Panel Upgrade' },
  { value: 'new_construction', label: 'New Construction' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'ev_charger', label: 'EV Charger Installation' },
  { value: 'generator', label: 'Generator Installation' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' }
];

const itemTypes = [
  { value: 'labor', label: 'Labor' },
  { value: 'material', label: 'Material' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' }
];

function QuoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [activeStep, setActiveStep] = useState(0);

  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    job_description: '',
    scope_of_work: '',
    service_address: '',
    service_city: '',
    service_state: 'MA',
    service_zip: '',
    job_type: 'service_call',
    valid_until: '',
    estimated_start_date: '',
    estimated_duration_days: '',
    discount_percent: 0,
    tax_rate: 0.0625,
    internal_notes: '',
    terms_and_conditions: ''
  });

  const [lineItems, setLineItems] = useState([]);
  const [itemDialog, setItemDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState({
    item_type: 'material',
    inventory_id: null,
    description: '',
    quantity: 1,
    unit: 'Each',
    unit_cost: 0,
    unit_price: 0,
    tier_basic: true,
    tier_standard: true,
    tier_premium: true,
    notes: ''
  });

  const fetchCustomers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || data);
      }
    } catch (err) {
      logger.error('Failed to fetch customers:', err);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setInventory(data.inventory || data);
      }
    } catch (err) {
      logger.error('Failed to fetch inventory:', err);
    }
  }, []);

  const fetchQuote = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/quotes/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch quote');
      const data = await response.json();
      setFormData({
        customer_id: data.customer_id || '',
        title: data.title || '',
        job_description: data.job_description || '',
        scope_of_work: data.scope_of_work || '',
        service_address: data.service_address || '',
        service_city: data.service_city || '',
        service_state: data.service_state || 'MA',
        service_zip: data.service_zip || '',
        job_type: data.job_type || 'service_call',
        valid_until: data.valid_until ? data.valid_until.split('T')[0] : '',
        estimated_start_date: data.estimated_start_date ? data.estimated_start_date.split('T')[0] : '',
        estimated_duration_days: data.estimated_duration_days || '',
        discount_percent: data.discount_percent || 0,
        tax_rate: data.tax_rate || 0.0625,
        internal_notes: data.internal_notes || '',
        terms_and_conditions: data.terms_and_conditions || ''
      });
      setLineItems(data.line_items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomers();
    fetchInventory();
    if (isEditing) {
      fetchQuote();
    }
  }, [fetchCustomers, fetchInventory, fetchQuote, isEditing]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomerChange = (customerId) => {
    handleChange('customer_id', customerId);
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      handleChange('service_address', customer.service_street || '');
      handleChange('service_city', customer.service_city || '');
      handleChange('service_state', customer.service_state || 'MA');
      handleChange('service_zip', customer.service_zip || '');
    }
  };

  const handleAddItem = () => {
    setCurrentItem({
      item_type: 'material',
      inventory_id: null,
      description: '',
      quantity: 1,
      unit: 'Each',
      unit_cost: 0,
      unit_price: 0,
      tier_basic: true,
      tier_standard: true,
      tier_premium: true,
      notes: ''
    });
    setItemDialog(true);
  };

  const handleSaveItem = () => {
    if (!currentItem.description) {
      alert('Please enter a description');
      return;
    }
    const newItem = {
      ...currentItem,
      line_total: currentItem.quantity * currentItem.unit_price,
      id: currentItem.id || `temp-${Date.now()}`
    };

    if (currentItem.id && !String(currentItem.id).startsWith('temp-')) {
      // Editing existing item - update via API
      saveLineItem(currentItem.id, newItem);
    } else if (currentItem.id) {
      // Editing temp item
      setLineItems(prev => prev.map(item =>
        item.id === currentItem.id ? newItem : item
      ));
    } else {
      // New item
      setLineItems(prev => [...prev, newItem]);
    }
    setItemDialog(false);
  };

  const saveLineItem = async (itemId, itemData) => {
    if (!id) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${id}/line-items/${itemId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(itemData)
        }
      );
      if (!response.ok) throw new Error('Failed to update item');
      fetchQuote();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this item?')) return;

    if (id && !String(itemId).startsWith('temp-')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${API_BASE_URL}/quotes/${id}/line-items/${itemId}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        if (!response.ok) throw new Error('Failed to delete item');
        fetchQuote();
      } catch (err) {
        setError(err.message);
      }
    } else {
      setLineItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const handleInventorySelect = (item) => {
    if (item) {
      setCurrentItem(prev => ({
        ...prev,
        inventory_id: item.id,
        description: item.description || '',
        unit_cost: parseFloat(item.cost) || 0,
        unit_price: parseFloat(item.sell_price) || 0
      }));
    }
  };

  const handleSaveQuote = async () => {
    if (!formData.customer_id || !formData.title) {
      setError('Please fill in required fields (Customer, Title)');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      // Create or update quote
      const quoteResponse = await fetch(
        `${API_BASE_URL}/quotes${id ? `/${id}` : ''}`,
        {
          method: id ? 'PATCH' : 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      );

      if (!quoteResponse.ok) {
        const data = await quoteResponse.json();
        throw new Error(data.detail || 'Failed to save quote');
      }

      const quoteData = await quoteResponse.json();
      const quoteId = quoteData.id;

      // Add new line items (those with temp IDs)
      for (const item of lineItems.filter(i => String(i.id).startsWith('temp-'))) {
        const itemData = { ...item };
        delete itemData.id;
        delete itemData.line_total;

        const itemResponse = await fetch(
          `${API_BASE_URL}/quotes/${quoteId}/line-items`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(itemData)
          }
        );
        if (!itemResponse.ok) {
          logger.error('Failed to add item:', await itemResponse.text());
        }
      }

      navigate(`/quotes/${quoteId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Calculate tier totals
  const calculateTierTotal = (tierKey) => {
    const tierField = `tier_${tierKey}`;
    const items = lineItems.filter(i => i[tierField]);
    const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
    const discount = subtotal * (formData.discount_percent / 100);
    const taxable = subtotal - discount;
    const tax = taxable * formData.tax_rate;
    return {
      subtotal,
      discount,
      tax,
      total: taxable + tax
    };
  };

  const steps = ['Quote Details', 'Line Items', 'Review'];

  if (loading) {
    return (
      <Box>
        <AppHeader title={isEditing ? 'Edit Quote' : 'New Quote'} showSearch={false} />
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <AppHeader title={isEditing ? 'Edit Quote' : 'New Quote'} showSearch={false}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSaveQuote}
          disabled={saving}
          sx={{ bgcolor: 'white', color: '#1e3a5f', '&:hover': { bgcolor: '#e0e0e0' } }}
        >
          {saving ? 'Saving...' : 'Save Quote'}
        </Button>
      </AppHeader>
      <Box sx={{ p: 3 }}>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      {activeStep === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Customer & Job Info" />
              <CardContent>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Customer *</InputLabel>
                  <Select
                    value={formData.customer_id}
                    label="Customer *"
                    onChange={(e) => handleCustomerChange(e.target.value)}
                  >
                    {customers.map(c => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.company_name || `${c.first_name} ${c.last_name}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  required
                  label="Quote Title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  sx={{ mb: 2 }}
                />

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Job Type</InputLabel>
                  <Select
                    value={formData.job_type}
                    label="Job Type"
                    onChange={(e) => handleChange('job_type', e.target.value)}
                  >
                    {jobTypes.map(jt => (
                      <MenuItem key={jt.value} value={jt.value}>{jt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Job Description"
                  value={formData.job_description}
                  onChange={(e) => handleChange('job_description', e.target.value)}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Scope of Work"
                  value={formData.scope_of_work}
                  onChange={(e) => handleChange('scope_of_work', e.target.value)}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ mb: 2 }}>
              <CardHeader title="Service Location" />
              <CardContent>
                <TextField
                  fullWidth
                  label="Street Address"
                  value={formData.service_address}
                  onChange={(e) => handleChange('service_address', e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="City"
                      value={formData.service_city}
                      onChange={(e) => handleChange('service_city', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      label="State"
                      value={formData.service_state}
                      onChange={(e) => handleChange('service_state', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      label="ZIP"
                      value={formData.service_zip}
                      onChange={(e) => handleChange('service_zip', e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Dates & Pricing" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Valid Until"
                      value={formData.valid_until}
                      onChange={(e) => handleChange('valid_until', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Est. Start Date"
                      value={formData.estimated_start_date}
                      onChange={(e) => handleChange('estimated_start_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Est. Duration (days)"
                      value={formData.estimated_duration_days}
                      onChange={(e) => handleChange('estimated_duration_days', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Discount %"
                      value={formData.discount_percent}
                      onChange={(e) => handleChange('discount_percent', parseFloat(e.target.value) || 0)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeStep === 1 && (
        <>
        {/* Quick Add Section */}
        <Card sx={{ mb: 2 }}>
          <CardHeader title="Quick Add" />
          <CardContent>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Click to quickly add common items:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const newItem = {
                    item_type: 'labor',
                    description: 'Labor - Electrician',
                    quantity: 4,
                    unit: 'Hours',
                    unit_cost: 35,
                    unit_price: 100,
                    tier_basic: true,
                    tier_standard: true,
                    tier_premium: true,
                    id: `temp-${Date.now()}`
                  };
                  setLineItems(prev => [...prev, newItem]);
                }}
              >
                + 4 hrs Labor
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const newItem = {
                    item_type: 'labor',
                    description: 'Labor - Electrician',
                    quantity: 8,
                    unit: 'Hours',
                    unit_cost: 35,
                    unit_price: 100,
                    tier_basic: true,
                    tier_standard: true,
                    tier_premium: true,
                    id: `temp-${Date.now()}`
                  };
                  setLineItems(prev => [...prev, newItem]);
                }}
              >
                + 8 hrs Labor
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const newItem = {
                    item_type: 'service',
                    description: 'Permit and Inspection',
                    quantity: 1,
                    unit: 'Each',
                    unit_cost: 150,
                    unit_price: 175,
                    tier_basic: true,
                    tier_standard: true,
                    tier_premium: true,
                    id: `temp-${Date.now()}`
                  };
                  setLineItems(prev => [...prev, newItem]);
                }}
              >
                + Permit/Inspection
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const newItem = {
                    item_type: 'labor',
                    description: 'Service Call - Diagnostic',
                    quantity: 1,
                    unit: 'Each',
                    unit_cost: 35,
                    unit_price: 125,
                    tier_basic: true,
                    tier_standard: true,
                    tier_premium: true,
                    id: `temp-${Date.now()}`
                  };
                  setLineItems(prev => [...prev, newItem]);
                }}
              >
                + Service Call
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const newItem = {
                    item_type: 'material',
                    description: 'Wire and Supplies',
                    quantity: 1,
                    unit: 'Lot',
                    unit_cost: 50,
                    unit_price: 62.50,
                    tier_basic: true,
                    tier_standard: true,
                    tier_premium: true,
                    id: `temp-${Date.now()}`
                  };
                  setLineItems(prev => [...prev, newItem]);
                }}
              >
                + Misc Supplies
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Line Items"
            action={
              <Button startIcon={<AddIcon />} onClick={handleAddItem}>
                Add Item
              </Button>
            }
          />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Good</TableCell>
                  <TableCell align="center">Better</TableCell>
                  <TableCell align="center">Best</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lineItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">
                        No items yet. Click "Add Item" to start.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.item_type}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                      <TableCell align="center">
                        <Checkbox checked={item.tier_basic} disabled size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Checkbox checked={item.tier_standard} disabled size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Checkbox checked={item.tier_premium} disabled size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => { setCurrentItem(item); setItemDialog(true); }}
                        >
                          <SearchIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
        </>
      )}

      {activeStep === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardHeader title="Quote Summary" />
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {formData.title}
                </Typography>
                <Typography color="textSecondary" gutterBottom>
                  {(() => {
                    const customer = customers.find(c => c.id === formData.customer_id);
                    if (!customer) return 'Unknown Customer';
                    return customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown Customer';
                  })()}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  {lineItems.length} line items
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardHeader title="Pricing Tiers" />
              <CardContent>
                {['basic', 'standard', 'premium'].map(tier => {
                  const totals = calculateTierTotal(tier);
                  return (
                    <Box key={tier} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                        {tier === 'basic' ? 'Good' : tier === 'standard' ? 'Better' : 'Best'}
                      </Typography>
                      <Typography variant="h5">{formatCurrency(totals.total)}</Typography>
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          disabled={activeStep === 0}
          onClick={() => setActiveStep(prev => prev - 1)}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            if (activeStep === steps.length - 1) {
              handleSaveQuote();
            } else {
              setActiveStep(prev => prev + 1);
            }
          }}
        >
          {activeStep === steps.length - 1 ? 'Save Quote' : 'Next'}
        </Button>
      </Box>

      {/* Add/Edit Item Dialog */}
      <Dialog open={itemDialog} onClose={() => setItemDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{currentItem.id ? 'Edit Item' : 'Add Item'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Item Type</InputLabel>
            <Select
              value={currentItem.item_type}
              label="Item Type"
              onChange={(e) => setCurrentItem({ ...currentItem, item_type: e.target.value })}
            >
              {itemTypes.map(it => (
                <MenuItem key={it.value} value={it.value}>{it.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {currentItem.item_type === 'material' && (
            <Autocomplete
              options={inventory}
              getOptionLabel={(option) => `${option.item_id} - ${option.description}`}
              renderInput={(params) => (
                <TextField {...params} label="Search Inventory" sx={{ mb: 2 }} />
              )}
              onChange={(e, value) => handleInventorySelect(value)}
            />
          )}

          <TextField
            fullWidth
            required
            label="Description"
            value={currentItem.description}
            onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
            sx={{ mb: 2 }}
          />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Quantity"
                value={currentItem.quantity}
                onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseFloat(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Unit"
                value={currentItem.unit}
                onChange={(e) => setCurrentItem({ ...currentItem, unit: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Unit Price"
                value={currentItem.unit_price}
                onChange={(e) => setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) || 0 })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>
          </Grid>

          <Typography variant="subtitle2" gutterBottom>Include in Tiers:</Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={currentItem.tier_basic}
                  onChange={(e) => setCurrentItem({ ...currentItem, tier_basic: e.target.checked })}
                />
              }
              label="Good"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={currentItem.tier_standard}
                  onChange={(e) => setCurrentItem({ ...currentItem, tier_standard: e.target.checked })}
                />
              }
              label="Better"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={currentItem.tier_premium}
                  onChange={(e) => setCurrentItem({ ...currentItem, tier_premium: e.target.checked })}
                />
              }
              label="Best"
            />
          </Box>

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Notes (Optional)"
            value={currentItem.notes}
            onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })}
          />

          <Typography variant="body2" sx={{ mt: 2 }}>
            Line Total: <strong>{formatCurrency(currentItem.quantity * currentItem.unit_price)}</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveItem}>
            {currentItem.id ? 'Update' : 'Add Item'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}

export default QuoteForm;
