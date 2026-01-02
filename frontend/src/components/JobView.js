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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Assignment as AssignmentIcon,
  LocationOn as LocationIcon,
  CheckCircle as CheckCircleIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  Note as NoteIcon,
  PhotoCamera as PhotoCameraIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Navigation as NavigationIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Close as CloseIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchWorkOrder,
  allocateMaterials,
  deallocateMaterials,
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
} from '../api';
import JobTasks from './JobTasks';
import ActivityTimeline from './ActivityTimeline';
import AppHeader from './AppHeader';
import AssignedAvatars from './common/AssignedAvatars';
import AddMaterialDialog from './AddMaterialDialog';
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

  // Photo viewer modal state
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState(null);
  const [viewerPhotoUrl, setViewerPhotoUrl] = useState(null);
  const [loadingViewerPhoto, setLoadingViewerPhoto] = useState(false);

  // Add Material Dialog state
  const [addMaterialDialog, setAddMaterialDialog] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

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
    };
  }, []);

  useEffect(() => {
    loadUserRole();
    loadWorkOrder();
    loadNotes();
    loadPhotos();
  }, [id]);

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

  const handlePullMaterial = async (materialId) => {
    try {
      setPullingMaterial(materialId);
      await allocateMaterials(id, [materialId]);
      setSuccessMessage('Material pulled from warehouse');
      await loadWorkOrder(); // Refresh to show updated status
    } catch (err) {
      logger.error('Error pulling material:', err);
      setError(err.message);
    } finally {
      setPullingMaterial(null);
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
      // Get all materials that have status 'planned' and have available stock
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
      // Get all materials that have status 'allocated' or 'used'
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
      setPhotos(data.photos || []);
    } catch (err) {
      logger.error('Error loading photos:', err);
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

  // Open the photo upload dialog with file selected
  const handlePhotoSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
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

  // Open photo in viewer modal with authenticated fetch
  const handleViewPhoto = async (photo) => {
    setViewerPhoto(photo);
    setPhotoViewerOpen(true);
    setLoadingViewerPhoto(true);

    try {
      const blobUrl = await fetchAuthenticatedPhoto(photo.filename);
      setViewerPhotoUrl(blobUrl);
    } catch (err) {
      logger.error('Error loading photo:', err);
      setError('Failed to load photo');
    } finally {
      setLoadingViewerPhoto(false);
    }
  };

  // Close photo viewer and clean up blob URL
  const handleClosePhotoViewer = () => {
    setPhotoViewerOpen(false);
    if (viewerPhotoUrl) {
      URL.revokeObjectURL(viewerPhotoUrl);
      setViewerPhotoUrl(null);
    }
    setViewerPhoto(null);
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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppHeader title={`Job ${workOrder.work_order_number}`}>
        <IconButton
          onClick={() => navigate('/jobs')}
          sx={{ color: 'white' }}
        >
          <ArrowBackIcon />
        </IconButton>
        {(userRole === 'admin' || userRole === 'manager') && (
          <Button
            variant="contained"
            size="small"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/work-orders/${id}`)}
            sx={{
              mr: 1,
              bgcolor: '#ff9800',
              color: 'white',
              textTransform: 'none',
              '&:hover': { bgcolor: '#ffa726' },
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

      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        {/* Job Info Card */}
        <Paper elevation={3} sx={{ p: 3, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#FF6B00' }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 1 }}>
                <LocationIcon sx={{ color: '#FF6B00', fontSize: 20 }} />
                <Typography variant="body1" sx={{ flexGrow: 1 }}>
                  {workOrder.service_address || 'No address provided'}
                </Typography>
                {workOrder.service_address && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<NavigationIcon />}
                    onClick={handleNavigate}
                    sx={{
                      bgcolor: '#FF6B00',
                      '&:hover': { bgcolor: '#E55F00' },
                      minWidth: { xs: '100%', sm: 'auto' },
                      mt: { xs: 1, sm: 0 }
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
              <Typography variant="subtitle2" color="text.secondary">JOB STATUS</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip
                  label={workOrder.priority?.toUpperCase()}
                  color={getPriorityColor(workOrder.priority)}
                  size="small"
                />
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
        </Paper>

        {/* Status Change Controls */}
        <Paper elevation={3} sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#FF6B00' }}>
            Update Job Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            {/* Technician buttons - Mark Complete */}
            {workOrder.status !== 'completed' && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleStatusChange('completed')}
                disabled={updatingStatus}
              >
                Mark Complete
              </Button>
            )}

            {/* Admin buttons - Full workflow control */}
            {userRole === 'admin' && (
              <>
                {workOrder.status !== 'pending' && (
                  <Button
                    variant="outlined"
                    onClick={() => handleStatusChange('pending')}
                    disabled={updatingStatus}
                  >
                    Set to Pending
                  </Button>
                )}
                {workOrder.status !== 'scheduled' && (
                  <Button
                    variant="outlined"
                    onClick={() => handleStatusChange('scheduled')}
                    disabled={updatingStatus}
                  >
                    Set to Scheduled
                  </Button>
                )}
                {workOrder.status !== 'in_progress' && (
                  <Button
                    variant="outlined"
                    onClick={() => handleStatusChange('in_progress')}
                    disabled={updatingStatus}
                  >
                    Set to In Progress
                  </Button>
                )}
                {workOrder.status !== 'completed' && (
                  <Button
                    variant="outlined"
                    color="success"
                    onClick={() => handleStatusChange('completed')}
                    disabled={updatingStatus}
                  >
                    Set to Completed
                  </Button>
                )}
                {workOrder.status !== 'cancelled' && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={updatingStatus}
                  >
                    Cancel Job
                  </Button>
                )}
              </>
            )}

            {/* Generate Invoice Button - shows for completed work orders */}
            {workOrder.status === 'completed' && (
              <Button
                variant="contained"
                startIcon={creatingInvoice ? <CircularProgress size={20} color="inherit" /> : <ReceiptIcon />}
                onClick={handleCreateInvoice}
                disabled={creatingInvoice}
                sx={{
                  bgcolor: '#2196F3',
                  '&:hover': { bgcolor: '#1976D2' },
                  fontWeight: 'bold',
                }}
              >
                {creatingInvoice ? 'Creating Invoice...' : 'Generate Invoice'}
              </Button>
            )}
          </Box>
        </Paper>

        {/* Job Tasks (Scope of Work with checkboxes) */}
        <JobTasks
          workOrderId={id}
          workOrder={workOrder}
          onError={(msg) => setError(msg)}
          onSuccess={(msg) => setSuccessMessage(msg)}
          onTasksConverted={loadWorkOrder}
        />

        {/* Materials Checklist */}
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Materials Checklist ({workOrder.materials?.length || 0} items)
            </Typography>
            <Button
              variant="contained"
              startIcon={<InventoryIcon />}
              onClick={() => setAddMaterialDialog(true)}
              sx={{ bgcolor: '#FF6B00', '&:hover': { bgcolor: '#E55F00' } }}
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
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#FF6B00' }}>
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
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                  {material.item_id} - {material.description}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {material.brand}
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
                                  <Chip
                                    label={`Available: ${material.available_qty || 0}`}
                                    size="small"
                                    color={getStockStatusColor(material.stock_status)}
                                  />
                                  <Chip
                                    label={material.status?.replace('_', ' ').toUpperCase()}
                                    size="small"
                                    color={getMaterialStatusColor(material.status)}
                                    variant="outlined"
                                  />
                                </Box>
                                {/* Location prominently displayed */}
                                <Box sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  bgcolor: '#FFF3E0',
                                  p: 1,
                                  borderRadius: 1,
                                  mt: 1
                                }}>
                                  <LocationIcon sx={{ mr: 1, color: '#FF6B00' }} />
                                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#FF6B00' }}>
                                    Location: {material.location || 'Unknown'}
                                  </Typography>
                                </Box>
                              </Box>
                            }
                          />
                        </Box>
                        {/* Pull/Return button for each material */}
                        <Box sx={{ ml: { sm: 2 }, mt: { xs: 2, sm: 0 } }}>
                          {material.status === 'planned' && material.available_qty > 0 ? (
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={pullingMaterial === material.id ? <CircularProgress size={16} color="inherit" /> : <ShoppingCartIcon />}
                              onClick={() => handlePullMaterial(material.id)}
                              disabled={pullingMaterial === material.id}
                              sx={{ minWidth: 100 }}
                            >
                              Pull
                            </Button>
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
                          ) : material.available_qty === 0 ? (
                            <Chip
                              label="Out of Stock"
                              color="error"
                              size="small"
                            />
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
        </Paper>

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

        {/* Permit & Inspection Info */}
        {(workOrder.permit_required || workOrder.inspection_required) && (
          <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Permits & Inspections
            </Typography>
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
          </Paper>
        )}

        {/* Job Notes */}
        <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <NoteIcon sx={{ mr: 1, color: '#FF6B00' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Job Notes
            </Typography>
          </Box>

          {/* Add Note */}
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
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
              sx={{ minWidth: 100 }}
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
                        bgcolor: '#FF6B00',
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
                          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#FF6B00' }}>
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
        </Paper>

        {/* Job Photos */}
        <Paper elevation={3} sx={{ p: 3, mt: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <PhotoCameraIcon sx={{ mr: 1, color: '#FF6B00' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Job Photos
            </Typography>
          </Box>

          {/* Upload Photo */}
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              component="label"
              startIcon={<PhotoCameraIcon />}
              sx={{ bgcolor: '#FF6B00', '&:hover': { bgcolor: '#E55F00' } }}
            >
              Take Photo / Upload
              <input
                type="file"
                hidden
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
              />
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Max file size: 10MB. Supported formats: JPG, PNG, HEIC
            </Typography>
          </Box>

          {/* Photos Grid */}
          {photos.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No photos yet. Take photos to document the job.
            </Typography>
          ) : (
            <ImageList cols={window.innerWidth < 600 ? 2 : 3} gap={8}>
              {photos.map((photo) => (
                <ImageListItem key={photo.id}>
                  <img
                    src={getPhotoUrl(photo.filename)}
                    alt={photo.caption || photo.original_filename}
                    loading="lazy"
                    style={{ height: 200, objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => handleViewPhoto(photo)}
                  />
                  {photo.photo_type && photo.photo_type !== 'general' && (
                    <Chip
                      label={photo.photo_type.charAt(0).toUpperCase() + photo.photo_type.slice(1)}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        bgcolor: photo.photo_type === 'before' ? '#2196f3' :
                                 photo.photo_type === 'after' ? '#4caf50' :
                                 photo.photo_type === 'issue' ? '#f44336' :
                                 photo.photo_type === 'progress' ? '#ff9800' : '#9e9e9e',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.65rem',
                      }}
                    />
                  )}
                  <ImageListItemBar
                    title={photo.notes || photo.original_filename}
                    subtitle={
                      <>
                        {photo.uploaded_by && (
                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
                            By: {photo.uploaded_by}
                          </Typography>
                        )}
                        <Typography variant="caption">
                          {new Date(photo.uploaded_at).toLocaleDateString()} at{' '}
                          {new Date(photo.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </>
                    }
                    actionIcon={
                      <IconButton
                        sx={{ color: 'rgba(255, 255, 255, 0.9)' }}
                        onClick={() => handleDeletePhoto(photo.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  />
                </ImageListItem>
              ))}
            </ImageList>
          )}
        </Paper>

        {/* Activity Timeline */}
        <ActivityTimeline
          workOrderId={id}
          onError={(msg) => setError(msg)}
        />

        {/* Add Material Dialog - Multi-select */}
        <AddMaterialDialog
          open={addMaterialDialog}
          onClose={handleMaterialDialogClose}
          onAdd={handleAddMaterial}
          workOrderId={id}
        />

        {/* Photo Upload Dialog with Notes */}
        <Dialog
          open={photoUploadDialog}
          onClose={handleClosePhotoDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PhotoCameraIcon color="primary" />
            Add Photo with Notes
          </DialogTitle>
          <DialogContent>
            {/* Photo Preview */}
            {photoPreviewUrl && (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
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
              startIcon={uploadingPhoto ? <CircularProgress size={16} /> : <PhotoCameraIcon />}
              sx={{ bgcolor: '#FF6B00', '&:hover': { bgcolor: '#E55F00' } }}
            >
              {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Photo Viewer Modal */}
        <Dialog
          open={photoViewerOpen}
          onClose={handleClosePhotoViewer}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: { bgcolor: '#000', maxHeight: '95vh' }
          }}
        >
          <DialogTitle sx={{
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 1,
          }}>
            <Box>
              <Typography variant="h6" component="span">
                {viewerPhoto?.notes || viewerPhoto?.original_filename || 'Photo'}
              </Typography>
              {viewerPhoto?.photo_type && viewerPhoto.photo_type !== 'general' && (
                <Chip
                  label={viewerPhoto.photo_type.charAt(0).toUpperCase() + viewerPhoto.photo_type.slice(1)}
                  size="small"
                  sx={{
                    ml: 1,
                    bgcolor: viewerPhoto.photo_type === 'before' ? '#2196f3' :
                             viewerPhoto.photo_type === 'after' ? '#4caf50' :
                             viewerPhoto.photo_type === 'issue' ? '#f44336' :
                             viewerPhoto.photo_type === 'progress' ? '#ff9800' : '#9e9e9e',
                    color: 'white',
                  }}
                />
              )}
            </Box>
            <IconButton onClick={handleClosePhotoViewer} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 0,
            minHeight: 400,
          }}>
            {loadingViewerPhoto ? (
              <CircularProgress sx={{ color: 'white' }} />
            ) : viewerPhotoUrl ? (
              <img
                src={viewerPhotoUrl}
                alt={viewerPhoto?.notes || viewerPhoto?.original_filename || 'Photo'}
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(95vh - 120px)',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Typography color="error">Failed to load photo</Typography>
            )}
          </DialogContent>
          {viewerPhoto && (
            <DialogActions sx={{ bgcolor: '#222', color: 'white', justifyContent: 'space-between', px: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#aaa' }}>
                  Uploaded by {viewerPhoto.uploaded_by} on{' '}
                  {new Date(viewerPhoto.uploaded_at).toLocaleDateString()} at{' '}
                  {new Date(viewerPhoto.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              <Button onClick={handleClosePhotoViewer} sx={{ color: 'white' }}>
                Close
              </Button>
            </DialogActions>
          )}
        </Dialog>
      </Container>
    </Box>
  );
}

export default JobView;
