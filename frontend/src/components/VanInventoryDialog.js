import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  InputAdornment,
  Autocomplete,
} from "@mui/material";
import {
  Close as CloseIcon,
  LocalShipping as VanIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
} from "@mui/icons-material";
import {
  fetchVanInventory,
  transferToVan,
  transferFromVan,
  gotItToVan,
  searchInventory,
} from "../api";
import logger from '../utils/logger';

const VanInventoryDialog = ({ open, onClose, van, onTransferComplete }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Transfer states
  const [transferMode, setTransferMode] = useState(null); // 'load' or 'unload'
  const [transferItem, setTransferItem] = useState(null);
  const [transferQty, setTransferQty] = useState(1);
  const [transferSaving, setTransferSaving] = useState(false);

  // Add new item states
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [warehouseItems, setWarehouseItems] = useState([]);
  const [selectedWarehouseItem, setSelectedWarehouseItem] = useState(null);
  const [addQty, setAddQty] = useState(1);
  const [searchingWarehouse, setSearchingWarehouse] = useState(false);

  // Got It states (field acquisition)
  const [gotItOpen, setGotItOpen] = useState(false);
  const [gotItItems, setGotItItems] = useState([]);
  const [selectedGotItItem, setSelectedGotItItem] = useState(null);
  const [gotItQty, setGotItQty] = useState(1);
  const [gotItCost, setGotItCost] = useState("");
  const [searchingGotIt, setSearchingGotIt] = useState(false);

  const loadInventory = async () => {
    if (!van?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVanInventory(van.id);
      setInventory(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && van?.id) {
      loadInventory();
    }
  }, [open, van?.id]);

  const filteredInventory = inventory.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.item_id?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    );
  });

  const handleSearchWarehouse = async (query) => {
    if (!query || query.length < 2) {
      setWarehouseItems([]);
      return;
    }
    setSearchingWarehouse(true);
    try {
      const results = await searchInventory(query);
      // Filter out items with no available stock
      setWarehouseItems(
        (results || []).filter((item) => (item.qty_available || item.qty || 0) > 0)
      );
    } catch (err) {
      logger.error("Search warehouse error:", err);
    } finally {
      setSearchingWarehouse(false);
    }
  };

  const handleLoadToVan = (item) => {
    setTransferMode("load");
    setTransferItem(item);
    setTransferQty(1);
  };

  const handleUnloadFromVan = (item) => {
    setTransferMode("unload");
    setTransferItem(item);
    setTransferQty(Math.min(1, item.quantity || 0));
  };

  const handleTransferConfirm = async () => {
    if (!transferItem || transferQty <= 0) return;
    setTransferSaving(true);
    setError(null);
    try {
      if (transferMode === "load") {
        await transferToVan(van.id, transferItem.id, transferQty);
      } else {
        await transferFromVan(van.id, transferItem.inventory_id, transferQty);
      }
      setTransferMode(null);
      setTransferItem(null);
      loadInventory();
      if (onTransferComplete) onTransferComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setTransferSaving(false);
    }
  };

  const handleAddNewItem = async () => {
    if (!selectedWarehouseItem || addQty <= 0) return;
    setTransferSaving(true);
    setError(null);
    try {
      await transferToVan(van.id, selectedWarehouseItem.id, addQty);
      setAddItemOpen(false);
      setSelectedWarehouseItem(null);
      setAddQty(1);
      setWarehouseItems([]);
      loadInventory();
      if (onTransferComplete) onTransferComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setTransferSaving(false);
    }
  };

  const cancelTransfer = () => {
    setTransferMode(null);
    setTransferItem(null);
  };

  // Got It handlers (field acquisition - items bought at store, etc.)
  const handleSearchGotIt = async (query) => {
    if (!query || query.length < 2) {
      setGotItItems([]);
      return;
    }
    setSearchingGotIt(true);
    try {
      const results = await searchInventory(query);
      // Show all items for Got It (no stock filter - we're adding new items)
      setGotItItems(results || []);
    } catch (err) {
      logger.error("Search Got It error:", err);
    } finally {
      setSearchingGotIt(false);
    }
  };

  const handleGotItSubmit = async () => {
    if (!selectedGotItItem || gotItQty <= 0) return;
    setTransferSaving(true);
    setError(null);
    try {
      const costValue = gotItCost ? parseFloat(gotItCost) : null;
      await gotItToVan(
        van.id,
        selectedGotItItem.id,
        gotItQty,
        costValue,
        "Field acquisition"
      );
      setGotItOpen(false);
      setSelectedGotItItem(null);
      setGotItQty(1);
      setGotItCost("");
      setGotItItems([]);
      loadInventory();
      if (onTransferComplete) onTransferComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setTransferSaving(false);
    }
  };

  const totalItems = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalValue = inventory.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.cost || 0),
    0
  );
  const lowStockCount = inventory.filter(
    (item) => item.quantity <= item.min_quantity && item.min_quantity > 0
  ).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <VanIcon color="primary" />
            <Typography variant="h6">
              {van?.van_number} - {van?.name || "Van Inventory"}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Summary Stats */}
        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
          <Chip
            icon={<InventoryIcon />}
            label={`${totalItems} Total Items`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`$${totalValue.toFixed(2)} Value`}
            color="secondary"
            variant="outlined"
          />
          {lowStockCount > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${lowStockCount} Low Stock`}
              color="warning"
            />
          )}
          {van?.assigned_to && (
            <Chip label={`Assigned: ${van.assigned_to}`} variant="outlined" />
          )}
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Search and Actions */}
        <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
          <TextField
            label="Search inventory"
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddItemOpen(true)}
          >
            Load from Warehouse
          </Button>
          <Tooltip title="Add items acquired in the field (bought at store, etc.)">
            <Button
              variant="outlined"
              color="success"
              startIcon={<ShoppingCartIcon />}
              onClick={() => setGotItOpen(true)}
            >
              Got It
            </Button>
          </Tooltip>
          <IconButton onClick={loadInventory} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>

        {/* Inventory Table */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredInventory.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography color="text.secondary">
              {inventory.length === 0
                ? "No items in this van. Use 'Load from Warehouse' or 'Got It' to add items."
                : "No items match your search."}
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item ID</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Min</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInventory.map((item) => {
                  const isLowStock =
                    item.quantity <= item.min_quantity && item.min_quantity > 0;
                  return (
                    <TableRow
                      key={item.id}
                      sx={{
                        bgcolor: isLowStock ? "warning.light" : "inherit",
                        "&:hover": { bgcolor: isLowStock ? "warning.main" : "action.hover" },
                      }}
                    >
                      <TableCell>
                        <Typography fontWeight="bold">{item.item_id}</Typography>
                      </TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={item.quantity}
                          size="small"
                          color={isLowStock ? "warning" : "primary"}
                        />
                      </TableCell>
                      <TableCell align="right">{item.min_quantity || 0}</TableCell>
                      <TableCell align="right">
                        ${((item.cost || 0) * (item.quantity || 0)).toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                          <Tooltip title="Add more from warehouse">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() =>
                                handleLoadToVan({
                                  id: item.inventory_id,
                                  item_id: item.item_id,
                                  description: item.description,
                                })
                              }
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Return to warehouse">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleUnloadFromVan(item)}
                              disabled={item.quantity <= 0}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Transfer Confirmation Dialog */}
        <Dialog open={transferMode !== null} onClose={cancelTransfer}>
          <DialogTitle>
            {transferMode === "load" ? "Load to Van" : "Return to Warehouse"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <Typography gutterBottom>
                <strong>Item:</strong> {transferItem?.item_id} -{" "}
                {transferItem?.description}
              </Typography>
              <TextField
                label="Quantity"
                type="number"
                value={transferQty}
                onChange={(e) =>
                  setTransferQty(Math.max(1, parseInt(e.target.value) || 1))
                }
                fullWidth
                sx={{ mt: 2 }}
                inputProps={{ min: 1 }}
              />
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                {[1, 5, 10, 25].map((qty) => (
                  <Chip
                    key={qty}
                    label={`+${qty}`}
                    onClick={() => setTransferQty(qty)}
                    color={transferQty === qty ? "primary" : "default"}
                    clickable
                  />
                ))}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelTransfer}>Cancel</Button>
            <Button
              variant="contained"
              color={transferMode === "load" ? "success" : "error"}
              onClick={handleTransferConfirm}
              disabled={transferSaving || transferQty <= 0}
            >
              {transferSaving ? (
                <CircularProgress size={20} />
              ) : transferMode === "load" ? (
                "Load to Van"
              ) : (
                "Return to Warehouse"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add New Item from Warehouse Dialog */}
        <Dialog
          open={addItemOpen}
          onClose={() => setAddItemOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Load Item from Warehouse</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <Autocomplete
                options={warehouseItems}
                getOptionLabel={(option) =>
                  `${option.item_id} - ${option.description}`
                }
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box>
                      <Typography fontWeight="bold">{option.item_id}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Available: {option.qty_available || option.qty || 0}
                      </Typography>
                    </Box>
                  </li>
                )}
                value={selectedWarehouseItem}
                onChange={(e, newValue) => setSelectedWarehouseItem(newValue)}
                onInputChange={(e, newValue) => handleSearchWarehouse(newValue)}
                loading={searchingWarehouse}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search warehouse items"
                    placeholder="Type item ID or description..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {searchingWarehouse && <CircularProgress size={20} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              {selectedWarehouseItem && (
                <>
                  <Alert severity="info">
                    Available in warehouse:{" "}
                    <strong>
                      {selectedWarehouseItem.qty_available ||
                        selectedWarehouseItem.qty ||
                        0}
                    </strong>
                  </Alert>
                  <TextField
                    label="Quantity to Load"
                    type="number"
                    value={addQty}
                    onChange={(e) =>
                      setAddQty(
                        Math.max(
                          1,
                          Math.min(
                            parseInt(e.target.value) || 1,
                            selectedWarehouseItem.qty_available ||
                              selectedWarehouseItem.qty ||
                              0
                          )
                        )
                      )
                    }
                    fullWidth
                    inputProps={{
                      min: 1,
                      max:
                        selectedWarehouseItem.qty_available ||
                        selectedWarehouseItem.qty ||
                        0,
                    }}
                  />
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {[1, 5, 10, 25].map((qty) => (
                      <Chip
                        key={qty}
                        label={`+${qty}`}
                        onClick={() =>
                          setAddQty(
                            Math.min(
                              qty,
                              selectedWarehouseItem.qty_available ||
                                selectedWarehouseItem.qty ||
                                0
                            )
                          )
                        }
                        color={addQty === qty ? "primary" : "default"}
                        clickable
                        disabled={
                          qty >
                          (selectedWarehouseItem.qty_available ||
                            selectedWarehouseItem.qty ||
                            0)
                        }
                      />
                    ))}
                  </Box>
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddItemOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleAddNewItem}
              disabled={transferSaving || !selectedWarehouseItem || addQty <= 0}
            >
              {transferSaving ? <CircularProgress size={20} /> : "Load to Van"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Got It Dialog - Field Acquisition */}
        <Dialog
          open={gotItOpen}
          onClose={() => setGotItOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ShoppingCartIcon color="success" />
              <Typography variant="h6">Got It - Field Acquisition</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="info" icon={<ShoppingCartIcon />}>
                Add items you acquired in the field (bought at store, found, etc.)
                directly to your van.
              </Alert>
              <Autocomplete
                options={gotItItems}
                getOptionLabel={(option) =>
                  `${option.item_id} - ${option.description}`
                }
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box>
                      <Typography fontWeight="bold">{option.item_id}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Unit cost: ${(option.cost || 0).toFixed(2)}
                      </Typography>
                    </Box>
                  </li>
                )}
                value={selectedGotItItem}
                onChange={(e, newValue) => {
                  setSelectedGotItItem(newValue);
                  if (newValue) {
                    setGotItCost(newValue.cost ? newValue.cost.toString() : "");
                  }
                }}
                onInputChange={(e, newValue) => handleSearchGotIt(newValue)}
                loading={searchingGotIt}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search item"
                    placeholder="Type item ID or description..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {searchingGotIt && <CircularProgress size={20} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              {selectedGotItItem && (
                <>
                  <TextField
                    label="Quantity"
                    type="number"
                    value={gotItQty}
                    onChange={(e) =>
                      setGotItQty(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    fullWidth
                    inputProps={{ min: 1 }}
                  />
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {[1, 5, 10, 25].map((qty) => (
                      <Chip
                        key={qty}
                        label={`+${qty}`}
                        onClick={() => setGotItQty(qty)}
                        color={gotItQty === qty ? "primary" : "default"}
                        clickable
                      />
                    ))}
                  </Box>
                  <TextField
                    label="Cost per unit (optional)"
                    type="number"
                    value={gotItCost}
                    onChange={(e) => setGotItCost(e.target.value)}
                    fullWidth
                    placeholder={`Default: $${(selectedGotItItem.cost || 0).toFixed(2)}`}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText="Leave blank to use item's default cost"
                  />
                  {gotItQty > 0 && (
                    <Alert severity="success">
                      Total cost: $
                      {(
                        gotItQty *
                        (gotItCost ? parseFloat(gotItCost) : selectedGotItItem.cost || 0)
                      ).toFixed(2)}
                    </Alert>
                  )}
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGotItOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleGotItSubmit}
              disabled={transferSaving || !selectedGotItItem || gotItQty <= 0}
              startIcon={<ShoppingCartIcon />}
            >
              {transferSaving ? <CircularProgress size={20} /> : "Got It"}
            </Button>
          </DialogActions>
        </Dialog>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default VanInventoryDialog;
