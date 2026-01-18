import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Autocomplete,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  CheckCircle as ApprovedIcon,
  Schedule as PendingIcon,
  LocalShipping as ReturnedIcon,
  AttachMoney as CreditedIcon,
  Business as VendorIcon,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import {
  fetchVendorReturns,
  fetchVendorReturnsSummary,
  fetchVendorReturnReport,
  createVendorReturn,
  updateVendorReturn,
  deleteVendorReturn,
  getVendors,
  searchInventory,
  getCurrentUser,
} from "../api";
import AppHeader from "./AppHeader";
import logger from '../utils/logger';

const RETURN_REASONS = [
  { value: 'defective', label: 'Defective', color: 'error' },
  { value: 'damaged', label: 'Damaged', color: 'warning' },
  { value: 'wrong_item', label: 'Wrong Item', color: 'info' },
  { value: 'overstock', label: 'Overstock', color: 'success' },
  { value: 'expired', label: 'Expired', color: 'default' },
];

const STATUSES = [
  { value: 'pending', label: 'Pending', color: 'warning', icon: PendingIcon },
  { value: 'approved', label: 'Approved', color: 'info', icon: ApprovedIcon },
  { value: 'returned', label: 'Returned', color: 'success', icon: ReturnedIcon },
  { value: 'credited', label: 'Credited', color: 'primary', icon: CreditedIcon },
];

const ReturnRackPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Data state
  const [returns, setReturns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [inventorySearch, setInventorySearch] = useState([]);

  // Filter state
  const [statusFilter, setStatusFilter] = useState(null);
  const [vendorFilter, setVendorFilter] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [bulkReturnDialogOpen, setBulkReturnDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [printReport, setPrintReport] = useState(null);

  // Row selection for bulk actions
  const [selectedRows, setSelectedRows] = useState([]);
  const [excludedFromBulk, setExcludedFromBulk] = useState(new Set());

  // Form state for adding new return
  const [formData, setFormData] = useState({
    inventory_id: null,
    quantity: 1,
    return_reason: 'defective',
    return_reason_notes: '',
    source_location: 'warehouse',
    vendor_id: null,
    notes: '',
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    status: '',
    return_authorization: '',
    credit_amount: '',
    credited_date: '',
    notes: '',
  });

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      logger.error("Error loading current user:", err);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [returnsData, summaryData, vendorsData] = await Promise.all([
        fetchVendorReturns(statusFilter, vendorFilter),
        fetchVendorReturnsSummary(),
        getVendors(),
      ]);
      setReturns(returnsData.returns || []);
      setSummary(summaryData);
      setVendors(vendorsData.vendors || vendorsData || []);
    } catch (err) {
      setError(err.message);
      if (err.message.includes("401") || err.message.includes("credentials")) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, vendorFilter, navigate]);

  useEffect(() => {
    loadCurrentUser();
    loadData();
  }, [loadData]);

  const canManage = currentUser?.role === "admin" || currentUser?.role === "manager";

  // Helper to parse date strings with space separator
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    // Handle case where it might already be a Date or not a string
    if (typeof dateStr !== 'string') {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    }
    // Replace space with 'T' for ISO format compatibility
    const isoStr = dateStr.replace(' ', 'T');
    const date = new Date(isoStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // All items on return rack are eligible to be marked as returned
  const eligibleForBulkReturn = returns;

  // Items that will be included in bulk action (not excluded)
  const itemsForBulkReturn = eligibleForBulkReturn.filter(r =>
    !excludedFromBulk.has(r.id)
  );

  const handleSearchInventory = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setInventorySearch([]);
      return;
    }
    try {
      const results = await searchInventory(searchTerm);
      setInventorySearch(results.inventory || []);
    } catch (err) {
      logger.error("Search inventory error:", err);
    }
  };

  const handleAddReturn = () => {
    setFormData({
      inventory_id: null,
      quantity: 1,
      return_reason: 'defective',
      return_reason_notes: '',
      source_location: 'warehouse',
      vendor_id: null,
      notes: '',
    });
    setSelectedItem(null);
    setAddDialogOpen(true);
  };

  const handleEditReturn = (returnItem) => {
    setSelectedReturn(returnItem);
    setEditFormData({
      status: returnItem.status || 'pending',
      return_authorization: returnItem.return_authorization || '',
      credit_amount: returnItem.credit_amount || '',
      credited_date: returnItem.credited_date?.split('T')[0] || '',
      notes: returnItem.notes || '',
    });
    setEditDialogOpen(true);
  };

  const handleDeletePrompt = (returnItem) => {
    setSelectedReturn(returnItem);
    setDeleteDialogOpen(true);
  };

  const handlePrintReport = async (vendorId) => {
    try {
      const report = await fetchVendorReturnReport(vendorId);
      setPrintReport(report);
      setPrintDialogOpen(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddSubmit = async () => {
    if (!selectedItem) {
      setError("Please select an inventory item");
      return;
    }
    setFormSaving(true);
    try {
      await createVendorReturn({
        ...formData,
        inventory_id: selectedItem.id,
      });
      setSuccessMessage("Item placed on return rack!");
      setAddDialogOpen(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleEditSubmit = async () => {
    setFormSaving(true);
    try {
      const updateData = {};
      if (editFormData.status) updateData.status = editFormData.status;
      if (editFormData.return_authorization) updateData.return_authorization = editFormData.return_authorization;
      if (editFormData.credit_amount) updateData.credit_amount = parseFloat(editFormData.credit_amount);
      if (editFormData.credited_date) updateData.credited_date = editFormData.credited_date;
      if (editFormData.notes !== selectedReturn.notes) updateData.notes = editFormData.notes;

      await updateVendorReturn(selectedReturn.id, updateData);
      setSuccessMessage("Return updated!");
      setEditDialogOpen(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteVendorReturn(selectedReturn.id);
      setSuccessMessage("Item removed from return rack");
      setDeleteDialogOpen(false);
      loadData();
    } catch (err) {
      setError(err.message);
      setDeleteDialogOpen(false);
    }
  };

  const handleOpenBulkReturn = () => {
    setExcludedFromBulk(new Set());
    setBulkReturnDialogOpen(true);
  };

  const handleToggleExclude = (id) => {
    setExcludedFromBulk(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleBulkMarkReturned = async () => {
    setFormSaving(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const item of itemsForBulkReturn) {
        try {
          await updateVendorReturn(item.id, { status: 'returned' });
          successCount++;
        } catch (err) {
          errorCount++;
          logger.error(`Failed to update return ${item.id}:`, err);
        }
      }

      if (errorCount > 0) {
        setSuccessMessage(`Marked ${successCount} items as returned. ${errorCount} failed.`);
      } else {
        setSuccessMessage(`Marked ${successCount} items as returned!`);
      }
      setBulkReturnDialogOpen(false);
      setSelectedRows([]); // Clear selection after bulk action
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const getReasonChip = (reason) => {
    const reasonConfig = RETURN_REASONS.find(r => r.value === reason) || { label: reason, color: 'default' };
    return <Chip label={reasonConfig.label} color={reasonConfig.color} size="small" />;
  };

  const getStatusChip = (status) => {
    const statusConfig = STATUSES.find(s => s.value === status) || { label: status, color: 'default' };
    return <Chip label={statusConfig.label} color={statusConfig.color} size="small" />;
  };

  const columns = [
    {
      field: 'item_id',
      headerName: 'Item ID',
      width: 100,
    },
    {
      field: 'item_description',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'brand',
      headerName: 'Brand',
      width: 120,
    },
    {
      field: 'quantity',
      headerName: 'Qty',
      width: 80,
      align: 'center',
    },
    {
      field: 'return_reason',
      headerName: 'Reason',
      width: 120,
      renderCell: (params) => getReasonChip(params.value),
    },
    {
      field: 'vendor_name',
      headerName: 'Vendor',
      width: 180,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params) => getStatusChip(params.value),
    },
    {
      field: 'total_value',
      headerName: 'Value',
      width: 100,
      align: 'right',
      valueFormatter: (value) => `$${(parseFloat(value) || 0).toFixed(2)}`,
    },
    {
      field: 'placed_on_rack_date',
      headerName: 'Date',
      width: 110,
      valueFormatter: (value) => {
        const date = parseDate(value);
        return date ? date.toLocaleDateString() : '';
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          {canManage && (
            <>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleEditReturn(params.row)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {params.row.status === 'pending' && (
                <Tooltip title="Remove">
                  <IconButton size="small" color="error" onClick={() => handleDeletePrompt(params.row)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Return Rack"
        showSearch={false}
        showNotifications={true}
      >
        <Tooltip title="Refresh">
          <IconButton sx={{ color: 'white' }} onClick={loadData}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        {canManage && eligibleForBulkReturn.length > 0 && (
          <Button
            variant="contained"
            startIcon={<ReturnedIcon />}
            onClick={handleOpenBulkReturn}
            sx={{ ml: 1 }}
          >
            Mark All Returned
          </Button>
        )}
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddReturn}
            sx={{ ml: 1, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
          >
            Add Return
          </Button>
        )}
      </AppHeader>

      <Box sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Summary Cards */}
        {summary && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Card sx={{ minWidth: 150 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Items
                </Typography>
                <Typography variant="h4">{summary.summary?.total_items || 0}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 150 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Qty
                </Typography>
                <Typography variant="h4">{summary.summary?.total_quantity || 0}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 150 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Value
                </Typography>
                <Typography variant="h4" color="primary">
                  ${(summary.summary?.total_value || 0).toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 150 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {summary.summary?.pending || 0}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 150 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Approved
                </Typography>
                <Typography variant="h4" color="info.main">
                  {summary.summary?.approved || 0}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Tabs for viewing by All / By Vendor */}
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
          <Tab label="All Returns" />
          <Tab label="By Vendor" />
        </Tabs>

        {tabValue === 0 && (
          <>
            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter || ''}
                  onChange={(e) => setStatusFilter(e.target.value || null)}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  {STATUSES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Vendor</InputLabel>
                <Select
                  value={vendorFilter || ''}
                  onChange={(e) => setVendorFilter(e.target.value || null)}
                  label="Vendor"
                >
                  <MenuItem value="">All Vendors</MenuItem>
                  {vendors.map((v) => (
                    <MenuItem key={v.id} value={v.id}>{v.vendor_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Selection Action Bar */}
            {canManage && selectedRows.length > 0 && (
              <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'primary.light' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>
                  {selectedRows.length} item{selectedRows.length > 1 ? 's' : ''} selected
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<ReturnedIcon />}
                  onClick={() => {
                    // Any selected item can be marked as returned
                    if (selectedRows.length === 0) {
                      setError('No items selected.');
                      return;
                    }
                    // Exclude items NOT in selection from bulk return
                    setExcludedFromBulk(new Set(
                      returns
                        .filter(r => !selectedRows.includes(r.id))
                        .map(r => r.id)
                    ));
                    setBulkReturnDialogOpen(true);
                  }}
                >
                  Mark Selected as Returned
                </Button>
                <Button
                  variant="outlined"
                  sx={{ color: 'primary.contrastText', borderColor: 'primary.contrastText' }}
                  onClick={() => setSelectedRows([])}
                >
                  Clear Selection
                </Button>
              </Paper>
            )}

            {/* Data Grid */}
            <Paper sx={{ height: 500 }}>
              <DataGrid
                rows={returns}
                columns={columns}
                loading={loading}
                pageSize={25}
                rowsPerPageOptions={[10, 25, 50]}
                checkboxSelection
                selectionModel={selectedRows}
                onSelectionModelChange={(newSelection) => setSelectedRows(newSelection)}
                disableSelectionOnClick
              />
            </Paper>
          </>
        )}

        {tabValue === 1 && (
          <Box>
            {summary?.by_vendor?.map((vendor) => (
              <Card key={vendor.vendor_id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <VendorIcon color="primary" />
                      <Typography variant="h6">{vendor.vendor_name || 'Unknown Vendor'}</Typography>
                    </Box>
                    <Box>
                      <Chip label={`${vendor.item_count} items`} sx={{ mr: 1 }} />
                      <Chip label={`$${vendor.total_value.toFixed(2)}`} color="primary" sx={{ mr: 1 }} />
                      <Button
                        startIcon={<PrintIcon />}
                        variant="outlined"
                        size="small"
                        onClick={() => handlePrintReport(vendor.vendor_id)}
                      >
                        Print List
                      </Button>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Chip
                      icon={<PendingIcon />}
                      label={`${vendor.pending_count} Pending`}
                      color="warning"
                      variant="outlined"
                      size="small"
                    />
                    <Chip
                      icon={<ApprovedIcon />}
                      label={`${vendor.approved_count} Approved`}
                      color="info"
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                  {vendor.vendor_email && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Email: {vendor.vendor_email}
                    </Typography>
                  )}
                  {vendor.vendor_phone && (
                    <Typography variant="body2" color="text.secondary">
                      Phone: {vendor.vendor_phone}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
            {(!summary?.by_vendor || summary.by_vendor.length === 0) && (
              <Alert severity="info">No returns on the rack</Alert>
            )}
          </Box>
        )}
      </Box>

      {/* Add Return Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'secondary.dark', color: 'white' }}>
          Place Item on Return Rack
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Autocomplete
            options={inventorySearch}
            getOptionLabel={(option) => `${option.item_id} - ${option.description}`}
            onInputChange={(e, value) => handleSearchInventory(value)}
            onChange={(e, value) => {
              setSelectedItem(value);
              if (value?.primary_vendor_id) {
                setFormData(prev => ({ ...prev, vendor_id: value.primary_vendor_id }));
              }
            }}
            renderInput={(params) => (
              <TextField {...params} label="Search Inventory" margin="normal" fullWidth />
            )}
            sx={{ mb: 2 }}
          />
          {selectedItem && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Selected: {selectedItem.description} (Stock: {selectedItem.qty})
            </Alert>
          )}
          <TextField
            label="Quantity"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
            fullWidth
            margin="normal"
            inputProps={{ min: 1 }}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Return Reason</InputLabel>
            <Select
              value={formData.return_reason}
              onChange={(e) => setFormData({ ...formData, return_reason: e.target.value })}
              label="Return Reason"
            >
              {RETURN_REASONS.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Reason Notes"
            value={formData.return_reason_notes}
            onChange={(e) => setFormData({ ...formData, return_reason_notes: e.target.value })}
            fullWidth
            margin="normal"
            multiline
            rows={2}
            placeholder="Describe the issue..."
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Source Location</InputLabel>
            <Select
              value={formData.source_location}
              onChange={(e) => setFormData({ ...formData, source_location: e.target.value })}
              label="Source Location"
            >
              <MenuItem value="warehouse">Warehouse</MenuItem>
              <MenuItem value="van">Van</MenuItem>
              <MenuItem value="job_site">Job Site</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Vendor (Optional Override)</InputLabel>
            <Select
              value={formData.vendor_id || ''}
              onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value || null })}
              label="Vendor (Optional Override)"
            >
              <MenuItem value="">Use Item's Primary Vendor</MenuItem>
              {vendors.map((v) => (
                <MenuItem key={v.id} value={v.id}>{v.vendor_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            fullWidth
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddSubmit}
            disabled={formSaving || !selectedItem}
          >
            {formSaving ? <CircularProgress size={24} /> : 'Place on Return Rack'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Return Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'secondary.dark', color: 'white' }}>
          Edit Return: {selectedReturn?.item_id}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedReturn && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                {selectedReturn.item_description} - Qty: {selectedReturn.quantity}
              </Alert>
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  label="Status"
                >
                  {STATUSES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Return Authorization (RA) Number"
                value={editFormData.return_authorization}
                onChange={(e) => setEditFormData({ ...editFormData, return_authorization: e.target.value })}
                fullWidth
                margin="normal"
                placeholder="e.g., RA-2026-001234"
              />
              <TextField
                label="Credit Amount"
                type="number"
                value={editFormData.credit_amount}
                onChange={(e) => setEditFormData({ ...editFormData, credit_amount: e.target.value })}
                fullWidth
                margin="normal"
                inputProps={{ step: "0.01" }}
              />
              <TextField
                label="Credited Date"
                type="date"
                value={editFormData.credited_date}
                onChange={(e) => setEditFormData({ ...editFormData, credited_date: e.target.value })}
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                fullWidth
                margin="normal"
                multiline
                rows={3}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSubmit} disabled={formSaving}>
            {formSaving ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Remove from Return Rack?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove "{selectedReturn?.item_description}" from the return rack?
            This will cancel the pending return.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Print Report Dialog */}
      <Dialog open={printDialogOpen} onClose={() => setPrintDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: 'secondary.dark', color: 'white' }}>
          Vendor Return List
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {printReport && (
            <Box id="print-content">
              <Typography variant="h5" gutterBottom>
                Return List for: {printReport.vendor?.name}
              </Typography>
              {printReport.vendor?.address && (
                <Typography variant="body2" color="text.secondary">
                  {printReport.vendor.address}
                </Typography>
              )}
              {printReport.vendor?.phone && (
                <Typography variant="body2" color="text.secondary">
                  Phone: {printReport.vendor.phone}
                </Typography>
              )}
              {printReport.vendor?.email && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Email: {printReport.vendor.email}
                </Typography>
              )}
              <Divider sx={{ my: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item ID</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Brand</TableCell>
                      <TableCell align="center">Qty</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>RA #</TableCell>
                      <TableCell align="right">Unit $</TableCell>
                      <TableCell align="right">Total $</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {printReport.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.item_id}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.brand}</TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell>{item.return_reason}</TableCell>
                        <TableCell>{item.return_authorization || '-'}</TableCell>
                        <TableCell align="right">${item.unit_cost?.toFixed(2)}</TableCell>
                        <TableCell align="right">${item.line_total?.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 2, textAlign: 'right' }}>
                <Typography variant="h6">
                  Total: ${printReport.summary?.total_value?.toFixed(2)} ({printReport.summary?.total_quantity} items)
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Generated: {new Date(printReport.generated_at).toLocaleString()} by {printReport.generated_by}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPrintDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Mark as Returned Dialog */}
      <Dialog open={bulkReturnDialogOpen} onClose={() => setBulkReturnDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'secondary.dark', color: 'white' }}>
          Mark Items as Returned
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            This will mark all selected items as "Returned" status.
            Uncheck any items you want to exclude.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{itemsForBulkReturn.length}</strong> of {eligibleForBulkReturn.length} items will be marked as returned
          </Typography>
          <List sx={{ maxHeight: 300, overflow: 'auto' }}>
            {eligibleForBulkReturn.map((item) => (
              <ListItem
                key={item.id}
                dense
                sx={{
                  bgcolor: excludedFromBulk.has(item.id) ? 'action.disabledBackground' : 'transparent',
                  opacity: excludedFromBulk.has(item.id) ? 0.6 : 1,
                }}
              >
                <ListItemIcon>
                  <Checkbox
                    checked={!excludedFromBulk.has(item.id)}
                    onChange={() => handleToggleExclude(item.id)}
                    color="primary"
                  />
                </ListItemIcon>
                <ListItemText
                  primary={`${item.item_id} - ${item.item_description}`}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <span>Qty: {item.quantity}</span>
                      <span>|</span>
                      <span>{item.vendor_name}</span>
                      <span>|</span>
                      {getStatusChip(item.status)}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBulkReturnDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleBulkMarkReturned}
            disabled={formSaving || itemsForBulkReturn.length === 0}
            startIcon={formSaving ? <CircularProgress size={20} /> : <ReturnedIcon />}
          >
            {formSaving ? 'Processing...' : `Mark ${itemsForBulkReturn.length} as Returned`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSuccessMessage("")} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ReturnRackPage;
