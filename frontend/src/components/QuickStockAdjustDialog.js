import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Paper,
} from "@mui/material";
import {
  Close as CloseIcon,
  Remove as RemoveIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { adjustStock } from "../api";

const QuickStockAdjustDialog = ({ open, onClose, item, onSuccess }) => {
  const [quantityChange, setQuantityChange] = useState(0);
  const [reason, setReason] = useState("Used on job");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleQuickAdjust = (amount) => {
    setQuantityChange((prev) => prev + amount);
  };

  const handleSubmit = async () => {
    if (quantityChange === 0) {
      setError("Please enter a quantity adjustment");
      return;
    }

    const newQty = (item.qty || 0) + quantityChange;
    if (newQty < 0) {
      setError(`Cannot adjust by ${quantityChange}. Current stock is ${item.qty}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fullReason = notes ? `${reason} - ${notes}` : reason;
      await adjustStock(item.item_id, quantityChange, fullReason);

      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (err) {
      setError(err.message || "Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuantityChange(0);
    setReason("Used on job");
    setNotes("");
    setError(null);
    onClose();
  };

  if (!item) return null;

  const projectedQty = (item.qty || 0) + quantityChange;
  const projectedAvailable = (item.qty_available || 0) + quantityChange;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">Quick Stock Adjustment</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Item Info */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: "grey.100", mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Item ID: <strong>{item.item_id}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Brand: <strong>{item.brand}</strong>
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            {item.description}
          </Typography>
        </Paper>

        {/* Current Stock Display */}
        <Box sx={{ mb: 3, display: "flex", gap: 2, justifyContent: "space-around" }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Current Qty
            </Typography>
            <Typography variant="h5">{item.qty || 0}</Typography>
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Available
            </Typography>
            <Typography variant="h5">{item.qty_available || 0}</Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Quick Adjust Buttons */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Adjust
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => handleQuickAdjust(-10)}
              startIcon={<RemoveIcon />}
            >
              10
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => handleQuickAdjust(-5)}
              startIcon={<RemoveIcon />}
            >
              5
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => handleQuickAdjust(-1)}
              startIcon={<RemoveIcon />}
            >
              1
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={() => handleQuickAdjust(1)}
              startIcon={<AddIcon />}
            >
              1
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={() => handleQuickAdjust(5)}
              startIcon={<AddIcon />}
            >
              5
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={() => handleQuickAdjust(10)}
              startIcon={<AddIcon />}
            >
              10
            </Button>
          </Box>
        </Box>

        {/* Manual Entry */}
        <TextField
          label="Quantity Adjustment"
          type="number"
          value={quantityChange}
          onChange={(e) => setQuantityChange(parseInt(e.target.value) || 0)}
          fullWidth
          helperText={
            quantityChange !== 0
              ? `New quantity will be: ${projectedQty} (Available: ${projectedAvailable})`
              : "Enter positive to add, negative to remove"
          }
          sx={{ mb: 2 }}
          InputProps={{
            endAdornment: quantityChange !== 0 && (
              <Chip
                label={quantityChange > 0 ? `+${quantityChange}` : quantityChange}
                color={quantityChange > 0 ? "success" : "error"}
                size="small"
              />
            ),
          }}
        />

        {/* Reason Dropdown */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Reason</InputLabel>
          <Select value={reason} onChange={(e) => setReason(e.target.value)} label="Reason">
            <MenuItem value="Used on job">Used on job</MenuItem>
            <MenuItem value="Damaged">Damaged</MenuItem>
            <MenuItem value="Return to vendor">Return to vendor</MenuItem>
            <MenuItem value="Physical count adjustment">Physical count adjustment</MenuItem>
            <MenuItem value="Customer return">Customer return</MenuItem>
            <MenuItem value="Received from vendor">Received from vendor</MenuItem>
            <MenuItem value="Other">Other</MenuItem>
          </Select>
        </FormControl>

        {/* Notes Field */}
        <TextField
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          multiline
          rows={2}
          placeholder="Additional notes about this adjustment..."
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || quantityChange === 0}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? "Adjusting..." : "Adjust Stock"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickStockAdjustDialog;
