import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Chip,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Card,
  CardContent,
  Snackbar,
  TextField,
  ImageList,
  ImageListItem,
  ImageListItemBar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Note as NoteIcon,
  PhotoCamera as PhotoCameraIcon,
  Send as SendIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchWorkOrder,
  allocateMaterials,
  deallocateMaterials,
  addMaterialToWorkOrder,
  removeMaterialFromWorkOrder,
  fetchWorkOrderNotes,
  addWorkOrderNote,
  deleteWorkOrderNote,
  fetchWorkOrderPhotos,
  uploadWorkOrderPhoto,
  deleteWorkOrderPhoto,
  getPhotoUrl,
} from '../api';
import AddMaterialDialog from './AddMaterialDialog';
import EditWorkOrderDialog from './EditWorkOrderDialog';
import AppHeader from './AppHeader';
import JobTasks from './JobTasks';
import ActivityTimeline from './ActivityTimeline';
import {
  formatCurrency,
  formatDate,
  getStockStatusColor,
  getMaterialStatusColor,
  groupMaterialsByCategory,
} from '../utils/workOrderHelpers';
import logger from '../utils/logger';

function WorkOrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [workOrder, setWorkOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [allocating, setAllocating] = useState(false);
  const [allocationResult, setAllocationResult] = useState(null);
  const [addMaterialDialogOpen, setAddMaterialDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    loadWorkOrder();
  }, [id]);

  const loadWorkOrder = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkOrder(id);
      setWorkOrder(data);
      setError(null);
    } catch (err) {
      logger.error('Error loading work order:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMaterial = (materialId) => {
    setSelectedMaterials(prev =>
      prev.includes(materialId)
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMaterials.length === workOrder.materials.length) {
      setSelectedMaterials([]);
    } else {
      setSelectedMaterials(workOrder.materials.map(m => m.id));
    }
  };

  const handleAllocate = async () => {
    if (selectedMaterials.length === 0) return;

    try {
      setAllocating(true);
      const result = await allocateMaterials(id, selectedMaterials);
      setAllocationResult(result);
      setSelectedMaterials([]);
      // Reload work order to see updated allocations
      await loadWorkOrder();
    } catch (err) {
      logger.error('Error allocating materials:', err);
      setError(err.message);
    } finally {
      setAllocating(false);
    }
  };

  const handleDeallocate = async () => {
    if (selectedMaterials.length === 0) return;

    try {
      setAllocating(true);
      const result = await deallocateMaterials(id, selectedMaterials);
      setAllocationResult(result);
      setSelectedMaterials([]);
      await loadWorkOrder();
    } catch (err) {
      logger.error('Error deallocating materials:', err);
      setError(err.message);
    } finally {
      setAllocating(false);
    }
  };

  const handleAddMaterial = async (material) => {
    try {
      setAllocating(true);
      await addMaterialToWorkOrder(id, material);
      setAllocationResult({ added: [material] });
      await loadWorkOrder();
    } catch (err) {
      logger.error('Error adding material:', err);
      setError(err.message);
    } finally {
      setAllocating(false);
    }
  };

  const handleRemoveMaterial = async (materialId) => {
    if (!window.confirm('Remove this material from the work order?')) return;

    try {
      setAllocating(true);
      await removeMaterialFromWorkOrder(id, materialId);
      setAllocationResult({ removed: true });
      await loadWorkOrder();
    } catch (err) {
      logger.error('Error removing material:', err);
      setError(err.message);
    } finally {
      setAllocating(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    // Parse date as local time, not UTC, to avoid timezone shifting
    // Date string like "2025-01-05" should display as January 5, not January 4
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]); // year, month (0-indexed), day
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
    // Fallback for other formats
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStockStatusColor = (status) => {
    const colors = {
      in_stock: 'success',
      partial: 'warning',
      out_of_stock: 'error',
      checking: 'default',
    };
    return colors[status] || 'default';
  };

  const getMaterialStatusColor = (status) => {
    const colors = {
      planned: 'default',
      allocated: 'info',
      loaded: 'primary',
      used: 'success',
      returned: 'warning',
    };
    return colors[status] || 'default';
  };

  const groupMaterialsByCategory = (materials) => {
    const grouped = {};
    materials.forEach(material => {
      const category = material.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(material);
    });
    return grouped;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!workOrder) {
    return (
      <Container>
        <Alert severity="error">Work order not found</Alert>
      </Container>
    );
  }

  const groupedMaterials = groupMaterialsByCategory(workOrder.materials || []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppHeader title={`WO ${workOrder.work_order_number}`}>
        <IconButton
          onClick={() => navigate('/work-orders')}
          sx={{ color: 'white' }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Button
          variant="contained"
          size="small"
          startIcon={<ViewIcon />}
          onClick={() => navigate(`/jobs/${id}`)}
          sx={{
            mr: 1,
            bgcolor: '#2196f3',
            color: 'white',
            textTransform: 'none',
            '&:hover': { bgcolor: '#42a5f5' },
          }}
        >
          Job View
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<EditIcon />}
          onClick={() => setEditDialogOpen(true)}
          sx={{
            mr: 1,
            bgcolor: '#4caf50',
            color: 'white',
            textTransform: 'none',
            '&:hover': { bgcolor: '#66bb6a' },
          }}
        >
          Edit
        </Button>
        <Chip
          label={workOrder.status?.replace('_', ' ').toUpperCase()}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }}
        />
      </AppHeader>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {allocationResult && (
          <Alert
            severity={allocationResult.insufficient_stock?.length > 0 ? 'warning' : 'success'}
            sx={{ mb: 2 }}
            onClose={() => setAllocationResult(null)}
          >
            {allocationResult.allocated?.length > 0 && (
              <div>Allocated {allocationResult.allocated.length} items successfully</div>
            )}
            {allocationResult.deallocated?.length > 0 && (
              <div>Deallocated {allocationResult.deallocated.length} items successfully</div>
            )}
            {allocationResult.insufficient_stock?.length > 0 && (
              <div>
                Insufficient stock for {allocationResult.insufficient_stock.length} items
              </div>
            )}
          </Alert>
        )}

        {/* Work Order Summary */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Job Details</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Job Type</Typography>
                    <Typography variant="body1">{workOrder.job_type}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Priority</Typography>
                    <Chip label={workOrder.priority?.toUpperCase()} size="small" />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Scheduled Date</Typography>
                    <Typography variant="body1">{formatDate(workOrder.scheduled_date)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Assigned To</Typography>
                    <Typography variant="body1">{workOrder.assigned_to || 'Unassigned'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Description</Typography>
                    <Typography variant="body1">{workOrder.job_description}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Customer Information</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Name</Typography>
                    <Typography variant="body1">
                      {workOrder.first_name} {workOrder.last_name}
                      {workOrder.company_name && ` (${workOrder.company_name})`}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Phone</Typography>
                    <Typography variant="body1">{workOrder.phone_primary}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Email</Typography>
                    <Typography variant="body1">{workOrder.email || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Service Address</Typography>
                    <Typography variant="body1">{workOrder.service_address}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Quote Summary</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">Labor</Typography>
                    <Typography variant="h6">{formatCurrency(workOrder.quoted_labor_cost)}</Typography>
                    <Typography variant="caption">{workOrder.quoted_labor_hours} hours @ {formatCurrency(workOrder.quoted_labor_rate)}/hr</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">Materials</Typography>
                    <Typography variant="h6">{formatCurrency(workOrder.quoted_material_cost)}</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                    <Typography variant="h6">{formatCurrency(workOrder.quoted_subtotal)}</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">Permit</Typography>
                    <Typography variant="body1">
                      {workOrder.permit_required ? `Yes - ${workOrder.permit_number || 'Pending'}` : 'No'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Materials List */}
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Materials ({workOrder.materials?.length || 0} items)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddMaterialDialogOpen(true)}
                sx={{ bgcolor: '#FF6B00', '&:hover': { bgcolor: '#ff8533' } }}
              >
                Add Material
              </Button>
              <Button
                variant="outlined"
                onClick={handleDeallocate}
                disabled={selectedMaterials.length === 0 || allocating}
              >
                Return ({selectedMaterials.length})
              </Button>
              <Button
                variant="contained"
                onClick={handleAllocate}
                disabled={selectedMaterials.length === 0 || allocating}
                startIcon={allocating ? <CircularProgress size={20} /> : <CheckCircleIcon />}
              >
                Allocate ({selectedMaterials.length})
              </Button>
            </Box>
          </Box>

          {Object.entries(groupedMaterials).map(([category, materials]) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#FF6B00' }}>
                {category} ({materials.length})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={
                            selectedMaterials.length > 0 &&
                            selectedMaterials.length < workOrder.materials.length
                          }
                          checked={selectedMaterials.length === workOrder.materials.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>Item ID</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="center">Needed</TableCell>
                      <TableCell align="center">Allocated</TableCell>
                      <TableCell align="center">Available</TableCell>
                      <TableCell align="center">Stock Status</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Line Total</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {materials.map((material) => (
                      <TableRow
                        key={material.id}
                        hover
                        sx={{
                          bgcolor: material.quantity_allocated >= material.quantity_needed
                            ? 'rgba(76, 175, 80, 0.05)'
                            : 'inherit'
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedMaterials.includes(material.id)}
                            onChange={() => handleSelectMaterial(material.id)}
                          />
                        </TableCell>
                        <TableCell>{material.item_id}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {material.brand} {material.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {material.location} | {material.qty_per}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {material.quantity_needed}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" color={material.quantity_allocated > 0 ? 'success.main' : 'text.secondary'}>
                            {material.quantity_allocated}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography
                            variant="body2"
                            color={material.available_qty >= material.quantity_needed ? 'success.main' : 'error.main'}
                          >
                            {material.available_qty}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={material.stock_status?.replace('_', ' ').toUpperCase()}
                            color={getStockStatusColor(material.stock_status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={material.status?.toUpperCase()}
                            color={getMaterialStatusColor(material.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">{formatCurrency(material.unit_price)}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(material.quantity_needed * material.unit_price)}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            onClick={() => handleRemoveMaterial(material.id)}
                            size="small"
                            color="error"
                            disabled={allocating}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Paper>
        {/* Tasks / Scope of Work */}
        <Box sx={{ mt: 3 }}>
          <JobTasks
            workOrderId={id}
            workOrder={workOrder}
            onError={(msg) => setError(msg)}
            onSuccess={(msg) => setAllocationResult({ message: msg })}
            onTasksConverted={loadWorkOrder}
          />
        </Box>

        {/* Activity Timeline */}
        <Box sx={{ mt: 3 }}>
          <ActivityTimeline
            workOrderId={id}
            onError={(msg) => setError(msg)}
          />
        </Box>

        <AddMaterialDialog
          open={addMaterialDialogOpen}
          onClose={() => setAddMaterialDialogOpen(false)}
          onAdd={handleAddMaterial}
          workOrderId={id}
        />

        <EditWorkOrderDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onUpdated={loadWorkOrder}
          workOrder={workOrder}
        />
      </Container>
    </Box>
  );
}

export default WorkOrderDetail;
