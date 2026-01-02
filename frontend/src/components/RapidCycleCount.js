import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  InputAdornment,
} from "@mui/material";
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Speed as SpeedIcon,
  Inventory as InventoryIcon,
} from "@mui/icons-material";
import { fetchInventoryByBarcode, searchInventory, API_BASE_URL } from "../api";
import logger from '../utils/logger';
const RapidCycleCount = ({ open, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [scannedItem, setScannedItem] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [countValue, setCountValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);

  const barcodeInputRef = useRef(null);
  const countInputRef = useRef(null);

  // Focus barcode input when dialog opens
  useEffect(() => {
    if (open && barcodeInputRef.current) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Focus count input when item is scanned
  useEffect(() => {
    if (scannedItem && countInputRef.current) {
      setTimeout(() => countInputRef.current?.focus(), 100);
    }
  }, [scannedItem]);

  // Debounced search as you type
  const searchTimeoutRef = useRef(null);

  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First try exact barcode lookup
      try {
        const item = await fetchInventoryByBarcode(query);
        if (item) {
          setScannedItem(item);
          setCountValue("");
          setSearchQuery("");
          setSearchResults([]);
          setLoading(false);
          return;
        }
      } catch (barcodeErr) {
        // Barcode not found, continue to search
      }

      // Fall back to general search (item ID, description, etc.)
      const results = await searchInventory(query);
      const items = results.inventory || results || [];

      if (items.length === 0) {
        setSearchResults([]);
      } else {
        // Show results in list for user to click
        setSearchResults(items.slice(0, 10)); // Limit to 10 results
      }
    } catch (err) {
      logger.error("[RapidCycleCount] Search error:", err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search as you type with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery.trim());
      }, 300); // 300ms debounce
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // Handle form submit (Enter key or search button click)
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    // Clear any pending debounced search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setLoading(true);
    setError(null);

    const query = searchQuery.trim();

    try {
      // First try exact barcode lookup
      try {
        const item = await fetchInventoryByBarcode(query);
        if (item) {
          setScannedItem(item);
          setCountValue("");
          setSearchQuery("");
          setSearchResults([]);
          setLoading(false);
          return;
        }
      } catch (barcodeErr) {
        // Barcode not found, continue to search
      }

      // Fall back to general search
      const results = await searchInventory(query);
      const items = results.inventory || results || [];

      if (items.length === 0) {
        setError(`No items found for: ${query}`);
        setScannedItem(null);
        setSearchResults([]);
      } else if (items.length === 1) {
        // Single result - auto-select on Enter
        setScannedItem(items[0]);
        setCountValue("");
        setSearchQuery("");
        setSearchResults([]);
      } else {
        // Multiple results - show selection list
        setSearchResults(items.slice(0, 10));
        setScannedItem(null);
      }
    } catch (err) {
      logger.error("[RapidCycleCount] Search error:", err);
      setError(`Search failed: ${err.message}`);
      setScannedItem(null);
    } finally {
      setLoading(false);
    }
  };

  const selectItem = (item) => {
    setScannedItem(item);
    setSearchResults([]);
    setSearchQuery("");
    setCountValue("");
  };

  const handleCountSubmit = async () => {
    if (!scannedItem || countValue === "") return;

    const qty = parseInt(countValue);
    if (isNaN(qty) || qty < 0) {
      setError("Please enter a valid quantity (0 or greater)");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/inventory/${scannedItem.id}/cycle-count`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          actual_quantity: qty,
          notes: "Rapid cycle count",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to record count");
      }

      const result = await response.json();

      // Add to session history
      setSessionHistory(prev => [{
        item: scannedItem,
        result: result,
        timestamp: new Date(),
      }, ...prev].slice(0, 20)); // Keep last 20

      // Clear for next item
      setScannedItem(null);
      setCountValue("");

      // Focus back to barcode input
      setTimeout(() => barcodeInputRef.current?.focus(), 100);

    } catch (err) {
      setError(err.message || "Failed to record count");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && scannedItem && countValue !== "") {
      e.preventDefault();
      handleCountSubmit();
    }
  };

  const adjustCount = (delta) => {
    const current = parseInt(countValue) || 0;
    const newVal = Math.max(0, current + delta);
    setCountValue(newVal.toString());
  };

  const handleClose = () => {
    setSearchQuery("");
    setScannedItem(null);
    setSearchResults([]);
    setCountValue("");
    setError(null);
    // Keep session history for reference
    onClose();
  };

  const clearSession = () => {
    setSessionHistory([]);
  };

  // Calculate variance for display
  const variance = scannedItem ? (parseInt(countValue) || 0) - (scannedItem.qty || 0) : 0;
  const systemQty = scannedItem?.qty || 0;
  const tolerance = parseFloat(scannedItem?.tolerance_percent) || 5.0;
  const variancePercent = systemQty > 0 ? Math.abs(variance / systemQty * 100) : (variance !== 0 ? 100 : 0);
  const exceedsTolerance = variancePercent > tolerance;

  const getVarianceColor = () => {
    if (countValue === "") return "default";
    if (variance === 0) return "success";
    if (exceedsTolerance) return "error";
    return "warning";
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { height: "90vh", maxHeight: 700 }
      }}
    >
      <DialogTitle sx={{ bgcolor: "primary.main", color: "white", py: 1.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SpeedIcon />
            <Typography variant="h6">Rapid Cycle Count</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: "white" }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Search Input */}
        <Paper elevation={2} sx={{ p: 2 }}>
          <form onSubmit={handleSearch}>
            <TextField
              inputRef={barcodeInputRef}
              label="Scan Barcode or Search Item ID/Description"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              autoComplete="off"
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || loading}
                      color="primary"
                    >
                      {loading ? <CircularProgress size={24} /> : <SearchIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              placeholder="Scan barcode, item ID, or description..."
            />
          </form>
        </Paper>

        {/* Search Results Selection */}
        {searchResults.length > 0 && (
          <Paper elevation={2} sx={{ p: 1, maxHeight: 250, overflow: "auto" }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ px: 1, pb: 1 }}>
              Select an item ({searchResults.length} results):
            </Typography>
            <List dense disablePadding>
              {searchResults.map((item) => (
                <ListItemButton
                  key={item.id}
                  onClick={() => selectItem(item)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    "&:hover": { bgcolor: "primary.light", color: "white" },
                  }}
                >
                  <ListItemText
                    primary={item.description}
                    secondary={`${item.item_id} | ${item.location || "No location"} | Qty: ${item.qty}`}
                    primaryTypographyProps={{ fontWeight: "medium" }}
                  />
                </ListItemButton>
              ))}
            </List>
            <Button
              size="small"
              fullWidth
              onClick={() => setSearchResults([])}
              sx={{ mt: 1 }}
            >
              Cancel
            </Button>
          </Paper>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Scanned Item Display */}
        {scannedItem ? (
          <Paper elevation={2} sx={{ p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  {scannedItem.item_id} | {scannedItem.location || "No location"}
                  {scannedItem.bin_location && ` - ${scannedItem.bin_location}`}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                  {scannedItem.description}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {scannedItem.brand} | {scannedItem.category}
                </Typography>
              </Box>
              <Chip
                label={`System: ${scannedItem.qty}`}
                color="default"
                variant="outlined"
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Count Input with +/- buttons */}
            <Typography variant="subtitle2" gutterBottom>
              ACTUAL COUNT:
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Button
                variant="outlined"
                onClick={() => adjustCount(-10)}
                disabled={submitting}
                sx={{ minWidth: 50 }}
              >
                -10
              </Button>
              <Button
                variant="outlined"
                onClick={() => adjustCount(-1)}
                disabled={submitting}
                sx={{ minWidth: 50 }}
              >
                <RemoveIcon />
              </Button>
              <TextField
                inputRef={countInputRef}
                type="number"
                value={countValue}
                onChange={(e) => setCountValue(e.target.value)}
                onKeyDown={handleKeyDown}
                inputProps={{
                  min: 0,
                  style: { textAlign: "center", fontSize: "1.5rem", fontWeight: "bold" }
                }}
                sx={{ flex: 1 }}
                placeholder="Enter count"
                disabled={submitting}
              />
              <Button
                variant="outlined"
                onClick={() => adjustCount(1)}
                disabled={submitting}
                sx={{ minWidth: 50 }}
              >
                <AddIcon />
              </Button>
              <Button
                variant="outlined"
                onClick={() => adjustCount(10)}
                disabled={submitting}
                sx={{ minWidth: 50 }}
              >
                +10
              </Button>
            </Box>

            {/* Variance Preview */}
            {countValue !== "" && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  mb: 2,
                  bgcolor: variance === 0 ? "success.light" : exceedsTolerance ? "error.light" : "warning.light",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {variance === 0 ? (
                    <CheckCircleIcon color="success" />
                  ) : exceedsTolerance ? (
                    <ErrorIcon color="error" />
                  ) : (
                    <WarningIcon color="warning" />
                  )}
                  <Typography variant="body1" fontWeight="bold">
                    Variance: {variance > 0 ? "+" : ""}{variance}
                  </Typography>
                </Box>
                <Typography variant="body2">
                  {variance === 0 ? "Perfect match!" :
                   exceedsTolerance ? `Exceeds ${tolerance}% tolerance` :
                   variance > 0 ? "Overage" : "Shortage"}
                </Typography>
              </Paper>
            )}

            {/* Submit Button */}
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleCountSubmit}
              disabled={submitting || countValue === ""}
              startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
              color={getVarianceColor()}
              sx={{ py: 1.5 }}
            >
              {submitting ? "Recording..." : "Submit & Scan Next"}
            </Button>
          </Paper>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: "center",
              bgcolor: "grey.100",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <InventoryIcon sx={{ fontSize: 60, color: "grey.400", mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Scan a barcode or enter an item ID to begin counting
            </Typography>
          </Paper>
        )}

        {/* Session History */}
        {sessionHistory.length > 0 && (
          <Paper elevation={1} sx={{ p: 1, maxHeight: 200, overflow: "auto" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Session: {sessionHistory.length} items counted
              </Typography>
              <Button size="small" onClick={clearSession}>Clear</Button>
            </Box>
            <Divider sx={{ my: 1 }} />
            <List dense disablePadding>
              {sessionHistory.slice(0, 5).map((entry, idx) => (
                <ListItem key={idx} disablePadding sx={{ py: 0.5, px: 1 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {entry.result.variance === 0 ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : entry.result.tolerance_exceeded ? (
                      <ErrorIcon color="error" fontSize="small" />
                    ) : (
                      <WarningIcon color="warning" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={entry.item.description}
                    secondary={`${entry.result.variance === 0 ? "Match" :
                      (entry.result.variance > 0 ? "+" : "") + entry.result.variance + " variance"}`}
                    primaryTypographyProps={{ variant: "body2", noWrap: true }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RapidCycleCount;
