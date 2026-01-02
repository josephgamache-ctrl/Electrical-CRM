import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { API_BASE_URL } from "../api";

const CycleCountExecutionDialog = ({ open, onClose, item, onSuccess }) => {
  const [actualQuantity, setActualQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Reset form when item changes or dialog opens
  useEffect(() => {
    if (open && item) {
      setActualQuantity(item.qty?.toString() || "0");
      setNotes("");
      setError(null);
      setResult(null);
    }
  }, [open, item]);

  const handleSubmit = async () => {
    const qty = parseInt(actualQuantity);
    if (isNaN(qty) || qty < 0) {
      setError("Please enter a valid quantity (0 or greater)");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/inventory/${item.id}/cycle-count`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          actual_quantity: qty,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to record cycle count");
      }

      const data = await response.json();
      setResult(data);

      // Notify parent after a short delay so user sees the result
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(data);
        }
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to record cycle count");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setActualQuantity("");
    setNotes("");
    setError(null);
    setResult(null);
    onClose();
  };

  if (!item) return null;

  const variance = parseInt(actualQuantity || 0) - (item.qty || 0);
  const varianceValue = Math.abs(variance) * (item.cost || 0);
  const tolerance = parseFloat(item.tolerance_percent) || 5.0;
  const systemQty = item.qty || 0;
  const variancePercent = systemQty > 0 ? Math.abs(variance / systemQty * 100) : (variance !== 0 ? 100 : 0);
  const exceedsTolerance = variancePercent > tolerance;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">Record Cycle Count</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Item Info */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: "grey.100", mb: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Item ID: <strong>{item.item_id}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Location: <strong>{item.location || "Not assigned"}</strong>
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {item.description}
              </Typography>
            </Box>
            {item.abc_class && (
              <Chip
                label={`Class ${item.abc_class}`}
                size="small"
                color={item.abc_class === "A" ? "primary" : item.abc_class === "B" ? "warning" : "default"}
              />
            )}
          </Box>
        </Paper>

        {/* System Quantity Display */}
        <Box sx={{ mb: 3, display: "flex", gap: 3, justifyContent: "center" }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              System Qty
            </Typography>
            <Typography variant="h4">{item.qty || 0}</Typography>
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Last Counted
            </Typography>
            <Typography variant="body1" sx={{ mt: 1 }}>
              {item.last_counted_date || "Never"}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {result ? (
          // Show result
          <Alert
            severity={result.tolerance_exceeded ? "warning" : "success"}
            icon={result.tolerance_exceeded ? <WarningIcon /> : <CheckCircleIcon />}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Cycle Count Recorded
            </Typography>
            <Typography variant="body2">
              System: {result.system_quantity} | Counted: {result.counted_quantity} |{" "}
              Variance: {result.variance > 0 ? "+" : ""}{result.variance}
            </Typography>
            {result.variance !== 0 && (
              <Typography variant="body2">
                Variance Value: ${result.variance_value.toFixed(2)} ({result.variance_percent.toFixed(1)}%)
              </Typography>
            )}
            {result.tolerance_exceeded && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                Variance exceeds tolerance - investigation may be needed
              </Typography>
            )}
            <Typography variant="body2" sx={{ mt: 1 }}>
              Next count due: {result.next_count_date}
            </Typography>
          </Alert>
        ) : (
          <>
            {/* Actual Count Input */}
            <TextField
              label="Actual Physical Count"
              type="number"
              value={actualQuantity}
              onChange={(e) => setActualQuantity(e.target.value)}
              fullWidth
              autoFocus
              inputProps={{ min: 0 }}
              sx={{ mb: 2 }}
            />

            {/* Variance Preview */}
            {actualQuantity !== "" && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: variance === 0 ? "success.lighter" : exceedsTolerance ? "error.lighter" : "warning.lighter",
                  border: 1,
                  borderColor: variance === 0 ? "success.main" : exceedsTolerance ? "error.main" : "warning.main",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">
                      Variance
                    </Typography>
                    <Typography
                      variant="h5"
                      color={variance === 0 ? "success.main" : variance > 0 ? "primary.main" : "error.main"}
                    >
                      {variance > 0 ? "+" : ""}{variance}
                    </Typography>
                    {variance !== 0 && (
                      <Typography variant="caption" color="text.secondary">
                        ({variancePercent.toFixed(1)}% / {tolerance}% tolerance)
                      </Typography>
                    )}
                  </Box>
                  {variance !== 0 && (
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="caption" color="text.secondary">
                        Variance Value
                      </Typography>
                      <Typography variant="h6">${varianceValue.toFixed(2)}</Typography>
                    </Box>
                  )}
                  <Box sx={{ textAlign: "center" }}>
                    {variance === 0 ? (
                      <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                    ) : exceedsTolerance ? (
                      <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                    ) : (
                      <WarningIcon color="warning" sx={{ fontSize: 40 }} />
                    )}
                  </Box>
                </Box>
                <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 1 }}>
                  {variance === 0
                    ? "Perfect match!"
                    : exceedsTolerance
                    ? `Exceeds ${tolerance}% tolerance - investigation needed`
                    : variance > 0
                    ? "Overage - More found than expected"
                    : "Shortage - Less found than expected"}
                </Typography>
              </Paper>
            )}

            {/* Notes Field */}
            <TextField
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Add notes about this count (e.g., found in different location, damaged items, etc.)"
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {result ? "Close" : "Cancel"}
        </Button>
        {!result && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || actualQuantity === ""}
            startIcon={loading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
            color={variance === 0 ? "success" : "primary"}
          >
            {loading ? "Recording..." : "Record Count"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CycleCountExecutionDialog;
