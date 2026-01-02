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

function LaborTimecardsReport() {
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
        `${API_BASE_URL}/reports/labor/summary?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to load labor report');
      }
    } catch (err) {
      setError('Error loading labor report: ' + err.message);
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
          Labor & Timecards Report
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
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Total Hours
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {formatHours(reportData.summary?.total_hours || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Billable: {formatHours(reportData.summary?.billable_hours || 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Labor Cost
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                    {formatCurrency(reportData.summary?.total_labor_cost || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total paid to employees
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Labor Revenue
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                    {formatCurrency(reportData.summary?.total_labor_revenue || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Billed to customers
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Labor Margin
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                    {reportData.summary?.total_labor_revenue > 0
                      ? (((reportData.summary.total_labor_revenue - reportData.summary.total_labor_cost) / reportData.summary.total_labor_revenue) * 100).toFixed(1)
                      : 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Profit margin
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Employee Performance Table */}
          {reportData.employees && reportData.employees.length > 0 && (
            <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Employee Performance
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Employee</strong></TableCell>
                      <TableCell align="right"><strong>Hours Worked</strong></TableCell>
                      <TableCell align="right"><strong>Jobs</strong></TableCell>
                      <TableCell align="right"><strong>Labor Cost</strong></TableCell>
                      <TableCell align="right"><strong>Revenue Generated</strong></TableCell>
                      <TableCell align="right"><strong>Productivity</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.employees.map((employee, idx) => {
                      const productivity = employee.total_labor_cost > 0
                        ? (employee.total_labor_revenue / employee.total_labor_cost)
                        : 0;

                      return (
                        <TableRow key={idx} hover>
                          <TableCell>{employee.employee_name}</TableCell>
                          <TableCell align="right">{formatHours(employee.total_hours)}</TableCell>
                          <TableCell align="right">{employee.jobs_worked}</TableCell>
                          <TableCell align="right">{formatCurrency(employee.total_labor_cost)}</TableCell>
                          <TableCell align="right">{formatCurrency(employee.total_labor_revenue)}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${productivity.toFixed(2)}x`}
                              size="small"
                              color={productivity >= 2 ? 'success' : productivity >= 1.5 ? 'primary' : 'default'}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Recent Timecards */}
          {reportData.recent_timecards && reportData.recent_timecards.length > 0 && (
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recent Timecards
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Date</strong></TableCell>
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
                    {reportData.recent_timecards.slice(0, 20).map((timecard, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>
                          {new Date(timecard.work_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{timecard.employee_name}</TableCell>
                        <TableCell>
                          <Chip label={timecard.work_order_number} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{formatHours(timecard.hours_worked)}</TableCell>
                        <TableCell align="right">{formatCurrency(timecard.pay_rate)}/hr</TableCell>
                        <TableCell align="right">{formatCurrency(timecard.bill_rate)}/hr</TableCell>
                        <TableCell align="right" sx={{ color: '#f44336' }}>
                          {formatCurrency(timecard.pay_amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                          {formatCurrency(timecard.bill_amount)}
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

export default LaborTimecardsReport;
