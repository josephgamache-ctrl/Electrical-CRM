import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';
import { API_BASE_URL } from '../../api';

function MaterialsUsageReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    fetchReportData();
  }, [period]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/reports/materials/summary?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to load materials report');
      }
    } catch (err) {
      setError('Error loading materials report: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value || 0);
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
      {/* Period Selector */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Materials Usage Report
        </Typography>
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {reportData && (
        <>
          {/* Summary Cards by Category */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {reportData.categories && reportData.categories.length > 0 ? (
              reportData.categories.map((cat, idx) => (
                <Grid item xs={12} sm={6} md={4} key={idx}>
                  <Card elevation={2}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="primary">
                        {cat.category || 'Uncategorized'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Materials Used: {cat.unique_materials}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Quantity: {formatNumber(cat.total_quantity)}
                      </Typography>
                      <Typography variant="h6" sx={{ mt: 2 }}>
                        Revenue: {formatCurrency(cat.total_revenue)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Cost: {formatCurrency(cat.total_cost)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        Profit: {formatCurrency(cat.total_profit)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Alert severity="info">No material usage data for this period</Alert>
              </Grid>
            )}
          </Grid>

          {/* Top Materials Table */}
          {reportData.top_materials && reportData.top_materials.length > 0 && (
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Top Materials Used
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Item</strong></TableCell>
                      <TableCell><strong>SKU</strong></TableCell>
                      <TableCell><strong>Category</strong></TableCell>
                      <TableCell align="right"><strong>Quantity</strong></TableCell>
                      <TableCell align="right"><strong>Jobs Used</strong></TableCell>
                      <TableCell align="right"><strong>Revenue</strong></TableCell>
                      <TableCell align="right"><strong>Profit</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.top_materials.slice(0, 20).map((material, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>{material.item_name}</TableCell>
                        <TableCell>
                          <Chip label={material.sku} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{material.category}</TableCell>
                        <TableCell align="right">{formatNumber(material.total_quantity)}</TableCell>
                        <TableCell align="right">{material.jobs_used_on}</TableCell>
                        <TableCell align="right">{formatCurrency(material.total_revenue)}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                          {formatCurrency(material.total_revenue - material.total_cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

export default MaterialsUsageReport;
