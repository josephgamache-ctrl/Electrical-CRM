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
import { fetchInvoice, recordInvoicePayment, markInvoiceSent, deleteInvoice, getCurrentUser, updateInvoice, sendInvoiceEmail, sendInvoiceSMS, updateInvoiceLineItem, updateInvoiceLaborEntry, fetchCommunicationCarriers } from '../api';
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

  // Edit Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    due_date: '',
    tax_rate: '',
    permit_cost: '',
    travel_charge: '',
    emergency_surcharge: '',
    discount_amount: '',
    notes: '',
    terms: ''
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Send Invoice Dialog
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendMethod, setSendMethod] = useState('email'); // 'email' or 'sms'
  const [sendEmail, setSendEmail] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [sendCarrier, setSendCarrier] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [submittingSend, setSubmittingSend] = useState(false);
  const [carriers, setCarriers] = useState([]);

  // Line Item Edit Dialog
  const [lineItemEditOpen, setLineItemEditOpen] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState(null);
  const [lineItemForm, setLineItemForm] = useState({ unit_price: '', quantity: '', notes: '' });
  const [submittingLineItem, setSubmittingLineItem] = useState(false);

  // Labor Entry Edit Dialog
  const [laborEditOpen, setLaborEditOpen] = useState(false);
  const [editingLabor, setEditingLabor] = useState(null);
  const [laborForm, setLaborForm] = useState({ billable_rate: '', hours_worked: '' });
  const [submittingLabor, setSubmittingLabor] = useState(false);

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

  // Edit Invoice handlers
  const handleEditClick = () => {
    if (invoice) {
      setEditForm({
        due_date: invoice.due_date ? invoice.due_date.split('T')[0] : '',
        tax_rate: invoice.tax_rate?.toString() || '0',
        permit_cost: invoice.permit_cost?.toString() || '0',
        travel_charge: invoice.travel_charge?.toString() || '0',
        emergency_surcharge: invoice.emergency_surcharge?.toString() || '0',
        discount_amount: invoice.discount_amount?.toString() || '0',
        notes: invoice.notes || '',
        terms: invoice.terms || ''
      });
      setEditDialogOpen(true);
    }
  };

  const handleEditSave = async () => {
    setSubmittingEdit(true);
    try {
      const updateData = {
        due_date: editForm.due_date || null,
        tax_rate: parseFloat(editForm.tax_rate) || 0,
        permit_cost: parseFloat(editForm.permit_cost) || 0,
        travel_charge: parseFloat(editForm.travel_charge) || 0,
        emergency_surcharge: parseFloat(editForm.emergency_surcharge) || 0,
        discount_amount: parseFloat(editForm.discount_amount) || 0,
        notes: editForm.notes || null,
        terms: editForm.terms || null
      };
      await updateInvoice(id, updateData);
      setSnackbar({ open: true, message: 'Invoice updated successfully', severity: 'success' });
      setEditDialogOpen(false);
      await loadInvoice();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Send Invoice handlers
  const handleSendClick = async () => {
    if (invoice) {
      setSendMethod('email');
      setSendEmail(invoice.customer_email || '');
      setSendPhone(invoice.customer_phone || '');
      setSendCarrier('');
      setSendMessage(`Dear ${invoice.customer_name || 'Customer'},\n\nPlease find attached Invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total_amount)}.\n\nPayment is due by ${formatDate(invoice.due_date)}.\n\nThank you for your business!\n\nPem2 Services`);
      setSendDialogOpen(true);
      // Load carriers for SMS option
      try {
        const data = await fetchCommunicationCarriers();
        setCarriers(data.carriers || []);
      } catch (err) {
        // Carriers not required for email, just log
        logger.warn('Could not load carriers:', err);
      }
    }
  };

  const handleSendInvoice = async () => {
    if (sendMethod === 'email') {
      if (!sendEmail || !sendEmail.includes('@')) {
        setSnackbar({ open: true, message: 'Please enter a valid email address', severity: 'error' });
        return;
      }
      setSubmittingSend(true);
      try {
        await sendInvoiceEmail(id, { email: sendEmail, message: sendMessage });
        setSnackbar({ open: true, message: `Invoice sent to ${sendEmail}`, severity: 'success' });
        setSendDialogOpen(false);
        await loadInvoice();
      } catch (err) {
        setSnackbar({ open: true, message: err.message, severity: 'error' });
      } finally {
        setSubmittingSend(false);
      }
    } else {
      // SMS
      if (!sendPhone || sendPhone.length < 10) {
        setSnackbar({ open: true, message: 'Please enter a valid phone number', severity: 'error' });
        return;
      }
      setSubmittingSend(true);
      try {
        await sendInvoiceSMS(id, {
          phone: sendPhone,
          message: sendMessage,
          carrier: sendCarrier || undefined
        });
        setSnackbar({ open: true, message: `Invoice sent via SMS to ${sendPhone}`, severity: 'success' });
        setSendDialogOpen(false);
        await loadInvoice();
      } catch (err) {
        setSnackbar({ open: true, message: err.message, severity: 'error' });
      } finally {
        setSubmittingSend(false);
      }
    }
  };

  // Line Item Edit handlers
  const handleLineItemEditClick = (item) => {
    setEditingLineItem(item);
    setLineItemForm({
      unit_price: item.unit_price?.toString() || '0',
      quantity: item.quantity?.toString() || '0',
      notes: ''
    });
    setLineItemEditOpen(true);
  };

  const handleLineItemSave = async () => {
    if (!editingLineItem) return;
    setSubmittingLineItem(true);
    try {
      await updateInvoiceLineItem(id, editingLineItem.id, {
        unit_price: parseFloat(lineItemForm.unit_price) || 0,
        quantity: parseInt(lineItemForm.quantity) || 0,
        notes: lineItemForm.notes || null
      });
      setSnackbar({ open: true, message: 'Line item updated', severity: 'success' });
      setLineItemEditOpen(false);
      setEditingLineItem(null);
      await loadInvoice();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setSubmittingLineItem(false);
    }
  };

  // Labor Entry Edit handlers
  const handleLaborEditClick = (entry) => {
    setEditingLabor(entry);
    setLaborForm({
      billable_rate: entry.billable_rate?.toString() || '0',
      hours_worked: entry.hours_worked?.toString() || '0'
    });
    setLaborEditOpen(true);
  };

  const handleLaborSave = async () => {
    if (!editingLabor) return;
    setSubmittingLabor(true);
    try {
      await updateInvoiceLaborEntry(id, editingLabor.id, {
        billable_rate: parseFloat(laborForm.billable_rate) || 0,
        hours_worked: parseFloat(laborForm.hours_worked) || 0
      });
      setSnackbar({ open: true, message: 'Labor entry updated', severity: 'success' });
      setLaborEditOpen(false);
      setEditingLabor(null);
      await loadInvoice();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setSubmittingLabor(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppHeader title="Invoice Details" />
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppHeader title="Invoice Details" />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </Box>
    );
  }

  if (!invoice) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppHeader title="Invoice Details" />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="warning">Invoice not found</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
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

          {/* Edit Invoice Button */}
          {(userRole === 'admin' || userRole === 'manager') && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<EditIcon />}
              onClick={handleEditClick}
            >
              Edit Invoice
            </Button>
          )}

          {/* Send Invoice Button */}
          <Button
            variant="contained"
            color="primary"
            startIcon={<SendIcon />}
            onClick={handleSendClick}
          >
            {invoice.sent_to_customer ? 'Resend Invoice' : 'Send Invoice'}
          </Button>

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
                PEM2 SERVICES
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Licensed Electrical Contractors
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Massachusetts License #E-48329
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
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
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
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      <TableCell><strong>Date</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Technician</strong></TableCell>
                      <TableCell align="right"><strong>Hours</strong></TableCell>
                      <TableCell align="right"><strong>Rate</strong></TableCell>
                      <TableCell align="right"><strong>Amount</strong></TableCell>
                      {(userRole === 'admin' || userRole === 'manager') && (
                        <TableCell align="center" className="no-print"><strong>Edit</strong></TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoice.labor_entries.map((entry, idx) => (
                      <TableRow key={idx} sx={{ bgcolor: entry.billable_rate === 0 ? 'success.light' : undefined }}>
                        <TableCell>{formatDate(entry.work_date)}</TableCell>
                        <TableCell>{entry.work_description || 'Labor'}</TableCell>
                        <TableCell>{entry.employee_name}</TableCell>
                        <TableCell align="right">
                          {entry.hours_worked}
                          {entry.hours_overtime > 0 && ` + ${entry.hours_overtime} OT`}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(entry.billable_rate)}/hr
                          {entry.billable_rate === 0 && (
                            <Chip label="FREE" size="small" color="success" sx={{ ml: 1 }} />
                          )}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(entry.line_total)}</TableCell>
                        {(userRole === 'admin' || userRole === 'manager') && (
                          <TableCell align="center" className="no-print">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleLaborEditClick(entry)}
                              title="Edit hours/rate"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
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
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      <TableCell><strong>Item</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell align="right"><strong>Qty</strong></TableCell>
                      <TableCell align="right"><strong>Unit Price</strong></TableCell>
                      <TableCell align="right"><strong>Amount</strong></TableCell>
                      {(userRole === 'admin' || userRole === 'manager') && (
                        <TableCell align="center" className="no-print"><strong>Edit</strong></TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoice.line_items.map((item, idx) => (
                      <TableRow key={idx} sx={{ bgcolor: item.unit_price === 0 ? 'success.light' : (item.customer_provided ? 'info.light' : undefined) }}>
                        <TableCell>{item.item_id}</TableCell>
                        <TableCell>
                          {item.brand && `${item.brand} - `}{item.description}
                          {item.is_custom && (
                            <Chip label="Special Order" size="small" color="secondary" sx={{ ml: 1 }} />
                          )}
                          {item.customer_provided && (
                            <Chip label="Customer Provided" size="small" color="info" sx={{ ml: 1 }} />
                          )}
                          {item.unit_price === 0 && !item.customer_provided && (
                            <Chip label="FREE" size="small" color="success" sx={{ ml: 1 }} />
                          )}
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.line_total)}</TableCell>
                        {(userRole === 'admin' || userRole === 'manager') && (
                          <TableCell align="center" className="no-print">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleLineItemEditClick(item)}
                              title="Edit price/quantity"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
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
            <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderTopColor: 'divider' }}>
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
                  <TableRow sx={{ bgcolor: 'background.default' }}>
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

      {/* Edit Invoice Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Invoice</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Due Date"
              type="date"
              value={editForm.due_date}
              onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
              sx={{ mb: 2 }}
              InputLabelProps={{ shrink: true }}
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Tax Rate (%)"
                  type="number"
                  value={editForm.tax_rate}
                  onChange={(e) => setEditForm({ ...editForm, tax_rate: e.target.value })}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Discount Amount"
                  type="number"
                  value={editForm.discount_amount}
                  onChange={(e) => setEditForm({ ...editForm, discount_amount: e.target.value })}
                  InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Permit Cost"
                  type="number"
                  value={editForm.permit_cost}
                  onChange={(e) => setEditForm({ ...editForm, permit_cost: e.target.value })}
                  InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Travel Charge"
                  type="number"
                  value={editForm.travel_charge}
                  onChange={(e) => setEditForm({ ...editForm, travel_charge: e.target.value })}
                  InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Emergency Surcharge"
                  type="number"
                  value={editForm.emergency_surcharge}
                  onChange={(e) => setEditForm({ ...editForm, emergency_surcharge: e.target.value })}
                  InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              </Grid>
            </Grid>

            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              sx={{ mt: 2 }}
            />

            <TextField
              fullWidth
              label="Terms & Conditions"
              multiline
              rows={2}
              value={editForm.terms}
              onChange={(e) => setEditForm({ ...editForm, terms: e.target.value })}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleEditSave}
            disabled={submittingEdit}
          >
            {submittingEdit ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Invoice Dialog */}
      <Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Invoice to Customer</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              This will send Invoice {invoice?.invoice_number} ({formatCurrency(invoice?.total_amount)}) to the customer.
            </Alert>

            {/* Send Method Selection */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Send Method</InputLabel>
              <Select
                value={sendMethod}
                label="Send Method"
                onChange={(e) => setSendMethod(e.target.value)}
              >
                <MenuItem value="email">📧 Email</MenuItem>
                <MenuItem value="sms">📱 Text Message (SMS)</MenuItem>
              </Select>
            </FormControl>

            {sendMethod === 'email' ? (
              <>
                <TextField
                  fullWidth
                  label="Recipient Email"
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                  placeholder="customer@email.com"
                />

                <TextField
                  fullWidth
                  label="Message (optional)"
                  multiline
                  rows={6}
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  helperText="This message will be included in the email body"
                />
              </>
            ) : (
              <>
                <TextField
                  fullWidth
                  label="Phone Number"
                  type="tel"
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                  placeholder="(555) 123-4567"
                  helperText="Enter customer's mobile phone number"
                />

                {carriers.length > 0 && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Mobile Carrier (for SMS Gateway)</InputLabel>
                    <Select
                      value={sendCarrier}
                      label="Mobile Carrier (for SMS Gateway)"
                      onChange={(e) => setSendCarrier(e.target.value)}
                    >
                      <MenuItem value="">Not Required (if using Twilio)</MenuItem>
                      {carriers.map((carrier) => (
                        <MenuItem key={carrier.id} value={carrier.id}>
                          {carrier.name}
                        </MenuItem>
                      ))}
                    </Select>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Only required if using SMS Gateway (email-to-SMS). Not needed for Twilio.
                    </Typography>
                  </FormControl>
                )}

                <TextField
                  fullWidth
                  label="Additional Message (optional)"
                  multiline
                  rows={3}
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  helperText="Short message to include (SMS has 160 character limit per segment)"
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendInvoice}
            disabled={submittingSend || (sendMethod === 'email' ? !sendEmail : !sendPhone)}
            startIcon={submittingSend ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {submittingSend ? 'Sending...' : (sendMethod === 'email' ? 'Send Email' : 'Send SMS')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Line Item Edit Dialog */}
      <Dialog open={lineItemEditOpen} onClose={() => setLineItemEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Material Line Item</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {editingLineItem && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {editingLineItem.item_id} - {editingLineItem.description}
                {editingLineItem.is_custom && <Chip label="Special Order" size="small" color="secondary" sx={{ ml: 1 }} />}
                {editingLineItem.customer_provided && <Chip label="Customer Provided" size="small" color="info" sx={{ ml: 1 }} />}
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Unit Price"
                  type="number"
                  value={lineItemForm.unit_price}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, unit_price: e.target.value })}
                  InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
                  inputProps={{ step: '0.01', min: '0' }}
                  helperText="Set to $0 for free item"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Quantity"
                  type="number"
                  value={lineItemForm.quantity}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, quantity: e.target.value })}
                  inputProps={{ min: '0' }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes (reason for change)"
                  value={lineItemForm.notes}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, notes: e.target.value })}
                  placeholder="e.g., Comped by owner, price match, customer discount"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLineItemEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleLineItemSave}
            disabled={submittingLineItem}
          >
            {submittingLineItem ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Labor Entry Edit Dialog */}
      <Dialog open={laborEditOpen} onClose={() => setLaborEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Labor Entry</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {editingLabor && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {editingLabor.employee_name} - {formatDate(editingLabor.work_date)}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Billable Rate"
              type="number"
              value={laborForm.billable_rate}
              onChange={(e) => setLaborForm({ ...laborForm, billable_rate: e.target.value })}
              sx={{ mb: 2 }}
              InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$/hr</Typography> }}
              inputProps={{ step: '0.01', min: '0' }}
              helperText="Set to $0.00 for free labor"
            />
            <TextField
              fullWidth
              label="Hours Worked"
              type="number"
              value={laborForm.hours_worked}
              onChange={(e) => setLaborForm({ ...laborForm, hours_worked: e.target.value })}
              inputProps={{ step: '0.25', min: '0' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLaborEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleLaborSave}
            disabled={submittingLabor}
          >
            {submittingLabor ? <CircularProgress size={24} /> : 'Save'}
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
