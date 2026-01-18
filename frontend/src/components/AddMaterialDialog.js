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
  Chip,
  Box,
  Typography,
  InputAdornment,
  Alert,
  CircularProgress,
  Checkbox,
  IconButton,
  Tooltip,
  Divider,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  PushPin as PushPinIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  ShoppingCart as ShoppingCartIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import { fetchInventory, addCustomMaterialToWorkOrder } from '../api';
import logger from '../utils/logger';

function AddMaterialDialog({ open, onClose, onAdd, workOrderId }) {
  const [tab, setTab] = useState(0); // 0 = inventory, 1 = custom
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // Array of {item, quantity}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('select'); // 'select' or 'quantity'

  // Custom material state
  const [customMaterial, setCustomMaterial] = useState({
    description: '',
    quantity: 1,
    unit_cost: '',
    unit_price: '',
    vendor: '',
    manufacturer: '',
    model_number: '',
    notes: '',
    needs_ordering: true,
    customer_provided: false,
  });

  useEffect(() => {
    if (open) {
      loadInventory();
      setSearchTerm('');
      setSelectedItems([]);
      setStep('select');
      setTab(0);
      setCustomMaterial({
        description: '',
        quantity: 1,
        unit_cost: '',
        unit_price: '',
        vendor: '',
        manufacturer: '',
        model_number: '',
        notes: '',
        needs_ordering: true,
        customer_provided: false,
      });
    }
  }, [open]);

  useEffect(() => {
    let baseItems;
    if (searchTerm.trim() === '') {
      baseItems = inventory.slice(0, 50);
    } else {
      baseItems = inventory.filter(item =>
        item.item_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 50);
    }

    if (selectedItems.length > 0) {
      const selectedIds = selectedItems.map(si => si.item.id);
      const pinnedItems = [];
      const unpinnedItems = [];

      selectedItems.forEach(si => {
        pinnedItems.push({ ...si.item, _pinned: true });
      });

      baseItems.forEach(item => {
        if (!selectedIds.includes(item.id)) {
          unpinnedItems.push({ ...item, _pinned: false });
        }
      });

      setFilteredInventory([...pinnedItems, ...unpinnedItems]);
    } else {
      setFilteredInventory(baseItems.map(item => ({ ...item, _pinned: false })));
    }
  }, [searchTerm, inventory, selectedItems]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await fetchInventory();
      const sorted = (data.inventory || []).sort((a, b) => {
        if (a.commonly_used && !b.commonly_used) return -1;
        if (!a.commonly_used && b.commonly_used) return 1;
        return a.item_id?.localeCompare(b.item_id);
      });
      setInventory(sorted);
    } catch (err) {
      logger.error('Error loading inventory:', err);
      setError('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const isItemSelected = (itemId) => {
    return selectedItems.some(si => si.item.id === itemId);
  };

  const handleToggleItem = (item) => {
    if (isItemSelected(item.id)) {
      setSelectedItems(prev => prev.filter(si => si.item.id !== item.id));
    } else {
      setSelectedItems(prev => [...prev, { item, quantity: 1 }]);
    }
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    setSelectedItems(prev => prev.map(si =>
      si.item.id === itemId
        ? { ...si, quantity: Math.max(1, parseInt(newQuantity) || 1) }
        : si
    ));
  };

  const handleAdjustQuantity = (itemId, delta) => {
    setSelectedItems(prev => prev.map(si =>
      si.item.id === itemId
        ? { ...si, quantity: Math.max(1, si.quantity + delta) }
        : si
    ));
  };

  const handleClearSelection = () => {
    setSelectedItems([]);
  };

  const handleProceedToQuantity = () => {
    if (selectedItems.length === 0) return;
    setStep('quantity');
  };

  const handleBackToSelect = () => {
    setStep('select');
  };

  const handleAdd = async () => {
    if (selectedItems.length === 0) return;

    for (const { item, quantity } of selectedItems) {
      await onAdd({
        inventory_id: item.id,
        item_id: item.item_id,
        description: item.description,
        brand: item.brand,
        quantity_needed: quantity,
        available_qty: item.qty_available,
        unit_cost: item.cost,
        unit_price: item.sell_price,
      });
    }

    setSelectedItems([]);
    setSearchTerm('');
    setStep('select');
    onClose();
  };

  const handleAddCustomMaterial = async () => {
    if (!customMaterial.description || !customMaterial.quantity) {
      setError('Description and quantity are required');
      return;
    }

    try {
      setLoading(true);

      // If workOrderId is provided, add directly via API
      if (workOrderId) {
        await addCustomMaterialToWorkOrder(workOrderId, {
          description: customMaterial.description,
          quantity: parseInt(customMaterial.quantity) || 1,
          unit_cost: parseFloat(customMaterial.unit_cost) || 0,
          unit_price: parseFloat(customMaterial.unit_price) || 0,
          vendor: customMaterial.vendor || null,
          manufacturer: customMaterial.manufacturer || null,
          model_number: customMaterial.model_number || null,
          notes: customMaterial.notes || null,
          needs_ordering: customMaterial.needs_ordering,
          customer_provided: customMaterial.customer_provided,
        });
      } else {
        // Pass to parent as custom item
        await onAdd({
          is_custom: true,
          description: customMaterial.description,
          quantity_needed: parseInt(customMaterial.quantity) || 1,
          unit_cost: parseFloat(customMaterial.unit_cost) || 0,
          unit_price: parseFloat(customMaterial.unit_price) || 0,
          vendor: customMaterial.vendor,
          manufacturer: customMaterial.manufacturer,
          model_number: customMaterial.model_number,
          notes: customMaterial.notes,
          needs_ordering: customMaterial.needs_ordering,
          customer_provided: customMaterial.customer_provided,
        });
      }

      // Reset and close
      setCustomMaterial({
        description: '',
        quantity: 1,
        unit_cost: '',
        unit_price: '',
        vendor: '',
        manufacturer: '',
        model_number: '',
        notes: '',
        needs_ordering: true,
        customer_provided: false,
      });
      onClose();
    } catch (err) {
      logger.error('Error adding custom material:', err);
      setError('Failed to add custom material: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStockChipColor = (item) => {
    if (item.qty_available >= 10) return 'success';
    if (item.qty_available > 0) return 'warning';
    return 'error';
  };

  const getTotalItems = () => selectedItems.length;
  const getTotalQuantity = () => selectedItems.reduce((sum, si) => sum + si.quantity, 0);

  const isCustomFormValid = customMaterial.description && customMaterial.quantity > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', maxHeight: 800 }
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Add Materials</Typography>
          {tab === 0 && selectedItems.length > 0 && step === 'select' && (
            <Chip
              icon={<PushPinIcon />}
              label={`${selectedItems.length} selected`}
              color="primary"
              onDelete={handleClearSelection}
              deleteIcon={<ClearIcon />}
            />
          )}
        </Box>
        <Tabs value={tab} onChange={(e, newTab) => setTab(newTab)} sx={{ mt: 1 }}>
          <Tab icon={<ShoppingCartIcon />} label="From Inventory" />
          <Tab icon={<BuildIcon />} label="Custom / Special Order" />
        </Tabs>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {tab === 0 ? (
          /* INVENTORY TAB */
          step === 'select' ? (
            <>
              <TextField
                fullWidth
                placeholder="Search by item ID, description, brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />

              <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                Select items to add. Items with 0 stock can still be added for ordering.
              </Typography>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <List sx={{ flex: 1, overflow: 'auto' }}>
                  {filteredInventory.map((item) => {
                    const isSelected = isItemSelected(item.id);
                    return (
                      <ListItem
                        key={item.id}
                        disablePadding
                        sx={{
                          border: 1,
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          borderRadius: 1,
                          mb: 1,
                          bgcolor: item._pinned ? 'primary.light' : 'inherit',
                        }}
                        secondaryAction={
                          item._pinned && (
                            <Tooltip title="Pinned (selected)">
                              <PushPinIcon color="primary" fontSize="small" sx={{ mr: 1 }} />
                            </Tooltip>
                          )
                        }
                      >
                        <ListItemButton onClick={() => handleToggleItem(item)}>
                          <Checkbox
                            edge="start"
                            checked={isSelected}
                            tabIndex={-1}
                            disableRipple
                            sx={{ mr: 1 }}
                          />
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                  {item.item_id}
                                </Typography>
                                {item.commonly_used && (
                                  <Chip label="★" size="small" color="warning" />
                                )}
                                <Chip
                                  label={`${item.qty_available} avail`}
                                  size="small"
                                  color={getStockChipColor(item)}
                                />
                              </Box>
                            }
                            secondary={
                              <>
                                <Typography variant="body2" component="span">
                                  {item.brand} - {item.description}
                                </Typography>
                                <br />
                                <Typography variant="caption" color="text.secondary">
                                  {item.category} | {item.location}
                                </Typography>
                              </>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                  {filteredInventory.length === 0 && !loading && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 3 }}>
                      No items found. Try a different search or use the "Custom / Special Order" tab.
                    </Typography>
                  )}
                </List>
              )}
            </>
          ) : (
            /* Quantity Setting Step */
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Set the quantity needed for each item:
              </Typography>

              <List>
                {selectedItems.map(({ item, quantity }) => (
                  <Box key={item.id} sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {item.item_id}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.brand} - {item.description}
                        </Typography>
                      </Box>
                      <Chip
                        label={`${item.qty_available} available`}
                        size="small"
                        color={getStockChipColor(item)}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                      <IconButton size="small" onClick={() => handleAdjustQuantity(item.id, -10)} disabled={quantity <= 10}>
                        -10
                      </IconButton>
                      <IconButton size="small" onClick={() => handleAdjustQuantity(item.id, -1)} disabled={quantity <= 1}>
                        <RemoveIcon />
                      </IconButton>
                      <TextField
                        type="number"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        inputProps={{ min: 1, style: { textAlign: 'center', width: 60 } }}
                        size="small"
                      />
                      <IconButton size="small" onClick={() => handleAdjustQuantity(item.id, 1)}>
                        <AddIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleAdjustQuantity(item.id, 10)}>
                        +10
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setSelectedItems(prev => prev.filter(si => si.item.id !== item.id))}
                        sx={{ ml: 'auto' }}
                      >
                        <ClearIcon />
                      </IconButton>
                    </Box>

                    {quantity > item.qty_available && (
                      <Alert severity="warning" sx={{ mt: 1 }} icon={<WarningIcon fontSize="small" />}>
                        Only {item.qty_available} available. Will need to order {quantity - item.qty_available} more.
                      </Alert>
                    )}
                  </Box>
                ))}
              </List>

              {selectedItems.length === 0 && (
                <Alert severity="info">No items selected. Go back to select items.</Alert>
              )}
            </Box>
          )
        ) : (
          /* CUSTOM MATERIAL TAB */
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Use this for designer fixtures, special orders, or any item not in your regular inventory.
            </Alert>

            <TextField
              fullWidth
              required
              label="Description"
              placeholder="e.g., Restoration Hardware Chandelier - Model XYZ"
              value={customMaterial.description}
              onChange={(e) => setCustomMaterial(prev => ({ ...prev, description: e.target.value }))}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                required
                type="number"
                label="Quantity"
                value={customMaterial.quantity}
                onChange={(e) => setCustomMaterial(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                inputProps={{ min: 1 }}
                sx={{ width: 120 }}
              />
              <TextField
                type="number"
                label="Unit Cost"
                placeholder="0.00"
                value={customMaterial.unit_cost}
                onChange={(e) => setCustomMaterial(prev => ({ ...prev, unit_cost: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={{ flex: 1 }}
              />
              <TextField
                type="number"
                label="Unit Price (to customer)"
                placeholder="0.00"
                value={customMaterial.unit_price}
                onChange={(e) => setCustomMaterial(prev => ({ ...prev, unit_price: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={{ flex: 1 }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Optional Details
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Manufacturer / Brand"
                placeholder="e.g., Restoration Hardware"
                value={customMaterial.manufacturer}
                onChange={(e) => setCustomMaterial(prev => ({ ...prev, manufacturer: e.target.value }))}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Model / Part Number"
                placeholder="e.g., RH-12345"
                value={customMaterial.model_number}
                onChange={(e) => setCustomMaterial(prev => ({ ...prev, model_number: e.target.value }))}
                sx={{ flex: 1 }}
              />
            </Box>

            <TextField
              fullWidth
              label="Vendor / Where to Order"
              placeholder="e.g., Order from Restoration Hardware website"
              value={customMaterial.vendor}
              onChange={(e) => setCustomMaterial(prev => ({ ...prev, vendor: e.target.value }))}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Notes"
              placeholder="Any special instructions, customer preferences, etc."
              value={customMaterial.notes}
              onChange={(e) => setCustomMaterial(prev => ({ ...prev, notes: e.target.value }))}
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={customMaterial.customer_provided}
                  onChange={(e) => setCustomMaterial(prev => ({
                    ...prev,
                    customer_provided: e.target.checked,
                    // If customer provided, set cost/price to 0 and disable ordering
                    unit_cost: e.target.checked ? '0' : prev.unit_cost,
                    unit_price: e.target.checked ? '0' : prev.unit_price,
                    needs_ordering: e.target.checked ? false : prev.needs_ordering,
                  }))}
                />
              }
              label="Customer Provided (no cost to job)"
              sx={{ mb: 1 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={customMaterial.needs_ordering}
                  onChange={(e) => setCustomMaterial(prev => ({ ...prev, needs_ordering: e.target.checked }))}
                  disabled={customMaterial.customer_provided}
                />
              }
              label="Needs to be ordered (show in purchasing queue)"
            />
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose}>Cancel</Button>

        {tab === 0 ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {step === 'quantity' && (
              <Button onClick={handleBackToSelect} variant="outlined">
                ← Back to Selection
              </Button>
            )}
            {step === 'select' ? (
              <Button
                onClick={handleProceedToQuantity}
                variant="contained"
                disabled={selectedItems.length === 0}
                size="large"
              >
                Set Quantities ({selectedItems.length} items)
              </Button>
            ) : (
              <Button
                onClick={handleAdd}
                variant="contained"
                color="success"
                disabled={selectedItems.length === 0}
                size="large"
              >
                Add {getTotalItems()} Items ({getTotalQuantity()} total qty)
              </Button>
            )}
          </Box>
        ) : (
          <Button
            onClick={handleAddCustomMaterial}
            variant="contained"
            color="success"
            disabled={!isCustomFormValid || loading}
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
          >
            Add Custom Item
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default AddMaterialDialog;
