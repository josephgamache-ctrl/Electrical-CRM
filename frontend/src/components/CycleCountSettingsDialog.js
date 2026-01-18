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
  Paper,
  Grid,
  Divider,
  Chip,
  InputAdornment,
} from "@mui/material";
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { API_BASE_URL } from "../api";

const CycleCountSettingsDialog = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Settings state
  const [settings, setSettings] = useState({
    class_a_days: 7,
    class_b_days: 30,
    class_c_days: 90,
    class_a_tolerance: 2.0,
    class_b_tolerance: 5.0,
    class_c_tolerance: 10.0,
  });

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/inventory/cycle-count-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to load settings");
      }

      const data = await response.json();

      // Map array of settings to our state format
      const newSettings = { ...settings };
      data.settings.forEach((s) => {
        if (s.abc_class === "A") {
          newSettings.class_a_days = s.count_frequency_days;
          newSettings.class_a_tolerance = parseFloat(s.tolerance_percent);
        } else if (s.abc_class === "B") {
          newSettings.class_b_days = s.count_frequency_days;
          newSettings.class_b_tolerance = parseFloat(s.tolerance_percent);
        } else if (s.abc_class === "C") {
          newSettings.class_c_days = s.count_frequency_days;
          newSettings.class_c_tolerance = parseFloat(s.tolerance_percent);
        }
      });
      setSettings(newSettings);
    } catch (err) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/inventory/cycle-count-settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save settings");
      }

      setSuccess("Settings saved successfully! Next count dates have been recalculated.");

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    onClose();
  };

  const getFrequencyLabel = (days) => {
    if (days <= 7) return "Weekly";
    if (days <= 14) return "Bi-Weekly";
    if (days <= 30) return "Monthly";
    if (days <= 60) return "Bi-Monthly";
    if (days <= 90) return "Quarterly";
    return "Periodic";
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SettingsIcon color="primary" />
            <Typography variant="h6">Cycle Count Settings</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure how often each ABC class should be counted and the acceptable variance tolerance.
              Changing these settings will recalculate the next count dates for all items.
            </Typography>

            <Grid container spacing={3}>
              {/* Class A Settings */}
              <Grid item xs={12} md={4}>
                <Paper elevation={2} sx={{ p: 2, bgcolor: 'info.light', height: "100%" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="h6">Class A</Typography>
                    <Chip label="High Value" color="primary" size="small" />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Top 80% of inventory value - most critical items
                  </Typography>

                  <TextField
                    label="Count Frequency"
                    type="number"
                    value={settings.class_a_days}
                    onChange={(e) => handleChange("class_a_days", parseInt(e.target.value) || 7)}
                    fullWidth
                    size="small"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">days</InputAdornment>,
                    }}
                    inputProps={{ min: 1, max: 365 }}
                    sx={{ mb: 2 }}
                    helperText={getFrequencyLabel(settings.class_a_days)}
                  />

                  <TextField
                    label="Tolerance"
                    type="number"
                    value={settings.class_a_tolerance}
                    onChange={(e) => handleChange("class_a_tolerance", parseFloat(e.target.value) || 2.0)}
                    fullWidth
                    size="small"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    inputProps={{ min: 0, max: 100, step: 0.5 }}
                    helperText="Variance % that triggers warning"
                  />
                </Paper>
              </Grid>

              {/* Class B Settings */}
              <Grid item xs={12} md={4}>
                <Paper elevation={2} sx={{ p: 2, bgcolor: 'warning.light', height: "100%" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="h6">Class B</Typography>
                    <Chip label="Medium Value" color="warning" size="small" />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Next 15% of inventory value - important items
                  </Typography>

                  <TextField
                    label="Count Frequency"
                    type="number"
                    value={settings.class_b_days}
                    onChange={(e) => handleChange("class_b_days", parseInt(e.target.value) || 30)}
                    fullWidth
                    size="small"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">days</InputAdornment>,
                    }}
                    inputProps={{ min: 1, max: 365 }}
                    sx={{ mb: 2 }}
                    helperText={getFrequencyLabel(settings.class_b_days)}
                  />

                  <TextField
                    label="Tolerance"
                    type="number"
                    value={settings.class_b_tolerance}
                    onChange={(e) => handleChange("class_b_tolerance", parseFloat(e.target.value) || 5.0)}
                    fullWidth
                    size="small"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    inputProps={{ min: 0, max: 100, step: 0.5 }}
                    helperText="Variance % that triggers warning"
                  />
                </Paper>
              </Grid>

              {/* Class C Settings */}
              <Grid item xs={12} md={4}>
                <Paper elevation={2} sx={{ p: 2, bgcolor: 'action.hover', height: "100%" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="h6">Class C</Typography>
                    <Chip label="Low Value" size="small" />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Bottom 5% of inventory value - routine items
                  </Typography>

                  <TextField
                    label="Count Frequency"
                    type="number"
                    value={settings.class_c_days}
                    onChange={(e) => handleChange("class_c_days", parseInt(e.target.value) || 90)}
                    fullWidth
                    size="small"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">days</InputAdornment>,
                    }}
                    inputProps={{ min: 1, max: 365 }}
                    sx={{ mb: 2 }}
                    helperText={getFrequencyLabel(settings.class_c_days)}
                  />

                  <TextField
                    label="Tolerance"
                    type="number"
                    value={settings.class_c_tolerance}
                    onChange={(e) => handleChange("class_c_tolerance", parseFloat(e.target.value) || 10.0)}
                    fullWidth
                    size="small"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    inputProps={{ min: 0, max: 100, step: 0.5 }}
                    helperText="Variance % that triggers warning"
                  />
                </Paper>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Paper elevation={0} sx={{ p: 2, bgcolor: "grey.100" }}>
              <Typography variant="subtitle2" gutterBottom>
                About ABC Classification
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Class A:</strong> High-value items (typically 20% of items representing 80% of value) should be counted most frequently.
                <br />
                <strong>Class B:</strong> Medium-value items (typically 30% of items representing 15% of value) counted at moderate intervals.
                <br />
                <strong>Class C:</strong> Low-value items (typically 50% of items representing 5% of value) counted least frequently.
              </Typography>
            </Paper>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || saving}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CycleCountSettingsDialog;
