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
  Chip,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  ShoppingCart as ShoppingCartIcon,
  ExpandMore as ExpandMoreIcon,
  LocalShipping as LocalShippingIcon,
  Schedule as ScheduleIcon,
  TrendingDown as TrendingDownIcon,
  Add as AddIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';
import logger from '../../utils/logger';
function InventoryProjectionsReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filter states
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [shortageOnly, setShortageOnly] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');

  // Data states
  const [projectionData, setProjectionData] = useState(null);
  const [shortageData, setShortageData] = useState(null);
  const [vendors, setVendors] = useState([]);

  // PO Dialog states
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [creatingPO, setCreatingPO] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      if (isMounted) {
        await fetchVendors();
        await fetchData();
      }
    };
    
    loadInitialData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchVendors = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/vendors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (err) {
      logger.error('Error fetching vendors:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    try {
      // Build query params
      const projParams = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        shortage_only: shortageOnly.toString(),
      });
      if (selectedVendorId) {
        projParams.append('vendor_id', selectedVendorId);
      }

      const [projResponse, shortageResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/inventory/projections?${projParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/inventory/shortages?days_ahead=30&group_by_vendor=true`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
      ]);

      if (projResponse.ok) {
        setProjectionData(await projResponse.json());
      } else {
        setError('Failed to load projections');
      }

      if (shortageResponse.ok) {
        setShortageData(await shortageResponse.json());
      }
    } catch (err) {
      setError('Error loading projections: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePOFromVendor = async (vendorId) => {
    setCreatingPO(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(
        `${API_BASE_URL}/purchase-orders/from-shortages?vendor_id=${vendorId}&days_ahead=30`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.created) {
          setSuccess(`Created PO ${result.po_number} with ${result.item_count} items ($${result.total_estimated_cost})`);
          fetchData(); // Refresh
        } else {
          setError(result.message);
        }
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Failed to create PO');
      }
    } catch (err) {
      setError('Error creating PO: ' + err.message);
    } finally {
      setCreatingPO(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return 'error';
      case 'urgent': return 'warning';
      case 'warning': return 'info';
      default: return 'success';
    }
  };

  const getUrgencyBgColor = (urgency) => {
    switch (urgency) {
      case 'critical': return '#ffebee';
      case 'urgent': return '#fff3e0';
      case 'warning': return '#e3f2fd';
      default: return 'transparent';
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
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5">Inventory Projections</Typography>
        <Button startIcon={<RefreshIcon />} onClick={fetchData} variant="outlined">
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Filter Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Start Date"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <TextField
            label="End Date"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Vendor Filter</InputLabel>
            <Select
              value={selectedVendorId}
              label="Vendor Filter"
              onChange={(e) => setSelectedVendorId(e.target.value)}
            >
              <MenuItem value="">All Vendors</MenuItem>
              {vendors.map((v) => (
                <MenuItem key={v.id} value={v.id}>{v.vendor_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={shortageOnly}
                onChange={(e) => setShortageOnly(e.target.checked)}
              />
            }
            label="Shortages Only"
          />
          <Button variant="contained" onClick={fetchData} startIcon={<FilterListIcon />}>
            Apply Filters
          </Button>
        </Box>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: projectionData?.summary?.critical > 0 ? '#ffebee' : '#e8f5e9' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon color={projectionData?.summary?.critical > 0 ? 'error' : 'success'} />
                <Typography variant="h4">{projectionData?.summary?.critical || 0}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Critical - Order Now</Typography>
              <Typography variant="caption">Order by date is today or past</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: projectionData?.summary?.urgent > 0 ? '#fff3e0' : '#e3f2fd' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color={projectionData?.summary?.urgent > 0 ? 'warning' : 'info'} />
                <Typography variant="h4">{projectionData?.summary?.urgent || 0}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Urgent - Within 7 Days</Typography>
              <Typography variant="caption">Need to order soon</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#e3f2fd' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingDownIcon color="info" />
                <Typography variant="h4">{projectionData?.summary?.shortage_count || 0}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Total Shortages</Typography>
              <Typography variant="caption">Items that will be short</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon color="action" />
                <Typography variant="h4">{projectionData?.summary?.total_items || 0}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Total Items Tracked</Typography>
              <Typography variant="caption">
                {projectionData?.date_range?.start} to {projectionData?.date_range?.end}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Shortages by Vendor - Quick PO Creation */}
      {shortageData?.by_vendor && shortageData.by_vendor.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShippingIcon /> Shortages by Vendor
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create purchase orders directly from shortage data
          </Typography>

          {shortageData.by_vendor.map((vendor) => (
            <Accordion key={vendor.vendor_id || 'none'} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', minWidth: 200 }}>
                    {vendor.vendor_name}
                  </Typography>
                  <Chip
                    label={`${vendor.total_items} items`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Est. Cost: {formatCurrency(vendor.total_estimated_cost)}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  {vendor.vendor_id && (
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<ShoppingCartIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreatePOFromVendor(vendor.vendor_id);
                      }}
                      disabled={creatingPO}
                    >
                      Create PO
                    </Button>
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Urgency</TableCell>
                        <TableCell>Item ID</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">In Stock</TableCell>
                        <TableCell align="right">Needed</TableCell>
                        <TableCell align="right">Shortage</TableCell>
                        <TableCell>First Needed</TableCell>
                        <TableCell>Order By</TableCell>
                        <TableCell align="right">Est. Cost</TableCell>
                        <TableCell>Affected Jobs</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {vendor.items.map((item) => (
                        <TableRow
                          key={item.inventory_id}
                          sx={{ bgcolor: getUrgencyBgColor(item.urgency) }}
                        >
                          <TableCell>
                            <Chip
                              label={item.urgency}
                              size="small"
                              color={getUrgencyColor(item.urgency)}
                            />
                          </TableCell>
                          <TableCell>{item.item_id}</TableCell>
                          <TableCell>{item.description?.substring(0, 35)}...</TableCell>
                          <TableCell align="right">{item.qty_available}</TableCell>
                          <TableCell align="right">{item.total_needed}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                            {item.shortage_qty}
                          </TableCell>
                          <TableCell>{item.first_needed_date}</TableCell>
                          <TableCell sx={{ fontWeight: item.urgency === 'critical' ? 'bold' : 'normal' }}>
                            {item.order_by_date}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(item.estimated_cost)}</TableCell>
                          <TableCell>
                            {item.affected_jobs?.slice(0, 3).join(', ')}
                            {item.affected_jobs?.length > 3 && ` +${item.affected_jobs.length - 3} more`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Detailed Projections Table */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Detailed Projections
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          All materials needed for scheduled jobs in the selected date range
        </Typography>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell align="right">Current Stock</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell align="right">Still Needed</TableCell>
                <TableCell align="right">Shortage</TableCell>
                <TableCell>First Needed</TableCell>
                <TableCell>Order By</TableCell>
                <TableCell>Jobs</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projectionData?.projections?.map((proj) => (
                <TableRow
                  key={proj.inventory_id}
                  sx={{
                    bgcolor: getUrgencyBgColor(proj.urgency),
                  }}
                >
                  <TableCell>
                    {proj.urgency === 'ok' ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : (
                      <Chip
                        label={proj.urgency}
                        size="small"
                        color={getUrgencyColor(proj.urgency)}
                      />
                    )}
                  </TableCell>
                  <TableCell>{proj.item_id}</TableCell>
                  <TableCell>{proj.description?.substring(0, 30)}...</TableCell>
                  <TableCell>{proj.vendor_name || '-'}</TableCell>
                  <TableCell align="right">{proj.current_stock}</TableCell>
                  <TableCell align="right">{proj.qty_available}</TableCell>
                  <TableCell align="right">{proj.still_needed}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: proj.shortage_qty > 0 ? 'bold' : 'normal',
                      color: proj.shortage_qty > 0 ? 'error.main' : 'inherit',
                    }}
                  >
                    {proj.shortage_qty > 0 ? proj.shortage_qty : '-'}
                  </TableCell>
                  <TableCell>{proj.first_needed_date}</TableCell>
                  <TableCell
                    sx={{
                      fontWeight: proj.urgency === 'critical' ? 'bold' : 'normal',
                      color: proj.urgency === 'critical' ? 'error.main' : 'inherit',
                    }}
                  >
                    {proj.order_by_date || '-'}
                  </TableCell>
                  <TableCell>
                    {proj.work_orders?.length > 0 && (
                      <Tooltip title={proj.work_orders.join(', ')}>
                        <Chip
                          label={`${proj.work_orders.length} job${proj.work_orders.length > 1 ? 's' : ''}`}
                          size="small"
                          variant="outlined"
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!projectionData?.projections || projectionData.projections.length === 0) && (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No materials projected for the selected date range
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}

export default InventoryProjectionsReport;
