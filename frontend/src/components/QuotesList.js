import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, Chip, Menu, MenuItem,
  TextField, InputAdornment, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Tooltip, CircularProgress, Alert,
  FormControl, InputLabel, Select, Card, CardContent, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem,
  ListItemButton, ListItemText, ListItemIcon, Autocomplete, Snackbar
} from '@mui/material';
import ConfirmDialog from './common/ConfirmDialog';
import {
  Add as AddIcon, Search as SearchIcon, FilterList as FilterIcon,
  MoreVert as MoreIcon, Visibility as ViewIcon, Edit as EditIcon,
  Delete as DeleteIcon, Send as SendIcon, CheckCircle as ApproveIcon,
  Cancel as DeclineIcon, Transform as ConvertIcon, Refresh as RefreshIcon,
  Description as QuoteIcon, ContentCopy as CloneIcon,
  Description as TemplateIcon, Bolt as BoltIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, API_BASE_URL } from '../api';
import AppHeader from './AppHeader';
import logger from '../utils/logger';

const statusColors = {
  draft: 'default',
  sent: 'info',
  viewed: 'secondary',
  approved: 'success',
  declined: 'error',
  converted: 'primary',
  expired: 'warning'
};

const statusLabels = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  approved: 'Approved',
  declined: 'Declined',
  converted: 'Converted',
  expired: 'Expired'
};

