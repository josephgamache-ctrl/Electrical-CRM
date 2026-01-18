import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Receipt as InvoiceIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  CheckCircle as PaidIcon,
  Schedule as PendingIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { fetchInvoices, getInvoiceStats } from '../api';
import AppHeader from './AppHeader';

function InvoiceList() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoicesData, statsData] = await Promise.all([
        fetchInvoices(statusFilter || null),
        getInvoiceStats()
      ]);
      setInvoices(invoicesData.invoices || []);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'paid':
        return <Chip label="Paid" color="success" size="small" icon={<PaidIcon />} />;
      case 'partial':
        return <Chip label="Partial" color="warning" size="small" icon={<MoneyIcon />} />;
      case 'unpaid':
        return <Chip label="Unpaid" color="error" size="small" icon={<PendingIcon />} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const isOverdue = (invoice) => {
    if (invoice.payment_status === 'paid') return false;
    return new Date(invoice.due_date) < new Date();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredInvoices = invoices.filter(inv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(query) ||
      inv.customer_name?.toLowerCase().includes(query) ||
      inv.work_order_number?.toLowerCase().includes(query)
    );
  });

  // Mobile card view for invoices
  const MobileInvoiceCard = ({ invoice }) => (
    <Card
      sx={{
        mb: 2,
        cursor: 'pointer',
        border: isOverdue(invoice) ? 2 : 0,
        borderStyle: 'solid',
        borderColor: isOverdue(invoice) ? 'error.main' : 'transparent',
        '&:hover': { boxShadow: 4 }
      }}
      onClick={() => navigate(`/invoices/${invoice.id}`)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {invoice.invoice_number}
          </Typography>
          {getStatusChip(invoice.payment_status)}
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {invoice.customer_name}
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          WO: {invoice.work_order_number}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Total</Typography>
            <Typography variant="body1" fontWeight="bold">
              {formatCurrency(invoice.total_amount)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">Balance</Typography>
            <Typography
              variant="body1"
              fontWeight="bold"
              color={invoice.balance_due > 0 ? 'error.main' : 'success.main'}
            >
              {formatCurrency(invoice.balance_due)}
            </Typography>
          </Box>
        </Box>

        {isOverdue(invoice) && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', color: 'error.main' }}>
            <WarningIcon fontSize="small" sx={{ mr: 0.5 }} />
            <Typography variant="caption">
              Overdue - Due {formatDate(invoice.due_date)}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Invoices" />

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Stats Cards */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <Card elevation={2}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {stats.total_invoices || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Invoices
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card elevation={2}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {formatCurrency(stats.total_collected)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Collected
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card elevation={2}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {formatCurrency(stats.total_outstanding)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Outstanding
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card elevation={2} sx={{ bgcolor: stats.overdue_count > 0 ? 'error.light' : undefined }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="error.main" fontWeight="bold">
                    {stats.overdue_count || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Overdue ({formatCurrency(stats.overdue_amount)})
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filters */}
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by invoice #, customer, or work order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={8} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                  <MenuItem value="partial">Partial</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadData}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* Loading */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredInvoices.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <InvoiceIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No invoices found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create an invoice from a completed work order to get started.
            </Typography>
          </Paper>
        ) : isMobile ? (
          // Mobile View
          <Box>
            {filteredInvoices.map((invoice) => (
              <MobileInvoiceCard key={invoice.id} invoice={invoice} />
            ))}
          </Box>
        ) : (
          // Desktop Table View
          <TableContainer component={Paper} elevation={2}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.default' }}>
                  <TableCell><strong>Invoice #</strong></TableCell>
                  <TableCell><strong>Customer</strong></TableCell>
                  <TableCell><strong>Work Order</strong></TableCell>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Due Date</strong></TableCell>
                  <TableCell align="right"><strong>Total</strong></TableCell>
                  <TableCell align="right"><strong>Paid</strong></TableCell>
                  <TableCell align="right"><strong>Balance</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      bgcolor: isOverdue(invoice) ? 'error.light' : undefined,
                      '&:hover': { bgcolor: isOverdue(invoice) ? 'error.light' : undefined }
                    }}
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {isOverdue(invoice) && (
                          <Tooltip title="Overdue">
                            <WarningIcon color="error" fontSize="small" sx={{ mr: 1 }} />
                          </Tooltip>
                        )}
                        <Typography fontWeight="bold">{invoice.invoice_number}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{invoice.customer_name}</TableCell>
                    <TableCell>{invoice.work_order_number}</TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>{formatDate(invoice.due_date)}</TableCell>
                    <TableCell align="right">{formatCurrency(invoice.total_amount)}</TableCell>
                    <TableCell align="right">{formatCurrency(invoice.amount_paid)}</TableCell>
                    <TableCell align="right">
                      <Typography
                        fontWeight="bold"
                        color={invoice.balance_due > 0 ? 'error.main' : 'success.main'}
                      >
                        {formatCurrency(invoice.balance_due)}
                      </Typography>
                    </TableCell>
                    <TableCell>{getStatusChip(invoice.payment_status)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/invoices/${invoice.id}`);
                        }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  );
}

export default InvoiceList;
