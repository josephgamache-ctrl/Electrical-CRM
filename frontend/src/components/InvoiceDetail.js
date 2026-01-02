import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Card,
  CardContent,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Print as PrintIcon,
  Payment as PaymentIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as PaidIcon,
  Schedule as PendingIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchInvoice, recordInvoicePayment, markInvoiceSent, deleteInvoice, getCurrentUser } from '../api';
import AppHeader from './AppHeader';
import ConfirmDialog from './common/ConfirmDialog';
import logger from '../utils/logger';

function InvoiceDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const printRef = useRef();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    loadInvoice();
    loadUserRole();
  }, [id]);

  const loadUserRole = async () => {
    try {
      const userData = await getCurrentUser();
      setUserRole(userData.role);
    } catch (err) {
      logger.error('Error loading user role:', err);
    }
  };

  const loadInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInvoice(id);
      setInvoice(data);
      setPaymentAmount(data.balance_due?.toString() || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'paid':
        return <Chip label="PAID" color="success" icon={<PaidIcon />} />;
      case 'partial':
        return <Chip label="PARTIAL PAYMENT" color="warning" icon={<MoneyIcon />} />;
      case 'unpaid':
        return <Chip label="UNPAID" color="error" icon={<PendingIcon />} />;
      default:
        return <Chip label={status} />;
    }
  };

  const isOverdue = () => {
    if (!invoice || invoice.payment_status === 'paid') return false;
    return new Date(invoice.due_date) < new Date();
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      setSnackbar({ open: true, message: 'Please enter a valid payment amount', severity: 'error' });
      return;
    }

    setSubmittingPayment(true);
    try {
      const paymentData = {
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        notes: paymentNotes,
        check_number: paymentMethod === 'check' ? checkNumber : null,
      };

      await recordInvoicePayment(id, paymentData);
      setSnackbar({ open: true, message: 'Payment recorded successfully', severity: 'success' });
      setPaymentDialogOpen(false);
      setPaymentNotes('');
      setCheckNumber('');
      await loadInvoice();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleMarkSent = async () => {
    try {
      await markInvoiceSent(id);
      setSnackbar({ open: true, message: 'Invoice marked as sent', severity: 'success' });
      await loadInvoice();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);
    try {
      await deleteInvoice(id);
      setSnackbar({ open: true, message: 'Invoice deleted', severity: 'success' });
      navigate('/invoices');
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        <AppHeader title="Invoice Details" />
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        <AppHeader title="Invoice Details" />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </Box>
    );
  }

  if (!invoice) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        <AppHeader title="Invoice Details" />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="warning">Invoice not found</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppHeader title={`Invoice ${invoice.invoice_number}`} />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Action Buttons - Hidden when printing */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }} className="no-print">
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate('/invoices')}
          >
            Back to Invoices
          </Button>

          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            Print / PDF
          </Button>

          {invoice.payment_status !== 'paid' && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PaymentIcon />}
              onClick={() => setPaymentDialogOpen(true)}
            >
              Record Payment
            </Button>
          )}

          {!invoice.sent_to_customer && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<SendIcon />}
              onClick={handleMarkSent}
            >
              Mark as Sent
            </Button>
          )}

          {userRole === 'admin' && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
            >
              Delete
            </Button>
          )}
        </Box>

        {/* Overdue Warning */}
        {isOverdue() && (
          <Alert severity="error" sx={{ mb: 3 }} className="no-print">
            <strong>This invoice is overdue!</strong> Due date was {formatDate(invoice.due_date)}
          </Alert>
        )}

        {/* Invoice Document */}
        <Paper ref={printRef} elevation={3} sx={{ p: 4 }} id="invoice-print">
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
            <Box>
              <Typography variant="h4" fontWeight="bold" color="primary">
                MA ELECTRICAL
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Licensed Electrical Contractors
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Massachusetts License #12345
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h3" fontWeight="bold" color="text.secondary">
                INVOICE
              </Typography>
              <Typography variant="h5" color="primary" fontWeight="bold">
                {invoice.invoice_number}
              </Typography>
              <Box sx={{ mt: 1 }} className="no-print">
                {getStatusChip(invoice.payment_status)}
              </Box>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Bill To & Invoice Details */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                BILL TO
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {invoice.company_name || invoice.customer_name}
              </Typography>
              {invoice.company_name && (
                <Typography variant="body1">{invoice.customer_name}</Typography>
              )}
              <Typography variant="body2">{invoice.customer_address}</Typography>
              <Typography variant="body2">
                {invoice.customer_city}, {invoice.customer_state} {invoice.customer_zip}
              </Typography>
              {invoice.customer_email && (
                <Typography variant="body2">{invoice.customer_email}</Typography>
              )}
              {invoice.customer_phone && (
                <Typography variant="body2">{invoice.customer_phone}</Typography>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Invoice Date:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="bold">{formatDate(invoice.invoice_date)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Due Date:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="bold" color={isOverdue() ? 'error.main' : 'inherit'}>
                      {formatDate(invoice.due_date)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Work Order:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="bold">{invoice.work_order_number}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Job Address:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">{invoice.job_address || 'Same as billing'}</Typography>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>

          {/* Job Description */}
          {invoice.job_description && (
            <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                JOB DESCRIPTION
              </Typography>
              <Typography variant="body1">{invoice.job_description}</Typography>
            </Box>
          )}

          {/* Labor Section */}
          {invoice.labor_entries && invoice.labor_entries.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Labor
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell><strong>Date</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Technician</strong></TableCell>
                      <TableCell align="right"><strong>Hours</strong></TableCell>
                      <TableCell align="right"><strong>Rate</strong></TableCell>
                      <TableCell align="right"><strong>Amount</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoice.labor_entries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{formatDate(entry.work_date)}</TableCell>
                        <TableCell>{entry.work_description || 'Labor'}</TableCell>
                        <TableCell>{entry.employee_name}</TableCell>
                        <TableCell align="right">
                          {entry.hours_regular}
                          {entry.hours_overtime > 0 && ` + ${entry.hours_overtime} OT`}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(entry.billable_rate)}/hr</TableCell>
                        <TableCell align="right">{formatCurrency(entry.line_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Materials Section */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Materials
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell><strong>Item</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell align="right"><strong>Qty</strong></TableCell>
                      <TableCell align="right"><strong>Unit Price</strong></TableCell>
                      <TableCell align="right"><strong>Amount</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoice.line_items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.item_id}</TableCell>
                        <TableCell>
                          {item.brand && `${item.brand} - `}{item.description}
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.line_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Totals */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Box sx={{ width: 300 }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body1">Labor:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" align="right">{formatCurrency(invoice.labor_cost)}</Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body1">Materials:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" align="right">{formatCurrency(invoice.material_cost)}</Typography>
                </Grid>

                {invoice.permit_cost > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body1">Permit Fees:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body1" align="right">{formatCurrency(invoice.permit_cost)}</Typography>
                    </Grid>
                  </>
                )}

                {invoice.travel_charge > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body1">Travel:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body1" align="right">{formatCurrency(invoice.travel_charge)}</Typography>
                    </Grid>
                  </>
                )}

                {invoice.emergency_surcharge > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body1">Emergency Surcharge:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body1" align="right">{formatCurrency(invoice.emergency_surcharge)}</Typography>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body1">Subtotal:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" align="right">{formatCurrency(invoice.subtotal)}</Typography>
                </Grid>

                {invoice.discount_amount > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body1" color="success.main">Discount:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body1" align="right" color="success.main">
                        -{formatCurrency(invoice.discount_amount)}
                      </Typography>
                    </Grid>
                  </>
                )}

                {invoice.tax_amount > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body1">Tax ({invoice.tax_rate}%):</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body1" align="right">{formatCurrency(invoice.tax_amount)}</Typography>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="h6" fontWeight="bold">TOTAL:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h6" fontWeight="bold" align="right">
                    {formatCurrency(invoice.total_amount)}
                  </Typography>
                </Grid>

                {invoice.amount_paid > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body1" color="success.main">Paid:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body1" align="right" color="success.main">
                        -{formatCurrency(invoice.amount_paid)}
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography variant="h6" fontWeight="bold" color="error.main">BALANCE DUE:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h6" fontWeight="bold" align="right" color="error.main">
                        {formatCurrency(invoice.balance_due)}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>
          </Box>

          {/* Terms */}
          {invoice.terms && (
            <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                TERMS & CONDITIONS
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {invoice.terms}
              </Typography>
            </Box>
          )}

          {/* Notes */}
          {invoice.notes && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                NOTES
              </Typography>
              <Typography variant="body2">{invoice.notes}</Typography>
            </Box>
          )}

          {/* Footer */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Thank you for your business!
            </Typography>
          </Box>
        </Paper>

        {/* Payment History - Hidden when printing */}
        {invoice.payments && invoice.payments.length > 0 && (
          <Paper elevation={3} sx={{ p: 3, mt: 3 }} className="no-print">
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Payment History
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Amount</strong></TableCell>
                    <TableCell><strong>Method</strong></TableCell>
                    <TableCell><strong>Notes</strong></TableCell>
                    <TableCell><strong>Recorded By</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoice.payments.map((payment, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{payment.payment_method}</TableCell>
                      <TableCell>{payment.notes || '-'}</TableCell>
                      <TableCell>{payment.recorded_by_name || payment.recorded_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Container>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        confirmColor="error"
        severity="warning"
      />

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Payment Amount"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
              helperText={`Balance due: ${formatCurrency(invoice?.balance_due)}`}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={paymentMethod}
                label="Payment Method"
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="check">Check</MenuItem>
                <MenuItem value="credit_card">Credit Card</MenuItem>
                <MenuItem value="debit_card">Debit Card</MenuItem>
                <MenuItem value="ach">ACH / Bank Transfer</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            {paymentMethod === 'check' && (
              <TextField
                fullWidth
                label="Check Number"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                sx={{ mb: 2 }}
              />
            )}

            <TextField
              fullWidth
              label="Notes (optional)"
              multiline
              rows={2}
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleRecordPayment}
            disabled={submittingPayment}
          >
            {submittingPayment ? <CircularProgress size={24} /> : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Print Styles */}
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #invoice-print {
              box-shadow: none !important;
              padding: 0 !important;
            }
          }
        `}
      </style>
    </Box>
  );
}

export default InvoiceDetail;
