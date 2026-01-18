import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Inventory as InventoryIcon,
  LocalShipping as VanIcon,
  Warehouse as WarehouseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { reconcileMaterials } from '../api';
import logger from '../utils/logger';

/**
 * MaterialReconciliationDialog
 *
 * Shows when user tries to mark a job complete and there are materials
 * that were allocated but may not have been fully used. User must account
 * for where each material went before completing the job.
 */
const MaterialReconciliationDialog = ({
  open,
  onClose,
  onComplete,
  workOrder,
  vans = [],
  selectedVanId,
}) => {
  // Track disposition of each material with unaccounted quantity
  const [materialDispositions, setMaterialDispositions] = useState({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});

  // Get ALL materials on the job - user needs to account for each one
  const materialsToReconcile = (workOrder?.materials || []).filter(m => {
    // Include any material that was needed for this job
    return (m.quantity_needed || 0) > 0;
  });

  // Initialize dispositions when dialog opens
  useEffect(() => {
    if (open && materialsToReconcile.length > 0) {
      const initial = {};
      materialsToReconcile.forEach(m => {
        const needed = m.quantity_needed || 0;
        const allocated = m.quantity_allocated || 0;
        // Default: assume the allocated amount was used (or all needed if nothing allocated)
        const defaultUsed = allocated > 0 ? allocated : needed;
        initial[m.id] = {
          allUsed: true,
          usedQty: defaultUsed,
          leftoverQty: 0,
          leftoverDestination: 'van', // 'van' or 'warehouse'
          notes: '',
          needed: needed,
          allocated: allocated,
        };
      });
      setMaterialDispositions(initial);
      setExpandedItems({});
      setError(null);
    }
  }, [open, workOrder?.id]);

  const toggleExpanded = (materialId) => {
    setExpandedItems(prev => ({
      ...prev,
      [materialId]: !prev[materialId]
    }));
  };

  const handleAllUsedChange = (materialId, allUsed) => {
    setMaterialDispositions(prev => {
      const material = materialsToReconcile.find(m => m.id === materialId);
      const allocated = material?.quantity_allocated || 0;
      const needed = material?.quantity_needed || 0;
      // Use the allocated qty if any was allocated, otherwise use needed
      const baseQty = allocated > 0 ? allocated : needed;

      return {
        ...prev,
        [materialId]: {
          ...prev[materialId],
          allUsed,
          usedQty: allUsed ? baseQty : prev[materialId]?.usedQty || 0,
          leftoverQty: allUsed ? 0 : baseQty - (prev[materialId]?.usedQty || 0),
        }
      };
    });

    // Auto-expand if not all used
    if (!allUsed) {
      setExpandedItems(prev => ({ ...prev, [materialId]: true }));
    }
  };

  const handleUsedQtyChange = (materialId, usedQty) => {
    setMaterialDispositions(prev => {
      const material = materialsToReconcile.find(m => m.id === materialId);
      const allocated = material?.quantity_allocated || 0;
      const needed = material?.quantity_needed || 0;
      const baseQty = allocated > 0 ? allocated : needed;
      const qty = Math.max(0, Math.min(baseQty, parseInt(usedQty) || 0));

      return {
        ...prev,
        [materialId]: {
          ...prev[materialId],
          usedQty: qty,
          leftoverQty: baseQty - qty,
          allUsed: qty >= baseQty,
        }
      };
    });
  };

  const handleDestinationChange = (materialId, destination) => {
    setMaterialDispositions(prev => ({
      ...prev,
      [materialId]: {
        ...prev[materialId],
        leftoverDestination: destination,
      }
    }));
  };

  const handleNotesChange = (materialId, notes) => {
    setMaterialDispositions(prev => ({
      ...prev,
      [materialId]: {
        ...prev[materialId],
        notes,
      }
    }));
  };

  const handleMarkAllUsed = () => {
    const allUsed = {};
    materialsToReconcile.forEach(m => {
      const allocated = m.quantity_allocated || 0;
      const needed = m.quantity_needed || 0;
      const baseQty = allocated > 0 ? allocated : needed;
      allUsed[m.id] = {
        allUsed: true,
        usedQty: baseQty,
        leftoverQty: 0,
        leftoverDestination: 'van',
        notes: '',
        needed: needed,
        allocated: allocated,
      };
    });
    setMaterialDispositions(allUsed);
    setExpandedItems({});
  };

  const handleComplete = async () => {
    setProcessing(true);
    setError(null);

    try {
      // Build the reconciliation request for all materials
      const materialsToSend = materialsToReconcile.map(material => {
        const disposition = materialDispositions[material.id];
        if (!disposition) {
          // Default to all used if no disposition set
          return {
            material_id: material.id,
            quantity_used: material.quantity_allocated || material.quantity_needed || 0,
            leftover_qty: 0,
            leftover_destination: null,
            leftover_van_id: null,
            notes: null
          };
        }

        return {
          material_id: material.id,
          quantity_used: disposition.usedQty || 0,
          leftover_qty: disposition.leftoverQty || 0,
          leftover_destination: disposition.leftoverQty > 0 ? disposition.leftoverDestination : null,
          leftover_van_id: disposition.leftoverDestination === 'van' ? selectedVanId : null,
          notes: disposition.notes || null
        };
      });

      // Send all reconciliation data in one API call
      await reconcileMaterials(workOrder.id, materialsToSend);
      logger.info(`Reconciled ${materialsToSend.length} materials for job #${workOrder.work_order_number}`);

      // All reconciliation done, now complete the job
      await onComplete();
    } catch (err) {
      logger.error('Error reconciling materials:', err);
      setError(err.message || 'Failed to reconcile materials');
    } finally {
      setProcessing(false);
    }
  };

  // Check if all materials have been accounted for
  const allAccountedFor = materialsToReconcile.every(m => {
    const disposition = materialDispositions[m.id];
    if (!disposition) return false;

    // If there are leftovers going to van, make sure a van is selected
    if (disposition.leftoverQty > 0 && disposition.leftoverDestination === 'van' && !selectedVanId) {
      return false;
    }

    return true;
  });

  // Count materials with leftovers
  const materialsWithLeftovers = materialsToReconcile.filter(m => {
    const disposition = materialDispositions[m.id];
    return disposition && disposition.leftoverQty > 0;
  });

  // If no materials to reconcile, just complete
  if (materialsToReconcile.length === 0) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckIcon color="success" />
          Complete Job
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1 }}>
            No materials were allocated to this job. Ready to mark as complete.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={onComplete}
            disabled={processing}
            startIcon={processing ? <CircularProgress size={20} /> : <CheckIcon />}
          >
            Mark Complete
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: (theme) => theme.palette.mode === 'dark'
          ? 'rgba(255, 167, 38, 0.2)'
          : 'warning.light'
      }}>
        <InventoryIcon color="warning" />
        <Box>
          <Typography variant="h6">Account for Materials</Typography>
          <Typography variant="body2" color="text.secondary">
            Before completing, please confirm what happened to each material
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {/* Quick action */}
        <Box sx={{ p: 2, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Button
            variant="outlined"
            color="success"
            onClick={handleMarkAllUsed}
            startIcon={<CheckIcon />}
            fullWidth
          >
            Mark All Materials as Used on Job
          </Button>
        </Box>

        {/* Materials list */}
        <List sx={{ py: 0 }}>
          {materialsToReconcile.map((material, index) => {
            const disposition = materialDispositions[material.id] || {};
            const allocated = material.quantity_allocated || 0;
            const needed = material.quantity_needed || 0;
            const baseQty = allocated > 0 ? allocated : needed;
            const isExpanded = expandedItems[material.id];
            const hasLeftovers = disposition.leftoverQty > 0;

            return (
              <React.Fragment key={material.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    py: 2,
                    bgcolor: hasLeftovers ? 'warning.main' : 'transparent',
                    ...(hasLeftovers && {
                      bgcolor: (theme) => theme.palette.mode === 'dark'
                        ? 'rgba(255, 167, 38, 0.15)'
                        : 'rgba(255, 167, 38, 0.1)'
                    }),
                  }}
                >
                  {/* Material header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {material.item_id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {material.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={`Needed: ${needed}`}
                          size="small"
                          variant="outlined"
                        />
                        {allocated > 0 && (
                          <Chip
                            label={`Pulled: ${allocated}`}
                            size="small"
                            color="primary"
                          />
                        )}
                        {allocated === 0 && (
                          <Chip
                            label="Not pulled"
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        )}
                        {disposition.allUsed ? (
                          <Chip
                            icon={<CheckIcon />}
                            label={`Used: ${disposition.usedQty || baseQty}`}
                            size="small"
                            color="success"
                          />
                        ) : hasLeftovers && (
                          <Chip
                            icon={<WarningIcon />}
                            label={`${disposition.leftoverQty} leftover`}
                            size="small"
                            color="warning"
                          />
                        )}
                      </Box>
                    </Box>
                    <IconButton onClick={() => toggleExpanded(material.id)} size="small">
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>

                  {/* Quick toggle */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Button
                      variant={disposition.allUsed ? 'contained' : 'outlined'}
                      color="success"
                      size="small"
                      onClick={() => handleAllUsedChange(material.id, true)}
                      sx={{ flex: 1 }}
                    >
                      All Used
                    </Button>
                    <Button
                      variant={!disposition.allUsed ? 'contained' : 'outlined'}
                      color="warning"
                      size="small"
                      onClick={() => handleAllUsedChange(material.id, false)}
                      sx={{ flex: 1 }}
                    >
                      Has Leftover
                    </Button>
                  </Box>

                  {/* Expanded details for leftovers */}
                  <Collapse in={isExpanded || hasLeftovers}>
                    <Box sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: (theme) => theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.04)',
                      borderRadius: 1
                    }}>
                      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                          label="Qty Used"
                          type="number"
                          value={disposition.usedQty || 0}
                          onChange={(e) => handleUsedQtyChange(material.id, e.target.value)}
                          size="small"
                          inputProps={{ min: 0, max: baseQty }}
                          sx={{ width: 120 }}
                          helperText={`Max: ${baseQty}`}
                        />
                        <TextField
                          label="Leftover"
                          type="number"
                          value={disposition.leftoverQty || 0}
                          disabled
                          size="small"
                          sx={{ width: 120 }}
                        />
                      </Box>

                      {hasLeftovers && (
                        <>
                          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                            <InputLabel>Where does leftover go?</InputLabel>
                            <Select
                              value={disposition.leftoverDestination || 'van'}
                              onChange={(e) => handleDestinationChange(material.id, e.target.value)}
                              label="Where does leftover go?"
                            >
                              <MenuItem value="van">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <VanIcon fontSize="small" color="primary" />
                                  Keep on Van
                                </Box>
                              </MenuItem>
                              <MenuItem value="warehouse">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <WarehouseIcon fontSize="small" color="info" />
                                  Return to Warehouse
                                </Box>
                              </MenuItem>
                            </Select>
                          </FormControl>

                          {disposition.leftoverDestination === 'van' && !selectedVanId && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                              No van selected. Please select a van or return to warehouse.
                            </Alert>
                          )}

                          <TextField
                            label="Notes (optional)"
                            value={disposition.notes || ''}
                            onChange={(e) => handleNotesChange(material.id, e.target.value)}
                            size="small"
                            fullWidth
                            placeholder="Why wasn't it all used?"
                          />
                        </>
                      )}
                    </Box>
                  </Collapse>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>

        {/* Summary */}
        {materialsWithLeftovers.length > 0 && (
          <Box sx={{
            p: 2,
            bgcolor: (theme) => theme.palette.mode === 'dark'
              ? 'rgba(255, 167, 38, 0.2)'
              : 'warning.light',
            borderTop: '1px solid',
            borderColor: 'divider'
          }}>
            <Typography variant="body2">
              <strong>{materialsWithLeftovers.length}</strong> material(s) have leftovers that will be:
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
              {materialsWithLeftovers.filter(m => materialDispositions[m.id]?.leftoverDestination === 'van').length > 0 && (
                <Chip
                  icon={<VanIcon />}
                  label={`${materialsWithLeftovers.filter(m => materialDispositions[m.id]?.leftoverDestination === 'van').length} to Van`}
                  size="small"
                  color="primary"
                />
              )}
              {materialsWithLeftovers.filter(m => materialDispositions[m.id]?.leftoverDestination === 'warehouse').length > 0 && (
                <Chip
                  icon={<WarehouseIcon />}
                  label={`${materialsWithLeftovers.filter(m => materialDispositions[m.id]?.leftoverDestination === 'warehouse').length} to Warehouse`}
                  size="small"
                  color="info"
                />
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleComplete}
          disabled={processing || !allAccountedFor}
          startIcon={processing ? <CircularProgress size={20} /> : <CheckIcon />}
        >
          {processing ? 'Processing...' : 'Complete Job'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MaterialReconciliationDialog;
