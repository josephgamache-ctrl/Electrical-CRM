import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Card,
  CardContent,
} from '@mui/material';
import {
  QrCodeScanner as ScannerIcon,
  Search as SearchIcon,
  LocalShipping as VanIcon,
  Inventory as InventoryIcon,
  Assignment as WorkOrderIcon,
  ArrowBack as BackIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ShoppingCart as CartIcon,
  Refresh as RefreshIcon,
  Build as FixIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from './AppHeader';
import {
  fetchVans,
  fetchVanInventory,
  transferFromVan,
  transferToVan,
  getUserDefaultVan,
  fetchWorkOrders,
  addMaterialToWorkOrder,
  searchInventory,
  adjustStock,
} from '../api';
import logger from '../utils/logger';
import BarcodeScanner from './BarcodeScanner';

function JobMaterialScanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const barcodeInputRef = useRef(null);

  // Van selection
  const [vans, setVans] = useState([]);
  const [selectedVanId, setSelectedVanId] = useState('');
  const [vanInventory, setVanInventory] = useState([]);
  const [loadingVan, setLoadingVan] = useState(false);

  // Work order selection (optional - for linking materials to job)
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);

  // Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searching, setSearching] = useState(false);

  // Found item state
  const [foundItem, setFoundItem] = useState(null);
  const [itemSource, setItemSource] = useState(null); // 'van' or 'warehouse'

  // Transfer state
  const [transferQty, setTransferQty] = useState(1);
  const [usedMaterials, setUsedMaterials] = useState([]); // Track materials used this session

  // UI state
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [mode, setMode] = useState('use'); // 'use' = pull from van, 'load' = load to van, 'return' = return to warehouse

  // Fix quantity dialog state
  const [fixQtyDialogOpen, setFixQtyDialogOpen] = useState(false);
  const [fixQtyValue, setFixQtyValue] = useState(0);
  const [fixQtyLocation, setFixQtyLocation] = useState(''); // 'van' or 'warehouse'

  // Initialize
  useEffect(() => {
    loadVans();
    loadWorkOrders();

    // Check for work order ID in URL
    const woId = searchParams.get('workorder');
    if (woId) {
      setSelectedWorkOrderId(woId);
    }

  }, []);

  // Load van inventory when van is selected
  useEffect(() => {
    if (selectedVanId) {
      loadVanInventory();
    }
  }, [selectedVanId]);

  const loadVans = async () => {
    try {
      const data = await fetchVans(true);
      setVans(data || []);

      // Get user's default van and auto-select it
      const defaultVan = await getUserDefaultVan();
      if (defaultVan?.id) {
        setSelectedVanId(defaultVan.id);
      } else if (data && data.length > 0) {
        setSelectedVanId(data[0].id);
      }
    } catch (err) {
      logger.error('Error loading vans:', err);
      showSnackbar('Failed to load vans', 'error');
    }
  };

  const loadVanInventory = async () => {
    if (!selectedVanId) return;
    setLoadingVan(true);
    try {
      const data = await fetchVanInventory(selectedVanId);
      setVanInventory(data || []);
    } catch (err) {
      logger.error('Error loading van inventory:', err);
      showSnackbar('Failed to load van inventory', 'error');
    } finally {
      setLoadingVan(false);
    }
  };

  const loadWorkOrders = async () => {
    setLoadingWorkOrders(true);
    try {
      const data = await fetchWorkOrders();
      // Filter to only show active work orders
      const activeOrders = (data || []).filter(wo =>
        wo.status === 'scheduled' || wo.status === 'in_progress' || wo.status === 'pending'
      );
      setWorkOrders(activeOrders);
    } catch (err) {
      logger.error('Error loading work orders:', err);
    } finally {
      setLoadingWorkOrders(false);
    }
  };

  // Handle barcode from unified scanner component
  const handleScannerResult = (barcode) => {
    handleBarcodeScan(barcode);
  };

  const handleBarcodeScan = async (barcode) => {
    if (!barcode || searching) return;

    logger.log('JobMaterialScanner: Scanning barcode:', barcode);
    setBarcodeInput(barcode);
    setSearching(true);
    setFoundItem(null);
    setItemSource(null);

    try {
      // First check if item is in the selected van
      logger.log('JobMaterialScanner: Checking van inventory, items:', vanInventory.length);
      const vanItem = vanInventory.find(item =>
        item.item_id?.toLowerCase() === barcode.toLowerCase() ||
        item.barcode?.toLowerCase() === barcode.toLowerCase() ||
        item.upc?.toLowerCase() === barcode.toLowerCase()
      );

      if (vanItem && vanItem.quantity > 0) {
        logger.log('JobMaterialScanner: Found in van:', vanItem.item_id);
        setFoundItem(vanItem);
        setItemSource('van');
        setTransferQty(1);
        showSnackbar(`Found in van: ${vanItem.item_id}`, 'success');
      } else {
        // Search warehouse inventory
        logger.log('JobMaterialScanner: Searching warehouse for:', barcode);
        const results = await searchInventory(barcode);
        logger.log('JobMaterialScanner: Warehouse results:', results);
        if (results && results.length > 0) {
          const warehouseItem = results[0];
          setFoundItem(warehouseItem);
          setItemSource('warehouse');
          setTransferQty(1);
          showSnackbar(`Found in warehouse: ${warehouseItem.item_id}`, 'info');
        } else {
          showSnackbar('Item not found', 'warning');
        }
      }
    } catch (err) {
      logger.error('JobMaterialScanner: Search error:', err);
      showSnackbar(`Search failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleManualSearch = () => {
    if (barcodeInput.trim()) {
      handleBarcodeScan(barcodeInput.trim());
    }
  };

  // Use material from van (record as used on job)
  const handleUseMaterial = async () => {
    if (!foundItem || transferQty < 1) return;

    setSaving(true);
    try {
      if (itemSource === 'van') {
        // Transfer from van to "used" - decrements van inventory
        await transferFromVan(selectedVanId, foundItem.inventory_id, transferQty,
          selectedWorkOrderId ? `Used on WO #${selectedWorkOrderId}` : 'Used on job');

        // If work order selected, also record the material usage
        if (selectedWorkOrderId) {
          try {
            await addMaterialToWorkOrder(selectedWorkOrderId, foundItem.inventory_id, transferQty);
          } catch (err) {
            logger.warn('Could not link to work order:', err);
          }
        }

        // Track in session
        setUsedMaterials(prev => [...prev, {
          item_id: foundItem.item_id,
          description: foundItem.description,
          quantity: transferQty,
          timestamp: new Date().toISOString()
        }]);

        showSnackbar(`Used ${transferQty}x ${foundItem.item_id} from van`, 'success');
        loadVanInventory(); // Refresh van inventory
      } else {
        // Item from warehouse - load to van first, then mark as used
        showSnackbar('Load this item to van first using "Load to Van" mode', 'info');
      }

      setFoundItem(null);
      setBarcodeInput('');
    } catch (err) {
      showSnackbar(err.message || 'Failed to record material usage', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Load material from warehouse to van
  const handleLoadToVan = async () => {
    if (!foundItem || !selectedVanId || transferQty < 1) return;

    setSaving(true);
    try {
      await transferToVan(selectedVanId, foundItem.id, transferQty, 'Loaded via Job Scanner');
      showSnackbar(`Loaded ${transferQty}x ${foundItem.item_id} to van`, 'success');
      loadVanInventory();
      setFoundItem(null);
      setBarcodeInput('');
    } catch (err) {
      showSnackbar(err.message || 'Failed to load to van', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Return material from van to warehouse
  const handleReturnToWarehouse = async () => {
    if (!foundItem || !selectedVanId || transferQty < 1) return;

    setSaving(true);
    try {
      await transferFromVan(selectedVanId, foundItem.inventory_id, transferQty, 'Returned via Job Scanner');
      showSnackbar(`Returned ${transferQty}x ${foundItem.item_id} to warehouse`, 'success');
      loadVanInventory();
      setFoundItem(null);
      setBarcodeInput('');
    } catch (err) {
      showSnackbar(err.message || 'Failed to return to warehouse', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  // Open fix quantity dialog
  const openFixQtyDialog = (location) => {
    if (!foundItem) return;
    setFixQtyLocation(location);
    // Set initial value to current quantity
    if (location === 'van') {
      setFixQtyValue(foundItem.quantity || 0);
    } else {
      setFixQtyValue(foundItem.qty_available || foundItem.qty || 0);
    }
    setFixQtyDialogOpen(true);
  };

  // Handle fix quantity submission
  const handleFixQty = async () => {
    if (!foundItem) return;
    setSaving(true);
    try {
      if (fixQtyLocation === 'warehouse') {
        // Get current warehouse qty and calculate delta
        const currentQty = foundItem.qty_available || foundItem.qty || 0;
        const delta = fixQtyValue - currentQty;

        if (delta !== 0) {
          // Use the item's database ID
          const itemId = foundItem.id || foundItem.inventory_id;
          await adjustStock(itemId, delta, `Quick fix from Job Scanner: corrected ${currentQty} → ${fixQtyValue}`);

          // Update local state so the UI reflects the fix
          setFoundItem(prev => ({
            ...prev,
            qty: fixQtyValue,
            qty_available: fixQtyValue
          }));

          showSnackbar(`Warehouse qty corrected: ${currentQty} → ${fixQtyValue}`, 'success');
        }
      } else if (fixQtyLocation === 'van') {
        // For van inventory, we need to calculate the delta and transfer
        const currentQty = foundItem.quantity || 0;
        const delta = fixQtyValue - currentQty;

        if (delta !== 0) {
          if (delta > 0) {
            // Need to add more to van (transfer from warehouse)
            await transferToVan(selectedVanId, foundItem.inventory_id, delta, `Quick fix: added ${delta} to correct count`);
          } else {
            // Need to remove from van (transfer back to warehouse)
            await transferFromVan(selectedVanId, foundItem.inventory_id, Math.abs(delta), `Quick fix: removed ${Math.abs(delta)} to correct count`);
          }

          // Update local state
          setFoundItem(prev => ({
            ...prev,
            quantity: fixQtyValue
          }));

          // Reload van inventory to reflect changes
          loadVanInventory();

          showSnackbar(`Van qty corrected: ${currentQty} → ${fixQtyValue}`, 'success');
        }
      }

      setFixQtyDialogOpen(false);
    } catch (err) {
      logger.error('Fix quantity error:', err);
      showSnackbar(err.message || 'Failed to fix quantity', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedVan = vans.find(v => v.id === selectedVanId);
  const selectedWorkOrder = workOrders.find(wo => wo.id === parseInt(selectedWorkOrderId));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Job Materials">
        <IconButton color="inherit" onClick={() => navigate(-1)}>
          <BackIcon />
        </IconButton>
      </AppHeader>

      <Box sx={{ p: 2, flexGrow: 1, overflow: 'auto' }}>
        {/* Van & Work Order Selection */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
              <InputLabel>Van</InputLabel>
              <Select
                value={selectedVanId}
                onChange={(e) => setSelectedVanId(e.target.value)}
                label="Van"
                startAdornment={<VanIcon sx={{ mr: 1, color: 'primary.main' }} />}
              >
                {vans.map(van => (
                  <MenuItem key={van.id} value={van.id}>
                    {van.van_number} {van.name ? `- ${van.name}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200, flexGrow: 1 }}>
              <InputLabel>Work Order (Optional)</InputLabel>
              <Select
                value={selectedWorkOrderId}
                onChange={(e) => setSelectedWorkOrderId(e.target.value)}
                label="Work Order (Optional)"
                startAdornment={<WorkOrderIcon sx={{ mr: 1, color: 'secondary.main' }} />}
              >
                <MenuItem value="">None</MenuItem>
                {workOrders.map(wo => (
                  <MenuItem key={wo.id} value={wo.id}>
                    #{wo.id} - {wo.customer_name || wo.title || 'Untitled'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {selectedVan && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                size="small"
                icon={<InventoryIcon />}
                label={`${vanInventory.length} items in van`}
                color="primary"
                variant="outlined"
              />
              <IconButton size="small" onClick={loadVanInventory} disabled={loadingVan}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Paper>

        {/* Mode Selector */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip
            label="Use Material"
            icon={<CartIcon />}
            onClick={() => setMode('use')}
            color={mode === 'use' ? 'primary' : 'default'}
            variant={mode === 'use' ? 'filled' : 'outlined'}
          />
          <Chip
            label="Load to Van"
            icon={<AddIcon />}
            onClick={() => setMode('load')}
            color={mode === 'load' ? 'success' : 'default'}
            variant={mode === 'load' ? 'filled' : 'outlined'}
          />
          <Chip
            label="Return"
            icon={<RemoveIcon />}
            onClick={() => setMode('return')}
            color={mode === 'return' ? 'warning' : 'default'}
            variant={mode === 'return' ? 'filled' : 'outlined'}
          />
        </Box>

        {/* Scanner / Search */}
        <Paper sx={{ p: 2, mb: 2 }}>
          {/* Barcode Scanner Component */}
          <BarcodeScanner
            onScan={handleScannerResult}
            active={scannerActive}
            onError={(err) => setCameraError(err)}
            height={250}
            autoStart={true}
            showControls={true}
            pauseOnScan={true}
          />

          {/* Manual search when scanner not active */}
          {!scannerActive && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                placeholder="Scan or type item ID/barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searching && (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ),
                }}
                inputRef={barcodeInputRef}
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<ScannerIcon />}
                  onClick={() => setScannerActive(true)}
                  sx={{ flexGrow: 1 }}
                >
                  Scan Barcode
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleManualSearch}
                  disabled={!barcodeInput.trim() || searching}
                >
                  Search
                </Button>
              </Box>
            </Box>
          )}

          {/* Show manual entry when scanner is active */}
          {scannerActive && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Or enter barcode manually..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                InputProps={{
                  endAdornment: (
                    <Button size="small" onClick={handleManualSearch} disabled={!barcodeInput.trim()}>
                      Go
                    </Button>
                  ),
                }}
              />
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setScannerActive(false)}
                sx={{ mt: 1 }}
              >
                Stop Scanner
              </Button>
            </Box>
          )}
        </Paper>

        {/* Found Item */}
        {foundItem && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    {foundItem.item_id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {foundItem.description}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={itemSource === 'van' ? 'In Van' : 'Warehouse'}
                  color={itemSource === 'van' ? 'success' : 'info'}
                />
              </Box>

              <Divider sx={{ my: 1 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">
                    {itemSource === 'van' ? 'In Van:' : 'In Warehouse:'}{' '}
                    <strong>{itemSource === 'van' ? foundItem.quantity : (foundItem.qty_available || foundItem.qty || 0)}</strong>
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={<FixIcon />}
                    onClick={() => openFixQtyDialog(itemSource)}
                    sx={{ minWidth: 'auto', py: 0.25, px: 1 }}
                  >
                    Fix
                  </Button>
                </Box>
                {foundItem.cost && (
                  <Typography variant="body2">
                    Cost: ${foundItem.cost.toFixed(2)}
                  </Typography>
                )}
              </Box>

              {/* Quantity selector */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <IconButton
                  onClick={() => setTransferQty(Math.max(1, transferQty - 1))}
                  disabled={transferQty <= 1}
                >
                  <RemoveIcon />
                </IconButton>
                <TextField
                  type="number"
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                  inputProps={{ min: 1, style: { textAlign: 'center' } }}
                  sx={{ width: 80 }}
                  size="small"
                />
                <IconButton
                  onClick={() => setTransferQty(transferQty + 1)}
                >
                  <AddIcon />
                </IconButton>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {[1, 5, 10].map(qty => (
                    <Chip
                      key={qty}
                      label={qty}
                      size="small"
                      onClick={() => setTransferQty(qty)}
                      color={transferQty === qty ? 'primary' : 'default'}
                      clickable
                    />
                  ))}
                </Box>
              </Box>

              {/* Action buttons based on mode */}
              {mode === 'use' && (
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleUseMaterial}
                  disabled={saving || (itemSource === 'van' && foundItem.quantity < transferQty)}
                  startIcon={saving ? <CircularProgress size={20} /> : <CheckIcon />}
                >
                  Use {transferQty}x {foundItem.item_id}
                </Button>
              )}

              {mode === 'load' && (
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  size="large"
                  onClick={handleLoadToVan}
                  disabled={saving || itemSource === 'van'}
                  startIcon={saving ? <CircularProgress size={20} /> : <VanIcon />}
                >
                  {itemSource === 'van' ? 'Already in Van' : `Load ${transferQty}x to Van`}
                </Button>
              )}

              {mode === 'return' && (
                <Button
                  fullWidth
                  variant="contained"
                  color="warning"
                  size="large"
                  onClick={handleReturnToWarehouse}
                  disabled={saving || itemSource !== 'van'}
                  startIcon={saving ? <CircularProgress size={20} /> : <InventoryIcon />}
                >
                  {itemSource !== 'van' ? 'Not in Van' : `Return ${transferQty}x to Warehouse`}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Materials used this session */}
        {usedMaterials.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Materials Used This Session
            </Typography>
            <List dense>
              {usedMaterials.map((item, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`${item.quantity}x ${item.item_id}`}
                    secondary={item.description}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {/* Quick access to van inventory */}
        {!foundItem && vanInventory.length > 0 && mode === 'use' && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Van Inventory - Quick Select
            </Typography>
            <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
              {vanInventory.slice(0, 10).map((item) => (
                <ListItem
                  key={item.id}
                  button
                  onClick={() => {
                    setFoundItem(item);
                    setItemSource('van');
                    setTransferQty(1);
                  }}
                >
                  <ListItemText
                    primary={item.item_id}
                    secondary={item.description?.substring(0, 40)}
                  />
                  <ListItemSecondaryAction>
                    <Chip size="small" label={item.quantity} />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Box>

      {/* Fix Quantity Dialog */}
      <Dialog open={fixQtyDialogOpen} onClose={() => setFixQtyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FixIcon color="warning" />
            Fix Quantity
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Item:</strong> {foundItem?.item_id}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {foundItem?.description}
            </Typography>
            <Alert severity="info" sx={{ my: 2 }}>
              Correcting quantity at: <strong>{fixQtyLocation === 'van' ? selectedVan?.van_number || 'Van' : 'Warehouse'}</strong>
            </Alert>
            <TextField
              fullWidth
              type="number"
              label="Correct Quantity"
              value={fixQtyValue}
              onChange={(e) => setFixQtyValue(Math.max(0, parseInt(e.target.value) || 0))}
              inputProps={{ min: 0 }}
              sx={{ mt: 1 }}
              autoFocus
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              {[0, 1, 5, 10, 25, 50].map(qty => (
                <Chip
                  key={qty}
                  label={qty}
                  onClick={() => setFixQtyValue(qty)}
                  color={fixQtyValue === qty ? 'primary' : 'default'}
                  clickable
                  size="small"
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFixQtyDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleFixQty}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <FixIcon />}
          >
            Fix Quantity
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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

export default JobMaterialScanner;
