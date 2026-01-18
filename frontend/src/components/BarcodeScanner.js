import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  QrCodeScanner as ScannerIcon,
  Close as CloseIcon,
  FlipCameraAndroid as FlipCameraIcon,
  CameraAlt as CameraIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
} from '@mui/icons-material';
import { BrowserMultiFormatReader } from '@zxing/library';
import logger from '../utils/logger';

/**
 * Unified BarcodeScanner component
 *
 * Props:
 * - onScan: (barcode: string) => void - Called when barcode is detected
 * - active: boolean - Whether scanner should be active
 * - onError: (error: string) => void - Optional error callback
 * - onCameraReady: () => void - Called when camera is ready
 * - height: number | string - Scanner height (default: 300)
 * - autoStart: boolean - Whether to auto-start on mount (default: false on desktop, true on mobile)
 * - showControls: boolean - Show camera controls (default: true)
 * - pauseOnScan: boolean - Pause scanning after detection (default: true)
 */
const BarcodeScanner = ({
  onScan,
  active = true,
  onError,
  onCameraReady,
  height = 300,
  autoStart,
  showControls = true,
  pauseOnScan = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const fileInputRef = useRef(null);

  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);

  // Determine if should auto-start
  const shouldAutoStart = autoStart !== undefined ? autoStart : isMobile;

  // Initialize barcode reader
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();
    logger.log('BarcodeScanner: Reader initialized');

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  // Auto-start scanner when active and autoStart is true
  useEffect(() => {
    if (active && shouldAutoStart && !scannerActive && !isInitializing) {
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [active, shouldAutoStart, scannerActive, isInitializing]);

  // Stop scanner when component becomes inactive
  useEffect(() => {
    if (!active && scannerActive) {
      stopScanner();
    }
  }, [active]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  /**
   * Start scanner with progressive fallback strategy
   * Level 1: Ideal constraints (back camera, HD resolution)
   * Level 2: Basic back camera only
   * Level 3: Any camera
   */
  const startScanner = async () => {
    if (isInitializing || scannerActive) return;

    setCameraError(null);
    setIsInitializing(true);

    // Wait for video element
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      if (!videoRef.current) {
        throw new Error('Camera view not ready');
      }

      logger.log('BarcodeScanner: Starting with ideal constraints...');

      // Level 1: Ideal constraints
      const idealConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16/9 }
        }
      };

      try {
        await codeReaderRef.current.decodeFromConstraints(
          idealConstraints,
          videoRef.current,
          handleScanResult
        );
        setScannerActive(true);
        logger.log('BarcodeScanner: Started with ideal constraints');
        await enumerateCameras();
        onCameraReady?.();
        return;
      } catch (level1Error) {
        logger.log('BarcodeScanner: Level 1 failed:', level1Error.message);
        codeReaderRef.current.reset();
      }

      // Level 2: Basic back camera
      logger.log('BarcodeScanner: Trying basic back camera...');
      try {
        await codeReaderRef.current.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          handleScanResult
        );
        setScannerActive(true);
        logger.log('BarcodeScanner: Started with basic back camera');
        await enumerateCameras();
        onCameraReady?.();
        return;
      } catch (level2Error) {
        logger.log('BarcodeScanner: Level 2 failed:', level2Error.message);
        codeReaderRef.current.reset();
      }

      // Level 3: Any camera
      logger.log('BarcodeScanner: Trying any camera...');
      await codeReaderRef.current.decodeFromConstraints(
        { video: true },
        videoRef.current,
        handleScanResult
      );
      setScannerActive(true);
      logger.log('BarcodeScanner: Started with fallback camera');
      await enumerateCameras();
      onCameraReady?.();

    } catch (err) {
      logger.error('BarcodeScanner: All start attempts failed:', err);
      handleCameraError(err);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCameraError = (err) => {
    setScannerActive(false);
    let errorMessage;

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMessage = 'Camera access denied. Please allow camera permission and try again.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMessage = 'No camera found on this device.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMessage = 'Camera is in use by another app. Please close other camera apps.';
    } else if (err.name === 'OverconstrainedError') {
      errorMessage = 'Camera does not support required settings.';
    } else {
      errorMessage = `Camera error: ${err.message || err.name || 'Unknown error'}`;
    }

    setCameraError(errorMessage);
    onError?.(errorMessage);
  };

  const enumerateCameras = async () => {
    try {
      const devices = await codeReaderRef.current.listVideoInputDevices();
      logger.log('BarcodeScanner: Available cameras:', devices.length);
      setAvailableCameras(devices);
    } catch (e) {
      logger.log('BarcodeScanner: Could not enumerate cameras:', e);
    }
  };

  const handleScanResult = useCallback((result, error) => {
    if (result) {
      const barcode = result.getText();
      logger.log('BarcodeScanner: Detected:', barcode);

      if (pauseOnScan) {
        stopScanner();
      }

      onScan?.(barcode);
    }
    // Ignore errors during continuous scanning - they're expected when no barcode is visible
  }, [onScan, pauseOnScan]);

  const stopScanner = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setScannerActive(false);
  };

  const switchCamera = async () => {
    if (availableCameras.length <= 1) return;

    const nextIndex = (selectedCameraIndex + 1) % availableCameras.length;
    setSelectedCameraIndex(nextIndex);

    stopScanner();

    try {
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      await codeReaderRef.current.decodeFromVideoDevice(
        availableCameras[nextIndex].deviceId,
        videoRef.current,
        handleScanResult
      );
      setScannerActive(true);
      logger.log('BarcodeScanner: Switched to camera:', availableCameras[nextIndex].label);
    } catch (err) {
      logger.error('BarcodeScanner: Camera switch failed:', err);
      handleCameraError(err);
    }
  };

  // Handle image capture from file input (works without HTTPS)
  const handleImageCapture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      const imageUrl = URL.createObjectURL(file);
      const result = await codeReaderRef.current.decodeFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl);

      if (result) {
        const barcode = result.getText();
        logger.log('BarcodeScanner: From image:', barcode);
        onScan?.(barcode);
      }
    } catch (err) {
      logger.error('BarcodeScanner: Image scan failed:', err);
      setCameraError('No barcode found in image. Try better lighting or positioning.');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openImageCapture = () => {
    fileInputRef.current?.click();
  };

  // Resume scanning (call from parent after handling scan result)
  const resume = () => {
    if (!scannerActive) {
      startScanner();
    }
  };

  // Expose resume method via ref would require forwardRef - instead provide via callback
  // Parent can call startScanner externally if needed

  if (!active) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* Hidden file input for image capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageCapture}
        style={{ display: 'none' }}
      />

      {/* Scanner View */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: height,
          bgcolor: '#000',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: scannerActive ? 'block' : 'none',
          }}
          playsInline
          muted
          autoPlay
        />

        {/* Scanning Overlay */}
        {scannerActive && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              height: '40%',
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: 1,
              pointerEvents: 'none',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                bgcolor: 'primary.main',
                animation: 'scanLine 2s ease-in-out infinite',
              },
              '@keyframes scanLine': {
                '0%, 100%': { top: 0 },
                '50%': { top: '100%' },
              },
            }}
          />
        )}

        {/* Loading State */}
        {isInitializing && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.7)',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress sx={{ color: 'white', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'white' }}>
                Starting camera...
              </Typography>
            </Box>
          </Box>
        )}

        {/* Inactive State - Start Button */}
        {!scannerActive && !isInitializing && !cameraError && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.8)',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <IconButton
                onClick={startScanner}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  width: 80,
                  height: 80,
                  mb: 1,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <VideocamIcon sx={{ fontSize: 40 }} />
              </IconButton>
              <Typography variant="body2" sx={{ color: 'white' }}>
                Tap to start camera
              </Typography>
            </Box>
          </Box>
        )}

        {/* Controls Overlay */}
        {showControls && scannerActive && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            {availableCameras.length > 1 && (
              <Tooltip title="Switch camera">
                <IconButton
                  onClick={switchCamera}
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                  }}
                >
                  <FlipCameraIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Capture image">
              <IconButton
                onClick={openImageCapture}
                sx={{
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <CameraIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Stop camera">
              <IconButton
                onClick={stopScanner}
                sx={{
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <VideocamOffIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Error Display */}
      {cameraError && (
        <Alert
          severity="error"
          sx={{ mt: 1 }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                onClick={startScanner}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Retry
              </Button>
              <Button
                size="small"
                onClick={openImageCapture}
                startIcon={<CameraIcon />}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Use Photo
              </Button>
            </Box>
          }
        >
          {cameraError}
        </Alert>
      )}

      {/* Scanning Status */}
      {scannerActive && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 1,
            color: 'text.secondary',
          }}
        >
          Point camera at barcode to scan
        </Typography>
      )}
    </Box>
  );
};

// Export both default and named export for flexibility
export { BarcodeScanner };
export default BarcodeScanner;
