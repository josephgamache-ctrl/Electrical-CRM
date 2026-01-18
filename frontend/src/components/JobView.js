import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Chip,
  IconButton,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  TextField,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  CheckCircle as CheckCircleIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  Note as NoteIcon,
  PhotoCamera as PhotoCameraIcon,
  Videocam as VideocamIcon,
  PlayCircleOutline as PlayIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Navigation as NavigationIcon,
  Receipt as ReceiptIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  LocalShipping as VanIcon,
  Warehouse as WarehouseIcon,
  Work as JobIcon,
  PauseCircle as PauseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ZoomIn as ZoomInIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Assignment as TaskIcon,
  History as HistoryIcon,
  Security as PermitIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchWorkOrder,
  allocateMaterials,
  deallocateMaterials,
  markFieldAcquisition,
  fetchWorkOrderNotes,
  addWorkOrderNote,
  deleteWorkOrderNote,
  fetchWorkOrderPhotos,
  uploadWorkOrderPhoto,
  deleteWorkOrderPhoto,
  getPhotoUrl,
  fetchAuthenticatedPhoto,
  addMaterialToWorkOrder,
  updateWorkOrderStatus,
  getCurrentUser,
  createInvoice,
  fetchVans,
  fetchVanInventory,
  getUserDefaultVan,
  transferToVan,
  transferFromVan,
} from '../api';
import JobTasks from './JobTasks';
import ActivityTimeline from './ActivityTimeline';
import AppHeader from './AppHeader';
import AssignedAvatars from './common/AssignedAvatars';
import AddMaterialDialog from './AddMaterialDialog';
import DelayJobDialog from './DelayJobDialog';
import MaterialReconciliationDialog from './MaterialReconciliationDialog';
import {
  getPriorityColor,
  getMaterialStatusColor,
  getStockStatusColor,
  formatDateLong,
  formatTime,
  groupMaterialsByCategory,
} from '../utils/workOrderHelpers';
import logger from '../utils/logger';

