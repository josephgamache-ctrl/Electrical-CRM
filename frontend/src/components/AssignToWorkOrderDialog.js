import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  Divider,
  Grid,
} from '@mui/material';
import {
  Search as SearchIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { fetchWorkOrders, addMaterialToWorkOrder } from '../api';
import logger from '../utils/logger';
function AssignToWorkOrderDialog({ open, onClose, selectedItems, onSuccess }) {
  const [workOrders, setWorkOrders] = useState([]);
  const [filteredWorkOrders, setFilteredWorkOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      loadWorkOrders();
      // Initialize quantities to 1 for each selected item
      const initialQuantities = {};
      selectedItems.forEach(item => {
        initialQuantities[item.id] = 1;
      });
      setQuantities(initialQuantities);
      setSelectedWorkOrder(null);
      setSearchTerm('');
    }
  }, [open, selectedItems]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredWorkOrders(workOrders);
    } else {
      const filtered = workOrders.filter(wo =>
        wo.work_order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.job_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.job_description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredWorkOrders(filtered);
    }
  }, [searchTerm, workOrders]);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      // Fetch active work orders (not completed or cancelled)
      const data = await fetchWorkOrders();
      const activeWorkOrders = (data.work_orders || []).filter(
        wo => wo.status !== 'completed' && wo.status !== 'cancelled'
      );
      setWorkOrders(activeWorkOrders);
      setFilteredWorkOrders(activeWorkOrders);
    } catch (err) {
      logger.error('Error loading work orders:', err);
      setError('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (itemId, value) => {
    const qty = parseInt(value) || 1;
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(1, qty)
    }));
  };

  const handleAssign = async () => {
    if (!selectedWorkOrder) return;

    try {
      setAssigning(true);
      setError(null);

      // Assign each selected item to the work order
      for (const item of selectedItems) {
        const material = {
          inventory_id: item.id,
          item_id: item.item_id,
          description: item.description,
          brand: item.brand,
          quantity_needed: quantities[item.id] || 1,
          available_qty: item.qty_available,
          unit_cost: item.cost,
          unit_price: item.sell_price,
        };

        await addMaterialToWorkOrder(selectedWorkOrder.id, material);
      }

      onSuccess(`Successfully assigned ${selectedItems.length} item(s) to ${selectedWorkOrder.work_order_number}`);
      handleClose();
    } catch (err) {
      logger.error('Error assigning materials:', err);
      setError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSelectedWorkOrder(null);
    setSearchTerm('');
    onClose();
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      scheduled: 'info',
      in_progress: 'primary',
      completed: 'success',
      cancelled: 'error',
      delayed: 'default',
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'success',
      normal: 'default',
      high: 'warning',
      urgent: 'error',
    };
    return colors[priority] || 'default';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={window.innerWidth < 600}
    >
      <DialogTitle>
        {selectedWorkOrder ? 'Set Quantities' : `Assign ${selectedItems.length} Item(s) to Work Order`}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!selectedWorkOrder ? (
          <>
            <TextField
              fullWidth
              placeholder="Search by WO#, customer, job type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              sx={{ mb: 2, mt: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : filteredWorkOrders.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 3 }}>
                {searchTerm ? 'No work orders found matching your search.' : 'No active work orders available.'}
              </Typography>
            ) : (
              <List sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                {filteredWorkOrders.map((wo) => (
                  <ListItemButton
                    key={wo.id}
                    onClick={() => setSelectedWorkOrder(wo)}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {wo.work_order_number}
                          </Typography>
                          <Chip
                            label={wo.status?.replace('_', ' ').toUpperCase()}
                            size="small"
                            color={getStatusColor(wo.status)}
                          />
                          <Chip
                            label={wo.priority?.toUpperCase()}
                            size="small"
                            color={getPriorityColor(wo.priority)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" component="span">
                            <strong>{wo.first_name} {wo.last_name}</strong>
                            {wo.company_name ? ` (${wo.company_name})` : ''}
                          </Typography>
                          <br />
                          <Typography variant="body2" component="span" color="text.secondary">
                            {wo.job_type} - {wo.job_description}
                          </Typography>
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            Scheduled: {formatDate(wo.scheduled_date)} |
                            Current Items: {wo.material_count || 0}
                          </Typography>
                        </>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </>
        ) : (
          <Box>
            {/* Selected Work Order Summary */}
            <Box sx={{
              p: 2,
              bgcolor: 'background.default',
              borderRadius: 1,
              mb: 3
            }}>
              <Typography variant="h6" gutterBottom>
                {selectedWorkOrder.work_order_number}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>{selectedWorkOrder.first_name} {selectedWorkOrder.last_name}</strong>
                {selectedWorkOrder.company_name ? ` (${selectedWorkOrder.company_name})` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedWorkOrder.job_type} - {selectedWorkOrder.job_description}
              </Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Items to Assign */}
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Items to Assign ({selectedItems.length})
            </Typography>

            <List>
              {selectedItems.map((item) => (
                <ListItem
                  key={item.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={7}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.item_id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.brand} - {item.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Available: {item.qty_available} | Location: {item.location}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Quantity"
                        value={quantities[item.id] || 1}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        inputProps={{ min: 1, step: 1 }}
                        size="small"
                      />
                      {quantities[item.id] > item.qty_available && (
                        <Typography variant="caption" color="error">
                          ⚠️ Only {item.qty_available} available
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                </ListItem>
              ))}
            </List>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => setSelectedWorkOrder(null)}
              sx={{ mt: 2 }}
            >
              ← Choose Different Work Order
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {selectedWorkOrder && (
          <Button
            onClick={handleAssign}
            variant="contained"
            disabled={assigning}
            size="large"
            startIcon={assigning ? <CircularProgress size={20} /> : <AssignmentIcon />}
          >
            Assign to Work Order
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default AssignToWorkOrderDialog;
