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
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  PushPin as PushPinIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import { fetchInventory } from '../api';
import logger from '../utils/logger';
function AddMaterialDialog({ open, onClose, onAdd, workOrderId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // Array of {item, quantity}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('select'); // 'select' or 'quantity'

  useEffect(() => {
    if (open) {
      loadInventory();
      setSearchTerm('');
      setSelectedItems([]);
      setStep('select');
    }
  }, [open]);

  useEffect(() => {
    let baseItems;
    if (searchTerm.trim() === '') {
      baseItems = inventory.slice(0, 50); // Show first 50 items
    } else {
      baseItems = inventory.filter(item =>
        item.item_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 50);
    }

    // Pin selected items at top
    if (selectedItems.length > 0) {
      const selectedIds = selectedItems.map(si => si.item.id);
      const pinnedItems = [];
      const unpinnedItems = [];

      // Get selected items from full inventory
      selectedItems.forEach(si => {
        pinnedItems.push({ ...si.item, _pinned: true });
      });

      // Add non-selected items from filtered results
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
      // Sort by commonly used first, then by item_id
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

    // Add each selected item
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

    // Reset and close
    setSelectedItems([]);
    setSearchTerm('');
    setStep('select');
    onClose();
  };

  const getStockChipColor = (item) => {
    if (item.qty_available >= 10) return 'success';
    if (item.qty_available > 0) return 'warning';
    return 'error';
  };

  const getTotalItems = () => selectedItems.length;
  const getTotalQuantity = () => selectedItems.reduce((sum, si) => sum + si.quantity, 0);

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
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {step === 'select' ? 'Select Materials' : 'Set Quantities'}
          </Typography>
          {selectedItems.length > 0 && step === 'select' && (
            <Chip
              icon={<PushPinIcon />}
              label={`${selectedItems.length} selected`}
              color="primary"
              onDelete={handleClearSelection}
              deleteIcon={<ClearIcon />}
            />
          )}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {step === 'select' ? (
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
              Select items to add to work order. Selected items stay pinned at top when searching.
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
                    No items found. Try a different search term.
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
                    <IconButton
                      size="small"
                      onClick={() => handleAdjustQuantity(item.id, -10)}
                      disabled={quantity <= 10}
                    >
                      -10
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleAdjustQuantity(item.id, -1)}
                      disabled={quantity <= 1}
                    >
                      <RemoveIcon />
                    </IconButton>
                    <TextField
                      type="number"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      inputProps={{
                        min: 1,
                        style: { textAlign: 'center', width: 60 }
                      }}
                      size="small"
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleAdjustQuantity(item.id, 1)}
                    >
                      <AddIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleAdjustQuantity(item.id, 10)}
                    >
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
              <Alert severity="info">
                No items selected. Go back to select items.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose}>Cancel</Button>
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
      </DialogActions>
    </Dialog>
  );
}

export default AddMaterialDialog;