function QuotesList() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);

  // Template dialog state
  const [templateDialog, setTemplateDialog] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);

  // Clone dialog state
  const [cloneDialog, setCloneDialog] = useState(false);
  const [cloneCustomer, setCloneCustomer] = useState(null);
  const [cloning, setCloning] = useState(false);

  // Snackbar and confirm dialog state
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, quoteId: null });

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/quotes?limit=${rowsPerPage}&offset=${page * rowsPerPage}`;
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch quotes');
      const data = await response.json();
      setQuotes(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter]);

  const fetchTemplates = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/quotes/templates/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (err) {
      logger.error('Failed to fetch templates:', err);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || data);
      }
    } catch (err) {
      logger.error('Failed to fetch customers:', err);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    fetchTemplates();
    fetchCustomers();
  }, [fetchQuotes, fetchTemplates, fetchCustomers]);

  const handleMenuClick = (event, quote) => {
    setAnchorEl(event.currentTarget);
    setSelectedQuote(quote);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedQuote(null);
  };

  const handleViewQuote = () => {
    if (selectedQuote) {
      navigate(`/quotes/${selectedQuote.id}`);
    }
    handleMenuClose();
  };

  const handleSendQuote = async () => {
    if (!selectedQuote) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${selectedQuote.id}/send`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to send quote');
      fetchQuotes();
    } catch (err) {
      setError(err.message);
    }
    handleMenuClose();
  };

  const handleDeleteQuote = () => {
    if (!selectedQuote) return;
    setConfirmDialog({ open: true, quoteId: selectedQuote.id });
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${confirmDialog.quoteId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to delete quote');
      setSnackbar({ open: true, message: 'Quote deleted successfully', severity: 'success' });
      fetchQuotes();
    } catch (err) {
      setError(err.message);
    }
    setConfirmDialog({ open: false, quoteId: null });
  };

  const handleConvertToWorkOrder = async () => {
    if (!selectedQuote) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${selectedQuote.id}/convert-to-work-order`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to convert quote');
      }
      const data = await response.json();
      setSnackbar({ open: true, message: `Quote converted to Work Order ${data.work_order_number}`, severity: 'success' });
      fetchQuotes();
    } catch (err) {
      setError(err.message);
    }
    handleMenuClose();
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !selectedCustomer) {
      setSnackbar({ open: true, message: 'Please select a template and customer', severity: 'warning' });
      return;
    }

    setCreatingFromTemplate(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/from-template/${selectedTemplate.id}?customer_id=${selectedCustomer.id}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create quote from template');
      }
      const data = await response.json();
      setTemplateDialog(false);
      setSelectedTemplate(null);
      setSelectedCustomer(null);
      navigate(`/quotes/${data.quote_id}/edit`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingFromTemplate(false);
    }
  };

  const handleCloneQuote = async () => {
    if (!selectedQuote) return;

    setCloning(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/quotes/${selectedQuote.id}/clone`;
      if (cloneCustomer) {
        url += `?customer_id=${cloneCustomer.id}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to clone quote');
      }

      const data = await response.json();
      setCloneDialog(false);
      setCloneCustomer(null);
      handleMenuClose();
      navigate(`/quotes/${data.quote_id}/edit`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCloning(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!selectedQuote) return;

    const templateName = window.prompt('Enter template name:', `Template from ${selectedQuote.quote_number}`);
    if (!templateName) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${selectedQuote.id}/save-as-template?name=${encodeURIComponent(templateName)}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to save as template');
      }

      const data = await response.json();
      setSnackbar({ open: true, message: `Template "${data.template_name}" created successfully!`, severity: 'success' });
      fetchTemplates();
    } catch (err) {
      setError(err.message);
    }
    handleMenuClose();
  };

  const filteredQuotes = quotes.filter(quote =>
    quote.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  // Summary stats
  const stats = {
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    approved: quotes.filter(q => q.status === 'approved').length,
    totalValue: quotes.filter(q => ['draft', 'sent', 'approved'].includes(q.status))
      .reduce((sum, q) => sum + (q.total_amount || 0), 0)
  };

  return (
    <Box>
      <AppHeader title="Quotes & Estimates" showSearch={false}>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchQuotes}
          disabled={loading}
          sx={{ color: 'white' }}
        >
          Refresh
        </Button>
        <Button
          variant="outlined"
          startIcon={<TemplateIcon />}
          onClick={() => setTemplateDialog(true)}
          sx={{ color: 'white', borderColor: 'white' }}
        >
          From Template
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/quotes/new')}
          sx={{ bgcolor: 'background.paper', color: '#1e3a5f', '&:hover': { bgcolor: '#e0e0e0' } }}
        >
          New Quote
        </Button>
      </AppHeader>
      <Box sx={{ p: 3 }}>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography color="textSecondary" variant="caption">Drafts</Typography>
              <Typography variant="h4">{stats.draft}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography color="textSecondary" variant="caption">Sent</Typography>
              <Typography variant="h4" color="info.main">{stats.sent}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography color="textSecondary" variant="caption">Approved</Typography>
              <Typography variant="h4" color="success.main">{stats.approved}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography color="textSecondary" variant="caption">Pipeline Value</Typography>
              <Typography variant="h5" color="primary.main">{formatCurrency(stats.totalValue)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search quotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
            sx={{ minWidth: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="sent">Sent</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="declined">Declined</MenuItem>
              <MenuItem value="converted">Converted</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Quotes Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Quote #</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Valid Until</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredQuotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">No quotes found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredQuotes.map((quote) => (
                <TableRow
                  key={quote.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                >
                  <TableCell>
                    <Typography fontWeight="medium">{quote.quote_number}</Typography>
                  </TableCell>
                  <TableCell>{quote.customer_name}</TableCell>
                  <TableCell>
                    <Typography noWrap sx={{ maxWidth: 200 }}>
                      {quote.title}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(quote.quote_date)}</TableCell>
                  <TableCell>{formatDate(quote.valid_until)}</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="medium">
                      {formatCurrency(quote.total_amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabels[quote.status] || quote.status}
                      color={statusColors[quote.status] || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuClick(e, quote)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredQuotes.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewQuote}>
          <ViewIcon sx={{ mr: 1 }} /> View
        </MenuItem>
        {selectedQuote?.status === 'draft' && (
          <>
            <MenuItem onClick={() => { navigate(`/quotes/${selectedQuote.id}/edit`); handleMenuClose(); }}>
              <EditIcon sx={{ mr: 1 }} /> Edit
            </MenuItem>
            <MenuItem onClick={handleSendQuote}>
              <SendIcon sx={{ mr: 1 }} /> Send to Customer
            </MenuItem>
            <MenuItem onClick={() => { setCloneDialog(true); }}>
              <CloneIcon sx={{ mr: 1 }} /> Clone Quote
            </MenuItem>
            <MenuItem onClick={handleSaveAsTemplate}>
              <TemplateIcon sx={{ mr: 1 }} /> Save as Template
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleDeleteQuote} sx={{ color: 'error.main' }}>
              <DeleteIcon sx={{ mr: 1 }} /> Delete
            </MenuItem>
          </>
        )}
        {selectedQuote?.status === 'sent' && (
          <>
            <MenuItem onClick={handleSendQuote}>
              <SendIcon sx={{ mr: 1 }} /> Resend
            </MenuItem>
          </>
        )}
        {selectedQuote?.status === 'approved' && !selectedQuote?.converted_to_work_order_id && (
          <MenuItem onClick={handleConvertToWorkOrder}>
            <ConvertIcon sx={{ mr: 1 }} /> Convert to Work Order
          </MenuItem>
        )}
        {/* Clone option for any quote */}
        {selectedQuote && selectedQuote.status !== 'draft' && (
          <>
            <Divider />
            <MenuItem onClick={() => { setCloneDialog(true); }}>
              <CloneIcon sx={{ mr: 1 }} /> Clone Quote
            </MenuItem>
            <MenuItem onClick={handleSaveAsTemplate}>
              <TemplateIcon sx={{ mr: 1 }} /> Save as Template
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Template Selection Dialog */}
      <Dialog
        open={templateDialog}
        onClose={() => setTemplateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Quote from Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Select a template and customer to quickly create a new quote with pre-filled line items.
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>1. Select Template</Typography>
              <List sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 300, overflow: 'auto' }}>
                {templates.map((template) => (
                  <ListItemButton
                    key={template.id}
                    selected={selectedTemplate?.id === template.id}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <ListItemIcon>
                      <BoltIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={template.name}
                      secondary={
                        <>
                          {template.job_type?.replace('_', ' ')} - {template.item_count} items
                          <br />
                          Est. Total: {formatCurrency(template.estimated_total)}
                        </>
                      }
                    />
                  </ListItemButton>
                ))}
                {templates.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No templates available"
                      secondary="Create a quote and save it as a template to get started."
                    />
                  </ListItem>
                )}
              </List>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>2. Select Customer</Typography>
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => option.company_name || `${option.first_name || ''} ${option.last_name || ''}`.trim()}
                value={selectedCustomer}
                onChange={(e, value) => setSelectedCustomer(value)}
                renderInput={(params) => (
                  <TextField {...params} label="Search customers..." fullWidth />
                )}
                sx={{ mb: 2 }}
              />

              {selectedTemplate && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Template Details
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Job Type:</strong> {selectedTemplate.job_type?.replace('_', ' ')}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Items:</strong> {selectedTemplate.item_count}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Est. Duration:</strong> {selectedTemplate.estimated_duration_days || 'N/A'} days
                    </Typography>
                    <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                      {formatCurrency(selectedTemplate.estimated_total)}
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setTemplateDialog(false); setSelectedTemplate(null); setSelectedCustomer(null); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateFromTemplate}
            disabled={!selectedTemplate || !selectedCustomer || creatingFromTemplate}
            startIcon={creatingFromTemplate ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {creatingFromTemplate ? 'Creating...' : 'Create Quote'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clone Quote Dialog */}
      <Dialog
        open={cloneDialog}
        onClose={() => { setCloneDialog(false); setCloneCustomer(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Clone Quote</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Create a copy of "{selectedQuote?.title}". Optionally select a different customer.
          </Typography>

          <Typography variant="subtitle2" gutterBottom>Clone to customer (optional)</Typography>
          <Autocomplete
            options={customers}
            getOptionLabel={(option) => option.company_name || `${option.first_name || ''} ${option.last_name || ''}`.trim()}
            value={cloneCustomer}
            onChange={(e, value) => setCloneCustomer(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Same customer (leave blank) or select new customer"
                fullWidth
              />
            )}
          />
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            Leave blank to clone for the same customer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCloneDialog(false); setCloneCustomer(null); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCloneQuote}
            disabled={cloning}
            startIcon={cloning ? <CircularProgress size={20} /> : <CloneIcon />}
          >
            {cloning ? 'Cloning...' : 'Clone Quote'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, quoteId: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Quote"
        message="Are you sure you want to delete this quote? This action cannot be undone."
        confirmText="Delete"
        confirmColor="error"
        severity="warning"
      />

      {/* Notification Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </Box>
  );
}

export default QuotesList;
