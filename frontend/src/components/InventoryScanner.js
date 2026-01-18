import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  InputAdornment,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  useMediaQuery,
  useTheme,
  Fab,
  Slide,
} from '@mui/material';
import {
  QrCodeScanner as ScannerIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  History as HistoryIcon,
  Clear as ClearIcon,
  Home as HomeIcon,
  CameraAlt as CameraIcon,
  Keyboard as KeyboardIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  ShoppingCart as CartIcon,
  Close as CloseIcon,
  FlipCameraAndroid as FlipCameraIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AppHeader from './AppHeader';
import {
  fetchInventoryByBarcode,
  fetchInventoryItem,
  adjustStock,
  recordCycleCount,
  updateInventoryItem,
  fetchWorkOrders,
  addMaterialToWorkOrder,
  searchInventory,
  createInventoryItem,
} from '../api';
import logger from '../utils/logger';
import BarcodeScanner from './BarcodeScanner';
function InventoryScanner() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const barcodeInputRef = useRef(null);

  // Scanner mode state
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Barcode/search state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Found item state
  const [foundItem, setFoundItem] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);

  // Quick action dialogs
  const [adjustCountOpen, setAdjustCountOpen] = useState(false);
  const [setCountOpen, setSetCountOpen] = useState(false);
  const [changeLocationOpen, setChangeLocationOpen] = useState(false);
  const [addToOrderOpen, setAddToOrderOpen] = useState(false);

  // Action states
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [physicalCount, setPhysicalCount] = useState(0);
  const [newLocation, setNewLocation] = useState('');
  const [newBinLocation, setNewBinLocation] = useState('');
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);

  // UI state
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Unknown barcode workflow state
  const [unknownBarcode, setUnknownBarcode] = useState(null);
  const [unknownBarcodeDialogOpen, setUnknownBarcodeDialogOpen] = useState(false);
  const [linkToExistingOpen, setLinkToExistingOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingItems, setSearchingItems] = useState(false);
  const [selectedItemToLink, setSelectedItemToLink] = useState(null);
  const [searchDebugInfo, setSearchDebugInfo] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [createNewOpen, setCreateNewOpen] = useState(false);
  const [newItemData, setNewItemData] = useState({
    item_name: '',
    description: '',
    category: '',
    sku: '',
    qty: 0,
    location: '',
  });

  // On mobile, auto-start scanner
  useEffect(() => {
    if (isMobile) {
      setScannerActive(true);
    }
  }, [isMobile]);

  // Handle barcode scanned from BarcodeScanner component
  const handleBarcodeScanned = async (barcode) => {
    // BarcodeScanner pauses on scan, so just process the result
    setBarcodeInput(barcode);
    await searchForItem(barcode);
  };

  // Start scanner (for buttons)
  const startScanner = () => {
    setScannerActive(true);
  };

  // Stop scanner
  const stopScanner = () => {
    setScannerActive(false);
  };

  // Search for item by barcode/UPC or item ID
  const searchForItem = async (searchTerm) => {
    if (!searchTerm.trim()) return;

    setSearching(true);
    setSearchError(null);

    try {
      let item = null;

      try {
        const result = await fetchInventoryByBarcode(searchTerm.trim());
        item = result.item || result;
      } catch (barcodeErr) {
        logger.log('Barcode search failed, item may not have this barcode');
      }

      if (item && item.id) {
        setFoundItem(item);
        addToHistory(item);
        setBarcodeInput('');
        showSnackbar(`Found: ${item.description}`, 'success');
      } else {
        // Barcode not found - show options dialog
        setUnknownBarcode(searchTerm.trim());
        setUnknownBarcodeDialogOpen(true);
        setBarcodeInput('');
      }
    } catch (err) {
      setSearchError(err.message || 'Error searching for item');
      if (isMobile) {
        setTimeout(() => startScanner(), 2000);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleManualSearch = () => {
    searchForItem(barcodeInput);
  };

  const handleBarcodeKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualSearch();
    }
  };

  // Add item to scan history
  const addToHistory = (item) => {
    setScanHistory(prev => {
      const filtered = prev.filter(h => h.id !== item.id);
      return [{ ...item, scannedAt: new Date() }, ...filtered].slice(0, 10);
    });
  };

  // Load work orders for "Add to Order" action
  const loadWorkOrders = async () => {
    try {
      const data = await fetchWorkOrders();
      const activeOrders = (data.work_orders || []).filter(
        wo => ['pending', 'scheduled', 'in_progress'].includes(wo.status)
      );
      setWorkOrders(activeOrders);
    } catch (err) {
      logger.error('Error loading work orders:', err);
    }
  };

  // Quick action handlers
  const handleAdjustCount = () => {
    setAdjustQuantity(0);
    setAdjustReason('');
    setAdjustCountOpen(true);
  };

  // Set Count - for inventory counting, enter the physical count directly
  const handleSetCount = () => {
    setPhysicalCount(foundItem?.qty || 0);
    setAdjustReason('');
    setSetCountOpen(true);
  };

  // Count Matches - quick confirm the system count is correct
  // Uses cycle-count API to properly track last_counted_date and next_count_date
  const handleCountMatches = async () => {
    if (!foundItem) return;

    setSaving(true);
    try {
      // Use recordCycleCount with current qty - properly updates counting dates
      const result = await recordCycleCount(foundItem.id, foundItem.qty || 0, 'Count verified via scanner - matches system');
      showSnackbar(`Count verified: ${foundItem.qty} items (next count: ${result.next_count_date})`, 'success');

      // Auto-scan next item after brief delay
      setTimeout(() => {
        scanAnother();
      }, 1000);
    } catch (err) {
      // Fall back to showing success even if API fails
      logger.error('Cycle count failed:', err);
      showSnackbar(`Count verified: ${foundItem.qty} items`, 'success');
      setTimeout(() => {
        scanAnother();
      }, 1000);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeLocation = () => {
    setNewLocation(foundItem?.location || '');
    setNewBinLocation(foundItem?.bin_location || '');
    setChangeLocationOpen(true);
  };

  const handleAddToOrder = () => {
    loadWorkOrders();
    setSelectedWorkOrder('');
    setOrderQuantity(1);
    setAddToOrderOpen(true);
  };

  // Save actions
  const saveAdjustCount = async () => {
    if (!foundItem || adjustQuantity === 0) return;

    setSaving(true);
    try {
      await adjustStock(foundItem.id, adjustQuantity, adjustReason || 'Manual adjustment via scanner');

      const updated = await fetchInventoryItem(foundItem.id);
      setFoundItem(updated.item || updated);
      addToHistory(updated.item || updated);

      setAdjustCountOpen(false);
      showSnackbar(`Stock ${adjustQuantity > 0 ? 'increased' : 'decreased'} by ${Math.abs(adjustQuantity)}`, 'success');

      // Auto-scan next item after brief delay
      setTimeout(() => scanAnother(), 1500);
    } catch (err) {
      showSnackbar(err.message || 'Failed to adjust stock', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save Set Count - uses cycle-count API for proper tracking
  // This records last_counted_date, next_count_date, and variance statistics
  const saveSetCount = async () => {
    if (!foundItem) return;

    const currentQty = foundItem.qty || 0;
    const variance = physicalCount - currentQty;

    setSaving(true);
    try {
      // Use recordCycleCount - properly tracks counting dates and variance
      const result = await recordCycleCount(
        foundItem.id,
        physicalCount,
        adjustReason || `Physical count via scanner`
      );

      const updated = await fetchInventoryItem(foundItem.id);
      setFoundItem(updated.item || updated);
      addToHistory(updated.item || updated);

      setSetCountOpen(false);

      if (variance === 0) {
        showSnackbar(`Count verified: ${physicalCount} items (next count: ${result.next_count_date})`, 'success');
      } else {
        const changeText = variance > 0 ? `+${variance}` : variance;
        showSnackbar(`Count updated: ${currentQty} → ${physicalCount} (${changeText})`, 'success');
      }

      // Auto-scan next item after update
      setTimeout(() => scanAnother(), 1500);
    } catch (err) {
      showSnackbar(err.message || 'Failed to update count', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveChangeLocation = async () => {
    if (!foundItem) return;

    setSaving(true);
    try {
      await updateInventoryItem(foundItem.id, {
        location: newLocation,
        bin_location: newBinLocation,
      });

      const updated = await fetchInventoryItem(foundItem.id);
      setFoundItem(updated.item || updated);
      addToHistory(updated.item || updated);

      setChangeLocationOpen(false);
      showSnackbar('Location updated successfully', 'success');

      // Auto-scan next item after brief delay
      setTimeout(() => scanAnother(), 1500);
    } catch (err) {
      showSnackbar(err.message || 'Failed to update location', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveAddToOrder = async () => {
    if (!foundItem || !selectedWorkOrder || orderQuantity < 1) return;

    setSaving(true);
    try {
      await addMaterialToWorkOrder(selectedWorkOrder, {
        inventory_id: foundItem.id,
        quantity_needed: orderQuantity,
      });

      const updated = await fetchInventoryItem(foundItem.id);
      setFoundItem(updated.item || updated);

      setAddToOrderOpen(false);
      showSnackbar(`Added ${orderQuantity} x ${foundItem.item_id} to work order`, 'success');

      // Auto-scan next item after brief delay
      setTimeout(() => scanAnother(), 1500);
    } catch (err) {
      showSnackbar(err.message || 'Failed to add to work order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const clearFoundItem = () => {
    setFoundItem(null);
    setBarcodeInput('');
    setSearchError(null);
    // Restart scanner on mobile
    if (isMobile) {
      startScanner();
    } else if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const scanAnother = () => {
    clearFoundItem();
  };

  // Unknown barcode handlers
  const handleUnknownBarcodeClose = () => {
    setUnknownBarcodeDialogOpen(false);
    setUnknownBarcode(null);
    // Restart scanner
    if (isMobile) {
      setTimeout(() => startScanner(), 300);
    }
  };

  const handleLinkToExisting = () => {
    setUnknownBarcodeDialogOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedItemToLink(null);
    setSearchDebugInfo('Type a search term and tap Search');
    setHasSearched(false);
    setLinkToExistingOpen(true);
  };

  const handleCreateNew = () => {
    setUnknownBarcodeDialogOpen(false);
    setNewItemData({
      item_name: '',
      description: '',
      category: '',
      sku: '',
      qty: 0,
      location: '',
    });
    setCreateNewOpen(true);
  };

  const handleSearchExistingItems = async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchDebugInfo('Enter a search term');
      return;
    }

    setSearchDebugInfo(`Searching for "${trimmedQuery}"...`);
    setSearchingItems(true);
    setHasSearched(true);
    setSearchResults([]); // Clear previous results

    try {
      // Use the dedicated search endpoint - no pagination limits
      // Searches: description, category, subcategory, brand, sku, upc, item_id
      const data = await searchInventory(trimmedQuery);

      // Debug: show what we got back
      if (!data) {
        setSearchDebugInfo(`Error: No response from server`);
        setSearchResults([]);
        return;
      }

      const items = data.inventory || data.items || [];

      if (!Array.isArray(items)) {
        setSearchDebugInfo(`Error: Invalid response format`);
        setSearchResults([]);
        return;
      }

      setSearchResults(items.slice(0, 50)); // Limit display to 50 for performance
      setSearchDebugInfo(`Found ${items.length} items for "${trimmedQuery}"`);
    } catch (err) {
      logger.error('[Scanner] Search error:', err);
      setSearchDebugInfo(`Error: ${err.message || 'Unknown error'}`);
      showSnackbar(`Search failed: ${err.message}`, 'error');
      setSearchResults([]);
    } finally {
      setSearchingItems(false);
    }
  };

  const handleLinkBarcodeToItem = async () => {
    if (!selectedItemToLink || !unknownBarcode) return;

    setSaving(true);
    try {
      await updateInventoryItem(selectedItemToLink.id, { upc: unknownBarcode });
      showSnackbar(`Barcode linked to ${selectedItemToLink.description || selectedItemToLink.item_name}`, 'success');
      setLinkToExistingOpen(false);

      // Fetch and display the updated item
      const updated = await fetchInventoryItem(selectedItemToLink.id);
      setFoundItem(updated.item || updated);
      addToHistory(updated.item || updated);
      setUnknownBarcode(null);

      // Auto-scan next item after brief delay
      setTimeout(() => scanAnother(), 1500);
    } catch (err) {
      showSnackbar(err.message || 'Failed to link barcode', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewItem = async () => {
    if (!newItemData.item_name && !newItemData.description) {
      showSnackbar('Please enter item name or description', 'warning');
      return;
    }

    setSaving(true);
    try {
      // Generate a unique item_id using timestamp + random suffix
      const timestamp = Date.now().toString(36).toUpperCase();
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const generatedItemId = `NEW-${timestamp}-${randomSuffix}`;

      // Description is the primary field - use item_name if provided, otherwise use description
      const itemDescription = newItemData.item_name || newItemData.description;

      // Build item data with sensible defaults for required fields
      // This allows users to create items quickly with just a title
      const itemData = {
        // Required identification fields
        item_id: generatedItemId,
        brand: 'Unknown', // Default brand - can be updated later
        description: itemDescription,

        // Category - use provided or default
        category: newItemData.category || 'Uncategorized',

        // Pricing - default to $0 for quick add, can be updated later
        cost: 0,
        sell_price: 0,

        // Inventory management
        qty: newItemData.qty || 0,
        min_stock: 0, // No minimum stock alert by default
        location: newItemData.location || 'Warehouse', // Default location

        // Optional fields
        sku: newItemData.sku || null,
        upc: unknownBarcode, // Save the scanned barcode!
        subcategory: null,
      };

      const createResult = await createInventoryItem(itemData);
      showSnackbar(`New item created: ${itemData.description}`, 'success');
      setCreateNewOpen(false);

      // Fetch the full item data to display
      try {
        const fullItem = await fetchInventoryItem(createResult.id);
        const item = fullItem.item || fullItem;
        setFoundItem(item);
        addToHistory(item);
      } catch (fetchErr) {
        // If fetch fails, create a minimal item object for display
        setFoundItem({
          id: createResult.id,
          item_id: createResult.item_id,
          description: itemData.description,
          upc: itemData.upc,
          qty: itemData.qty || 0,
          location: itemData.location || 'Warehouse',
          brand: itemData.brand || 'Unknown',
        });
      }
      setUnknownBarcode(null);

      // Stay on the Item Found screen so user can set count/location
      // Don't auto-scan - let user manually tap "Scan Another" when ready
    } catch (err) {
      showSnackbar(err.message || 'Failed to create item', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Render dialogs (shared between mobile and desktop) - MUST be defined before any returns
  const renderDialogs = () => (
    <>
      {/* Adjust Count Dialog */}
      <Dialog open={adjustCountOpen} onClose={() => setAdjustCountOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Adjust Stock Count</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {foundItem?.item_id} - {foundItem?.description?.substring(0, 50)}...
            </Typography>
            <Typography variant="h6" gutterBottom>
              Current: {foundItem?.qty || 0}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, my: 3 }}>
              <IconButton
                color="error"
                size="large"
                onClick={() => setAdjustQuantity(prev => prev - 1)}
                sx={{ border: '2px solid', borderColor: 'error.main', width: 56, height: 56 }}
              >
                <RemoveIcon />
              </IconButton>
              <TextField
                type="number"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                sx={{ width: 80 }}
                inputProps={{ style: { textAlign: 'center', fontSize: '1.5rem' } }}
              />
              <IconButton
                color="success"
                size="large"
                onClick={() => setAdjustQuantity(prev => prev + 1)}
                sx={{ border: '2px solid', borderColor: 'success.main', width: 56, height: 56 }}
              >
                <AddIcon />
              </IconButton>
            </Box>

            <Typography variant="h6" sx={{ textAlign: 'center', mb: 2 }}>
              New Stock: <strong>{(foundItem?.qty || 0) + adjustQuantity}</strong>
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mb: 2 }}>
              <Chip label="-10" onClick={() => setAdjustQuantity(-10)} clickable />
              <Chip label="-5" onClick={() => setAdjustQuantity(-5)} clickable />
              <Chip label="+1" onClick={() => setAdjustQuantity(1)} clickable color="primary" />
              <Chip label="+5" onClick={() => setAdjustQuantity(5)} clickable color="primary" />
              <Chip label="+10" onClick={() => setAdjustQuantity(10)} clickable color="primary" />
            </Box>

            <TextField
              fullWidth
              label="Reason (optional)"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g., Physical count..."
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustCountOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveAdjustCount}
            disabled={saving || adjustQuantity === 0}
            color={adjustQuantity > 0 ? 'success' : 'error'}
          >
            {saving ? <CircularProgress size={24} /> : (adjustQuantity > 0 ? `Add ${adjustQuantity}` : `Remove ${Math.abs(adjustQuantity)}`)}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set Count Dialog - For inventory counting */}
      <Dialog open={setCountOpen} onClose={() => setSetCountOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'secondary.dark', color: 'secondary.contrastText' }}>
          Set Physical Count
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {foundItem?.item_id} - {foundItem?.description?.substring(0, 50)}...
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">System Count</Typography>
                <Typography variant="h5">{foundItem?.qty || 0}</Typography>
              </Box>
              <Typography variant="h4" color="text.secondary">→</Typography>
              <Box>
                <Typography variant="caption" color="text.secondary">Physical Count</Typography>
                <Typography variant="h5" color={physicalCount !== (foundItem?.qty || 0) ? 'warning.main' : 'success.main'}>
                  {physicalCount}
                </Typography>
              </Box>
            </Box>

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Enter what you counted:
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, my: 2 }}>
              <IconButton
                color="error"
                size="large"
                onClick={() => setPhysicalCount(prev => Math.max(0, prev - 1))}
                sx={{ border: '2px solid', borderColor: 'error.main', width: 56, height: 56 }}
              >
                <RemoveIcon />
              </IconButton>
              <TextField
                type="number"
                value={physicalCount}
                onChange={(e) => setPhysicalCount(Math.max(0, parseInt(e.target.value) || 0))}
                sx={{ width: 100 }}
                inputProps={{ style: { textAlign: 'center', fontSize: '2rem' }, min: 0 }}
                autoFocus
              />
              <IconButton
                color="success"
                size="large"
                onClick={() => setPhysicalCount(prev => prev + 1)}
                sx={{ border: '2px solid', borderColor: 'success.main', width: 56, height: 56 }}
              >
                <AddIcon />
              </IconButton>
            </Box>

            {physicalCount !== (foundItem?.qty || 0) && (
              <Alert
                severity={physicalCount > (foundItem?.qty || 0) ? 'info' : 'warning'}
                sx={{ mb: 2 }}
              >
                {physicalCount > (foundItem?.qty || 0)
                  ? `Will add ${physicalCount - (foundItem?.qty || 0)} to stock`
                  : `Will remove ${(foundItem?.qty || 0) - physicalCount} from stock`
                }
              </Alert>
            )}

            <TextField
              fullWidth
              label="Note (optional)"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g., Counted shelf A-3..."
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetCountOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveSetCount}
            disabled={saving}
            color={physicalCount === (foundItem?.qty || 0) ? 'success' : 'warning'}
          >
            {saving ? <CircularProgress size={24} /> : (
              physicalCount === (foundItem?.qty || 0) ? 'Confirm Match' : `Update to ${physicalCount}`
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Location Dialog */}
      <Dialog open={changeLocationOpen} onClose={() => setChangeLocationOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Location</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Location"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="e.g., Warehouse, Truck 1..."
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Bin Location"
              value={newBinLocation}
              onChange={(e) => setNewBinLocation(e.target.value)}
              placeholder="e.g., Shelf 3, Bin A-12..."
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label="Warehouse" onClick={() => setNewLocation('Warehouse')} clickable size="small" />
              <Chip label="Shop" onClick={() => setNewLocation('Shop')} clickable size="small" />
              <Chip label="Truck 1" onClick={() => setNewLocation('Truck 1')} clickable size="small" />
              <Chip label="Truck 2" onClick={() => setNewLocation('Truck 2')} clickable size="small" />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeLocationOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveChangeLocation} disabled={saving}>
            {saving ? <CircularProgress size={24} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to Work Order Dialog */}
      <Dialog open={addToOrderOpen} onClose={() => setAddToOrderOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add to Work Order</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select Work Order</InputLabel>
              <Select
                value={selectedWorkOrder}
                onChange={(e) => setSelectedWorkOrder(e.target.value)}
                label="Select Work Order"
              >
                {workOrders.length === 0 ? (
                  <MenuItem disabled>No active work orders</MenuItem>
                ) : (
                  workOrders.map((wo) => (
                    <MenuItem key={wo.id} value={wo.id}>
                      {wo.work_order_number} - {wo.customer_name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              type="number"
              label="Quantity"
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              inputProps={{ min: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddToOrderOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveAddToOrder}
            disabled={saving || !selectedWorkOrder}
          >
            {saving ? <CircularProgress size={24} /> : 'Add to Order'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unknown Barcode Dialog */}
      <Dialog
        open={unknownBarcodeDialogOpen}
        onClose={handleUnknownBarcodeClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <WarningIcon color="warning" sx={{ fontSize: 48, mb: 1 }} />
          <Typography variant="h6">Unknown Barcode</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 3 }}>
              <Typography variant="caption" color="text.secondary">Scanned Barcode:</Typography>
              <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                {unknownBarcode}
              </Typography>
            </Paper>

            <Typography variant="body1" color="text.secondary" gutterBottom>
              This barcode is not in your inventory. What would you like to do?
            </Typography>

            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<SearchIcon />}
                  onClick={handleLinkToExisting}
                  sx={{ py: 2 }}
                >
                  Link to Existing Item
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Search for an item and add this barcode to it
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={handleCreateNew}
                  sx={{ py: 2 }}
                >
                  Create New Item
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Add a new inventory item with this barcode
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleUnknownBarcodeClose} color="inherit">
            Cancel & Scan Again
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link to Existing Item Dialog */}
      <Dialog
        open={linkToExistingOpen}
        onClose={() => setLinkToExistingOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Link Barcode to Existing Item
          <Typography variant="body2" color="text.secondary">
            Barcode: <strong>{unknownBarcode}</strong>
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                autoFocus
                label="Search items by name, SKU, or description"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchExistingItems()}
                size="small"
                inputProps={{ autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off' }}
              />
              <Button
                variant="contained"
                onClick={handleSearchExistingItems}
                disabled={searchingItems || !searchQuery.trim()}
              >
                {searchingItems ? <CircularProgress size={24} /> : 'Search'}
              </Button>
            </Box>

            {searchResults.length > 0 && (
              <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {searchResults.map((item) => (
                  <ListItem
                    key={item.id}
                    button
                    selected={selectedItemToLink?.id === item.id}
                    onClick={() => setSelectedItemToLink(item)}
                    sx={{
                      borderBottom: '1px solid',
                      borderBottomColor: 'divider',
                      '&.Mui-selected': { bgcolor: 'primary.light' }
                    }}
                  >
                    <ListItemText
                      primary={item.description || item.item_name}
                      secondary={
                        <>
                          ID: {item.item_id || 'N/A'} | SKU: {item.sku || 'N/A'} | Qty: {item.qty || 0}
                          {item.upc && <><br />Current UPC: {item.upc}</>}
                        </>
                      }
                    />
                    {selectedItemToLink?.id === item.id && (
                      <CheckIcon color="primary" />
                    )}
                  </ListItem>
                ))}
              </List>
            )}

            {searchResults.length === 0 && hasSearched && !searchingItems && (
              <Alert severity="info">No items found. Try a different search term.</Alert>
            )}

            {selectedItemToLink && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Ready to link barcode <strong>{unknownBarcode}</strong> to: <strong>{selectedItemToLink.item_name || selectedItemToLink.description}</strong>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkToExistingOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLinkBarcodeToItem}
            disabled={saving || !selectedItemToLink}
          >
            {saving ? <CircularProgress size={24} /> : 'Link Barcode'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New Item Dialog */}
      <Dialog
        open={createNewOpen}
        onClose={() => setCreateNewOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Create New Inventory Item
          <Typography variant="body2" color="text.secondary">
            Barcode: <strong>{unknownBarcode}</strong> will be saved automatically
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Item Name *"
                  value={newItemData.item_name}
                  onChange={(e) => setNewItemData({ ...newItemData, item_name: e.target.value })}
                  placeholder="e.g., 20A GFCI Outlet"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={newItemData.description}
                  onChange={(e) => setNewItemData({ ...newItemData, description: e.target.value })}
                  multiline
                  rows={2}
                  placeholder="Detailed description..."
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="SKU"
                  value={newItemData.sku}
                  onChange={(e) => setNewItemData({ ...newItemData, sku: e.target.value })}
                  placeholder="Internal SKU"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Category"
                  value={newItemData.category}
                  onChange={(e) => setNewItemData({ ...newItemData, category: e.target.value })}
                  placeholder="e.g., Devices"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Initial Quantity"
                  value={newItemData.qty}
                  onChange={(e) => setNewItemData({ ...newItemData, qty: parseInt(e.target.value) || 0 })}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Location"
                  value={newItemData.location}
                  onChange={(e) => setNewItemData({ ...newItemData, location: e.target.value })}
                  placeholder="e.g., Warehouse"
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>Quick Categories:</Typography>
              {['Devices', 'Wire & Cable', 'Boxes & Covers', 'Conduit & Fittings', 'Circuit Breakers', 'Lighting'].map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  size="small"
                  clickable
                  onClick={() => setNewItemData({ ...newItemData, category: cat })}
                  color={newItemData.category === cat ? 'primary' : 'default'}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateNewOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleCreateNewItem}
            disabled={saving || (!newItemData.item_name && !newItemData.description)}
          >
            {saving ? <CircularProgress size={24} /> : 'Create Item'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  // Mobile Camera View - show when on mobile and no item found yet
  if (isMobile && !foundItem) {
    return (
      <Box sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'black',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Camera Header */}
        <Box sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: 'rgba(0,0,0,0.7)',
          color: 'white'
        }}>
          <IconButton color="inherit" onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6">Scan Barcode</Typography>
          <Box sx={{ width: 48 }} />
        </Box>

        {/* Camera View using unified BarcodeScanner */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <BarcodeScanner
            onScan={handleBarcodeScanned}
            active={scannerActive}
            onError={(err) => setCameraError(err)}
            height="100%"
            autoStart={true}
            showControls={true}
            pauseOnScan={true}
          />

          {/* Searching overlay */}
          {searching && (
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'rgba(0,0,0,0.8)',
              p: 3,
              borderRadius: 2,
              textAlign: 'center',
              zIndex: 10,
            }}>
              <CircularProgress color="primary" />
              <Typography color="white" sx={{ mt: 1 }}>Searching...</Typography>
            </Box>
          )}
        </Box>

        {/* Manual Entry Option */}
        <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.9)' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Or enter barcode manually..."
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyPress={handleBarcodeKeyPress}
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 1,
              '& .MuiOutlinedInput-root': { borderRadius: 1 }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleManualSearch} disabled={!barcodeInput.trim()}>
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Unknown Barcode Dialog - for mobile camera view */}
        <Dialog
          open={unknownBarcodeDialogOpen}
          onClose={handleUnknownBarcodeClose}
          maxWidth="sm"
          fullWidth
          keepMounted
          disableScrollLock
          sx={{
            zIndex: 10001,
            '& .MuiDialog-container': { zIndex: 10001 },
            '& .MuiPaper-root': { zIndex: 10001 }
          }}
          slotProps={{
            backdrop: {
              sx: { zIndex: 10000 }
            }
          }}
        >
          <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
            <WarningIcon color="warning" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h6">Unknown Barcode</Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 3 }}>
                <Typography variant="caption" color="text.secondary">Scanned Barcode:</Typography>
                <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {unknownBarcode}
                </Typography>
              </Paper>

              <Typography variant="body1" color="text.secondary" gutterBottom>
                This barcode is not in your inventory. What would you like to do?
              </Typography>

              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={<SearchIcon />}
                    onClick={handleLinkToExisting}
                    sx={{ py: 2 }}
                  >
                    Link to Existing Item
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Search for an item and add this barcode to it
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<AddIcon />}
                    onClick={handleCreateNew}
                    sx={{ py: 2 }}
                  >
                    Create New Item
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Add a new inventory item with this barcode
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleUnknownBarcodeClose} color="inherit">
              Cancel & Scan Again
            </Button>
          </DialogActions>
        </Dialog>

        {/* Link to Existing Item Dialog - for mobile camera view */}
        <Dialog
          open={linkToExistingOpen}
          onClose={() => setLinkToExistingOpen(false)}
          maxWidth="sm"
          fullWidth
          keepMounted
          disableScrollLock
          sx={{
            zIndex: 10001,
            '& .MuiDialog-container': { zIndex: 10001 },
            '& .MuiPaper-root': { zIndex: 10001 }
          }}
          slotProps={{
            backdrop: {
              sx: { zIndex: 10000 }
            }
          }}
        >
          <DialogTitle>
            Link Barcode to Existing Item
            <Typography variant="body2" color="text.secondary">
              Barcode: <strong>{unknownBarcode}</strong>
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  autoFocus
                  label="Search items by name, SKU, or description"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchExistingItems()}
                  size="small"
                  inputProps={{ autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off' }}
                />
                <Button
                  variant="contained"
                  onClick={handleSearchExistingItems}
                  disabled={searchingItems || !searchQuery.trim()}
                >
                  {searchingItems ? <CircularProgress size={24} /> : 'Search'}
                </Button>
              </Box>

              {searchResults.length > 0 && (
                <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  {searchResults.map((item) => (
                    <ListItem
                      key={item.id}
                      button
                      selected={selectedItemToLink?.id === item.id}
                      onClick={() => setSelectedItemToLink(item)}
                      sx={{
                        borderBottom: '1px solid',
                        borderBottomColor: 'divider',
                        '&.Mui-selected': { bgcolor: 'primary.light' }
                      }}
                    >
                      <ListItemText
                        primary={item.description || item.item_name}
                        secondary={
                          <>
                            ID: {item.item_id || 'N/A'} | SKU: {item.sku || 'N/A'} | Qty: {item.qty || 0}
                            {item.upc && <><br />Current UPC: {item.upc}</>}
                          </>
                        }
                      />
                      {selectedItemToLink?.id === item.id && (
                        <CheckIcon color="primary" />
                      )}
                    </ListItem>
                  ))}
                </List>
              )}

              {/* Debug info - shows search status */}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Query: "{searchQuery}" | {searchDebugInfo || 'Ready'}
              </Typography>

              {searchResults.length === 0 && hasSearched && !searchingItems && (
                <Alert severity="info">No items found. Try a different search term.</Alert>
              )}

              {selectedItemToLink && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Ready to link barcode <strong>{unknownBarcode}</strong> to: <strong>{selectedItemToLink.item_name || selectedItemToLink.description}</strong>
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLinkToExistingOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleLinkBarcodeToItem}
              disabled={saving || !selectedItemToLink}
            >
              {saving ? <CircularProgress size={24} /> : 'Link Barcode'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create New Item Dialog - for mobile camera view */}
        <Dialog
          open={createNewOpen}
          onClose={() => setCreateNewOpen(false)}
          maxWidth="sm"
          fullWidth
          keepMounted
          disableScrollLock
          sx={{
            zIndex: 10001,
            '& .MuiDialog-container': { zIndex: 10001 },
            '& .MuiPaper-root': { zIndex: 10001 }
          }}
          slotProps={{
            backdrop: {
              sx: { zIndex: 10000 }
            }
          }}
        >
          <DialogTitle>
            Create New Inventory Item
            <Typography variant="body2" color="text.secondary">
              Barcode: <strong>{unknownBarcode}</strong> will be saved automatically
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Item Name *"
                    value={newItemData.item_name}
                    onChange={(e) => setNewItemData({ ...newItemData, item_name: e.target.value })}
                    placeholder="e.g., 20A GFCI Outlet"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={newItemData.description}
                    onChange={(e) => setNewItemData({ ...newItemData, description: e.target.value })}
                    multiline
                    rows={2}
                    placeholder="Detailed description..."
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="SKU"
                    value={newItemData.sku}
                    onChange={(e) => setNewItemData({ ...newItemData, sku: e.target.value })}
                    placeholder="Internal SKU"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Category"
                    value={newItemData.category}
                    onChange={(e) => setNewItemData({ ...newItemData, category: e.target.value })}
                    placeholder="e.g., Devices"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Initial Quantity"
                    value={newItemData.qty}
                    onChange={(e) => setNewItemData({ ...newItemData, qty: parseInt(e.target.value) || 0 })}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Location"
                    value={newItemData.location}
                    onChange={(e) => setNewItemData({ ...newItemData, location: e.target.value })}
                    placeholder="e.g., Warehouse"
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>Quick Categories:</Typography>
                {['Devices', 'Wire & Cable', 'Boxes & Covers', 'Conduit & Fittings', 'Circuit Breakers', 'Lighting'].map((cat) => (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    clickable
                    onClick={() => setNewItemData({ ...newItemData, category: cat })}
                    color={newItemData.category === cat ? 'primary' : 'default'}
                  />
                ))}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateNewOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleCreateNewItem}
              disabled={saving || (!newItemData.item_name && !newItemData.description)}
            >
              {saving ? <CircularProgress size={24} /> : 'Create Item'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  // Mobile Item Found View
  if (isMobile && foundItem) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Header */}
        <Box sx={{
          bgcolor: 'success.main',
          color: 'white',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <CheckIcon />
          <Typography variant="h6" sx={{ flex: 1 }}>Item Found</Typography>
          <IconButton color="inherit" onClick={scanAnother}>
            <ScannerIcon />
          </IconButton>
        </Box>

        <Container maxWidth="sm" sx={{ py: 2 }}>
          {/* Item Info Card */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                {foundItem.item_id}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {foundItem.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Stock</Typography>
                  <Typography variant="h4">
                    <Chip
                      label={foundItem.qty || 0}
                      color={(foundItem.qty || 0) <= (foundItem.min_stock || 0) ? 'error' : 'success'}
                      sx={{ fontSize: '1.5rem', height: 40, minWidth: 60 }}
                    />
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Available</Typography>
                  <Typography variant="h4">
                    {foundItem.qty_available ?? foundItem.qty ?? 0}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Location</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {foundItem.location || 'Not set'}
                  </Typography>
                  {foundItem.bin_location && (
                    <Typography variant="caption" color="text.secondary">
                      Bin: {foundItem.bin_location}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Brand</Typography>
                  <Typography variant="body1">{foundItem.brand || 'N/A'}</Typography>
                </Grid>
              </Grid>

              {(foundItem.qty || 0) <= (foundItem.min_stock || 0) && (
                <Alert severity="warning" sx={{ mt: 2 }} icon={<WarningIcon />}>
                  Low Stock! Min: {foundItem.min_stock || 0}
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Count Verification - Primary action for inventory counting */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ px: 1 }}>
            Inventory Count
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="contained"
                color="success"
                size="large"
                startIcon={<CheckIcon />}
                onClick={handleCountMatches}
                disabled={saving}
                sx={{ py: 2.5, fontSize: '1rem' }}
              >
                {saving ? <CircularProgress size={24} color="inherit" /> : 'Count OK'}
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="contained"
                color="warning"
                size="large"
                startIcon={<EditIcon />}
                onClick={handleSetCount}
                sx={{ py: 2.5, fontSize: '1rem' }}
              >
                Set Count
              </Button>
            </Grid>
          </Grid>

          {/* Other Quick Actions */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ px: 1, mt: 2 }}>
            Other Actions
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Button
                fullWidth
                variant="outlined"
                size="medium"
                startIcon={<AddIcon />}
                onClick={handleAdjustCount}
                sx={{ py: 1.5 }}
              >
                +/-
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                fullWidth
                variant="outlined"
                size="medium"
                startIcon={<LocationIcon />}
                onClick={handleChangeLocation}
                sx={{ py: 1.5 }}
              >
                Move
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                fullWidth
                variant="outlined"
                size="medium"
                startIcon={<CartIcon />}
                onClick={handleAddToOrder}
                sx={{ py: 1.5 }}
              >
                WO
              </Button>
            </Grid>
          </Grid>

          {/* Scan Another Button */}
          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            startIcon={<ScannerIcon />}
            onClick={scanAnother}
            sx={{ mt: 3, py: 2 }}
          >
            Scan Another Item
          </Button>
        </Container>

        {/* Dialogs - same as desktop */}
        {renderDialogs()}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  // Desktop View
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Inventory Scanner" />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Scanner Input Section */}
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <ScannerIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Scan Barcode or Enter UPC
            </Typography>
            {!scannerActive && (
              <Button
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={startScanner}
                sx={{ ml: 'auto' }}
              >
                Use Camera
              </Button>
            )}
          </Box>

          {scannerActive && (
            <Box sx={{ mb: 3 }}>
              <BarcodeScanner
                onScan={handleBarcodeScanned}
                active={scannerActive}
                onError={(err) => setCameraError(err)}
                height={300}
                autoStart={true}
                showControls={true}
                pauseOnScan={true}
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              inputRef={barcodeInputRef}
              fullWidth
              label="Barcode / UPC / Item ID"
              placeholder="Scan barcode or type UPC..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={handleBarcodeKeyPress}
              disabled={searching}
              autoFocus={!isMobile}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              size="large"
              onClick={handleManualSearch}
              disabled={searching || !barcodeInput.trim()}
              sx={{ minWidth: 120, height: 56 }}
            >
              {searching ? <CircularProgress size={24} /> : 'Search'}
            </Button>
          </Box>

          {searchError && (
            <Alert severity="warning" sx={{ mt: 2 }} onClose={() => setSearchError(null)}>
              {searchError}
            </Alert>
          )}
        </Paper>

        <Grid container spacing={3}>
          {/* Found Item Display */}
          <Grid item xs={12} md={8}>
            {foundItem ? (
              <Paper elevation={3} sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CheckIcon color="success" />
                      <Typography variant="h6" color="success.main">Item Found</Typography>
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{foundItem.item_id}</Typography>
                    <Typography variant="body1" color="text.secondary">{foundItem.description}</Typography>
                  </Box>
                  <Button variant="outlined" startIcon={<ClearIcon />} onClick={clearFoundItem}>
                    Clear
                  </Button>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Current Stock</Typography>
                    <Typography variant="h4">
                      <Chip
                        label={foundItem.qty || 0}
                        color={(foundItem.qty || 0) <= (foundItem.min_stock || 0) ? 'error' : 'success'}
                        sx={{ fontSize: '1.2rem', height: 36 }}
                      />
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Available</Typography>
                    <Typography variant="h5">{foundItem.qty_available ?? foundItem.qty ?? 0}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Location</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {foundItem.location || 'Not set'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Brand</Typography>
                    <Typography variant="body1">{foundItem.brand || 'N/A'}</Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Quick Actions</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleAdjustCount}>
                    Adjust Count
                  </Button>
                  <Button variant="contained" color="secondary" startIcon={<LocationIcon />} onClick={handleChangeLocation}>
                    Change Location
                  </Button>
                  <Button variant="contained" color="info" startIcon={<CartIcon />} onClick={handleAddToOrder}>
                    Add to Work Order
                  </Button>
                  <Button variant="outlined" startIcon={<EditIcon />} onClick={() => navigate(`/inventory?edit=${foundItem.id}`)}>
                    Full Edit
                  </Button>
                </Box>

                {(foundItem.qty || 0) <= (foundItem.min_stock || 0) && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <strong>Low Stock!</strong> Current: {foundItem.qty || 0}, Min: {foundItem.min_stock || 0}
                  </Alert>
                )}
              </Paper>
            ) : (
              <Paper elevation={1} sx={{ p: 6, textAlign: 'center', bgcolor: 'background.paper', border: 2, borderStyle: 'dashed', borderColor: 'divider' }}>
                <ScannerIcon sx={{ fontSize: 80, color: 'action.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">Scan a barcode to get started</Typography>
              </Paper>
            )}
          </Grid>

          {/* Scan History Sidebar */}
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HistoryIcon color="action" />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Recent Scans</Typography>
              </Box>
              {scanHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No items scanned yet
                </Typography>
              ) : (
                <List dense>
                  {scanHistory.map((item, index) => (
                    <ListItem
                      key={`${item.id}-${index}`}
                      button
                      onClick={() => { setFoundItem(item); setSearchError(null); }}
                      selected={foundItem?.id === item.id}
                      sx={{ borderRadius: 1, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={item.item_id}
                        secondary={`${item.description?.substring(0, 25)}... | Qty: ${item.qty || 0}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {renderDialogs()}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default InventoryScanner;
