import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  Divider,
  Badge,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ShoppingCart as CartIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  LocalShipping as ShippingIcon,
  Inventory as InventoryIcon,
  Work as WorkIcon,
  AllInbox as AllIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
} from '@mui/icons-material';
import AppHeader from './AppHeader';
import { API_BASE_URL } from '../api';
import logger from '../utils/logger';

function OrderPlanning() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Data
  const [planningData, setPlanningData] = useState(null);
  const [vendors, setVendors] = useState([]);

  // Filters
  const [mode, setMode] = useState('combined');
  const [daysAhead, setDaysAhead] = useState(30);
  const [includeRestock, setIncludeRestock] = useState(true);
  const [vendorFilter, setVendorFilter] = useState('');

  // Selection for PO creation
  const [selectedItems, setSelectedItems] = useState({});
  const [expandedVendors, setExpandedVendors] = useState({});

  // Create PO dialog
  const [createPODialogOpen, setCreatePODialogOpen] = useState(false);
  const [selectedVendorForPO, setSelectedVendorForPO] = useState(null);
  const [poNotes, setPONotes] = useState('');
  const [creatingPO, setCreatingPO] = useState(false);

  const fetchPlanningData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    try {
      const params = new URLSearchParams({
        mode,
        days_ahead: daysAhead.toString(),
        include_restock: includeRestock.toString(),
      });
      if (vendorFilter) params.append('vendor_id', vendorFilter);

      const response = await fetch(
        `${API_BASE_URL}/inventory/order-planning?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setPlanningData(data);

        // Expand vendors with critical/urgent items by default
        const expanded = {};
        data.by_vendor?.forEach((vendor, index) => {
          if (vendor.has_critical || vendor.has_urgent) {
            expanded[vendor.vendor_id || `no-vendor-${index}`] = true;
          }
        });
        setExpandedVendors(expanded);
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Failed to load order planning data');
      }
    } catch (err) {
      setError('Error loading order planning data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [mode, daysAhead, includeRestock, vendorFilter]);

  const fetchVendors = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/vendors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || data || []);
      }
    } catch (err) {
      logger.error('Error fetching vendors:', err);
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchPlanningData();
  }, [fetchPlanningData]);

  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setMode(newMode);
      setSelectedItems({});
    }
  };

  const toggleVendorExpand = (vendorId) => {
    setExpandedVendors(prev => ({
      ...prev,
      [vendorId]: !prev[vendorId]
    }));
  };

  const toggleItemSelection = (inventoryId, vendorId) => {
    setSelectedItems(prev => {
      const key = `${vendorId}-${inventoryId}`;
      if (prev[key]) {
        const { [key]: _, ...rest } = prev;
        return rest;
      } else {
        return { ...prev, [key]: true };
      }
    });
  };

  const selectAllVendorItems = (vendor) => {
    const vendorKey = vendor.vendor_id || 'no-vendor';
    const allSelected = vendor.items.every(item =>
      selectedItems[`${vendorKey}-${item.inventory_id}`]
    );

    setSelectedItems(prev => {
      const newSelection = { ...prev };
      vendor.items.forEach(item => {
        const key = `${vendorKey}-${item.inventory_id}`;
        if (allSelected) {
          delete newSelection[key];
        } else {
          newSelection[key] = true;
        }
      });
      return newSelection;
    });
  };

  const getSelectedItemsForVendor = (vendor) => {
    const vendorKey = vendor.vendor_id || 'no-vendor';
    return vendor.items.filter(item =>
      selectedItems[`${vendorKey}-${item.inventory_id}`]
    );
  };

  const openCreatePODialog = (vendor) => {
    const selected = getSelectedItemsForVendor(vendor);
    if (selected.length === 0) {
      setError('Please select at least one item to create a PO');
      return;
    }
    setSelectedVendorForPO({ ...vendor, selectedItems: selected });
    setPONotes('');
    setCreatePODialogOpen(true);
  };

  const handleCreatePO = async () => {
    if (!selectedVendorForPO || !selectedVendorForPO.vendor_id) {
      setError('Cannot create PO: No vendor assigned to these items');
      return;
    }

    setCreatingPO(true);
    const token = localStorage.getItem('token');

    try {
      const items = selectedVendorForPO.selectedItems.map(item => ({
        inventory_id: item.inventory_id,
        quantity_ordered: item.order_qty,
        unit_cost: item.cost,
      }));

      const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendor_id: selectedVendorForPO.vendor_id,
          notes: poNotes,
          items,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(`Purchase Order ${data.po_number} created successfully!`);
        setCreatePODialogOpen(false);
        setSelectedVendorForPO(null);

        // Clear selected items for this vendor
        const vendorKey = selectedVendorForPO.vendor_id || 'no-vendor';
        setSelectedItems(prev => {
          const newSelection = { ...prev };
          Object.keys(newSelection).forEach(key => {
            if (key.startsWith(`${vendorKey}-`)) {
              delete newSelection[key];
            }
          });
          return newSelection;
        });

        fetchPlanningData();
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Failed to create purchase order');
      }
    } catch (err) {
      setError('Error creating purchase order: ' + err.message);
    } finally {
      setCreatingPO(false);
    }
  };

  const getUrgencyChip = (urgency) => {
    switch (urgency) {
      case 'critical':
        return <Chip label="Critical" color="error" size="small" icon={<ErrorIcon />} />;
      case 'urgent':
        return <Chip label="Urgent" color="warning" size="small" icon={<WarningIcon />} />;
      default:
        return <Chip label="Warning" color="info" size="small" />;
    }
  };

  const getSourceChip = (source) => {
    switch (source) {
      case 'job_materials':
        return <Chip label="Job Need" size="small" color="primary" variant="outlined" />;
      case 'low_stock':
        return <Chip label="Low Stock" size="small" color="secondary" variant="outlined" />;
      case 'both':
        return <Chip label="Both" size="small" color="success" variant="outlined" />;
      default:
        return null;
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader />
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            <CartIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
            Order Planning
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchPlanningData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

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

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>
                Order Mode
              </Typography>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={handleModeChange}
                size="small"
                fullWidth
              >
                <ToggleButton value="combined">
                  <Tooltip title="Show both job materials and low stock items">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AllIcon fontSize="small" />
                      Combined
                    </Box>
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="job_materials">
                  <Tooltip title="Only items needed for scheduled jobs">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <WorkIcon fontSize="small" />
                      Jobs Only
                    </Box>
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="low_stock">
                  <Tooltip title="Only items at/below reorder point">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <InventoryIcon fontSize="small" />
                      Low Stock
                    </Box>
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>

            <Grid item xs={6} md={2}>
              <TextField
                label="Days Ahead"
                type="number"
                value={daysAhead}
                onChange={(e) => setDaysAhead(Math.max(1, parseInt(e.target.value) || 30))}
                size="small"
                fullWidth
                inputProps={{ min: 1, max: 365 }}
              />
            </Grid>

            <Grid item xs={6} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Vendor</InputLabel>
                <Select
                  value={vendorFilter}
                  label="Vendor"
                  onChange={(e) => setVendorFilter(e.target.value)}
                >
                  <MenuItem value="">All Vendors</MenuItem>
                  {vendors.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.vendor_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeRestock}
                    onChange={(e) => setIncludeRestock(e.target.checked)}
                  />
                }
                label={
                  <Tooltip title="When ordering for jobs, also include quantity to restock to target level">
                    <span>Smart Restock (order to target level)</span>
                  </Tooltip>
                }
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Summary Cards */}
        {planningData?.summary && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="primary">
                    {planningData.summary.total_items}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Items
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ bgcolor: 'error.dark' }}>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="white">
                    {planningData.summary.critical_count}
                  </Typography>
                  <Typography variant="body2" color="rgba(255,255,255,0.7)">
                    Critical
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ bgcolor: 'warning.dark' }}>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="white">
                    {planningData.summary.urgent_count}
                  </Typography>
                  <Typography variant="body2" color="rgba(255,255,255,0.7)">
                    Urgent
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="primary">
                    {planningData.summary.vendors_affected}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Vendors
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h5" color="primary">
                    {planningData.summary.total_order_qty}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Qty
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h5" color="success.main">
                    {formatCurrency(planningData.summary.total_estimated_cost)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Est. Cost
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Mode Info */}
        {mode === 'combined' && planningData?.summary && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Showing {planningData.summary.job_material_items} items needed for jobs and{' '}
            {planningData.summary.low_stock_items} low stock items
            {planningData.summary.combined_items > 0 && (
              <> ({planningData.summary.combined_items} items appear in both categories)</>
            )}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : planningData?.by_vendor?.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <CheckIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h6">No items need ordering!</Typography>
            <Typography color="textSecondary">
              All inventory levels are adequate for the selected timeframe.
            </Typography>
          </Paper>
        ) : (
          /* Vendor Groups */
          planningData?.by_vendor?.map((vendor, vendorIndex) => {
            const vendorKey = vendor.vendor_id || `no-vendor-${vendorIndex}`;
            const isExpanded = expandedVendors[vendorKey];
            const selectedCount = getSelectedItemsForVendor(vendor).length;
            const allSelected = vendor.items.length > 0 &&
              vendor.items.every(item => selectedItems[`${vendorKey}-${item.inventory_id}`]);

            return (
              <Paper key={vendorKey} sx={{ mb: 2 }}>
                {/* Vendor Header */}
                <Box
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: vendor.has_critical ? 'error.dark' : vendor.has_urgent ? 'warning.dark' : 'primary.dark',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleVendorExpand(vendorKey)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton size="small" sx={{ color: 'white' }}>
                      {isExpanded ? <ArrowUpIcon /> : <ArrowDownIcon />}
                    </IconButton>
                    <ShippingIcon />
                    <Box>
                      <Typography variant="h6">
                        {vendor.vendor_name}
                      </Typography>
                      {vendor.vendor_email && (
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>
                          {vendor.vendor_email}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2">
                        {vendor.total_items} items | {formatCurrency(vendor.total_estimated_cost)}
                      </Typography>
                      {(vendor.has_critical || vendor.has_urgent) && (
                        <Typography variant="caption">
                          {vendor.items.filter(i => i.urgency === 'critical').length > 0 &&
                            `${vendor.items.filter(i => i.urgency === 'critical').length} critical`}
                          {vendor.items.filter(i => i.urgency === 'critical').length > 0 &&
                           vendor.items.filter(i => i.urgency === 'urgent').length > 0 && ' | '}
                          {vendor.items.filter(i => i.urgency === 'urgent').length > 0 &&
                            `${vendor.items.filter(i => i.urgency === 'urgent').length} urgent`}
                        </Typography>
                      )}
                    </Box>
                    {vendor.vendor_id && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<CartIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreatePODialog(vendor);
                        }}
                        disabled={selectedCount === 0}
                      >
                        Create PO ({selectedCount})
                      </Button>
                    )}
                  </Box>
                </Box>

                {/* Vendor Items */}
                <Collapse in={isExpanded}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={allSelected}
                              indeterminate={selectedCount > 0 && !allSelected}
                              onChange={() => selectAllVendorItems(vendor)}
                              disabled={!vendor.vendor_id}
                            />
                          </TableCell>
                          <TableCell>Item</TableCell>
                          <TableCell>Source</TableCell>
                          <TableCell>Urgency</TableCell>
                          <TableCell align="right">Current</TableCell>
                          <TableCell align="right">Available</TableCell>
                          <TableCell align="right">Needed (Job)</TableCell>
                          <TableCell align="right">Min / Max</TableCell>
                          <TableCell align="right">Order Qty</TableCell>
                          <TableCell align="right">Est. Cost</TableCell>
                          <TableCell>Order By</TableCell>
                          <TableCell>Jobs</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {vendor.items.map((item) => (
                          <TableRow
                            key={item.inventory_id}
                            hover
                            sx={{
                              bgcolor: item.urgency === 'critical' ? 'error.lighter' :
                                       item.urgency === 'urgent' ? 'warning.lighter' : 'inherit'
                            }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={!!selectedItems[`${vendorKey}-${item.inventory_id}`]}
                                onChange={() => toggleItemSelection(item.inventory_id, vendorKey)}
                                disabled={!vendor.vendor_id}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {item.item_id}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" display="block">
                                {item.description}
                              </Typography>
                              {item.brand && (
                                <Typography variant="caption" color="textSecondary">
                                  {item.brand}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>{getSourceChip(item.source)}</TableCell>
                            <TableCell>{getUrgencyChip(item.urgency)}</TableCell>
                            <TableCell align="right">{item.current_stock}</TableCell>
                            <TableCell align="right">
                              <Typography
                                color={item.qty_available <= 0 ? 'error.main' :
                                       item.qty_available <= item.min_stock ? 'warning.main' : 'inherit'}
                                fontWeight={item.qty_available <= item.min_stock ? 'bold' : 'normal'}
                              >
                                {item.qty_available}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {item.job_qty_needed > 0 ? (
                                <Typography color={item.job_shortage > 0 ? 'error.main' : 'inherit'}>
                                  {item.job_qty_needed}
                                  {item.job_shortage > 0 && ` (short ${item.job_shortage})`}
                                </Typography>
                              ) : '-'}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {item.min_stock} / {item.max_stock || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold" color="primary.main">
                                {item.order_qty}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(item.estimated_cost)}
                            </TableCell>
                            <TableCell>
                              {item.order_by_date ? (
                                <Typography
                                  variant="body2"
                                  color={new Date(item.order_by_date) <= new Date() ? 'error.main' : 'inherit'}
                                >
                                  {new Date(item.order_by_date).toLocaleDateString()}
                                </Typography>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {item.affected_jobs?.length > 0 ? (
                                <Tooltip title={item.affected_jobs.join(', ')}>
                                  <Chip
                                    label={`${item.job_count} job${item.job_count > 1 ? 's' : ''}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                </Tooltip>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Paper>
            );
          })
        )}

        {/* Create PO Dialog */}
        <Dialog
          open={createPODialogOpen}
          onClose={() => setCreatePODialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Create Purchase Order
            {selectedVendorForPO && (
              <Typography variant="subtitle1" color="textSecondary">
                Vendor: {selectedVendorForPO.vendor_name}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {selectedVendorForPO && (
              <>
                <TableContainer sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Cost</TableCell>
                        <TableCell align="right">Line Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedVendorForPO.selectedItems.map((item) => (
                        <TableRow key={item.inventory_id}>
                          <TableCell>
                            <Typography variant="body2">{item.item_id}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {item.description}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{item.order_qty}</TableCell>
                          <TableCell align="right">{formatCurrency(item.cost)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.estimated_cost)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} align="right">
                          <strong>Total:</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>
                            {formatCurrency(
                              selectedVendorForPO.selectedItems.reduce(
                                (sum, item) => sum + item.estimated_cost, 0
                              )
                            )}
                          </strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                <TextField
                  label="Notes"
                  multiline
                  rows={3}
                  fullWidth
                  value={poNotes}
                  onChange={(e) => setPONotes(e.target.value)}
                  sx={{ mt: 2 }}
                  placeholder="Optional notes for this purchase order..."
                />
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreatePODialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleCreatePO}
              disabled={creatingPO}
              startIcon={creatingPO ? <CircularProgress size={20} /> : <CartIcon />}
            >
              {creatingPO ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}

export default OrderPlanning;
