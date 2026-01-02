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
  Tabs,
  Tab,
  Chip,
  Button,
  LinearProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  TrendingDown as TrendingDownIcon,
  Inventory as InventoryIcon,
  Refresh as RefreshIcon,
  ShoppingCart as ShoppingCartIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';
import CycleCountExecutionDialog from '../CycleCountExecutionDialog';
import CycleCountSettingsDialog from '../CycleCountSettingsDialog';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function InventoryAnalyticsReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);

  // Data states
  const [stockoutData, setStockoutData] = useState(null);
  const [reorderData, setReorderData] = useState(null);
  const [abcData, setAbcData] = useState(null);
  const [cycleCountData, setCycleCountData] = useState(null);
  const [deadStockData, setDeadStockData] = useState(null);
  const [shrinkageData, setShrinkageData] = useState(null);

  // Dialog states
  const [cycleCountDialogOpen, setCycleCountDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleStartCount = (item) => {
    setSelectedItem(item);
    setCycleCountDialogOpen(true);
  };

  const handleCountSuccess = () => {
    setCycleCountDialogOpen(false);
    setSelectedItem(null);
    fetchAllData(); // Refresh all data
  };

  const handleSettingsSuccess = () => {
    fetchAllData(); // Refresh all data after settings change
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    try {
      const [stockout, reorder, abc, cycleCount, deadStock, shrinkage] = await Promise.all([
        fetch(`${API_BASE_URL}/inventory/stockout-predictions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/inventory/reorder-suggestions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/inventory/abc-analysis`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/inventory/cycle-count-due`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/reports/dead-stock`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/reports/shrinkage-analysis`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (stockout.ok) setStockoutData(await stockout.json());
      if (reorder.ok) setReorderData(await reorder.json());
      if (abc.ok) setAbcData(await abc.json());
      if (cycleCount.ok) setCycleCountData(await cycleCount.json());
      if (deadStock.ok) setDeadStockData(await deadStock.json());
      if (shrinkage.ok) setShrinkageData(await shrinkage.json());
    } catch (err) {
      setError('Error loading analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateABC = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/update-abc-classifications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchAllData();
      }
    } catch (err) {
      setError('Failed to update ABC classifications');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'CRITICAL': return 'error';
      case 'LOW': return 'warning';
      case 'WARNING': return 'info';
      case 'MONITOR': return 'default';
      default: return 'success';
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'IMMEDIATE': return 'error';
      case 'URGENT': return 'warning';
      case 'SOON': return 'info';
      default: return 'default';
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
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Inventory Analytics</Typography>
        <Button startIcon={<RefreshIcon />} onClick={fetchAllData} variant="outlined">
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: stockoutData?.summary?.critical > 0 ? '#ffebee' : '#e8f5e9' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon color={stockoutData?.summary?.critical > 0 ? 'error' : 'success'} />
                <Typography variant="h4">{stockoutData?.summary?.total_at_risk || 0}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Items at Risk</Typography>
              <Typography variant="caption">
                {stockoutData?.summary?.critical || 0} critical, {stockoutData?.summary?.low || 0} low
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: reorderData?.summary?.immediate_count > 0 ? '#fff3e0' : '#e3f2fd' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShoppingCartIcon color={reorderData?.summary?.immediate_count > 0 ? 'warning' : 'info'} />
                <Typography variant="h4">{reorderData?.summary?.total_items || 0}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Need Reordering</Typography>
              <Typography variant="caption">
                Est. Cost: {formatCurrency(reorderData?.summary?.total_estimated_cost)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: cycleCountData?.summary?.overdue > 0 ? '#fce4ec' : '#f3e5f5' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon color={cycleCountData?.summary?.overdue > 0 ? 'error' : 'secondary'} />
                <Typography variant="h4">{cycleCountData?.summary?.overdue || 0}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Counts Overdue</Typography>
              <Typography variant="caption">
                {cycleCountData?.summary?.due_this_week || 0} due this week
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#fff8e1' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingDownIcon color="warning" />
                <Typography variant="h4">{deadStockData?.summary?.total_items || 0}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Dead Stock Items</Typography>
              <Typography variant="caption">
                Value: {formatCurrency(deadStockData?.summary?.total_value)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} variant="scrollable">
          <Tab label="Stockout Predictions" icon={<WarningIcon />} iconPosition="start" />
          <Tab label="Reorder Suggestions" icon={<ShoppingCartIcon />} iconPosition="start" />
          <Tab label="ABC Analysis" icon={<AssessmentIcon />} iconPosition="start" />
          <Tab label="Cycle Counts" icon={<InventoryIcon />} iconPosition="start" />
          <Tab label="Dead Stock" icon={<TrendingDownIcon />} iconPosition="start" />
          <Tab label="Shrinkage" icon={<ErrorIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={currentTab} index={0}>
        <Typography variant="h6" gutterBottom>Stockout Risk Analysis</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Items at risk of stocking out based on 90-day usage velocity
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell align="right">Daily Usage</TableCell>
                <TableCell align="right">Days Until Stockout</TableCell>
                <TableCell>Risk Level</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stockoutData?.predictions?.slice(0, 20).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.item_id}</TableCell>
                  <TableCell>{item.description?.substring(0, 40)}...</TableCell>
                  <TableCell align="right">{item.qty_available}</TableCell>
                  <TableCell align="right">{parseFloat(item.avg_daily_usage || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{item.days_until_stockout || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip label={item.risk_level} color={getRiskColor(item.risk_level)} size="small" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        <Typography variant="h6" gutterBottom>Reorder Suggestions</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Items below minimum stock with suggested order quantities
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Current</TableCell>
                <TableCell align="right">Min Stock</TableCell>
                <TableCell align="right">Suggested Qty</TableCell>
                <TableCell align="right">Est. Cost</TableCell>
                <TableCell>Urgency</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reorderData?.reorder_suggestions?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.item_id}</TableCell>
                  <TableCell>{item.description?.substring(0, 40)}...</TableCell>
                  <TableCell align="right">{item.qty_available}</TableCell>
                  <TableCell align="right">{item.min_stock}</TableCell>
                  <TableCell align="right">{item.suggested_order_qty}</TableCell>
                  <TableCell align="right">{formatCurrency(item.estimated_order_cost)}</TableCell>
                  <TableCell>
                    <Chip label={item.urgency} color={getUrgencyColor(item.urgency)} size="small" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <div>
            <Typography variant="h6" gutterBottom>ABC Classification</Typography>
            <Typography variant="body2" color="text.secondary">
              Items classified by value and usage (A=80%, B=15%, C=5% of total value)
            </Typography>
          </div>
          <Button variant="contained" onClick={handleUpdateABC}>
            Update Classifications
          </Button>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={4}>
            <Card sx={{ bgcolor: '#e3f2fd' }}>
              <CardContent>
                <Typography variant="h6">Class A</Typography>
                <Typography variant="h4">{abcData?.summary?.a_class?.count || 0}</Typography>
                <Typography variant="body2">Value: {formatCurrency(abcData?.summary?.a_class?.total_value)}</Typography>
                <Chip label="Count Weekly" size="small" color="primary" sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card sx={{ bgcolor: '#fff3e0' }}>
              <CardContent>
                <Typography variant="h6">Class B</Typography>
                <Typography variant="h4">{abcData?.summary?.b_class?.count || 0}</Typography>
                <Typography variant="body2">Value: {formatCurrency(abcData?.summary?.b_class?.total_value)}</Typography>
                <Chip label="Count Monthly" size="small" color="warning" sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card sx={{ bgcolor: '#f5f5f5' }}>
              <CardContent>
                <Typography variant="h6">Class C</Typography>
                <Typography variant="h4">{abcData?.summary?.c_class?.count || 0}</Typography>
                <Typography variant="body2">Value: {formatCurrency(abcData?.summary?.c_class?.total_value)}</Typography>
                <Chip label="Count Quarterly" size="small" sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Class</TableCell>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Cost</TableCell>
                <TableCell align="right">Total Value</TableCell>
                <TableCell>Count Frequency</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {abcData?.items?.slice(0, 30).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Chip
                      label={item.abc_class}
                      size="small"
                      color={item.abc_class === 'A' ? 'primary' : item.abc_class === 'B' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{item.item_id}</TableCell>
                  <TableCell>{item.description?.substring(0, 40)}...</TableCell>
                  <TableCell align="right">{item.qty}</TableCell>
                  <TableCell align="right">{formatCurrency(item.cost)}</TableCell>
                  <TableCell align="right">{formatCurrency(item.total_value)}</TableCell>
                  <TableCell>{item.suggested_count_frequency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={currentTab} index={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <div>
            <Typography variant="h6" gutterBottom>Cycle Count Schedule</Typography>
            <Typography variant="body2" color="text.secondary">
              Items due for physical inventory counts - click to start a count
            </Typography>
          </div>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setSettingsDialogOpen(true)}
          >
            Count Settings
          </Button>
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Action</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>ABC Class</TableCell>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Location</TableCell>
                <TableCell align="right">System Qty</TableCell>
                <TableCell>Last Counted</TableCell>
                <TableCell>Next Count Due</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cycleCountData?.items?.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Tooltip title="Start Cycle Count">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleStartCount(item)}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.count_status}
                      size="small"
                      color={item.count_status === 'Overdue' ? 'error' : item.count_status === 'Due This Week' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {item.abc_class ? (
                      <Chip
                        label={item.abc_class}
                        size="small"
                        color={item.abc_class === 'A' ? 'primary' : item.abc_class === 'B' ? 'warning' : 'default'}
                      />
                    ) : '-'}
                  </TableCell>
                  <TableCell>{item.item_id}</TableCell>
                  <TableCell>{item.description?.substring(0, 35)}...</TableCell>
                  <TableCell>{item.location || '-'}</TableCell>
                  <TableCell align="right">{item.qty}</TableCell>
                  <TableCell>{item.last_counted_date || 'Never'}</TableCell>
                  <TableCell>{item.next_count_date || 'Not Scheduled'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={currentTab} index={4}>
        <Typography variant="h6" gutterBottom>Dead / Slow-Moving Stock</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Items with no usage in the last 6 months - candidates for disposal or return
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Location</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Value</TableCell>
                <TableCell>Last Used</TableCell>
                <TableCell>Recommendation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deadStockData?.dead_stock?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.item_id}</TableCell>
                  <TableCell>{item.description?.substring(0, 35)}...</TableCell>
                  <TableCell>{item.location || '-'}</TableCell>
                  <TableCell align="right">{item.qty}</TableCell>
                  <TableCell align="right">{formatCurrency(item.inventory_value)}</TableCell>
                  <TableCell>{item.last_used_date || 'Never'}</TableCell>
                  <TableCell>
                    <Chip label={item.recommendation} size="small" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={currentTab} index={5}>
        <Typography variant="h6" gutterBottom>Shrinkage Analysis</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Inventory variance analysis to identify potential loss, theft, or process issues
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ bgcolor: '#ffebee' }}>
              <CardContent>
                <Typography variant="h6">Total Shrinkage</Typography>
                <Typography variant="h4" color="error">
                  {formatCurrency(shrinkageData?.summary?.total_shrinkage_value)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ bgcolor: '#e8f5e9' }}>
              <CardContent>
                <Typography variant="h6">Total Overage</Typography>
                <Typography variant="h4" color="success.main">
                  {formatCurrency(shrinkageData?.summary?.total_overage_value)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Net Variance</Typography>
                <Typography variant="h4">
                  {formatCurrency(shrinkageData?.summary?.net_variance_value)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Shrinkage by Location</Typography>
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Location</TableCell>
                <TableCell align="right">Items</TableCell>
                <TableCell align="right">Shortages</TableCell>
                <TableCell align="right">Overages</TableCell>
                <TableCell align="right">Shrinkage Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shrinkageData?.by_location?.map((loc, idx) => (
                <TableRow key={idx}>
                  <TableCell>{loc.location}</TableCell>
                  <TableCell align="right">{loc.item_count}</TableCell>
                  <TableCell align="right">{loc.items_with_shortage}</TableCell>
                  <TableCell align="right">{loc.items_with_overage}</TableCell>
                  <TableCell align="right" sx={{ color: parseFloat(loc.shrinkage_value) < 0 ? 'error.main' : 'inherit' }}>
                    {formatCurrency(Math.abs(loc.shrinkage_value))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>Items with Highest Shrinkage</Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Risk</TableCell>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Location</TableCell>
                <TableCell align="right">Variance</TableCell>
                <TableCell align="right">Value Lost</TableCell>
                <TableCell>Last Counted</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shrinkageData?.worst_items?.slice(0, 15).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Chip
                      label={item.risk_level}
                      size="small"
                      color={item.risk_level === 'HIGH' ? 'error' : item.risk_level === 'MEDIUM' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{item.item_id}</TableCell>
                  <TableCell>{item.description?.substring(0, 30)}...</TableCell>
                  <TableCell>{item.location || '-'}</TableCell>
                  <TableCell align="right">{item.count_variance}</TableCell>
                  <TableCell align="right" sx={{ color: 'error.main' }}>
                    {formatCurrency(Math.abs(item.variance_value))}
                  </TableCell>
                  <TableCell>{item.last_counted_date || 'Never'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Cycle Count Execution Dialog */}
      <CycleCountExecutionDialog
        open={cycleCountDialogOpen}
        onClose={() => {
          setCycleCountDialogOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onSuccess={handleCountSuccess}
      />

      {/* Cycle Count Settings Dialog */}
      <CycleCountSettingsDialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        onSuccess={handleSettingsSuccess}
      />
    </Box>
  );
}

export default InventoryAnalyticsReport;
