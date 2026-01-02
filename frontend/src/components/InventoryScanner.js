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
  updateInventoryItem,
  fetchWorkOrders,
  addMaterialToWorkOrder,
} from '../api';
import { BrowserMultiFormatReader } from '@zxing/library';
import logger from '../utils/logger';
function InventoryScanner() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const barcodeInputRef = useRef(null);
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);

  // Scanner mode state
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [useNativeCamera, setUseNativeCamera] = useState(false);
  const fileInputRef = useRef(null);

  // Barcode/search state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Found item state
  const [foundItem, setFoundItem] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);

  // Quick action dialogs
  const [adjustCountOpen, setAdjustCountOpen] = useState(false);
  const [changeLocationOpen, setChangeLocationOpen] = useState(false);
  const [addToOrderOpen, setAddToOrderOpen] = useState(false);

  // Action states
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newBinLocation, setNewBinLocation] = useState('');
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);

  // UI state
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Initialize barcode reader - just create the reader, don't start camera yet
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();
    logger.log('BrowserMultiFormatReader initialized');

    // On mobile, auto-start camera after component mounts
    if (isMobile) {
      // Small delay to ensure video element is ready
      const timer = setTimeout(() => {
        startScannerDirect();
      }, 300);
      return () => clearTimeout(timer);
    }

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, [isMobile]);

  // Direct camera start - uses constraints instead of device ID for better compatibility
  const startScannerDirect = async () => {
    setCameraError(null);
    setScannerActive(true);

    // Wait for video element
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      if (!videoRef.current) {
        logger.error('Video element not found');
        setCameraError('Camera view not ready. Please try again.');
        setScannerActive(false);
        return;
      }

      logger.log('Starting scanner with back camera preference...');

      // Use constraints with facingMode instead of deviceId for better mobile support
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Prefer back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      await codeReaderRef.current.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, error) => {
          if (result) {
            const barcode = result.getText();
            logger.log('Barcode scanned:', barcode);
            handleBarcodeScanned(barcode);
          }
        }
      );

      logger.log('Scanner started successfully');

      // Get available cameras for switch button (after permission granted)
      try {
        const devices = await codeReaderRef.current.listVideoInputDevices();
        logger.log('Available cameras:', devices);
        setAvailableCameras(devices);
        if (devices.length > 0) {
          setSelectedCamera(devices[0].deviceId);
        }
      } catch (e) {
        logger.log('Could not list cameras:', e);
      }

    } catch (err) {
      logger.error('Scanner error:', err);
      setScannerActive(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access denied. Please allow camera permission and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is in use by another app. Please close other camera apps and try again.');
      } else if (err.name === 'OverconstrainedError') {
        setCameraError('Camera does not support the required settings. Trying again...');
        // Try again with simpler constraints
        setTimeout(() => startScannerSimple(), 500);
      } else {
        setCameraError(`Camera error: ${err.message || err.name || 'Unknown error'}`);
      }
    }
  };

  // Fallback simple start for older devices
  const startScannerSimple = async () => {
    try {
      if (!videoRef.current) return;

      await codeReaderRef.current.decodeFromConstraints(
        { video: true },
        videoRef.current,
        (result, error) => {
          if (result) {
            handleBarcodeScanned(result.getText());
          }
        }
      );
      setScannerActive(true);
      setCameraError(null);
    } catch (err) {
      logger.error('Simple scanner also failed:', err);
      setCameraError('Could not start camera. Please check permissions in browser settings.');
      setScannerActive(false);
    }
  };

  const startScannerWithDevice = async (deviceId) => {
    setCameraError(null);
    setScannerActive(true);

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      if (!videoRef.current) {
        logger.error('Video element not found');
        setCameraError('Camera view not ready. Please try again.');
        setScannerActive(false);
        return;
      }

      logger.log('Starting scanner with device:', deviceId);

      await codeReaderRef.current.decodeFromVideoDevice(
        deviceId || undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            const barcode = result.getText();
            logger.log('Barcode scanned:', barcode);
            handleBarcodeScanned(barcode);
          }
        }
      );
      logger.log('Scanner started successfully');
    } catch (err) {
      logger.error('Scanner error:', err);
      setCameraError('Could not start camera. Please check permissions and try again.');
      setScannerActive(false);
    }
  };

  const startScanner = async () => {
    // Use direct method for better compatibility
    await startScannerDirect();
  };

  // Handle image capture from native camera (works without HTTPS)
  const handleImageCapture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSearching(true);
    setCameraError(null);

    try {
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      // Create image URL from file
      const imageUrl = URL.createObjectURL(file);

      // Decode barcode from image
      const result = await codeReaderRef.current.decodeFromImageUrl(imageUrl);

      // Clean up
      URL.revokeObjectURL(imageUrl);

      if (result) {
        const barcode = result.getText();
        logger.log('Barcode from image:', barcode);
        handleBarcodeScanned(barcode);
      }
    } catch (err) {
      logger.error('Could not read barcode from image:', err);
      setCameraError('No barcode found in image. Please try again with better lighting or positioning.');
      setSearching(false);
    }

    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openNativeCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const stopScanner = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setScannerActive(false);
  };

  const switchCamera = () => {
    const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCamera(availableCameras[nextIndex].deviceId);

    // Restart scanner with new camera
    if (scannerActive) {
      stopScanner();
      setTimeout(() => startScanner(), 100);
    }
  };

  // Handle barcode scanned from camera
  const handleBarcodeScanned = async (barcode) => {
    // Stop scanner temporarily to prevent multiple scans
    stopScanner();

    setBarcodeInput(barcode);
    await searchForItem(barcode);
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
        setSearchError(`No item found with barcode: "${searchTerm}"`);
        showSnackbar('Item not found', 'warning');
        // Restart scanner after a short delay
        if (isMobile) {
          setTimeout(() => startScanner(), 2000);
        }
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
    } catch (err) {
      showSnackbar(err.message || 'Failed to adjust stock', 'error');
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
        {/* Hidden file input for native camera */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleImageCapture}
          style={{ display: 'none' }}
        />

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
          {availableCameras.length > 1 && scannerActive && (
            <IconButton color="inherit" onClick={switchCamera}>
              <FlipCameraIcon />
            </IconButton>
          )}
          {!scannerActive && <Box sx={{ width: 48 }} />}
        </Box>

        {/* Camera View */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Video element - always rendered but may be hidden */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: scannerActive ? 'block' : 'none',
            }}
          />

          {/* Show camera options if not active */}
          {!scannerActive && !cameraError && !searching && (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <CameraIcon sx={{ fontSize: 80, color: 'white', mb: 2 }} />
              <Typography color="white" variant="h6" gutterBottom>
                Scan Barcode
              </Typography>
              <Typography color="grey.400" variant="body2" sx={{ mb: 3 }}>
                Take a photo of the barcode to scan
              </Typography>

              {/* Primary: Native camera - works on HTTP */}
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<CameraIcon />}
                onClick={openNativeCamera}
                sx={{ py: 2, px: 4, mb: 2, width: '100%', maxWidth: 280 }}
              >
                Take Photo to Scan
              </Button>

              {/* Secondary: Try live scanner (may not work on HTTP) */}
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={startScanner}
                sx={{ color: 'grey.400', borderColor: 'grey.600' }}
              >
                Try Live Scanner
              </Button>
            </Box>
          )}

          {/* Scan overlay - only show when camera is active */}
          {scannerActive && (
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              maxWidth: 300,
              height: 150,
              border: '3px solid #4caf50',
              borderRadius: 2,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
            }}>
              <Box sx={{
                position: 'absolute',
                top: -30,
                left: '50%',
                transform: 'translateX(-50%)',
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'white',
                px: 2,
                py: 0.5,
                borderRadius: 1,
              }}>
                <Typography variant="caption">Position barcode here</Typography>
              </Box>
            </Box>
          )}

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
            }}>
              <CircularProgress color="primary" />
              <Typography color="white" sx={{ mt: 1 }}>Reading barcode...</Typography>
            </Box>
          )}

          {cameraError && (
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'rgba(0,0,0,0.9)',
              p: 3,
              borderRadius: 2,
              textAlign: 'center',
              maxWidth: '80%',
            }}>
              <WarningIcon color="error" sx={{ fontSize: 48 }} />
              <Typography color="white" sx={{ mt: 1 }}>{cameraError}</Typography>
              <Button
                variant="contained"
                color="success"
                sx={{ mt: 2, mr: 1 }}
                onClick={openNativeCamera}
              >
                Take Photo
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                sx={{ mt: 2, color: 'white', borderColor: 'white' }}
                onClick={() => setCameraError(null)}
              >
                Cancel
              </Button>
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
              bgcolor: 'white',
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
      </Box>
    );
  }

  // Mobile Item Found View
  if (isMobile && foundItem) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
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

          {/* Quick Action Buttons */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ px: 1 }}>
            Quick Actions
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                startIcon={<AddIcon />}
                onClick={handleAdjustCount}
                sx={{ py: 2 }}
              >
                Adjust Count
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                size="large"
                startIcon={<LocationIcon />}
                onClick={handleChangeLocation}
                sx={{ py: 2 }}
              >
                Location
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="contained"
                color="info"
                size="large"
                startIcon={<CartIcon />}
                onClick={handleAddToOrder}
                sx={{ py: 2 }}
              >
                Add to WO
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/inventory?edit=${foundItem.id}`)}
                sx={{ py: 2 }}
              >
                Full Edit
              </Button>
            </Grid>
          </Grid>

          {/* Scan Another Button */}
          <Button
            fullWidth
            variant="contained"
            color="success"
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

  // Render dialogs (shared between mobile and desktop)
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
    </>
  );

  // Desktop View
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
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
            <Box sx={{ mb: 3, position: 'relative' }}>
              <video
                ref={videoRef}
                style={{
                  width: '100%',
                  maxHeight: 300,
                  objectFit: 'cover',
                  borderRadius: 8,
                }}
              />
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<CloseIcon />}
                onClick={stopScanner}
                sx={{ position: 'absolute', top: 8, right: 8 }}
              >
                Close Camera
              </Button>
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
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
              <Paper elevation={1} sx={{ p: 6, textAlign: 'center', bgcolor: '#fafafa', border: '2px dashed #ddd' }}>
                <ScannerIcon sx={{ fontSize: 80, color: '#ccc', mb: 2 }} />
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
