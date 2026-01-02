import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, Chip, Grid, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, CardHeader, CardActions, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Tabs, Tab, List, ListItem,
  ListItemText, ListItemIcon, Tooltip, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import {
  ArrowBack as BackIcon, Edit as EditIcon, Send as SendIcon,
  CheckCircle as ApproveIcon, Cancel as DeclineIcon, Print as PrintIcon,
  Transform as ConvertIcon, History as HistoryIcon, Star as StarIcon,
  StarBorder as StarBorderIcon, LocalOffer as TierIcon, Add as AddIcon,
  Delete as DeleteIcon, Business as CustomerIcon, LocationOn as LocationIcon,
  CalendarToday as DateIcon, AttachMoney as MoneyIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { getCurrentUser, API_BASE_URL } from '../api';
import AppHeader from './AppHeader';

const statusColors = {
  draft: 'default',
  sent: 'info',
  viewed: 'secondary',
  approved: 'success',
  declined: 'error',
  converted: 'primary',
  expired: 'warning'
};

function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [approvalData, setApprovalData] = useState({
    selected_tier: 'standard',
    customer_approved_by: '',
    customer_notes: ''
  });

  const fetchQuote = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${id}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to fetch quote');
      const data = await response.json();
      setQuote(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  const handleSendQuote = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${id}/send`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to send quote');
      fetchQuote();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApproveQuote = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${id}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(approvalData)
        }
      );
      if (!response.ok) throw new Error('Failed to approve quote');
      setApprovalDialog(false);
      fetchQuote();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeclineQuote = async () => {
    const reason = window.prompt('Enter reason for declining (optional):');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${id}/decline?reason=${encodeURIComponent(reason || '')}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to decline quote');
      fetchQuote();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConvertToWorkOrder = async () => {
    if (!window.confirm('Convert this quote to a work order?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/quotes/${id}/convert-to-work-order`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to convert');
      }
      const data = await response.json();
      alert(`Converted to Work Order: ${data.work_order_number}`);
      navigate(`/jobs/${data.work_order_id}`);
    } catch (err) {
      setError(err.message);
    }
  };

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

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Box>
        <AppHeader title="Quote Details" showSearch={false} />
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <AppHeader title="Quote Details" showSearch={false} />
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
          <Button sx={{ mt: 2 }} onClick={() => navigate('/quotes')}>
            Back to Quotes
          </Button>
        </Box>
      </Box>
    );
  }

  if (!quote) return null;

  const tierOrder = ['basic', 'standard', 'premium'];
  const tierLabels = { basic: 'Good', standard: 'Better', premium: 'Best' };

  return (
    <Box>
      <AppHeader title={quote.quote_number || 'Quote Details'} showSearch={false}>
        {quote.status === 'draft' && (
          <>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/quotes/${id}/edit`)}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              Edit
            </Button>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleSendQuote}
              sx={{ bgcolor: 'white', color: '#1e3a5f', '&:hover': { bgcolor: '#e0e0e0' } }}
            >
              Send
            </Button>
          </>
        )}
        {quote.status === 'sent' && (
          <>
            <Button
              variant="outlined"
              startIcon={<DeclineIcon />}
              onClick={handleDeclineQuote}
              sx={{ color: '#f44336', borderColor: '#f44336' }}
            >
              Decline
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={() => setApprovalDialog(true)}
            >
              Approve
            </Button>
          </>
        )}
        {quote.status === 'approved' && !quote.converted_to_work_order_id && (
          <Button
            variant="contained"
            startIcon={<ConvertIcon />}
            onClick={handleConvertToWorkOrder}
            sx={{ bgcolor: 'white', color: '#1e3a5f', '&:hover': { bgcolor: '#e0e0e0' } }}
          >
            Convert
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          sx={{ color: 'white', borderColor: 'white' }}
        >
          Print
        </Button>
      </AppHeader>
      <Box sx={{ p: 3 }}>
      {/* Quote Info Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5">{quote.title}</Typography>
        <Chip
          label={quote.status?.toUpperCase()}
          color={statusColors[quote.status] || 'default'}
        />
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Quote Info */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 2 }}>
            <CardHeader title="Customer Information" />
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CustomerIcon color="action" />
                <Box>
                  <Typography variant="subtitle1">{quote.customer_name}</Typography>
                  {quote.customer_email && (
                    <Typography variant="body2" color="textSecondary">
                      {quote.customer_email}
                    </Typography>
                  )}
                  {quote.customer_phone && (
                    <Typography variant="body2" color="textSecondary">
                      {quote.customer_phone}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <LocationIcon color="action" />
                <Box>
                  <Typography variant="body2">{quote.service_address}</Typography>
                  <Typography variant="body2">
                    {[quote.service_city, quote.service_state, quote.service_zip].filter(Boolean).join(', ')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardHeader title="Quote Details" />
            <CardContent>
              <List dense>
                <ListItem>
                  <ListItemIcon><DateIcon /></ListItemIcon>
                  <ListItemText primary="Quote Date" secondary={formatDate(quote.quote_date)} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><DateIcon /></ListItemIcon>
                  <ListItemText primary="Valid Until" secondary={formatDate(quote.valid_until)} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><DateIcon /></ListItemIcon>
                  <ListItemText primary="Est. Start" secondary={formatDate(quote.estimated_start_date) || 'TBD'} />
                </ListItem>
                {quote.estimated_duration_days && (
                  <ListItem>
                    <ListItemText
                      primary="Est. Duration"
                      secondary={`${quote.estimated_duration_days} days`}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>

          {quote.job_description && (
            <Card sx={{ mb: 2 }}>
              <CardHeader title="Job Description" />
              <CardContent>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {quote.job_description}
                </Typography>
              </CardContent>
            </Card>
          )}

          {quote.scope_of_work && (
            <Card sx={{ mb: 2 }}>
              <CardHeader title="Scope of Work" />
              <CardContent>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {quote.scope_of_work}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Column - Pricing Tiers */}
        <Grid item xs={12} md={8}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TierIcon color="primary" />
            Pricing Options
          </Typography>

          <Grid container spacing={2}>
            {tierOrder.map((tierKey) => {
              const tier = quote.tiers?.[tierKey];
              if (!tier) return null;

              const isSelected = quote.selected_tier === tierKey;
              const isRecommended = tier.is_recommended;

              return (
                <Grid item xs={12} md={4} key={tierKey}>
                  <Card
                    sx={{
                      height: '100%',
                      border: isSelected ? '2px solid' : '1px solid',
                      borderColor: isSelected ? 'success.main' : isRecommended ? 'primary.main' : 'divider',
                      position: 'relative'
                    }}
                  >
                    {isRecommended && (
                      <Chip
                        label="Recommended"
                        color="primary"
                        size="small"
                        icon={<StarIcon />}
                        sx={{
                          position: 'absolute',
                          top: -12,
                          left: '50%',
                          transform: 'translateX(-50%)'
                        }}
                      />
                    )}
                    {isSelected && (
                      <Chip
                        label="Selected"
                        color="success"
                        size="small"
                        icon={<ApproveIcon />}
                        sx={{
                          position: 'absolute',
                          top: -12,
                          right: 8
                        }}
                      />
                    )}
                    <CardHeader
                      title={tier.tier_name}
                      subheader={tier.tier_description}
                      titleTypographyProps={{
                        variant: 'h6',
                        align: 'center',
                        color: isRecommended ? 'primary' : 'inherit'
                      }}
                      subheaderTypographyProps={{ align: 'center', variant: 'caption' }}
                      sx={{ pt: isRecommended ? 3 : 2 }}
                    />
                    <CardContent>
                      <Typography variant="h4" align="center" sx={{ mb: 2 }}>
                        {formatCurrency(tier.total_amount)}
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <List dense>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemText primary="Labor" />
                          <Typography>{formatCurrency(tier.labor_subtotal)}</Typography>
                        </ListItem>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemText primary="Materials" />
                          <Typography>{formatCurrency(tier.material_subtotal)}</Typography>
                        </ListItem>
                        {tier.other_subtotal > 0 && (
                          <ListItem sx={{ px: 0 }}>
                            <ListItemText primary="Other" />
                            <Typography>{formatCurrency(tier.other_subtotal)}</Typography>
                          </ListItem>
                        )}
                        <Divider sx={{ my: 1 }} />
                        <ListItem sx={{ px: 0 }}>
                          <ListItemText primary="Subtotal" />
                          <Typography>{formatCurrency(tier.subtotal)}</Typography>
                        </ListItem>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemText primary={`Tax (${(quote.tax_rate * 100).toFixed(2)}%)`} />
                          <Typography>{formatCurrency(tier.tax_amount)}</Typography>
                        </ListItem>
                      </List>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                      <Typography variant="caption" color="textSecondary">
                        {tier.line_items?.length || 0} items included
                      </Typography>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* Line Items Table */}
          <Card sx={{ mt: 3 }}>
            <CardHeader title="All Line Items" />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center">Good</TableCell>
                    <TableCell align="center">Better</TableCell>
                    <TableCell align="center">Best</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {quote.line_items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2">{item.description}</Typography>
                        {item.notes && (
                          <Typography variant="caption" color="textSecondary">
                            {item.notes}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={item.item_type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{item.quantity} {item.unit}</TableCell>
                      <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.line_total)}</TableCell>
                      <TableCell align="center">
                        {item.tier_basic ? <ApproveIcon color="success" fontSize="small" /> : '-'}
                      </TableCell>
                      <TableCell align="center">
                        {item.tier_standard ? <ApproveIcon color="success" fontSize="small" /> : '-'}
                      </TableCell>
                      <TableCell align="center">
                        {item.tier_premium ? <ApproveIcon color="success" fontSize="small" /> : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          {/* History */}
          {(quote.history || []).length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardHeader
                title="Quote History"
                avatar={<HistoryIcon />}
              />
              <CardContent>
                <List dense>
                  {(quote.history || []).map((h, idx) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={h.action} size="small" />
                            {h.new_status && (
                              <Typography variant="caption">
                                Status: {h.new_status}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={`${formatDateTime(h.action_date)} by ${h.performed_by}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog} onClose={() => setApprovalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Customer Approval</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Select which pricing tier the customer approved.
          </Typography>

          <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
            <Typography variant="subtitle2" gutterBottom>Selected Tier</Typography>
            <RadioGroup
              value={approvalData.selected_tier}
              onChange={(e) => setApprovalData({ ...approvalData, selected_tier: e.target.value })}
            >
              {tierOrder.map((tierKey) => {
                const tier = quote.tiers?.[tierKey];
                if (!tier) return null;
                return (
                  <FormControlLabel
                    key={tierKey}
                    value={tierKey}
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography>{tier.tier_name}</Typography>
                        <Typography color="primary" fontWeight="bold">
                          {formatCurrency(tier.total_amount)}
                        </Typography>
                        {tier.is_recommended && (
                          <Chip label="Recommended" size="small" color="primary" />
                        )}
                      </Box>
                    }
                  />
                );
              })}
            </RadioGroup>
          </FormControl>

          <TextField
            fullWidth
            label="Approved By (Customer Name)"
            value={approvalData.customer_approved_by}
            onChange={(e) => setApprovalData({ ...approvalData, customer_approved_by: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Customer Notes (Optional)"
            value={approvalData.customer_notes}
            onChange={(e) => setApprovalData({ ...approvalData, customer_notes: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleApproveQuote}>
            Record Approval
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}

export default QuoteDetail;
