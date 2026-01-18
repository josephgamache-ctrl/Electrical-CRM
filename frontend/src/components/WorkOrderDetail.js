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
  List,
  ListItem,
  ListItemText,
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
} from '@mui/material';
import ConfirmDialog from './common/ConfirmDialog';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchWorkOrder,
  allocateMaterials,
  deallocateMaterials,
  markFieldAcquisition,
  addMaterialToWorkOrder,
  removeMaterialFromWorkOrder,
  deleteWorkOrder,
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
  const [allocating, setAllocating] = useState(false);
  const [allocationResult, setAllocationResult] = useState(null);
  const [addMaterialDialogOpen, setAddMaterialDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removeMaterialDialog, setRemoveMaterialDialog] = useState({ open: false, materialId: null });

  // Material action dialog state
  const [materialActionDialog, setMaterialActionDialog] = useState(null);
  const [actionQuantity, setActionQuantity] = useState(1);
  const [actionCost, setActionCost] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

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

  const handleDeleteWorkOrder = async () => {
    try {
      setDeleting(true);
      await deleteWorkOrder(id);
      setDeleteDialogOpen(false);
      navigate('/work-orders');
    } catch (err) {
      logger.error('Error deleting work order:', err);
      setError(err.message);
      setDeleting(false);
    }
  };

  // Open dialog for pull action
  const openPullDialog = (material) => {
    const remaining = material.quantity_needed - (material.quantity_allocated || 0);
    setMaterialActionDialog({ material, action: 'pull' });
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

      if (action === 'pull') {
        await allocateMaterials(id, [material.id], quantity);
        setAllocationResult({ message: `Pulled ${quantity} x ${material.description} from warehouse` });
      } else if (action === 'gotit') {
        await markFieldAcquisition(id, material.id, quantity, cost);
        setAllocationResult({ message: `Marked ${quantity} x ${material.description} as acquired` });
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
      setAllocating(true);
      await deallocateMaterials(id, [materialId]);
      setAllocationResult({ message: 'Material returned to warehouse' });
      await loadWorkOrder();
    } catch (err) {
      logger.error('Error returning material:', err);
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

  const handleRemoveMaterial = (materialId) => {
    setRemoveMaterialDialog({ open: true, materialId });
  };

  const handleConfirmRemoveMaterial = async () => {
    const materialId = removeMaterialDialog.materialId;
    setRemoveMaterialDialog({ open: false, materialId: null });

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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden', maxWidth: '100vw' }}>
      <AppHeader title={workOrder.service_address || 'No Address'} subtitle={`${workOrder.work_order_number} - Customer: ${workOrder.customer_name || 'Unknown'}`}>
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
        <Button
          variant="contained"
          size="small"
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialogOpen(true)}
          sx={{
            mr: 1,
            bgcolor: '#f44336',
            color: 'white',
            textTransform: 'none',
            '&:hover': { bgcolor: '#e57373' },
          }}
        >
          Delete
        </Button>
        <Chip
          label={workOrder.status?.replace('_', ' ').toUpperCase()}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }}
        />
      </AppHeader>

      <Container maxWidth="xl" sx={{ mt: 2, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
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
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Labor</Typography>
                    <Typography variant="h6">{formatCurrency(workOrder.quoted_labor_cost)}</Typography>
                    <Typography variant="caption">{workOrder.quoted_labor_hours}h @ {formatCurrency(workOrder.quoted_labor_rate)}/hr</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Materials</Typography>
                    <Typography variant="h6">{formatCurrency(workOrder.quoted_material_cost)}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                    <Typography variant="h6">{formatCurrency(workOrder.quoted_subtotal)}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Materials ({workOrder.materials?.length || 0} items)
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddMaterialDialogOpen(true)}
              sx={{ bgcolor: '#FF6B00', '&:hover': { bgcolor: '#E55F00' } }}
            >
              Add Material
            </Button>
          </Box>

          {Object.entries(groupedMaterials).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No materials assigned to this work order yet.
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
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          py: 2,
                          bgcolor: material.quantity_allocated >= material.quantity_needed
                            ? 'rgba(76, 175, 80, 0.05)'
                            : 'inherit'
                        }}
                      >
                        <Box sx={{ width: '100%' }}>
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
                                  <Chip
                                    label={formatCurrency(material.quantity_needed * material.unit_price)}
                                    size="small"
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
                        {/* Action buttons */}
                        <Box sx={{ width: '100%', mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
                                startIcon={allocating ? <CircularProgress size={16} color="inherit" /> : <InventoryIcon />}
                                onClick={() => handleReturnMaterial(material.id)}
                                disabled={allocating}
                              >
                                Return
                              </Button>
                            ) : material.status === 'planned' ? (
                              <>
                                {material.available_qty === 0 && (
                                  <Chip
                                    label="Out of Stock"
                                    color="error"
                                    size="small"
                                  />
                                )}
                                {(material.quantity_allocated > 0 && material.quantity_allocated < material.quantity_needed) && (
                                  <Chip
                                    label={`${material.quantity_allocated}/${material.quantity_needed} allocated`}
                                    color="warning"
                                    size="small"
                                    sx={{ fontWeight: 'bold' }}
                                  />
                                )}
                                {material.available_qty > 0 && (
                                  <Button
                                    variant="contained"
                                    color="success"
                                    size="small"
                                    startIcon={<InventoryIcon />}
                                    onClick={() => openPullDialog(material)}
                                  >
                                    Pull
                                  </Button>
                                )}
                                <Button
                                  variant="contained"
                                  color="info"
                                  size="small"
                                  startIcon={<ShoppingCartIcon />}
                                  onClick={() => openGotItDialog(material)}
                                >
                                  Got It
                                </Button>
                              </>
                            ) : null}
                          </Box>
                          <IconButton
                            onClick={() => handleRemoveMaterial(material.id)}
                            size="small"
                            color="error"
                            disabled={allocating}
                            title="Remove material"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            ))
          )}
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

        {/* Material Action Dialog (Pull / Got It) */}
        <Dialog
          open={!!materialActionDialog}
          onClose={closeMaterialActionDialog}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {materialActionDialog?.action === 'pull' ? (
              <>
                <InventoryIcon color="success" />
                Pull from Warehouse
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
                  {materialActionDialog.action === 'pull' && (
                    <Chip label={`Available: ${materialActionDialog.material.available_qty || 0}`} size="small" color="success" />
                  )}
                </Box>

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
                          materialActionDialog.material.available_qty || 0
                        )
                      : materialActionDialog.material.quantity_needed - (materialActionDialog.material.quantity_allocated || 0)
                  }}
                  helperText={
                    materialActionDialog.action === 'pull'
                      ? `Max: ${Math.min(materialActionDialog.material.quantity_needed - (materialActionDialog.material.quantity_allocated || 0), materialActionDialog.material.available_qty || 0)}`
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
              disabled={processingAction || actionQuantity < 1}
              color={materialActionDialog?.action === 'pull' ? 'success' : 'info'}
              startIcon={processingAction ? <CircularProgress size={20} /> : null}
              sx={{ minWidth: 120 }}
            >
              {processingAction ? 'Processing...' : materialActionDialog?.action === 'pull' ? 'Pull' : 'Got It'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Work Order?</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete work order <strong>{workOrder?.work_order_number}</strong>?
            </Typography>
            <Typography color="error" sx={{ mt: 2 }}>
              This will permanently delete:
            </Typography>
            <Typography component="ul" sx={{ pl: 2 }}>
              <li>All time entries</li>
              <li>All schedule assignments</li>
              <li>All materials</li>
              <li>All tasks and notes</li>
              <li>All photos</li>
            </Typography>
            <Typography color="error" sx={{ mt: 2, fontWeight: 'bold' }}>
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteWorkOrder}
              color="error"
              variant="contained"
              disabled={deleting}
            >
              {deleting ? <CircularProgress size={20} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Success Snackbar */}
        {allocationResult?.message && (
          <Snackbar
            open={!!allocationResult?.message}
            autoHideDuration={4000}
            onClose={() => setAllocationResult(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={() => setAllocationResult(null)} severity="success" sx={{ width: '100%' }}>
              {allocationResult.message}
            </Alert>
          </Snackbar>
        )}

        {/* Remove Material Confirmation */}
        <ConfirmDialog
          open={removeMaterialDialog.open}
          onClose={() => setRemoveMaterialDialog({ open: false, materialId: null })}
          onConfirm={handleConfirmRemoveMaterial}
          title="Remove Material"
          message="Remove this material from the work order?"
          confirmText="Remove"
          confirmColor="error"
          severity="warning"
        />
      </Container>
    </Box>
  );
}

export default WorkOrderDetail;
