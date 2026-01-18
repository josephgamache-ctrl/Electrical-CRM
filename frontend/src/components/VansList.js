import React, { useState, useEffect } from "react";
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
  Switch,
  FormControlLabel,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  LocalShipping as VanIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import {
  fetchVans,
  createVan,
  updateVan,
  deleteVan,
  fetchUsers,
  getCurrentUser,
} from "../api";
import AppHeader from "./AppHeader";
import VanInventoryDialog from "./VanInventoryDialog";
import logger from '../utils/logger';

const VansList = () => {
  const navigate = useNavigate();
  const [vans, setVans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Current user info
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVan, setSelectedVan] = useState(null);
  const [formMode, setFormMode] = useState("add");

  // Form state
  const [formData, setFormData] = useState({
    van_number: "",
    name: "",
    assigned_to: "",
    notes: "",
    active: true,
  });
  const [formError, setFormError] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  const loadVans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVans(!showInactive);
      setVans(data || []);
    } catch (err) {
      setError(err.message);
      if (err.message.includes("401") || err.message.includes("credentials")) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const userData = await fetchUsers();
      setUsers(userData || []);
    } catch (err) {
      logger.error("Error loading users:", err);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      logger.error("Error loading current user:", err);
    }
  };

  useEffect(() => {
    loadVans();
    loadUsers();
    loadCurrentUser();
  }, [showInactive]);

  const canManageVans = currentUser?.role === "admin" || currentUser?.role === "manager";
  const canDeleteVans = currentUser?.role === "admin";

  const filteredVans = vans.filter((van) => {
    const query = searchQuery.toLowerCase();
    return (
      van.van_number?.toLowerCase().includes(query) ||
      van.name?.toLowerCase().includes(query) ||
      van.assigned_to?.toLowerCase().includes(query)
    );
  });

  const handleAddVan = () => {
    setFormMode("add");
    setFormData({
      van_number: "",
      name: "",
      assigned_to: "",
      notes: "",
      active: true,
    });
    setFormError(null);
    setFormDialogOpen(true);
  };

  const handleEditVan = (van) => {
    setSelectedVan(van);
    setFormMode("edit");
    setFormData({
      van_number: van.van_number || "",
      name: van.name || "",
      assigned_to: van.assigned_to || "",
      notes: van.notes || "",
      active: van.active !== false,
    });
    setFormError(null);
    setFormDialogOpen(true);
  };

  const handleViewInventory = (van) => {
    setSelectedVan(van);
    setInventoryDialogOpen(true);
  };

  const handleDeletePrompt = (van) => {
    setSelectedVan(van);
    setDeleteDialogOpen(true);
  };

  const handleFormSubmit = async () => {
    setFormSaving(true);
    setFormError(null);
    try {
      if (formMode === "add") {
        await createVan(formData);
        setSuccessMessage("Van created successfully!");
      } else {
        await updateVan(selectedVan.id, formData);
        setSuccessMessage("Van updated successfully!");
      }
      setFormDialogOpen(false);
      loadVans();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteVan(selectedVan.id);
      setSuccessMessage("Van deactivated successfully!");
      setDeleteDialogOpen(false);
      loadVans();
    } catch (err) {
      setError(err.message);
      setDeleteDialogOpen(false);
    }
  };

  const columns = [
    {
      field: "van_number",
      headerName: "Van #",
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <VanIcon color="primary" fontSize="small" />
          <Typography fontWeight="bold">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 150,
    },
    {
      field: "assigned_to",
      headerName: "Assigned To",
      width: 150,
      renderCell: (params) =>
        params.value ? (
          <Chip
            icon={<PersonIcon />}
            label={params.value}
            size="small"
            variant="outlined"
          />
        ) : (
          <Typography color="text.secondary" variant="body2">
            Unassigned
          </Typography>
        ),
    },
    {
      field: "item_count",
      headerName: "Items",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value || 0}
          size="small"
          color={params.value > 0 ? "primary" : "default"}
        />
      ),
    },
    {
      field: "total_value",
      headerName: "Value",
      width: 120,
      type: "number",
      renderCell: (params) => (
        <Typography variant="body2">
          ${(params.value || 0).toFixed(2)}
        </Typography>
      ),
    },
    {
      field: "low_stock_count",
      headerName: "Low Stock",
      width: 110,
      type: "number",
      renderCell: (params) =>
        params.value > 0 ? (
          <Chip
            icon={<WarningIcon />}
            label={params.value}
            size="small"
            color="warning"
          />
        ) : (
          <Typography color="text.secondary" variant="body2">
            —
          </Typography>
        ),
    },
    {
      field: "active",
      headerName: "Status",
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          size="small"
          color={params.value ? "success" : "default"}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="View Inventory">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleViewInventory(params.row)}
            >
              <InventoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canManageVans && (
            <Tooltip title="Edit Van">
              <IconButton
                size="small"
                color="default"
                onClick={() => handleEditVan(params.row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canDeleteVans && params.row.active && (
            <Tooltip title="Deactivate Van">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeletePrompt(params.row)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppHeader title="Work Vans">
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={loadVans}
          sx={{
            color: "white",
            textTransform: "none",
            "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
          }}
        >
          Refresh
        </Button>
      </AppHeader>

      {/* Controls */}
      <Box
        sx={{
          p: 2,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <TextField
            label="Search vans"
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
            }
            label="Show Inactive"
          />
          {canManageVans && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddVan}
            >
              Add Van
            </Button>
          )}
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <Box sx={{ p: 2 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      {/* DataGrid */}
      <Box sx={{ flexGrow: 1, p: 2 }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={filteredVans}
            columns={columns}
            pageSize={25}
            rowsPerPageOptions={[25, 50, 100]}
            disableSelectionOnClick
            sx={{ height: "100%" }}
          />
        )}
      </Box>

      {/* Van Form Dialog */}
      <Dialog
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {formMode === "add" ? "Add New Van" : "Edit Van"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {formError && (
              <Alert severity="error" onClose={() => setFormError(null)}>
                {formError}
              </Alert>
            )}
            <TextField
              label="Van Number"
              value={formData.van_number}
              onChange={(e) =>
                setFormData({ ...formData, van_number: e.target.value })
              }
              required
              placeholder="e.g., VAN-1, TRUCK-2"
              disabled={formMode === "edit"}
            />
            <TextField
              label="Name / Description"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Joey's Van, Service Truck #3"
            />
            <FormControl fullWidth>
              <InputLabel>Assigned To</InputLabel>
              <Select
                value={formData.assigned_to}
                label="Assigned To"
                onChange={(e) =>
                  setFormData({ ...formData, assigned_to: e.target.value })
                }
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.username} value={user.username}>
                    {user.full_name || user.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              multiline
              rows={2}
            />
            {formMode === "edit" && (
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.active}
                    onChange={(e) =>
                      setFormData({ ...formData, active: e.target.checked })
                    }
                  />
                }
                label="Active"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleFormSubmit}
            disabled={formSaving || !formData.van_number}
          >
            {formSaving ? <CircularProgress size={20} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Deactivate Van?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate{" "}
            <strong>{selectedVan?.van_number}</strong>?
          </Typography>
          {selectedVan?.item_count > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This van has {selectedVan.item_count} items in inventory. Please
              transfer all items before deactivating.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={selectedVan?.item_count > 0}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Van Inventory Dialog */}
      <VanInventoryDialog
        open={inventoryDialogOpen}
        onClose={() => setInventoryDialogOpen(false)}
        van={selectedVan}
        onTransferComplete={loadVans}
      />

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage("")}
        message={successMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
};

export default VansList;
