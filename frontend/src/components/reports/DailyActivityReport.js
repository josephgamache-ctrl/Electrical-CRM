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
  TextField,
  Chip,
  Divider,
} from '@mui/material';
import { API_BASE_URL } from '../../api';

function DailyActivityReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    fetchReportData();
  }, [selectedDate]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/reports/daily-activity?date=${selectedDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to load daily activity report');
      }
    } catch (err) {
      setError('Error loading daily activity report: ' + err.message);
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

  const formatHours = (hours) => {
    return `${parseFloat(hours || 0).toFixed(2)} hrs`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'scheduled':
        return 'info';
      case 'pending':
        return 'warning';
      case 'delayed':
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
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
      {/* Date Selector */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Daily Activity Report
        </Typography>
        <TextField
          type="date"
          label="Select Date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 200 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {reportData && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Jobs Worked
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {reportData.summary?.total_jobs || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed: {reportData.summary?.completed_jobs || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Labor Hours
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {formatHours(reportData.summary?.total_hours || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {reportData.summary?.employees_worked || 0} employees
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Materials Used
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(reportData.summary?.materials_cost || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {reportData.summary?.materials_items || 0} items
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Revenue Generated
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {formatCurrency(reportData.summary?.total_revenue || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    From completed jobs
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Jobs Activity */}
          {reportData.jobs && reportData.jobs.length > 0 && (
            <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Jobs Activity
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Work Order</strong></TableCell>
                      <TableCell><strong>Customer</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell align="right"><strong>Hours</strong></TableCell>
                      <TableCell align="right"><strong>Materials</strong></TableCell>
                      <TableCell align="right"><strong>Labor</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.jobs.map((job, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>
                          <Chip label={job.work_order_number} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{job.customer_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={job.status}
                            size="small"
                            color={getStatusColor(job.status)}
                          />
                        </TableCell>
                        <TableCell align="right">{formatHours(job.hours_worked)}</TableCell>
                        <TableCell align="right">{formatCurrency(job.materials_cost)}</TableCell>
                        <TableCell align="right">{formatCurrency(job.labor_cost)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(job.total_cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Labor Activity */}
          {reportData.labor && reportData.labor.length > 0 && (
            <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Labor Activity
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Employee</strong></TableCell>
                      <TableCell><strong>Work Order</strong></TableCell>
                      <TableCell align="right"><strong>Hours</strong></TableCell>
                      <TableCell align="right"><strong>Pay Rate</strong></TableCell>
                      <TableCell align="right"><strong>Bill Rate</strong></TableCell>
                      <TableCell align="right"><strong>Cost</strong></TableCell>
                      <TableCell align="right"><strong>Revenue</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.labor.map((entry, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>{entry.employee_name}</TableCell>
                        <TableCell>
                          <Chip label={entry.work_order_number} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{formatHours(entry.hours_worked)}</TableCell>
                        <TableCell align="right">{formatCurrency(entry.pay_rate)}/hr</TableCell>
                        <TableCell align="right">{formatCurrency(entry.bill_rate)}/hr</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          {formatCurrency(entry.pay_amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                          {formatCurrency(entry.bill_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Materials Activity */}
          {reportData.materials && reportData.materials.length > 0 && (
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Materials Used
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Item</strong></TableCell>
                      <TableCell><strong>SKU</strong></TableCell>
                      <TableCell><strong>Work Order</strong></TableCell>
                      <TableCell align="right"><strong>Quantity</strong></TableCell>
                      <TableCell align="right"><strong>Unit Cost</strong></TableCell>
                      <TableCell align="right"><strong>Total Cost</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.materials.map((material, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>{material.item_name}</TableCell>
                        <TableCell>
                          <Chip label={material.sku} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip label={material.work_order_number} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{material.quantity_used}</TableCell>
                        <TableCell align="right">{formatCurrency(material.unit_cost)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(material.line_cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* No Activity Message */}
          {(!reportData.jobs || reportData.jobs.length === 0) &&
           (!reportData.labor || reportData.labor.length === 0) &&
           (!reportData.materials || reportData.materials.length === 0) && (
            <Alert severity="info">
              No activity recorded for {new Date(selectedDate).toLocaleDateString()}
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}

export default DailyActivityReport;
