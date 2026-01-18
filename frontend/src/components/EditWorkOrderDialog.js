import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { updateWorkOrder, undelayWorkOrder, API_BASE_URL } from '../api';
import DelayJobDialog from './DelayJobDialog';
import logger from '../utils/logger';
function EditWorkOrderDialog({ open, onClose, onUpdated, workOrder }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [formData, setFormData] = useState({});
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadEmployees();
      loadManagers();
    }
  }, [open]);

  const loadEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const usersArray = Array.isArray(data) ? data : (data.users || []);
        const techs = usersArray.filter(u =>
          u.role === 'technician' || u.role === 'admin' || u.role === 'manager'
        );
        setEmployees(techs);
      }
    } catch (err) {
      logger.error('Error loading employees:', err);
    }
  };

  const loadManagers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/work-orders/managers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setManagers(data);
      }
    } catch (err) {
      logger.error('Error loading managers:', err);
    }
  };

  useEffect(() => {
    if (open && workOrder) {
      // Initialize form with work order data
      setFormData({
        job_type: workOrder.job_type || '',
        job_description: workOrder.job_description || '',
        scope_of_work: workOrder.scope_of_work || '',
        scheduled_date: workOrder.scheduled_date || '',
        scheduled_start_time: workOrder.scheduled_start_time || '',
        estimated_duration_hours: workOrder.estimated_duration_hours || 0,
        assigned_to: workOrder.assigned_to || '',
        assigned_manager: workOrder.assigned_manager || '',
        status: workOrder.status || 'pending',
        priority: workOrder.priority || 'normal',
        quoted_labor_hours: workOrder.quoted_labor_hours || 0,
        quoted_labor_rate: workOrder.quoted_labor_rate || 0,
        permit_required: workOrder.permit_required || false,
        permit_number: workOrder.permit_number || '',
        inspection_required: workOrder.inspection_required || false,
      });
    }
  }, [open, workOrder]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-calculate labor cost
    if (field === 'quoted_labor_hours' || field === 'quoted_labor_rate') {
      const hours = field === 'quoted_labor_hours' ? value : formData.quoted_labor_hours;
      const rate = field === 'quoted_labor_rate' ? value : formData.quoted_labor_rate;
      setFormData(prev => ({
        ...prev,
        quoted_labor_cost: hours * rate,
        quoted_subtotal: (hours * rate) + (workOrder.quoted_material_cost || 0)
      }));
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Calculate costs
      const laborCost = formData.quoted_labor_hours * formData.quoted_labor_rate;
      const updateData = {
        ...formData,
        quoted_labor_cost: laborCost,
        quoted_subtotal: laborCost + (workOrder.quoted_material_cost || 0),
      };

      // Check if status changed to 'delayed' - open delay dialog instead
      const statusChanged = formData.status !== workOrder.status;
      const isDelayed = formData.status === 'delayed';
      const wasDelayed = workOrder.status === 'delayed';

      if (statusChanged && isDelayed) {
        // Don't update status directly - open the delay dialog
        // First save other changes if any
        const otherData = { ...updateData };
        delete otherData.status; // Don't update status yet
        await updateWorkOrder(workOrder.id, otherData);

        setLoading(false);
        setDelayDialogOpen(true);
        return;
      }

      // Check if status changed FROM delayed - call undelay endpoint
      if (statusChanged && wasDelayed && !isDelayed) {
        // Undelay the job first
        await undelayWorkOrder(workOrder.id, false);
        // Then update with new status and other fields
        await updateWorkOrder(workOrder.id, updateData);
        setSuccessMessage('Job delay removed and status updated.');
        setTimeout(() => {
          onUpdated();
          handleClose();
        }, 2000);
        return;
      }

      // Normal update
      await updateWorkOrder(workOrder.id, updateData);

      onUpdated();
      handleClose();
    } catch (err) {
      logger.error('Error updating work order:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delay dialog result
  const handleDelayResult = (result) => {
    const message = result.message || 'Job delayed successfully';
    let detailMessage = message;

    if (result.crew_removed > 0) {
      detailMessage += ` Removed ${result.crew_removed} crew assignment(s).`;
    }
    if (result.delay_type === 'indefinite') {
      detailMessage += ' Job will remain delayed until manually reactivated.';
    } else if (result.delay_end_date) {
      detailMessage += ` Job will auto-resume on ${new Date(result.delay_end_date + 'T00:00:00').toLocaleDateString()}.`;
    }

    setSuccessMessage(detailMessage);
    setTimeout(() => {
      onUpdated();
      handleClose();
    }, 3000);
  };

  const handleClose = () => {
    setError(null);
    setSuccessMessage(null);
    setDelayDialogOpen(false);
    onClose();
  };

  if (!workOrder) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Work Order - {workOrder.work_order_number}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Job Type"
              value={formData.job_type}
              onChange={(e) => handleChange('job_type', e.target.value)}
            >
              <MenuItem value="Service Call">Service Call</MenuItem>
              <MenuItem value="Panel Upgrade">Panel Upgrade</MenuItem>
              <MenuItem value="New Construction">New Construction</MenuItem>
              <MenuItem value="Repair">Repair</MenuItem>
              <MenuItem value="Maintenance">Maintenance</MenuItem>
              <MenuItem value="Installation">Installation</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Status"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="delayed">Delayed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Job Description"
              value={formData.job_description}
              onChange={(e) => handleChange('job_description', e.target.value)}
              multiline
              rows={2}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Scope of Work"
              value={formData.scope_of_work}
              onChange={(e) => handleChange('scope_of_work', e.target.value)}
              multiline
              rows={3}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="Scheduled Date"
              value={formData.scheduled_date}
              onChange={(e) => handleChange('scheduled_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="time"
              label="Start Time"
              value={formData.scheduled_start_time}
              onChange={(e) => handleChange('scheduled_start_time', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Est. Duration (hours)"
              value={formData.estimated_duration_hours}
              onChange={(e) => handleChange('estimated_duration_hours', parseFloat(e.target.value) || 0)}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Priority"
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Assigned To"
              value={formData.assigned_to}
              onChange={(e) => handleChange('assigned_to', e.target.value)}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
              {employees.map((emp) => (
                <MenuItem key={emp.username} value={emp.username}>
                  {emp.full_name || emp.username}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Assign to Manager"
              value={formData.assigned_manager}
              onChange={(e) => handleChange('assigned_manager', e.target.value)}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
              {managers.map((mgr) => (
                <MenuItem key={mgr.username} value={mgr.username}>
                  {mgr.full_name || mgr.username}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Labor Hours"
              value={formData.quoted_labor_hours}
              onChange={(e) => handleChange('quoted_labor_hours', parseFloat(e.target.value) || 0)}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Labor Rate ($/hr)"
              value={formData.quoted_labor_rate}
              onChange={(e) => handleChange('quoted_labor_rate', parseFloat(e.target.value) || 0)}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Labor Cost"
              value={(formData.quoted_labor_hours * formData.quoted_labor_rate).toFixed(2)}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Permit Required"
              value={formData.permit_required}
              onChange={(e) => handleChange('permit_required', e.target.value === 'true')}
            >
              <MenuItem value="false">No</MenuItem>
              <MenuItem value="true">Yes</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Permit Number"
              value={formData.permit_number}
              onChange={(e) => handleChange('permit_number', e.target.value)}
              disabled={!formData.permit_required}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Inspection Required"
              value={formData.inspection_required}
              onChange={(e) => handleChange('inspection_required', e.target.value === 'true')}
            >
              <MenuItem value="false">No</MenuItem>
              <MenuItem value="true">Yes</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Save Changes'}
        </Button>
      </DialogActions>

      {/* Delay Job Dialog */}
      <DelayJobDialog
        open={delayDialogOpen}
        onClose={() => setDelayDialogOpen(false)}
        onDelayed={handleDelayResult}
        workOrder={workOrder}
      />
    </Dialog>
  );
}

export default EditWorkOrderDialog;
