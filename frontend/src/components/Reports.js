import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../api';

function Reports() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    loadSnapshot();
  }, [period]);

  const loadSnapshot = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/reports/financial-snapshot?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSnapshot(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to load financial snapshot');
      }
    } catch (err) {
      setError('Failed to load financial data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value || 0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Financial Snapshot
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Comprehensive financial overview and business intelligence
            </Typography>
          </Box>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={period}
              label="Time Period"
              onChange={(e) => setPeriod(e.target.value)}
            >
              <MenuItem value="weekly">Last 7 Days</MenuItem>
              <MenuItem value="monthly">Last 30 Days</MenuItem>
              <MenuItem value="quarterly">Last 90 Days</MenuItem>
              <MenuItem value="annually">Last Year</MenuItem>
              <MenuItem value="all-time">All Time</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ my: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Financial Snapshot Summary Cards */}
        {snapshot && (
          <>
            <Grid container spacing={3}>
                {/* Revenue Card */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <MoneyIcon sx={{ color: 'success.main', mr: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          Completed Revenue
                        </Typography>
                      </Box>
                      <Typography variant="h5" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                        {formatCurrency(snapshot.completed_revenue)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Pipeline: {formatCurrency(snapshot.total_revenue_pipeline)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Profit Card */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TrendingUpIcon sx={{ color: 'info.main', mr: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          Gross Profit
                        </Typography>
                      </Box>
                      <Typography variant="h5" sx={{ color: 'info.main', fontWeight: 'bold' }}>
                        {formatCurrency(snapshot.completed_gross_profit)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Material: {formatCurrency(snapshot.completed_material_cost)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Jobs Card */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PeopleIcon sx={{ color: 'warning.main', mr: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          Jobs
                        </Typography>
                      </Box>
                      <Typography variant="h5" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                        {snapshot.total_jobs}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Active: {snapshot.active_jobs} | Completed: {snapshot.completed_jobs}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Inventory Card */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <InventoryIcon sx={{ color: 'secondary.main', mr: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          Inventory Value
                        </Typography>
                      </Box>
                      <Typography variant="h5" sx={{ color: 'secondary.main', fontWeight: 'bold' }}>
                        {formatCurrency(snapshot.inventory_value)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        On-hand stock value
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Labor Metrics */}
              <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                Labor Metrics
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Total Labor Cost
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'error.main' }}>
                        {formatCurrency(snapshot.total_labor_cost)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Total Labor Revenue
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'success.main' }}>
                        {formatCurrency(snapshot.total_labor_revenue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Labor Margin
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'info.main' }}>
                        {snapshot.total_labor_revenue > 0
                          ? (((snapshot.total_labor_revenue - snapshot.total_labor_cost) / snapshot.total_labor_revenue) * 100).toFixed(1)
                          : 0}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Invoice Status */}
              <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                Invoice Status
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Total Invoiced
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(snapshot.total_invoiced)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ bgcolor: 'success.light' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Paid
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'success.main' }}>
                        {formatCurrency(snapshot.total_paid)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ bgcolor: snapshot.outstanding_invoices > 0 ? 'warning.light' : 'background.paper' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Outstanding
                      </Typography>
                      <Typography variant="h6" sx={{ color: snapshot.outstanding_invoices > 0 ? 'warning.main' : 'inherit' }}>
                        {formatCurrency(snapshot.outstanding_invoices)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
            </Grid>
          </>
        )}

      </Paper>
    </Box>
  );
}

export default Reports;
