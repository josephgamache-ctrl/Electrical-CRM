import React, { useState, useEffect } from 'react';
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
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import ConfirmDialog from './common/ConfirmDialog';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  ShoppingCart as CartIcon,
  Cancel as CancelIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import AppHeader from './AppHeader';
import { API_BASE_URL } from '../api';
import logger from '../utils/logger';
function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function PurchaseOrders() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, poId: null });

  // Data
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [inventory, setInventory] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');

  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);

  // Create PO form
  const [newPO, setNewPO] = useState({
    vendor_id: '',
    notes: '',
    items: [],
  });
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnitCost, setItemUnitCost] = useState('');

  // Receive items
  const [receiveItems, setReceiveItems] = useState([]);

  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      // Only update state if component is still mounted
      if (isMounted) {
        await Promise.all([fetchData(), fetchVendors(), fetchInventory()]);
      }
    };
    
    loadInitialData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    try {
      let url = `${API_BASE_URL}/purchase-orders`;
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (vendorFilter) params.append('vendor_id', vendorFilter);
      if (params.toString()) url += `?${params}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPurchaseOrders(data.purchase_orders || []);
      } else {
        setError('Failed to load purchase orders');
      }
    } catch (err) {
      setError('Error loading purchase orders: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/vendors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (err) {
      logger.error('Error fetching vendors:', err);
    }
  };

  const fetchInventory = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setInventory(data.items || []);
      }
    } catch (err) {
      logger.error('Error fetching inventory:', err);
    }
  };

  const fetchPODetails = async (poId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/purchase-orders/${poId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedPO(data);
        return data;
      }
    } catch (err) {
      setError('Error fetching PO details: ' + err.message);
    }
    return null;
  };

  const handleViewPO = async (po) => {
    await fetchPODetails(po.id);
    setViewDialogOpen(true);
  };

  const handleUpdateStatus = async (poId, newStatus) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setSuccess(`PO status updated to ${newStatus}`);
        fetchData();
        if (selectedPO) fetchPODetails(poId);
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Failed to update status');
      }
    } catch (err) {
      setError('Error updating status: ' + err.message);
    }
  };

  const handleDeletePO = (poId) => {
    setDeleteDialog({ open: true, poId });
  };

  const handleConfirmDeletePO = async () => {
    const poId = deleteDialog.poId;
    setDeleteDialog({ open: false, poId: null });

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/purchase-orders/${poId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setSuccess('Purchase order deleted');
        fetchData();
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Failed to delete PO');
      }
    } catch (err) {
      setError('Error deleting PO: ' + err.message);
    }
  };

  const handleAddItemToNewPO = () => {
    if (!selectedInventoryId || !itemQuantity || !itemUnitCost) {
      setError('Please select an item, quantity, and cost');
      return;
    }

    const item = inventory.find((i) => i.id === parseInt(selectedInventoryId));
    if (!item) return;

    setNewPO((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          inventory_id: item.id,
          item_id: item.item_id,
          description: item.description,
          quantity_ordered: parseInt(itemQuantity),
          unit_cost: parseFloat(itemUnitCost),
        },
      ],
    }));

    setSelectedInventoryId('');
    setItemQuantity(1);
    setItemUnitCost('');
  };

  const handleRemoveItemFromNewPO = (index) => {
    setNewPO((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleCreatePO = async () => {
    if (!newPO.vendor_id || newPO.items.length === 0) {
      setError('Please select a vendor and add at least one item');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendor_id: parseInt(newPO.vendor_id),
          notes: newPO.notes,
          items: newPO.items.map((i) => ({
            inventory_id: i.inventory_id,
            quantity_ordered: i.quantity_ordered,
            unit_cost: i.unit_cost,
          })),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Created PO ${result.po_number}`);
        setCreateDialogOpen(false);
        setNewPO({ vendor_id: '', notes: '', items: [] });
        fetchData();
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Failed to create PO');
      }
    } catch (err) {
      setError('Error creating PO: ' + err.message);
    }
  };

  const handleOpenReceiveDialog = async (po) => {
    const details = await fetchPODetails(po.id);
    if (details && details.items) {
      setReceiveItems(
        details.items.map((item) => ({
          purchase_order_item_id: item.id,
          item_id: item.item_id,
          description: item.description,
          quantity_ordered: item.quantity_ordered,
          quantity_received: item.quantity_received || 0,
          quantity_to_receive: 0,
        }))
      );
      setReceiveDialogOpen(true);
    }
  };

  const handleReceiveItems = async () => {
    const itemsToReceive = receiveItems.filter((i) => i.quantity_to_receive > 0);
    if (itemsToReceive.length === 0) {
      setError('Enter quantities to receive');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/purchase-orders/${selectedPO.id}/receive`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToReceive.map((i) => ({
            purchase_order_item_id: i.purchase_order_item_id,
            quantity_received: i.quantity_to_receive,
          })),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Items received. PO status: ${result.po_status}`);
        setReceiveDialogOpen(false);
        fetchData();
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Failed to receive items');
      }
    } catch (err) {
      setError('Error receiving items: ' + err.message);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'pending_approval':
        return 'warning';
      case 'approved':
        return 'info';
      case 'ordered':
        return 'primary';
      case 'partial':
        return 'secondary';
      case 'received':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft':
        return <EditIcon fontSize="small" />;
      case 'pending_approval':
        return <ScheduleIcon fontSize="small" />;
      case 'approved':
        return <CheckIcon fontSize="small" />;
      case 'ordered':
        return <ShippingIcon fontSize="small" />;
      case 'partial':
        return <CartIcon fontSize="small" />;
      case 'received':
        return <CheckIcon fontSize="small" />;
      case 'cancelled':
        return <CancelIcon fontSize="small" />;
      default:
        return null;
    }
  };

  // Summary calculations
  const draftCount = purchaseOrders.filter((po) => po.status === 'draft').length;
  const pendingCount = purchaseOrders.filter((po) => po.status === 'pending_approval').length;
  const orderedCount = purchaseOrders.filter((po) => ['ordered', 'partial'].includes(po.status)).length;
  const receivedCount = purchaseOrders.filter((po) => po.status === 'received').length;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Purchase Orders" />

      <Container maxWidth="xl" sx={{ py: 3 }}>
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

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EditIcon color="action" />
                  <Typography variant="h4">{draftCount}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Drafts
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: pendingCount > 0 ? 'warning.light' : 'inherit' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ScheduleIcon color="warning" />
                  <Typography variant="h4">{pendingCount}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Pending Approval
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: orderedCount > 0 ? 'info.light' : 'inherit' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShippingIcon color="primary" />
                  <Typography variant="h4">{orderedCount}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  On Order
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: 'success.light' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckIcon color="success" />
                  <Typography variant="h4">{receivedCount}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Received
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Actions Bar */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
              Create PO
            </Button>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="pending_approval">Pending Approval</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="ordered">Ordered</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="received">Received</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Vendor</InputLabel>
              <Select value={vendorFilter} label="Vendor" onChange={(e) => setVendorFilter(e.target.value)}>
                <MenuItem value="">All Vendors</MenuItem>
                {vendors.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.vendor_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={fetchData} startIcon={<RefreshIcon />}>
              Refresh
            </Button>
          </Box>
        </Paper>

        {/* PO List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>PO Number</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Items</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Order Date</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow key={po.id} hover>
                    <TableCell>
                      <Typography fontWeight="bold">{po.po_number}</Typography>
                    </TableCell>
                    <TableCell>{po.vendor_name || 'Unknown'}</TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(po.status)}
                        label={po.status.replace('_', ' ')}
                        size="small"
                        color={getStatusColor(po.status)}
                      />
                    </TableCell>
                    <TableCell align="right">{po.item_count}</TableCell>
                    <TableCell align="right">{formatCurrency(po.total_amount)}</TableCell>
                    <TableCell>{po.created_at?.split('T')[0]}</TableCell>
                    <TableCell>{po.order_date || '-'}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleViewPO(po)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {po.status === 'draft' && (
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeletePO(po.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {['ordered', 'partial'].includes(po.status) && (
                        <Tooltip title="Receive Items">
                          <IconButton size="small" color="success" onClick={() => handleOpenReceiveDialog(po)}>
                            <ReceiptIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {purchaseOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No purchase orders found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* View PO Dialog */}
        <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Purchase Order: {selectedPO?.po_number}</span>
              <Chip
                label={selectedPO?.status?.replace('_', ' ')}
                color={getStatusColor(selectedPO?.status)}
                size="small"
              />
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {selectedPO && (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Vendor
                    </Typography>
                    <Typography>{selectedPO.vendor_name}</Typography>
                    {selectedPO.vendor_email && <Typography variant="body2">{selectedPO.vendor_email}</Typography>}
                    {selectedPO.vendor_phone && <Typography variant="body2">{selectedPO.vendor_phone}</Typography>}
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Created
                    </Typography>
                    <Typography>{selectedPO.created_at?.split('T')[0]}</Typography>
                    <Typography variant="body2">By: {selectedPO.created_by}</Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Line Items
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item ID</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Ordered</TableCell>
                        <TableCell align="right">Received</TableCell>
                        <TableCell align="right">Unit Cost</TableCell>
                        <TableCell align="right">Line Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedPO.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.item_id}</TableCell>
                          <TableCell>{item.description?.substring(0, 40)}...</TableCell>
                          <TableCell align="right">{item.quantity_ordered}</TableCell>
                          <TableCell align="right">{item.quantity_received || 0}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unit_cost)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.line_total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 2, textAlign: 'right' }}>
                  <Typography variant="h6">Total: {formatCurrency(selectedPO.total_amount)}</Typography>
                </Box>

                {selectedPO.notes && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Notes
                    </Typography>
                    <Typography>{selectedPO.notes}</Typography>
                  </Box>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            {selectedPO?.status === 'draft' && (
              <>
                <Button onClick={() => handleUpdateStatus(selectedPO.id, 'pending_approval')} color="warning">
                  Submit for Approval
                </Button>
                <Button onClick={() => handleUpdateStatus(selectedPO.id, 'ordered')} color="primary">
                  Mark as Ordered
                </Button>
              </>
            )}
            {selectedPO?.status === 'pending_approval' && (
              <>
                <Button onClick={() => handleUpdateStatus(selectedPO.id, 'approved')} color="success">
                  Approve
                </Button>
                <Button onClick={() => handleUpdateStatus(selectedPO.id, 'cancelled')} color="error">
                  Reject
                </Button>
              </>
            )}
            {selectedPO?.status === 'approved' && (
              <Button onClick={() => handleUpdateStatus(selectedPO.id, 'ordered')} color="primary">
                Mark as Ordered
              </Button>
            )}
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Create PO Dialog */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Vendor *</InputLabel>
                  <Select
                    value={newPO.vendor_id}
                    label="Vendor *"
                    onChange={(e) => setNewPO({ ...newPO, vendor_id: e.target.value })}
                  >
                    {vendors.map((v) => (
                      <MenuItem key={v.id} value={v.id}>
                        {v.vendor_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={2}
                  value={newPO.notes}
                  onChange={(e) => setNewPO({ ...newPO, notes: e.target.value })}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Add Items
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Item</InputLabel>
                  <Select
                    value={selectedInventoryId}
                    label="Select Item"
                    onChange={(e) => {
                      setSelectedInventoryId(e.target.value);
                      const item = inventory.find((i) => i.id === parseInt(e.target.value));
                      if (item?.cost) setItemUnitCost(item.cost.toString());
                    }}
                  >
                    {inventory.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.item_id} - {item.description?.substring(0, 40)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Qty"
                  type="number"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Unit Cost"
                  type="number"
                  value={itemUnitCost}
                  onChange={(e) => setItemUnitCost(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button fullWidth variant="contained" onClick={handleAddItemToNewPO}>
                  Add
                </Button>
              </Grid>
            </Grid>

            {newPO.items.length > 0 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Unit Cost</TableCell>
                      <TableCell align="right">Line Total</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {newPO.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {item.item_id} - {item.description?.substring(0, 30)}
                        </TableCell>
                        <TableCell align="right">{item.quantity_ordered}</TableCell>
                        <TableCell align="right">{formatCurrency(item.unit_cost)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.quantity_ordered * item.unit_cost)}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleRemoveItemFromNewPO(idx)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} align="right">
                        <strong>Total:</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>
                          {formatCurrency(newPO.items.reduce((sum, i) => sum + i.quantity_ordered * i.unit_cost, 0))}
                        </strong>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreatePO} disabled={!newPO.vendor_id || newPO.items.length === 0}>
              Create PO
            </Button>
          </DialogActions>
        </Dialog>

        {/* Receive Items Dialog */}
        <Dialog open={receiveDialogOpen} onClose={() => setReceiveDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Receive Items - {selectedPO?.po_number}</DialogTitle>
          <DialogContent dividers>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Ordered</TableCell>
                    <TableCell align="right">Previously Received</TableCell>
                    <TableCell align="right">Remaining</TableCell>
                    <TableCell align="right">Receive Now</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receiveItems.map((item, idx) => {
                    const remaining = item.quantity_ordered - item.quantity_received;
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          {item.item_id} - {item.description?.substring(0, 30)}
                        </TableCell>
                        <TableCell align="right">{item.quantity_ordered}</TableCell>
                        <TableCell align="right">{item.quantity_received}</TableCell>
                        <TableCell align="right">{remaining}</TableCell>
                        <TableCell align="right" sx={{ width: 120 }}>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, max: remaining }}
                            value={item.quantity_to_receive}
                            onChange={(e) => {
                              const qty = Math.min(parseInt(e.target.value) || 0, remaining);
                              setReceiveItems((prev) =>
                                prev.map((i, ix) => (ix === idx ? { ...i, quantity_to_receive: qty } : i))
                              );
                            }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReceiveDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="success" onClick={handleReceiveItems}>
              Receive Items
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete PO Confirmation */}
        <ConfirmDialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, poId: null })}
          onConfirm={handleConfirmDeletePO}
          title="Delete Purchase Order"
          message="Are you sure you want to delete this draft PO? This action cannot be undone."
          confirmText="Delete"
          confirmColor="error"
          severity="warning"
        />
      </Container>
    </Box>
  );
}

export default PurchaseOrders;
