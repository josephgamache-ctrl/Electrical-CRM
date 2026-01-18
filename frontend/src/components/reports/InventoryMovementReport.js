import React, { useState, useEffect, useCallback } from 'react';
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
  Tabs,
  Tab,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  SwapHoriz as SwapHorizIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Print as PrintIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Inventory as InventoryIcon,
  LocalShipping as VanIcon,
  Work as JobIcon,
  Store as VendorIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function InventoryMovementReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [showFilters, setShowFilters] = useState(true);

  // Data state
  const [reportData, setReportData] = useState(null);

  // Filter states
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transactionType, setTransactionType] = useState('');
  const [vendorId, setVendorId] = useState('');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    try {
      let url = `${API_BASE_URL}/reports/inventory-movement?start_date=${startDate}&end_date=${endDate}`;
      if (transactionType) url += `&transaction_type=${transactionType}`;
      if (vendorId) url += `&vendor_id=${vendorId}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load inventory movement report');

      const data = await response.json();
      setReportData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, transactionType, vendorId]);

  useEffect(() => {
    fetchReport();
  }, []);

  const handleApplyFilters = () => {
    fetchReport();
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionTypeLabel = (type) => {
    const labels = {
      'job_usage': 'Job Usage',
      'job_return': 'Job Return',
      'job_to_van': 'To Van',
      'allocation_release': 'Released',
      'transfer': 'Transfer',
      'adjustment': 'Adjustment',
      'got_it': 'Got It',
      'return_rack': 'Return Rack',
      'vendor_return': 'Vendor Return'
    };
    return labels[type] || type;
  };

  const getTransactionTypeColor = (type) => {
    const colors = {
      'job_usage': 'error',      // Red - stock going out
      'job_return': 'success',   // Green - stock coming back
      'job_to_van': 'info',      // Blue - internal transfer
      'allocation_release': 'default',
      'transfer': 'info',
      'adjustment': 'warning',
      'got_it': 'success',
      'return_rack': 'warning',
      'vendor_return': 'secondary'
    };
    return colors[type] || 'default';
  };

  if (loading && !reportData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const summary = reportData?.summary || {};
  const byType = summary.by_type || [];

  return (
    <Box className="print-container">
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }} className="no-print">
        <Typography variant="h5">
          <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Inventory Movement Report
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(!showFilters)}
            variant="outlined"
            size="small"
          >
            Filters
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={fetchReport} variant="outlined" size="small">
            Refresh
          </Button>
          <Button startIcon={<PrintIcon />} onClick={handlePrint} variant="contained" size="small">
            Print
          </Button>
        </Box>
      </Box>

      {/* Print Header */}
      <Box sx={{ display: 'none' }} className="print-only print-header">
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>Inventory Movement Report</Typography>
        <Typography variant="subtitle1">
          {startDate} to {endDate}
          {vendorId && reportData?.filters?.vendors?.find(v => v.id === parseInt(vendorId))?.vendor_name &&
            ` | Vendor: ${reportData.filters.vendors.find(v => v.id === parseInt(vendorId)).vendor_name}`}
          {transactionType && ` | Type: ${getTransactionTypeLabel(transactionType)}`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Generated: {new Date().toLocaleString()}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Collapse in={showFilters}>
        <Paper sx={{ p: 2, mb: 3 }} className="no-print">
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Transaction Type</InputLabel>
                <Select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  label="Transaction Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  {reportData?.filters?.transaction_types?.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Vendor</InputLabel>
                <Select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  label="Vendor"
                >
                  <MenuItem value="">All Vendors</MenuItem>
                  {reportData?.filters?.vendors?.map((v) => (
                    <MenuItem key={v.id} value={v.id}>{v.vendor_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                onClick={handleApplyFilters}
                fullWidth
                disabled={loading}
              >
                {loading ? <CircularProgress size={20} /> : 'Apply'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ bgcolor: 'success.light' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon color="success" />
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {summary.total_items_in || 0}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Items In</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ bgcolor: 'error.light' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingDownIcon color="error" />
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {summary.total_items_out || 0}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Items Out</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ bgcolor: summary.net_change >= 0 ? 'info.light' : 'warning.light' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SwapHorizIcon color={summary.net_change >= 0 ? 'info' : 'warning'} />
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {summary.net_change > 0 ? '+' : ''}{summary.net_change || 0}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Net Change</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(summary.total_value_moved)}
              </Typography>
              <Typography variant="body2" color="text.secondary">Value Moved</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Breakdown by Type */}
      {byType.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
            Activity by Type
          </Typography>
          <Grid container spacing={1}>
            {byType.map((t) => (
              <Grid item xs={6} sm={4} md={2} key={t.transaction_type}>
                <Box sx={{
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'background.default',
                  textAlign: 'center'
                }}>
                  <Chip
                    label={getTransactionTypeLabel(t.transaction_type)}
                    color={getTransactionTypeColor(t.transaction_type)}
                    size="small"
                    sx={{ mb: 0.5 }}
                  />
                  <Typography variant="h6">{t.transaction_count}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.total_out > 0 ? `-${t.total_out}` : ''}{t.total_in > 0 ? ` +${t.total_in}` : ''}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }} className="no-print">
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} variant="scrollable">
          <Tab label="All Transactions" icon={<SwapHorizIcon />} iconPosition="start" />
          <Tab label="Top Items" icon={<InventoryIcon />} iconPosition="start" />
          <Tab label="By Job" icon={<JobIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab: All Transactions */}
      <TabPanel value={currentTab} index={0}>
        <Typography variant="h6" gutterBottom className="print-only">Transaction History</Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Item</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Qty</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Value</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Details</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportData?.transactions?.map((t, idx) => (
                <TableRow
                  key={t.id || idx}
                  sx={{
                    bgcolor: idx % 2 === 0 ? 'background.default' : 'white',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatDate(t.transaction_date)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getTransactionTypeLabel(t.transaction_type)}
                      color={getTransactionTypeColor(t.transaction_type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {t.item_id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {t.description?.substring(0, 35)}{t.description?.length > 35 ? '...' : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>{t.vendor_name || '-'}</TableCell>
                  <TableCell align="right">
                    <Typography
                      sx={{
                        color: t.quantity_change > 0 ? 'success.main' : t.quantity_change < 0 ? 'error.main' : 'text.primary',
                        fontWeight: 'bold'
                      }}
                    >
                      {t.quantity_change > 0 ? '+' : ''}{t.quantity_change}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {t.total_cost ? formatCurrency(Math.abs(t.total_cost)) : '-'}
                  </TableCell>
                  <TableCell>
                    {t.work_order_number && (
                      <Chip label={t.work_order_number} size="small" variant="outlined" sx={{ mr: 0.5 }} />
                    )}
                    {t.from_van_number && (
                      <Tooltip title={`From Van ${t.from_van_number}`}>
                        <Chip icon={<VanIcon />} label={t.from_van_number} size="small" variant="outlined" sx={{ mr: 0.5 }} />
                      </Tooltip>
                    )}
                    {t.to_van_number && (
                      <Tooltip title={`To Van ${t.to_van_number}`}>
                        <Chip icon={<VanIcon />} label={t.to_van_number} size="small" color="info" />
                      </Tooltip>
                    )}
                    {!t.work_order_number && !t.from_van_number && !t.to_van_number && '-'}
                  </TableCell>
                  <TableCell>{t.performed_by || '-'}</TableCell>
                </TableRow>
              ))}
              {(!reportData?.transactions || reportData.transactions.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No transactions found for the selected period</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Showing {reportData?.transactions?.length || 0} of {summary.total_transactions || 0} transactions
        </Typography>
      </TabPanel>

      {/* Tab: Top Items */}
      <TabPanel value={currentTab} index={1}>
        <Typography variant="h6" gutterBottom>Top Moving Items</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Items with the most transaction activity in the selected period
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Item ID</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Brand</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Transactions</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Out</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>In</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Value Moved</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportData?.top_items?.map((item, idx) => (
                <TableRow key={item.id || idx} sx={{ bgcolor: idx % 2 === 0 ? 'background.default' : 'white' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{item.item_id}</TableCell>
                  <TableCell>{item.description?.substring(0, 40)}{item.description?.length > 40 ? '...' : ''}</TableCell>
                  <TableCell>{item.brand || '-'}</TableCell>
                  <TableCell>{item.vendor_name || '-'}</TableCell>
                  <TableCell align="right">
                    <Chip label={item.transaction_count} size="small" color="primary" />
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                    {item.total_out > 0 ? `-${item.total_out}` : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    {item.total_in > 0 ? `+${item.total_in}` : '-'}
                  </TableCell>
                  <TableCell align="right">{formatCurrency(item.total_value_moved)}</TableCell>
                </TableRow>
              ))}
              {(!reportData?.top_items || reportData.top_items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No item data available</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab: By Job */}
      <TabPanel value={currentTab} index={2}>
        <Typography variant="h6" gutterBottom>Materials Used by Job</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Summary of materials consumed on each job during the selected period
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Work Order</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Address</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Unique Items</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Items Used</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Material Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportData?.job_summary?.map((job, idx) => (
                <TableRow key={job.work_order_id || idx} sx={{ bgcolor: idx % 2 === 0 ? 'background.default' : 'white' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{job.work_order_number}</TableCell>
                  <TableCell>{job.service_address || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={job.status?.replace('_', ' ').toUpperCase()}
                      size="small"
                      color={job.status === 'completed' ? 'success' : job.status === 'in_progress' ? 'info' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">{job.unique_items || 0}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{job.items_used || 0}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    {formatCurrency(job.material_cost)}
                  </TableCell>
                </TableRow>
              ))}
              {(!reportData?.job_summary || reportData.job_summary.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No job material data available</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Print Styles */}
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .print-header { margin-bottom: 20px; }
            body { font-size: 10pt; }
            table { font-size: 9pt; }
            .MuiChip-root { border: 1px solid #ccc; }
          }
          @media screen {
            .print-only { display: none; }
          }
        `}
      </style>
    </Box>
  );
}

export default InventoryMovementReport;