function JobView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [workOrder, setWorkOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [pullingMaterial, setPullingMaterial] = useState(null);
  const [pullingAll, setPullingAll] = useState(false);
  const [fieldAcquiringMaterial, setFieldAcquiringMaterial] = useState(null);

  // Material action dialog state
  const [materialActionDialog, setMaterialActionDialog] = useState(null); // { material, action: 'pull' | 'gotit' }
  const [actionQuantity, setActionQuantity] = useState(1);
  const [actionCost, setActionCost] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // Notes & Photos state
  const [notes, setNotes] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Photo upload dialog state
  const [photoUploadDialog, setPhotoUploadDialog] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [photoNotes, setPhotoNotes] = useState('');
  const [photoType, setPhotoType] = useState('general');

  // Photo viewer modal state - full gallery with navigation
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState(null);
  const [viewerPhotoUrl, setViewerPhotoUrl] = useState(null);
  const [loadingViewerPhoto, setLoadingViewerPhoto] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoCache, setPhotoCache] = useState({}); // Cache loaded photo URLs
  const [thumbnailUrls, setThumbnailUrls] = useState({}); // Authenticated thumbnail URLs

  // Add Material Dialog state
  const [addMaterialDialog, setAddMaterialDialog] = useState(false);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // Van state for pull functionality
  const [vans, setVans] = useState([]);
  const [selectedVanId, setSelectedVanId] = useState('');
  const [vanInventory, setVanInventory] = useState([]);
  const [pullSource, setPullSource] = useState('warehouse'); // 'warehouse' or 'van'
  const [pullDestination, setPullDestination] = useState('job'); // 'job' or 'van'

  // Collapsible section state - Job Info and Status expanded by default
  const [expandedSections, setExpandedSections] = useState({
    jobInfo: true,
    status: true,
    tasks: false,
    materials: false,
    permits: false,
    notes: false,
    photos: false,
    activity: false,
  });

  // Handle accordion expansion toggle
  const handleSectionToggle = (section) => (event, isExpanded) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: isExpanded,
    }));
  };

  // Track mounted state for safe async updates
  const isMountedRef = useRef(true);
  
  // Cleanup blob URLs and mounted flag on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      if (viewerPhotoUrl) {
        URL.revokeObjectURL(viewerPhotoUrl);
      }
      // Clean up all thumbnail blob URLs
      Object.values(thumbnailUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    loadUserRole();
    loadWorkOrder();
    loadNotes();
    loadPhotos();
    loadVans();
  }, [id]);

  // Load vans and set default van
  const loadVans = async () => {
    try {
      const vanList = await fetchVans(true);
      setVans(vanList);

      // Try to get user's default van
      const defaultVan = await getUserDefaultVan();
      if (defaultVan?.van_id) {
        setSelectedVanId(defaultVan.van_id);
        // Load that van's inventory
        loadVanInventory(defaultVan.van_id);
      } else if (vanList.length > 0) {
        // Fallback to first van
        setSelectedVanId(vanList[0].id);
        loadVanInventory(vanList[0].id);
      }
    } catch (err) {
      logger.error('Error loading vans:', err);
    }
  };

  // Load inventory for selected van
  const loadVanInventory = async (vanId) => {
    if (!vanId) return;
    try {
      const items = await fetchVanInventory(vanId);
      setVanInventory(items);
    } catch (err) {
      logger.error('Error loading van inventory:', err);
    }
  };

  // When selected van changes, reload its inventory
  useEffect(() => {
    if (selectedVanId) {
      loadVanInventory(selectedVanId);
    }
  }, [selectedVanId]);

  const loadUserRole = async () => {
    try {
      const userData = await getCurrentUser();
      setUserRole(userData.role);
    } catch (err) {
      logger.error('Error loading user role:', err);
    }
  };

  const loadWorkOrder = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkOrder(id);
      if (isMountedRef.current) {
        setWorkOrder(data);  // Backend returns work order directly, not wrapped
      }
    } catch (err) {
      if (isMountedRef.current) {
        logger.error('Error loading work order:', err);
        setError(err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Get quantity available from selected source
  const getSourceAvailableQty = (material) => {
    if (pullSource === 'warehouse') {
      return material.available_qty || 0;
    } else {
      // Check van inventory for this item
      const vanItem = vanInventory.find(v => v.inventory_id === material.inventory_id);
      return vanItem?.quantity || 0;
    }
  };

  // Open dialog for pull action
  const openPullDialog = (material) => {
    const remaining = material.quantity_needed - (material.quantity_allocated || 0);
    setMaterialActionDialog({ material, action: 'pull' });
    // Reset to defaults
    setPullSource('warehouse');
    setPullDestination('job');
    setActionQuantity(Math.min(remaining, material.available_qty || 0));
    setActionCost('');
  };

  // Open dialog for got it action
  const openGotItDialog = (material) => {
    const remaining = material.quantity_needed - (material.quantity_allocated || 0);
    setMaterialActionDialog({ material, action: 'gotit' });
    setActionQuantity(remaining);
    setActionCost('');
  };

  // Close dialog
  const closeMaterialActionDialog = () => {
    setMaterialActionDialog(null);
    setActionQuantity(1);
    setActionCost('');
    setPullSource('warehouse');
    setPullDestination('job');
  };

  // Execute material action (pull or got it)
  const handleMaterialAction = async () => {
    if (!materialActionDialog) return;

    const { material, action } = materialActionDialog;
    const quantity = parseInt(actionQuantity) || 0;
    const cost = actionCost ? parseFloat(actionCost) : null;

    if (quantity <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    try {
      setProcessingAction(true);

      if (action === 'gotit') {
        // Got It = field acquisition (unchanged)
        await markFieldAcquisition(id, material.id, quantity, cost);
        setSuccessMessage(`Marked ${quantity} x ${material.description} as acquired`);
      } else if (action === 'pull') {
        // Handle different source/destination combinations
        const selectedVan = vans.find(v => v.id === selectedVanId);
        const vanName = selectedVan?.van_number || 'Van';

        if (pullSource === 'warehouse' && pullDestination === 'job') {
          // Warehouse → Job (original flow)
          await allocateMaterials(id, [material.id], quantity);
          setSuccessMessage(`Pulled ${quantity} x ${material.description} from warehouse to job`);
        } else if (pullSource === 'warehouse' && pullDestination === 'van') {
          // Warehouse → Van (stock the van)
          if (!selectedVanId) {
            setError('Please select a van first');
            return;
          }
          await transferToVan(selectedVanId, material.inventory_id, quantity, `Stocking for job #${workOrder?.work_order_number}`);
          setSuccessMessage(`Transferred ${quantity} x ${material.description} from warehouse to ${vanName}`);
          // Reload van inventory
          loadVanInventory(selectedVanId);
        } else if (pullSource === 'van' && pullDestination === 'job') {
          // Van → Job (use from van)
          if (!selectedVanId) {
            setError('Please select a van first');
            return;
          }
          // Transfer from van back to warehouse, then allocate to job
          await transferFromVan(selectedVanId, material.inventory_id, quantity, `Used on job #${workOrder?.work_order_number}`);
          await allocateMaterials(id, [material.id], quantity);
          setSuccessMessage(`Used ${quantity} x ${material.description} from ${vanName} on job`);
          // Reload van inventory
          loadVanInventory(selectedVanId);
        }
      }

      closeMaterialActionDialog();
      await loadWorkOrder();
    } catch (err) {
      logger.error(`Error ${action} material:`, err);
      setError(err.message);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReturnMaterial = async (materialId) => {
    try {
      setPullingMaterial(materialId);
      await deallocateMaterials(id, [materialId]);
      setSuccessMessage('Material returned to warehouse');
      await loadWorkOrder();
    } catch (err) {
      logger.error('Error returning material:', err);
      setError(err.message);
    } finally {
      setPullingMaterial(null);
    }
  };

  const handlePullAllAvailable = async () => {
    try {
      setPullingAll(true);
      const availableMaterials = workOrder.materials
        .filter(m => m.status === 'planned' && m.available_qty > 0)
        .map(m => m.id);

      if (availableMaterials.length === 0) {
        setError('No available materials to pull');
        setPullingAll(false);
        return;
      }

      await allocateMaterials(id, availableMaterials);
      setSuccessMessage(`Pulled ${availableMaterials.length} item(s) from warehouse`);
      await loadWorkOrder();
    } catch (err) {
      logger.error('Error pulling all materials:', err);
      setError(err.message);
    } finally {
      setPullingAll(false);
    }
  };

  const handleReturnAll = async () => {
    try {
      setPullingAll(true);
      const allocatedMaterials = workOrder.materials
        .filter(m => m.status === 'allocated' || m.status === 'used')
        .map(m => m.id);

      if (allocatedMaterials.length === 0) {
        setError('No materials to return');
        setPullingAll(false);
        return;
      }

      await deallocateMaterials(id, allocatedMaterials);
      setSuccessMessage(`Returned ${allocatedMaterials.length} item(s) to warehouse`);
      await loadWorkOrder();
    } catch (err) {
      logger.error('Error returning materials:', err);
      setError(err.message);
    } finally {
      setPullingAll(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setUpdatingStatus(true);
      const result = await updateWorkOrderStatus(id, newStatus);
      setWorkOrder(result.work_order);
      setSuccessMessage(result.message || `Status updated to ${newStatus}`);
      await loadWorkOrder(); // Reload to get updated data
    } catch (err) {
      logger.error('Error updating status:', err);
      setError(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle marking job complete - show reconciliation dialog if materials exist
  const handleMarkCompleteClick = () => {
    // Check if there are any materials on the job at all
    const hasMaterials = (workOrder?.materials?.length || 0) > 0;

    if (hasMaterials) {
      // Show reconciliation dialog to account for materials
      setReconciliationDialogOpen(true);
    } else {
      // No materials on job, complete directly
      handleStatusChange('completed');
    }
  };

  // Called after material reconciliation is complete
  const handleReconciliationComplete = async () => {
    setReconciliationDialogOpen(false);
    await handleStatusChange('completed');
  };

  const handleCreateInvoice = async () => {
    try {
      setCreatingInvoice(true);
      const result = await createInvoice({ work_order_id: parseInt(id) });
      setSuccessMessage(`Invoice ${result.invoice_number} created successfully!`);
      // Navigate to the new invoice
      navigate(`/invoices/${result.invoice_id}`);
    } catch (err) {
      logger.error('Error creating invoice:', err);
      setError(err.message);
      setCreatingInvoice(false);
    }
  };

  // Notes & Photos handlers
  const loadNotes = async () => {
    try {
      const data = await fetchWorkOrderNotes(id);
      setNotes(data.notes || []);
    } catch (err) {
      logger.error('Error loading notes:', err);
    }
  };

  const loadPhotos = async () => {
    try {
      const data = await fetchWorkOrderPhotos(id);
      const photoList = data.photos || [];
      setPhotos(photoList);

      // Load authenticated thumbnails for all photos
      if (photoList.length > 0) {
        loadThumbnails(photoList);
      }
    } catch (err) {
      logger.error('Error loading photos:', err);
    }
  };

  // Load authenticated thumbnail URLs for grid display (photos only - videos use placeholder)
  const loadThumbnails = async (photoList) => {
    const newThumbnails = {};

    // Filter to only photos (videos don't need thumbnail fetch)
    const photosOnly = photoList.filter(p => p.media_type !== 'video');

    // Load thumbnails in parallel (batch of 5 at a time to avoid overwhelming)
    const batchSize = 5;
    for (let i = 0; i < photosOnly.length; i += batchSize) {
      const batch = photosOnly.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (photo) => {
          try {
            const blobUrl = await fetchAuthenticatedPhoto(photo.filename);
            return { id: photo.id, url: blobUrl };
          } catch (err) {
            logger.error(`Error loading thumbnail for photo ${photo.id}:`, err);
            return { id: photo.id, url: null };
          }
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.url) {
          newThumbnails[result.value.id] = result.value.url;
        }
      });

      // Update state progressively so thumbnails appear as they load
      setThumbnailUrls(prev => ({ ...prev, ...newThumbnails }));
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      await addWorkOrderNote(id, newNote);
      setNewNote('');
      setSuccessMessage('Note added successfully');
      await loadNotes();
    } catch (err) {
      logger.error('Error adding note:', err);
      setError(err.message);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteWorkOrderNote(id, noteId);
      setSuccessMessage('Note deleted');
      await loadNotes();
    } catch (err) {
      logger.error('Error deleting note:', err);
      setError(err.message);
    }
  };

  // Track if materials were added in this dialog session
  const [materialsAdded, setMaterialsAdded] = useState(false);

  // Material add handler for multi-select dialog
  const handleAddMaterial = async (material) => {
    try {
      await addMaterialToWorkOrder(id, {
        inventory_id: material.inventory_id,
        quantity_needed: material.quantity_needed,
        unit_cost: material.unit_cost || 0,
        unit_price: material.unit_price || 0
      });
      setMaterialsAdded(true);
    } catch (err) {
      logger.error('Error adding material:', err);
      setError(err.message);
      throw err; // Re-throw so AddMaterialDialog knows it failed
    }
  };

  // Called when AddMaterialDialog closes (cancel or after adding)
  const handleMaterialDialogClose = () => {
    setAddMaterialDialog(false);
    if (materialsAdded) {
      setSuccessMessage('Materials added to job');
      loadWorkOrder(); // Refresh to show new materials
      setMaterialsAdded(false);
    }
  };

  // Open the photo/video upload dialog with file selected
  const handlePhotoSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    // Check file type - accept images and videos
    if (!isImage && !isVideo) {
      setError('Please select an image or video file');
      return;
    }

    // Check file size - different limits for images vs videos
    const maxSize = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024; // 200MB for video, 10MB for image
    if (file.size > maxSize) {
      setError(`${isVideo ? 'Video' : 'Image'} must be smaller than ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    // Set selected file and create preview
    setSelectedPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setPhotoNotes('');
    setPhotoType('general');
    setPhotoUploadDialog(true);

    // Reset file input so same file can be selected again
    event.target.value = '';
  };

  // Actually upload the photo with notes
  const handlePhotoUpload = async () => {
    if (!selectedPhotoFile) return;

    try {
      setUploadingPhoto(true);
      await uploadWorkOrderPhoto(id, selectedPhotoFile, {
        notes: photoNotes || null,
        photoType: photoType,
      });
      setSuccessMessage('Photo uploaded successfully');
      await loadPhotos();

      // Close dialog and reset
      setPhotoUploadDialog(false);
      setSelectedPhotoFile(null);
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
        setPhotoPreviewUrl(null);
      }
      setPhotoNotes('');
      setPhotoType('general');
    } catch (err) {
      logger.error('Error uploading photo:', err);
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Close photo upload dialog without saving
  const handleClosePhotoDialog = () => {
    setPhotoUploadDialog(false);
    setSelectedPhotoFile(null);
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
      setPhotoPreviewUrl(null);
    }
    setPhotoNotes('');
    setPhotoType('general');
  };

  const handleDeletePhoto = async (photoId) => {
    try {
      await deleteWorkOrderPhoto(id, photoId);
      setSuccessMessage('Photo deleted');
      await loadPhotos();
    } catch (err) {
      logger.error('Error deleting photo:', err);
      setError(err.message);
    }
  };

  // Load a photo into cache and return URL
  const loadPhotoToCache = async (photo) => {
    if (photoCache[photo.id]) {
      return photoCache[photo.id];
    }
    try {
      const blobUrl = await fetchAuthenticatedPhoto(photo.filename);
      setPhotoCache(prev => ({ ...prev, [photo.id]: blobUrl }));
      return blobUrl;
    } catch (err) {
      logger.error('Error loading photo:', err);
      return null;
    }
  };

  // Open photo in viewer modal with authenticated fetch
  const handleViewPhoto = async (photo) => {
    const index = photos.findIndex(p => p.id === photo.id);
    setCurrentPhotoIndex(index >= 0 ? index : 0);
    setViewerPhoto(photo);
    setPhotoViewerOpen(true);

    // Videos and photos both need authenticated fetch
    if (photo.media_type === 'video') {
      // For videos, always fetch fresh (they're not cached in thumbnails)
      setLoadingViewerPhoto(true);
      try {
        const blobUrl = await fetchAuthenticatedPhoto(photo.filename);
        setViewerPhotoUrl(blobUrl);
      } catch (err) {
        logger.error('Error loading video:', err);
        setError('Failed to load video');
      } finally {
        setLoadingViewerPhoto(false);
      }
    } else if (thumbnailUrls[photo.id]) {
      // Use already-loaded thumbnail if available (instant open)
      setViewerPhotoUrl(thumbnailUrls[photo.id]);
      setLoadingViewerPhoto(false);
    } else {
      setLoadingViewerPhoto(true);
      try {
        const blobUrl = await loadPhotoToCache(photo);
        setViewerPhotoUrl(blobUrl);
      } catch (err) {
        logger.error('Error loading photo:', err);
        setError('Failed to load photo');
      } finally {
        setLoadingViewerPhoto(false);
      }
    }

    // Preload adjacent photos for smooth navigation (skip videos)
    if (index > 0) {
      const prevPhoto = photos[index - 1];
      if (prevPhoto.media_type !== 'video' && !thumbnailUrls[prevPhoto.id]) {
        loadPhotoToCache(prevPhoto);
      }
    }
    if (index < photos.length - 1) {
      const nextPhoto = photos[index + 1];
      if (nextPhoto.media_type !== 'video' && !thumbnailUrls[nextPhoto.id]) {
        loadPhotoToCache(nextPhoto);
      }
    }
  };

  // Navigate to next/previous media item
  const navigatePhoto = async (direction) => {
    const newIndex = currentPhotoIndex + direction;
    if (newIndex < 0 || newIndex >= photos.length) return;

    setCurrentPhotoIndex(newIndex);
    const newPhoto = photos[newIndex];
    setViewerPhoto(newPhoto);

    // Videos always need fresh fetch
    if (newPhoto.media_type === 'video') {
      setLoadingViewerPhoto(true);
      try {
        const blobUrl = await fetchAuthenticatedPhoto(newPhoto.filename);
        setViewerPhotoUrl(blobUrl);
      } catch (err) {
        logger.error('Error loading video:', err);
      } finally {
        setLoadingViewerPhoto(false);
      }
    } else {
      // Use thumbnail if available (instant navigation for photos)
      const cachedUrl = thumbnailUrls[newPhoto.id] || photoCache[newPhoto.id];
      if (cachedUrl) {
        setViewerPhotoUrl(cachedUrl);
        setLoadingViewerPhoto(false);
      } else {
        setLoadingViewerPhoto(true);
        try {
          const blobUrl = await loadPhotoToCache(newPhoto);
          setViewerPhotoUrl(blobUrl);
        } catch (err) {
          logger.error('Error navigating photo:', err);
        } finally {
          setLoadingViewerPhoto(false);
        }
      }
    }

    // Preload next photo in direction of travel (skip videos)
    const preloadIndex = newIndex + direction;
    if (preloadIndex >= 0 && preloadIndex < photos.length) {
      const preloadPhoto = photos[preloadIndex];
      if (preloadPhoto.media_type !== 'video' && !thumbnailUrls[preloadPhoto.id] && !photoCache[preloadPhoto.id]) {
        loadPhotoToCache(preloadPhoto);
      }
    }
  };

  // Handle keyboard navigation and swipe
  const handlePhotoKeyDown = (e) => {
    if (e.key === 'ArrowLeft') navigatePhoto(-1);
    if (e.key === 'ArrowRight') navigatePhoto(1);
    if (e.key === 'Escape') handleClosePhotoViewer();
  };

  // Close photo viewer and clean up blob URLs
  const handleClosePhotoViewer = () => {
    setPhotoViewerOpen(false);
    // Clean up all cached blob URLs
    Object.values(photoCache).forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
    setPhotoCache({});
    setViewerPhotoUrl(null);
    setViewerPhoto(null);
    setCurrentPhotoIndex(0);
  };

  const handleNavigate = () => {
    if (!workOrder?.service_address) return;

    // Encode the address for URL
    const encodedAddress = encodeURIComponent(workOrder.service_address);

    // Try to open in native navigation app (works on iOS and Android)
    // Falls back to Google Maps in browser if not on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // For mobile devices, try to open in native maps app
      // iOS will use Apple Maps, Android will use Google Maps
      window.location.href = `maps://?q=${encodedAddress}`;

      // Fallback to Google Maps web if native app doesn't open
      setTimeout(() => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
      }, 500);
    } else {
      // For desktop, open Google Maps in new tab
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  // Helper functions imported from utils/workOrderHelpers.js

  // Group materials by category using shared helper - memoized for performance
  // NOTE: This hook must be called before any conditional returns to satisfy React's Rules of Hooks
  const groupedMaterials = useMemo(() => {
    if (!workOrder?.materials) return {};
    return groupMaterialsByCategory(workOrder.materials);
  }, [workOrder?.materials]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !workOrder) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Work order not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden', maxWidth: '100vw' }}>
      <AppHeader title={workOrder.service_address || 'No Address'} subtitle={`${workOrder.work_order_number} - Customer: ${workOrder.first_name} ${workOrder.last_name}`}>
        {(userRole === 'admin' || userRole === 'manager') && (
          <Button
            variant="contained"
            size="small"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/work-orders/${id}`)}
            sx={{
              mr: 1,
              bgcolor: 'warning.main',
              color: 'white',
              textTransform: 'none',
              '&:hover': { bgcolor: 'warning.light' },
            }}
          >
            Edit WO
          </Button>
        )}
        <Chip
          label={workOrder.status?.replace('_', ' ').toUpperCase()}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }}
        />
      </AppHeader>

      <Container maxWidth="lg" sx={{ mt: 2, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Job Info Section */}
        <Accordion
          expanded={expandedSections.jobInfo}
          onChange={handleSectionToggle('jobInfo')}
          sx={{ mb: 1 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '& .MuiAccordionSummary-expandIconWrapper': { color: 'white' },
              borderRadius: expandedSections.jobInfo ? '4px 4px 0 0' : '4px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <InfoIcon />
              <Typography variant="h6" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                Job Details
              </Typography>
              <Chip
                label={workOrder.priority?.toUpperCase()}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  {workOrder.job_type}
                </Typography>
                <Typography variant="h6" gutterBottom>
                  {workOrder.job_description}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">CUSTOMER</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {workOrder.first_name} {workOrder.last_name}
                </Typography>
                {workOrder.company_name && (
                  <Typography variant="body2" color="text.secondary">
                    {workOrder.company_name}
                  </Typography>
                )}
                {workOrder.phone_primary && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    📞 {workOrder.phone_primary}
                  </Typography>
                )}
                {workOrder.email && (
                  <Typography variant="body2">
                    ✉️ {workOrder.email}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">SERVICE ADDRESS</Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 0.5, gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                    <LocationIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="body1">
                      {workOrder.service_address || 'No address provided'}
                    </Typography>
                  </Box>
                  {workOrder.service_address && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<NavigationIcon />}
                      onClick={handleNavigate}
                      sx={{
                        bgcolor: 'primary.main',
                        '&:hover': { bgcolor: 'primary.dark' },
                        minWidth: { xs: '100%', sm: 'auto' },
                      }}
                    >
                      Navigate
                    </Button>
                  )}
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">SCHEDULE</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  📅 {formatDateLong(workOrder.scheduled_date)}
                </Typography>
                {workOrder.scheduled_start_time && (
                  <Typography variant="body2" color="text.secondary">
                    🕐 Start: {formatTime(workOrder.scheduled_start_time)}
                  </Typography>
                )}
                {workOrder.estimated_duration_hours && (
                  <Typography variant="body2" color="text.secondary">
                    ⏱️ Duration: {workOrder.estimated_duration_hours} hours
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">ASSIGNED</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {workOrder.assigned_to && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AssignedAvatars
                        assignedWorkers={workOrder.assigned_to.split(',').map(username => ({
                          username: username.trim(),
                          full_name: username.trim()
                        }))}
                        size="medium"
                        max={4}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {workOrder.assigned_to.split(',').length > 1
                          ? `${workOrder.assigned_to.split(',').length} workers`
                          : 'Assigned'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Status Change Controls Section */}
        <Accordion
          expanded={expandedSections.status}
          onChange={handleSectionToggle('status')}
          sx={{ mb: 1 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'success.main',
              color: 'white',
              '& .MuiAccordionSummary-expandIconWrapper': { color: 'white' },
              borderRadius: expandedSections.status ? '4px 4px 0 0' : '4px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Job Status
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {/* Mark Complete - available when not already completed */}
              {workOrder.status !== 'completed' && workOrder.status !== 'invoiced' && workOrder.status !== 'paid' && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={updatingStatus ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                  onClick={handleMarkCompleteClick}
                  disabled={updatingStatus}
                  size="large"
                  sx={{ flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
                >
                  Mark Complete
                </Button>
              )}

              {/* Delay Job - available when not completed/invoiced/paid and not already delayed */}
              {workOrder.status !== 'completed' && workOrder.status !== 'invoiced' && workOrder.status !== 'paid' && !workOrder.delay_start_date && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<PauseIcon />}
                  onClick={() => setDelayDialogOpen(true)}
                  disabled={updatingStatus}
                  size="large"
                  sx={{ flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
                >
                  Delay Job
                </Button>
              )}

              {/* Show delayed status indicator */}
              {workOrder.delay_start_date && (
                <Chip
                  icon={<PauseIcon />}
                  label={workOrder.delay_end_date
                    ? `Delayed until ${new Date(workOrder.delay_end_date).toLocaleDateString()}`
                    : 'Delayed indefinitely'}
                  color="warning"
                  sx={{ height: 40, fontSize: '0.9rem' }}
                />
              )}

              {/* Generate Invoice Button - shows for completed work orders */}
              {workOrder.status === 'completed' && (
                <>
                  <Button
                    variant="contained"
                    startIcon={creatingInvoice ? <CircularProgress size={20} color="inherit" /> : <ReceiptIcon />}
                    onClick={handleCreateInvoice}
                    disabled={creatingInvoice}
                    size="large"
                    sx={{
                      bgcolor: 'info.main',
                      '&:hover': { bgcolor: 'info.dark' },
                      fontWeight: 'bold',
                      flex: { xs: '1 1 100%', sm: '0 1 auto' },
                    }}
                  >
                    {creatingInvoice ? 'Creating Invoice...' : 'Generate Invoice'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={updatingStatus ? <CircularProgress size={20} color="inherit" /> : <EditIcon />}
                    onClick={() => handleStatusChange('in_progress')}
                    disabled={updatingStatus}
                    size="large"
                    sx={{ flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
                  >
                    Reopen Job
                  </Button>
                </>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Job Tasks Section */}
        <Accordion
          expanded={expandedSections.tasks}
          onChange={handleSectionToggle('tasks')}
          sx={{ mb: 1 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'secondary.main',
              color: 'white',
              '& .MuiAccordionSummary-expandIconWrapper': { color: 'white' },
              borderRadius: expandedSections.tasks ? '4px 4px 0 0' : '4px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <TaskIcon />
              <Typography variant="h6" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                Tasks / Scope of Work
              </Typography>
              {workOrder.tasks && workOrder.tasks.length > 0 && (
                <Chip
                  label={`${workOrder.tasks.filter(t => t.completed).length}/${workOrder.tasks.length}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <JobTasks
              workOrderId={id}
              workOrder={workOrder}
              onError={(msg) => setError(msg)}
              onSuccess={(msg) => setSuccessMessage(msg)}
              onTasksConverted={loadWorkOrder}
            />
          </AccordionDetails>
        </Accordion>

        {/* Materials Checklist Section */}
        <Accordion
          expanded={expandedSections.materials}
          onChange={handleSectionToggle('materials')}
          sx={{ mb: 1 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'warning.main',
              color: 'white',
              '& .MuiAccordionSummary-expandIconWrapper': { color: 'white' },
              borderRadius: expandedSections.materials ? '4px 4px 0 0' : '4px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <InventoryIcon />
              <Typography variant="h6" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                Materials
              </Typography>
              <Chip
                label={`${workOrder.materials?.length || 0} items`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<InventoryIcon />}
                onClick={() => setAddMaterialDialog(true)}
                sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
              >
                Add Material
              </Button>
            </Box>

          {Object.entries(groupedMaterials).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No materials assigned to this job yet.
            </Typography>
          ) : (
            Object.entries(groupedMaterials).map(([category, materials]) => (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
                  {category} ({materials.length})
                </Typography>
                <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                  {materials.map((material, index) => (
                    <React.Fragment key={material.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          flexDirection: { xs: 'column', sm: 'row' },
                          alignItems: { xs: 'flex-start', sm: 'center' },
                          py: 2,
                        }}
                      >
                        <Box sx={{ flexGrow: 1, width: '100%' }}>
                          <ListItemText
                            primary={
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                    {material.is_custom ? 'CUSTOM' : material.item_id} - {material.description}
                                  </Typography>
                                  {material.is_custom && (
                                    <Chip
                                      label="Special Order"
                                      size="small"
                                      color="secondary"
                                      sx={{ fontSize: '0.7rem', height: 20 }}
                                    />
                                  )}
                                  {material.customer_provided && (
                                    <Chip
                                      label="Customer Provided"
                                      size="small"
                                      color="info"
                                      sx={{ fontSize: '0.7rem', height: 20, fontWeight: 'bold' }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                  {material.brand}
                                  {material.custom_vendor && ` | Order from: ${material.custom_vendor}`}
                                  {material.custom_model_number && ` | Model: ${material.custom_model_number}`}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box sx={{ mt: 1 }}>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                  <Chip
                                    label={`Qty: ${material.quantity_needed}`}
                                    size="small"
                                    color="primary"
                                    sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}
                                  />
                                  {!material.is_custom && (
                                    <Chip
                                      label={`Available: ${material.available_qty || 0}`}
                                      size="small"
                                      color={getStockStatusColor(material.stock_status)}
                                    />
                                  )}
                                  {material.needs_ordering && (
                                    <Chip
                                      label="Needs Ordering"
                                      size="small"
                                      color="warning"
                                    />
                                  )}
                                  <Chip
                                    label={material.status?.replace('_', ' ').toUpperCase()}
                                    size="small"
                                    color={getMaterialStatusColor(material.status)}
                                    variant="outlined"
                                  />
                                </Box>
                                {/* Material Reconciliation Info - shows after job completion */}
                                {(material.quantity_used > 0 || material.leftover_destination) && (
                                  <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    flexWrap: 'wrap',
                                    mb: 1,
                                    p: 1,
                                    borderRadius: 1,
                                    bgcolor: (theme) => theme.palette.mode === 'dark'
                                      ? 'rgba(76, 175, 80, 0.15)'
                                      : 'success.50',
                                    border: '1px solid',
                                    borderColor: 'success.light'
                                  }}>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                      {material.quantity_used || 0} used
                                    </Typography>
                                    {material.quantity_returned > 0 && (
                                      <Chip
                                        label={`${material.quantity_returned} returned to ${material.leftover_destination === 'van' ? 'van' : 'warehouse'}`}
                                        size="small"
                                        color={material.leftover_destination === 'van' ? 'info' : 'secondary'}
                                        variant="outlined"
                                        sx={{ fontSize: '0.75rem' }}
                                      />
                                    )}
                                    {material.leftover_notes && (
                                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                        ({material.leftover_notes})
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                                {/* Location prominently displayed */}
                                <Box sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  bgcolor: (theme) => theme.palette.mode === 'dark'
                                    ? 'rgba(255, 167, 38, 0.15)'
                                    : 'warning.light',
                                  p: 1,
                                  borderRadius: 1,
                                  mt: 1
                                }}>
                                  <LocationIcon sx={{ mr: 1, color: 'primary.main' }} />
                                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    Location: {material.location || 'Unknown'}
                                  </Typography>
                                </Box>
                              </Box>
                            }
                          />
                        </Box>
                        {/* Pull/Return button for each material */}
                        <Box sx={{ ml: { sm: 2 }, mt: { xs: 2, sm: 0 } }}>
                          {material.acquired_in_field ? (
                            <Chip
                              label="Acquired in Field"
                              color="info"
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          ) : (material.status === 'allocated' || material.status === 'used') ? (
                            <Button
                              variant="outlined"
                              color="warning"
                              size="small"
                              startIcon={pullingMaterial === material.id ? <CircularProgress size={16} color="inherit" /> : <InventoryIcon />}
                              onClick={() => handleReturnMaterial(material.id)}
                              disabled={pullingMaterial === material.id}
                              sx={{ minWidth: 100 }}
                            >
                              Return
                            </Button>
                          ) : material.status === 'planned' ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                              {material.available_qty === 0 && (
                                <Chip
                                  label="Out of Stock"
                                  color="error"
                                  size="small"
                                />
                              )}
                              {/* Show allocated/needed progress if partially allocated */}
                              {(material.quantity_allocated > 0 && material.quantity_allocated < material.quantity_needed) && (
                                <Chip
                                  label={`${material.quantity_allocated}/${material.quantity_needed} allocated`}
                                  color="warning"
                                  size="small"
                                  sx={{ fontWeight: 'bold' }}
                                />
                              )}
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {material.available_qty > 0 && (
                                  <Button
                                    variant="contained"
                                    color="success"
                                    size="medium"
                                    startIcon={<InventoryIcon />}
                                    onClick={() => openPullDialog(material)}
                                    sx={{ minWidth: 90, py: 1 }}
                                  >
                                    Pull
                                  </Button>
                                )}
                                <Button
                                  variant="contained"
                                  color="info"
                                  size="medium"
                                  startIcon={<ShoppingCartIcon />}
                                  onClick={() => openGotItDialog(material)}
                                  sx={{ minWidth: 90, py: 1 }}
                                >
                                  Got It
                                </Button>
                              </Box>
                            </Box>
                          ) : null}
                        </Box>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            ))
          )}

          {/* Bulk Actions */}
          {workOrder.materials?.length > 0 && (
            <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={pullingAll ? <CircularProgress size={20} color="inherit" /> : <InventoryIcon />}
                onClick={handlePullAllAvailable}
                disabled={pullingAll || !workOrder.materials.some(m => m.status === 'planned' && m.available_qty > 0)}
                sx={{ minWidth: 200, fontWeight: 'bold' }}
              >
                Pull All Available
              </Button>
              <Button
                variant="outlined"
                color="warning"
                size="large"
                startIcon={pullingAll ? <CircularProgress size={20} color="inherit" /> : <InventoryIcon />}
                onClick={handleReturnAll}
                disabled={pullingAll || !workOrder.materials.some(m => m.status === 'allocated' || m.status === 'used')}
                sx={{ minWidth: 200, fontWeight: 'bold' }}
              >
                Return All
              </Button>
            </Box>
          )}
          </AccordionDetails>
        </Accordion>

        {/* Success/Error Messages */}
        <Snackbar
          open={!!successMessage}
          autoHideDuration={4000}
          onClose={() => setSuccessMessage('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSuccessMessage('')} severity="success" sx={{ width: '100%' }}>
            {successMessage}
          </Alert>
        </Snackbar>
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>

        {/* Permit & Inspection Info Section */}
        {(workOrder.permit_required || workOrder.inspection_required) && (
          <Accordion
            expanded={expandedSections.permits}
            onChange={handleSectionToggle('permits')}
            sx={{ mb: 1 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: 'error.main',
                color: 'white',
                '& .MuiAccordionSummary-expandIconWrapper': { color: 'white' },
                borderRadius: expandedSections.permits ? '4px 4px 0 0' : '4px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PermitIcon />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Permits & Inspections
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 3 }}>
              <Grid container spacing={2}>
                {workOrder.permit_required && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Permit Required</Typography>
                        {workOrder.permit_number && (
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            #{workOrder.permit_number}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                )}
                {workOrder.inspection_required && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                      <Typography variant="body1">Inspection Required</Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Job Notes Section */}
        <Accordion
          expanded={expandedSections.notes}
          onChange={handleSectionToggle('notes')}
          sx={{ mb: 1 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'info.main',
              color: 'white',
              '& .MuiAccordionSummary-expandIconWrapper': { color: 'white' },
              borderRadius: expandedSections.notes ? '4px 4px 0 0' : '4px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <NoteIcon />
              <Typography variant="h6" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                Notes
              </Typography>
              {notes.length > 0 && (
                <Chip
                  label={notes.length}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 3 }}>
            {/* Add Note */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="Add a note about this job..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                variant="outlined"
                size="small"
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                startIcon={<SendIcon />}
                sx={{ minWidth: 100, alignSelf: { xs: 'flex-end', sm: 'flex-start' } }}
              >
                Add
              </Button>
            </Box>

            {/* Notes List */}
            {notes.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No notes yet. Add a note to document job details.
              </Typography>
            ) : (
              <List>
                {notes.map((note, index) => (
                  <React.Fragment key={note.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      alignItems="flex-start"
                      secondaryAction={
                        <IconButton edge="end" onClick={() => handleDeleteNote(note.id)}>
                          <DeleteIcon />
                        </IconButton>
                      }
                      sx={{ py: 2 }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: 'primary.main',
                          mr: 2,
                          width: 40,
                          height: 40,
                        }}
                      >
                        {note.created_by?.charAt(0).toUpperCase() || 'U'}
                      </Avatar>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="body1" sx={{ mb: 0.5 }}>
                              {note.note}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                              {note.created_by}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {' • '}
                              {new Date(note.created_at).toLocaleDateString()} at{' '}
                              {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Job Photos & Videos Section */}
        <Accordion
          expanded={expandedSections.photos}
          onChange={handleSectionToggle('photos')}
          sx={{ mb: 1 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'grey.700',
              color: 'white',
              '& .MuiAccordionSummary-expandIconWrapper': { color: 'white' },
              borderRadius: expandedSections.photos ? '4px 4px 0 0' : '4px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <PhotoCameraIcon />
              <Typography variant="h6" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                Photos & Videos
              </Typography>
              {photos.length > 0 && (
                <Chip
                  label={photos.length}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 3 }}>
            {/* Upload Buttons */}
            <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                component="label"
                startIcon={<PhotoCameraIcon />}
                sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
              >
                Take Photo
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                />
              </Button>
              <Button
                variant="contained"
                component="label"
                startIcon={<VideocamIcon />}
                sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' }, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
              >
                Record Video
                <input
                  type="file"
                  hidden
                  accept="video/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                />
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Photos: max 10MB (JPG, PNG, HEIC) | Videos: max 200MB (MP4, MOV)
            </Typography>

          {/* Media Grid - Photos and Videos */}
          {photos.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No photos or videos yet. Capture media to document the job.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {photos.map((photo, index) => (
                <Grid item xs={6} sm={4} md={4} key={photo.id}>
                  <Box
                    sx={{
                      position: 'relative',
                      borderRadius: 2,
                      overflow: 'hidden',
                      boxShadow: 2,
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'scale(1.02)',
                        boxShadow: 4,
                      },
                      '&:hover .photo-overlay': {
                        opacity: 1,
                      },
                    }}
                    onClick={() => handleViewPhoto(photo)}
                  >
                    {/* Media Thumbnail */}
                    <Box
                      sx={{
                        width: '100%',
                        paddingTop: '100%', // 1:1 aspect ratio for square thumbnails
                        position: 'relative',
                        bgcolor: photo.media_type === 'video' ? 'grey.800' : 'grey.200',
                      }}
                    >
                      {photo.media_type === 'video' ? (
                        // Video thumbnail - show play icon overlay
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            bgcolor: 'grey.800',
                          }}
                        >
                          <PlayIcon sx={{ fontSize: 60, color: 'white', opacity: 0.9 }} />
                          <Typography variant="caption" sx={{ color: 'white', mt: 1 }}>
                            Video
                          </Typography>
                        </Box>
                      ) : thumbnailUrls[photo.id] ? (
                        <img
                          src={thumbnailUrls[photo.id]}
                          alt={photo.caption || photo.original_filename}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CircularProgress size={24} />
                        </Box>
                      )}
                    </Box>

                    {/* Photo Type Badge */}
                    {photo.photo_type && photo.photo_type !== 'general' && (
                      <Chip
                        label={photo.photo_type.charAt(0).toUpperCase() + photo.photo_type.slice(1)}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          bgcolor: photo.photo_type === 'before' ? 'info.main' :
                                   photo.photo_type === 'after' ? 'success.main' :
                                   photo.photo_type === 'issue' ? 'error.main' :
                                   photo.photo_type === 'progress' ? 'warning.main' : 'grey.500',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                        }}
                      />
                    )}

                    {/* Photo Counter Badge */}
                    <Chip
                      label={`${index + 1}/${photos.length}`}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        fontSize: '0.65rem',
                        height: 20,
                      }}
                    />

                    {/* Hover Overlay with Zoom Icon */}
                    <Box
                      className="photo-overlay"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <ZoomInIcon sx={{ color: 'white', fontSize: 40 }} />
                    </Box>

                    {/* Bottom Info Bar */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        p: 1,
                      }}
                    >
                      {photo.notes && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            fontWeight: 'medium',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {photo.notes}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem' }}>
                        {photo.uploaded_by} • {new Date(photo.uploaded_at).toLocaleDateString()}
                      </Typography>
                    </Box>

                    {/* Delete Button */}
                    <IconButton
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        bgcolor: 'rgba(255,255,255,0.9)',
                        '&:hover': { bgcolor: 'error.light', color: 'white' },
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
          </AccordionDetails>
        </Accordion>

        {/* Activity Timeline Section */}
        <Accordion
          expanded={expandedSections.activity}
          onChange={handleSectionToggle('activity')}
          sx={{ mb: 1 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'grey.600',
              color: 'white',
              '& .MuiAccordionSummary-expandIconWrapper': { color: 'white' },
              borderRadius: expandedSections.activity ? '4px 4px 0 0' : '4px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Activity History
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <ActivityTimeline
              workOrderId={id}
              onError={(msg) => setError(msg)}
            />
          </AccordionDetails>
        </Accordion>

        {/* Add Material Dialog - Multi-select */}
        <AddMaterialDialog
          open={addMaterialDialog}
          onClose={handleMaterialDialogClose}
          onAdd={handleAddMaterial}
          workOrderId={id}
        />

        {/* Delay Job Dialog */}
        <DelayJobDialog
          open={delayDialogOpen}
          onClose={() => setDelayDialogOpen(false)}
          onDelayed={(result) => {
            setSuccessMessage(result.message || 'Job delayed successfully');
            loadWorkOrder();
          }}
          workOrder={workOrder}
        />

        {/* Material Reconciliation Dialog - shown when completing a job with materials */}
        <MaterialReconciliationDialog
          open={reconciliationDialogOpen}
          onClose={() => setReconciliationDialogOpen(false)}
          onComplete={handleReconciliationComplete}
          workOrder={workOrder}
          vans={vans}
          selectedVanId={selectedVanId}
        />

        {/* Material Action Dialog (Pull / Got It) */}
        <Dialog
          open={!!materialActionDialog}
          onClose={closeMaterialActionDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {materialActionDialog?.action === 'pull' ? (
              <>
                <InventoryIcon color="success" />
                Pull Material
              </>
            ) : (
              <>
                <ShoppingCartIcon color="info" />
                Mark as Acquired
              </>
            )}
          </DialogTitle>
          <DialogContent>
            {materialActionDialog && (
              <Box sx={{ pt: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                  {materialActionDialog.material.item_id} - {materialActionDialog.material.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip label={`Needed: ${materialActionDialog.material.quantity_needed}`} size="small" />
                  <Chip label={`Allocated: ${materialActionDialog.material.quantity_allocated || 0}`} size="small" color="primary" />
                </Box>

                {/* From/To Selection for Pull action */}
                {materialActionDialog.action === 'pull' && (
                  <Box sx={{ mb: 2 }}>
                    {/* Van Selector */}
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Your Van</InputLabel>
                      <Select
                        value={selectedVanId}
                        onChange={(e) => setSelectedVanId(e.target.value)}
                        label="Your Van"
                        startAdornment={<VanIcon sx={{ mr: 1, color: 'primary.main' }} />}
                      >
                        {vans.map(van => (
                          <MenuItem key={van.id} value={van.id}>
                            {van.van_number} {van.name ? `- ${van.name}` : ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* From/To Selection */}
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>From</InputLabel>
                          <Select
                            value={pullSource}
                            onChange={(e) => {
                              setPullSource(e.target.value);
                              // Update available quantity based on new source
                              const material = materialActionDialog.material;
                              const remaining = material.quantity_needed - (material.quantity_allocated || 0);
                              if (e.target.value === 'warehouse') {
                                setActionQuantity(Math.min(remaining, material.available_qty || 0));
                              } else {
                                const vanItem = vanInventory.find(v => v.inventory_id === material.inventory_id);
                                setActionQuantity(Math.min(remaining, vanItem?.quantity || 0));
                              }
                            }}
                            label="From"
                          >
                            <MenuItem value="warehouse">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <WarehouseIcon fontSize="small" />
                                Warehouse
                              </Box>
                            </MenuItem>
                            <MenuItem value="van">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <VanIcon fontSize="small" />
                                My Van
                              </Box>
                            </MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>To</InputLabel>
                          <Select
                            value={pullDestination}
                            onChange={(e) => setPullDestination(e.target.value)}
                            label="To"
                          >
                            <MenuItem value="job">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <JobIcon fontSize="small" />
                                This Job
                              </Box>
                            </MenuItem>
                            {pullSource === 'warehouse' && (
                              <MenuItem value="van">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <VanIcon fontSize="small" />
                                  My Van
                                </Box>
                              </MenuItem>
                            )}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    {/* Show available from selected source */}
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Available from {pullSource === 'warehouse' ? 'Warehouse' : 'Van'}:{' '}
                        <strong style={{ color: getSourceAvailableQty(materialActionDialog.material) > 0 ? '#2e7d32' : '#d32f2f' }}>
                          {getSourceAvailableQty(materialActionDialog.material)}
                        </strong>
                      </Typography>
                      {pullSource === 'van' && (
                        <Typography variant="caption" color="text.secondary">
                          (Also {materialActionDialog.material.available_qty || 0} in warehouse)
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}

                <TextField
                  label="Quantity"
                  type="number"
                  value={actionQuantity}
                  onChange={(e) => setActionQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  fullWidth
                  sx={{ mb: 2 }}
                  inputProps={{
                    min: 1,
                    max: materialActionDialog.action === 'pull'
                      ? Math.min(
                          materialActionDialog.material.quantity_needed - (materialActionDialog.material.quantity_allocated || 0),
                          getSourceAvailableQty(materialActionDialog.material)
                        )
                      : materialActionDialog.material.quantity_needed - (materialActionDialog.material.quantity_allocated || 0)
                  }}
                  helperText={
                    materialActionDialog.action === 'pull'
                      ? `Max: ${Math.min(materialActionDialog.material.quantity_needed - (materialActionDialog.material.quantity_allocated || 0), getSourceAvailableQty(materialActionDialog.material))}`
                      : `Remaining needed: ${materialActionDialog.material.quantity_needed - (materialActionDialog.material.quantity_allocated || 0)}`
                  }
                />

                {materialActionDialog.action === 'gotit' && (
                  <TextField
                    label="Cost (Optional)"
                    type="number"
                    value={actionCost}
                    onChange={(e) => setActionCost(e.target.value)}
                    fullWidth
                    placeholder="Enter cost if known"
                    helperText="Accountant can fill this in later"
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button
              onClick={closeMaterialActionDialog}
              size="large"
              sx={{ minWidth: 100 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMaterialAction}
              variant="contained"
              size="large"
              disabled={processingAction || actionQuantity < 1 || (materialActionDialog?.action === 'pull' && getSourceAvailableQty(materialActionDialog?.material) < 1)}
              color={materialActionDialog?.action === 'pull' ? 'success' : 'info'}
              startIcon={processingAction ? <CircularProgress size={20} /> : null}
              sx={{ minWidth: 120 }}
            >
              {processingAction ? 'Processing...' :
                materialActionDialog?.action === 'gotit' ? 'Got It' :
                pullDestination === 'van' ? 'Stock Van' : 'Use on Job'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Photo Upload Dialog with Notes */}
        <Dialog
          open={photoUploadDialog}
          onClose={handleClosePhotoDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectedPhotoFile?.type?.startsWith('video/') ? (
              <VideocamIcon color="primary" />
            ) : (
              <PhotoCameraIcon color="primary" />
            )}
            {selectedPhotoFile?.type?.startsWith('video/') ? 'Add Video with Notes' : 'Add Photo with Notes'}
          </DialogTitle>
          <DialogContent>
            {/* Photo/Video Preview */}
            {photoPreviewUrl && (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                {selectedPhotoFile?.type?.startsWith('video/') ? (
                  <video
                    src={photoPreviewUrl}
                    controls
                    style={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <img
                    src={photoPreviewUrl}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: 8,
                      objectFit: 'contain',
                    }}
                  />
                )}
              </Box>
            )}

            {/* Photo Type */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Photo Type</InputLabel>
              <Select
                value={photoType}
                onChange={(e) => setPhotoType(e.target.value)}
                label="Photo Type"
              >
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="before">Before (starting condition)</MenuItem>
                <MenuItem value="after">After (completed work)</MenuItem>
                <MenuItem value="progress">Progress (work in progress)</MenuItem>
                <MenuItem value="issue">Issue (problem/concern)</MenuItem>
              </Select>
            </FormControl>

            {/* Notes */}
            <TextField
              label="Notes (optional)"
              placeholder="Describe what this photo shows, any issues, or important details..."
              value={photoNotes}
              onChange={(e) => setPhotoNotes(e.target.value)}
              multiline
              rows={4}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePhotoDialog}>
              Cancel
            </Button>
            <Button
              onClick={handlePhotoUpload}
              variant="contained"
              disabled={uploadingPhoto}
              startIcon={uploadingPhoto ? <CircularProgress size={16} /> : (selectedPhotoFile?.type?.startsWith('video/') ? <VideocamIcon /> : <PhotoCameraIcon />)}
              sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
            >
              {uploadingPhoto ? 'Uploading...' : (selectedPhotoFile?.type?.startsWith('video/') ? 'Upload Video' : 'Upload Photo')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Full-Screen Photo Gallery Viewer */}
        <Dialog
          open={photoViewerOpen}
          onClose={handleClosePhotoViewer}
          fullScreen
          PaperProps={{
            sx: { bgcolor: '#000' }
          }}
          onKeyDown={handlePhotoKeyDown}
        >
          {/* Top Bar - Counter and Close */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              zIndex: 10,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={`${currentPhotoIndex + 1} / ${photos.length}`}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 'bold',
                }}
              />
              {viewerPhoto?.photo_type && viewerPhoto.photo_type !== 'general' && (
                <Chip
                  label={viewerPhoto.photo_type.charAt(0).toUpperCase() + viewerPhoto.photo_type.slice(1)}
                  size="small"
                  sx={{
                    bgcolor: viewerPhoto.photo_type === 'before' ? 'info.main' :
                             viewerPhoto.photo_type === 'after' ? 'success.main' :
                             viewerPhoto.photo_type === 'issue' ? 'error.main' :
                             viewerPhoto.photo_type === 'progress' ? 'warning.main' : 'grey.500',
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                />
              )}
            </Box>
            <IconButton
              onClick={handleClosePhotoViewer}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Main Photo Area with Navigation */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Previous Button */}
            {currentPhotoIndex > 0 && (
              <IconButton
                onClick={() => navigatePhoto(-1)}
                disabled={loadingViewerPhoto}
                sx={{
                  position: 'absolute',
                  left: { xs: 8, sm: 24 },
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  zIndex: 10,
                  width: { xs: 48, sm: 56 },
                  height: { xs: 48, sm: 56 },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  '&:disabled': { opacity: 0.3 },
                }}
              >
                <ChevronLeftIcon sx={{ fontSize: { xs: 32, sm: 40 } }} />
              </IconButton>
            )}

            {/* Media Display - Photo or Video */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                px: { xs: 6, sm: 12 },
                py: { xs: 10, sm: 8 },
              }}
            >
              {loadingViewerPhoto ? (
                <CircularProgress sx={{ color: 'white' }} size={60} />
              ) : viewerPhoto?.media_type === 'video' ? (
                // Video Player
                <video
                  src={viewerPhotoUrl}
                  controls
                  autoPlay
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(100vh - 180px)',
                    borderRadius: 4,
                    backgroundColor: '#000',
                  }}
                >
                  Your browser does not support video playback.
                </video>
              ) : viewerPhotoUrl ? (
                <img
                  src={viewerPhotoUrl}
                  alt={viewerPhoto?.notes || viewerPhoto?.original_filename || 'Photo'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(100vh - 180px)',
                    objectFit: 'contain',
                    borderRadius: 4,
                  }}
                />
              ) : (
                <Typography color="error" variant="h6">Failed to load media</Typography>
              )}
            </Box>

            {/* Next Button */}
            {currentPhotoIndex < photos.length - 1 && (
              <IconButton
                onClick={() => navigatePhoto(1)}
                disabled={loadingViewerPhoto}
                sx={{
                  position: 'absolute',
                  right: { xs: 8, sm: 24 },
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  zIndex: 10,
                  width: { xs: 48, sm: 56 },
                  height: { xs: 48, sm: 56 },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  '&:disabled': { opacity: 0.3 },
                }}
              >
                <ChevronRightIcon sx={{ fontSize: { xs: 32, sm: 40 } }} />
              </IconButton>
            )}
          </Box>

          {/* Bottom Notes Overlay */}
          {viewerPhoto && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)',
                color: 'white',
                p: { xs: 2, sm: 3 },
                pt: { xs: 4, sm: 5 },
              }}
            >
              {/* Notes - prominently displayed */}
              {viewerPhoto.notes && (
                <Typography
                  variant="body1"
                  sx={{
                    mb: 1.5,
                    fontWeight: 'medium',
                    fontSize: { xs: '1rem', sm: '1.1rem' },
                    lineHeight: 1.4,
                  }}
                >
                  {viewerPhoto.notes}
                </Typography>
              )}

              {/* Metadata row */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: { xs: 1, sm: 2 },
                  opacity: 0.8,
                }}
              >
                <Typography variant="body2">
                  <strong>By:</strong> {viewerPhoto.uploaded_by}
                </Typography>
                <Typography variant="body2">
                  <strong>Date:</strong> {new Date(viewerPhoto.uploaded_at).toLocaleDateString()}
                </Typography>
                <Typography variant="body2">
                  <strong>Time:</strong> {new Date(viewerPhoto.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
                {viewerPhoto.original_filename && (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    {viewerPhoto.original_filename}
                  </Typography>
                )}
              </Box>

              {/* Swipe hint for mobile */}
              <Typography
                variant="caption"
                sx={{
                  display: { xs: 'block', sm: 'none' },
                  textAlign: 'center',
                  mt: 2,
                  opacity: 0.5,
                }}
              >
                Use arrows to navigate • Tap outside to close
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  textAlign: 'center',
                  mt: 2,
                  opacity: 0.5,
                }}
              >
                Use arrow keys to navigate • Press ESC to close
              </Typography>
            </Box>
          )}
        </Dialog>
      </Container>
    </Box>
  );
}

export default JobView;
