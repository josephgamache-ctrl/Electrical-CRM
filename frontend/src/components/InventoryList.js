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
  useMediaQuery,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  SwapHoriz as SwapHorizIcon,
  Star as StarIcon,
  QrCodeScanner as ScannerIcon,
  Assignment as AssignmentIcon,
  Speed as SpeedIcon,
  PushPin as PushPinIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import { fetchInventory, fetchLowStock, getCurrentUser } from "../api";
import { useTheme } from "@mui/material/styles";
import QuickStockAdjustDialog from "./QuickStockAdjustDialog";
import InventoryFormDialog from "./InventoryFormDialog";
import AssignToWorkOrderDialog from "./AssignToWorkOrderDialog";
import RapidCycleCount from "./RapidCycleCount";
import AppHeader from "./AppHeader";
import logger from '../utils/logger';
const InventoryList = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [sortBy, setSortBy] = useState("commonly_used");
  const [sortOrder, setSortOrder] = useState("desc");

  // Dialog states
  const [quickAdjustOpen, setQuickAdjustOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [rapidCountOpen, setRapidCountOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formMode, setFormMode] = useState("add");
  const [successMessage, setSuccessMessage] = useState("");
  const [userRole, setUserRole] = useState(null);

  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = showLowStockOnly ? await fetchLowStock() : await fetchInventory();
      setInventory(data.inventory || []);
      setFilteredInventory(data.inventory || []);
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

  useEffect(() => {
    loadInventory();
    loadUserRole();
  }, [showLowStockOnly]);

  const loadUserRole = async () => {
    try {
      const userData = await getCurrentUser();
      setUserRole(userData.role);
    } catch (err) {
      logger.error('Error loading user role:', err);
    }
  };
  const applySorting = (items) => {
    const sorted = [...items].sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'commonly_used':
          // Commonly used first, then by item_id
          if (a.commonly_used && !b.commonly_used) return -1;
          if (!a.commonly_used && b.commonly_used) return 1;
          return (a.item_id || '').localeCompare(b.item_id || '');

        case 'item_id':
          aVal = a.item_id || '';
          bVal = b.item_id || '';
          return aVal.localeCompare(bVal);

        case 'description':
          aVal = (a.description || '').toLowerCase();
          bVal = (b.description || '').toLowerCase();
          return aVal.localeCompare(bVal);

        case 'category':
          aVal = (a.category || '').toLowerCase();
          bVal = (b.category || '').toLowerCase();
          if (aVal === bVal) {
            return (a.item_id || '').localeCompare(b.item_id || '');
          }
          return aVal.localeCompare(bVal);

        case 'brand':
          aVal = (a.brand || '').toLowerCase();
          bVal = (b.brand || '').toLowerCase();
          if (aVal === bVal) {
            return (a.item_id || '').localeCompare(b.item_id || '');
          }
          return aVal.localeCompare(bVal);

        case 'qty':
          aVal = a.qty || 0;
          bVal = b.qty || 0;
          return aVal - bVal;

        case 'qty_available':
          aVal = a.qty_available !== null && a.qty_available !== undefined ? a.qty_available : a.qty || 0;
          bVal = b.qty_available !== null && b.qty_available !== undefined ? b.qty_available : b.qty || 0;
          return aVal - bVal;

        case 'low_stock':
          // Show low stock items first
          const aLow = (a.qty || 0) <= (a.min_stock || 0);
          const bLow = (b.qty || 0) <= (b.min_stock || 0);
          if (aLow && !bLow) return -1;
          if (!aLow && bLow) return 1;
          // If both low stock or both not, sort by qty ascending
          return (a.qty || 0) - (b.qty || 0);

        case 'cost':
          aVal = a.cost || 0;
          bVal = b.cost || 0;
          return aVal - bVal;

        case 'sell_price':
          aVal = a.sell_price || 0;
          bVal = b.sell_price || 0;
          return aVal - bVal;

        case 'location':
          aVal = (a.location || '').toLowerCase();
          bVal = (b.location || '').toLowerCase();
          return aVal.localeCompare(bVal);

        case 'recently_added':
          aVal = a.id || 0;
          bVal = b.id || 0;
          return bVal - aVal; // Newest first (higher ID = more recent)

        default:
          return 0;
      }
    });

    // Apply sort order (asc/desc), except for special sorts
    if (sortBy === 'commonly_used' || sortBy === 'low_stock' || sortBy === 'recently_added') {
      return sorted; // These have their own logic
    }

    return sortOrder === 'desc' ? sorted.reverse() : sorted;
  };

  useEffect(() => {
    let baseItems;
    if (searchQuery.trim() === "") {
      baseItems = applySorting(inventory);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = inventory.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(query)
        )
      );
      baseItems = applySorting(filtered);
    }

    // Pin selected items at top of the list
    if (selectedRows.length > 0) {
      const pinnedItems = [];
      const unpinnedItems = [];

      // First, find selected items from full inventory (not just filtered)
      const selectedFromInventory = inventory.filter(item => selectedRows.includes(item.id));

      // Mark pinned items
      selectedFromInventory.forEach(item => {
        pinnedItems.push({ ...item, _pinned: true });
      });

      // Add non-pinned items from filtered results (excluding already pinned)
      baseItems.forEach(item => {
        if (!selectedRows.includes(item.id)) {
          unpinnedItems.push({ ...item, _pinned: false });
        }
      });

      setFilteredInventory([...pinnedItems, ...unpinnedItems]);
    } else {
      setFilteredInventory(baseItems.map(item => ({ ...item, _pinned: false })));
    }

  }, [searchQuery, inventory, sortBy, sortOrder, selectedRows]);

  const getLowStockCount = () => {
    return inventory.filter((item) => item.qty <= item.min_stock).length;
  };

  const handleQuickAdjust = (item) => {
    setSelectedItem(item);
    setQuickAdjustOpen(true);
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setFormMode("edit");
    setFormDialogOpen(true);
  };

  const handleAddItem = () => {
    setSelectedItem(null);
    setFormMode("add");
    setFormDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    loadInventory();
    setSuccessMessage(
      formMode === "add" ? "Item created successfully!" : "Item updated successfully!"
    );
  };

  const handleQuickAdjustSuccess = () => {
    loadInventory();
    setSuccessMessage("Stock adjusted successfully!");
  };

  const handleAssignToWorkOrder = () => {
    if (selectedRows.length === 0) {
      setError("Please select at least one item to assign");
      return;
    }
    setAssignDialogOpen(true);
  };

  const handleAssignSuccess = (message) => {
    setSuccessMessage(message);
    setSelectedRows([]);
    setAssignDialogOpen(false);
  };

  const getSelectedItems = () => {
    return filteredInventory.filter(item => selectedRows.includes(item.id));
  };

  const handleClearSelection = () => {
    setSelectedRows([]);
  };

  const columns = [
    {
      field: "_pinned",
      headerName: "",
      width: 40,
      sortable: false,
      renderCell: (params) => {
        return params.row._pinned ? (
          <Tooltip title="Pinned (selected)">
            <PushPinIcon color="primary" fontSize="small" />
          </Tooltip>
        ) : null;
      },
    },
    {
      field: "commonly_used",
      headerName: "",
      width: 50,
      renderCell: (params) => {
        return params.row.commonly_used ? (
          <Tooltip title="Commonly Used">
            <StarIcon color="primary" fontSize="small" />
          </Tooltip>
        ) : null;
      },
    },
    {
      field: "item_id",
      headerName: "Item ID",
      width: 100,
      pinned: "left",
    },
    {
      field: "description",
      headerName: "Description",
      flex: 1,
      minWidth: 250,
    },
    {
      field: "brand",
      headerName: "Brand",
      width: 130,
    },
    {
      field: "category",
      headerName: "Category",
      width: 150,
    },
    {
      field: "qty",
      headerName: "Stock",
      width: 100,
      type: "number",
      renderCell: (params) => {
        const isLowStock = params.row.qty <= params.row.min_stock;
        return (
          <Chip
            label={params.value || 0}
            size="small"
            color={isLowStock ? "error" : "success"}
            sx={{ fontWeight: "bold" }}
          />
        );
      },
    },
    {
      field: "qty_available",
      headerName: "Available",
      width: 100,
      type: "number",
      renderCell: (params) => {
        return (
          <Typography variant="body2" color="text.secondary">
            {params.value !== null && params.value !== undefined ? params.value : params.row.qty || 0}
          </Typography>
        );
      },
    },
    {
      field: "min_stock",
      headerName: "Min",
      width: 80,
      type: "number",
    },
    {
      field: "location",
      headerName: "Location",
      width: 120,
    },
    // Cost column - only visible to admins and managers
    ...(userRole === 'admin' || userRole === 'manager' ? [{
      field: "cost",
      headerName: "Cost",
      width: 100,
      type: "number",
      valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : "$0.00",
    }] : []),
    {
      field: "sell_price",
      headerName: "Sell Price",
      width: 110,
      type: "number",
      valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : "$0.00",
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 150,
      sortable: false,
      renderCell: (params) => {
        return (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Tooltip title="Quick Stock Adjust">
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleQuickAdjust(params.row)}
              >
                <SwapHorizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit Item">
              <IconButton
                size="small"
                color="default"
                onClick={() => handleEditItem(params.row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  const getRowClassName = (params) => {
    const classes = [];
    if (params.row._pinned) {
      classes.push("pinned-row");
    }
    if (params.row.qty <= params.row.min_stock) {
      classes.push("low-stock-row");
    }
    return classes.join(" ");
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top AppBar */}
      <AppHeader title="Inventory">
        {!isMobile && getLowStockCount() > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${getLowStockCount()} Low`}
            size="small"
            sx={{
              mr: 1,
              bgcolor: 'rgba(255,152,0,0.2)',
              color: 'white',
              '& .MuiChip-icon': { color: 'white' },
            }}
          />
        )}
        <Button
          size="small"
          startIcon={<SpeedIcon />}
          onClick={() => setRapidCountOpen(true)}
          sx={{
            color: 'white',
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          Rapid Count
        </Button>
        <Button
          size="small"
          startIcon={<ScannerIcon />}
          onClick={() => navigate('/inventory/scan')}
          sx={{
            color: 'white',
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          Scan
        </Button>
      </AppHeader>

      {/* Controls */}
      <Box sx={{ p: 2, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
          <Button
            variant={showLowStockOnly ? "contained" : "outlined"}
            color="warning"
            startIcon={<WarningIcon />}
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
          >
            Low Stock Only
          </Button>
          <IconButton onClick={loadInventory} color="primary">
            <RefreshIcon />
          </IconButton>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value)}
            >
              <MenuItem value="commonly_used">⭐ Commonly Used</MenuItem>
              <MenuItem value="low_stock">⚠️ Low Stock First</MenuItem>
              <MenuItem value="recently_added">🕐 Recently Added</MenuItem>
              <MenuItem value="item_id">Item ID</MenuItem>
              <MenuItem value="description">Description</MenuItem>
              <MenuItem value="category">Category</MenuItem>
              <MenuItem value="brand">Brand</MenuItem>
              <MenuItem value="qty">Stock Quantity</MenuItem>
              <MenuItem value="qty_available">Available Qty</MenuItem>
              {(userRole === 'admin' || userRole === 'manager') && (
                <MenuItem value="cost">Cost</MenuItem>
              )}
              <MenuItem value="sell_price">Sell Price</MenuItem>
              <MenuItem value="location">Location</MenuItem>
            </Select>
          </FormControl>
          {sortBy !== 'commonly_used' && sortBy !== 'low_stock' && sortBy !== 'recently_added' && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Order</InputLabel>
              <Select
                value={sortOrder}
                label="Order"
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <MenuItem value="asc">A → Z / Low → High</MenuItem>
                <MenuItem value="desc">Z → A / High → Low</MenuItem>
              </Select>
            </FormControl>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            Add Item
          </Button>
          {selectedRows.length > 0 && (
            <>
              <Chip
                icon={<PushPinIcon />}
                label={`${selectedRows.length} selected`}
                color="primary"
                onDelete={handleClearSelection}
                deleteIcon={<ClearIcon />}
              />
              <Button
                variant="contained"
                color="secondary"
                startIcon={<AssignmentIcon />}
                onClick={handleAssignToWorkOrder}
              >
                Assign to WO ({selectedRows.length})
              </Button>
            </>
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
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={filteredInventory}
            columns={columns}
            pageSize={25}
            rowsPerPageOptions={[25, 50, 100]}
            checkboxSelection
            selectionModel={selectedRows}
            onSelectionModelChange={(newSelection) => setSelectedRows(newSelection)}
            disableSelectionOnClick
            getRowClassName={getRowClassName}
            sx={{
              height: "100%",
              "& .low-stock-row": {
                bgcolor: "error.light",
                "&:hover": {
                  bgcolor: "error.main",
                },
              },
              "& .pinned-row": {
                bgcolor: "primary.light",
                "&:hover": {
                  bgcolor: "primary.main",
                },
              },
            }}
          />
        )}
      </Box>

      {/* Quick Stock Adjust Dialog */}
      <QuickStockAdjustDialog
        open={quickAdjustOpen}
        onClose={() => setQuickAdjustOpen(false)}
        item={selectedItem}
        onSuccess={handleQuickAdjustSuccess}
      />

      {/* Inventory Form Dialog (Add/Edit) */}
      <InventoryFormDialog
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        item={selectedItem}
        mode={formMode}
        onSuccess={handleDialogSuccess}
      />

      {/* Assign to Work Order Dialog */}
      <AssignToWorkOrderDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        selectedItems={getSelectedItems()}
        onSuccess={handleAssignSuccess}
      />

      {/* Rapid Cycle Count Dialog */}
      <RapidCycleCount
        open={rapidCountOpen}
        onClose={() => {
          setRapidCountOpen(false);
          loadInventory(); // Refresh inventory after counting
        }}
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

export default InventoryList;
