import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Button,
  Grid,
  Chip,
  IconButton,
  InputAdornment,
  Collapse,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Home as HomeIcon,
  Palette as PaletteIcon,
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  Work as WorkIcon,
  People as PeopleIcon,
  CalendarMonth as CalendarIcon,
  Assessment as ReportsIcon,
  AccessTime as TimeIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Send as SendIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import AppHeader from './AppHeader';
import {
  getUserSettings,
  updateUserSettings,
  getCommunicationSettings,
  saveEmailSettings,
  testEmailSettings,
  saveSmsSettings,
  testSmsSettings,
  saveSmsGatewaySettings,
  testSmsGatewaySettings,
  deleteCommunicationSetting,
  getCurrentUser,
} from '../api';
import logger from '../utils/logger';

const DEFAULT_PAGES = [
  { value: '/home', label: 'Dashboard', icon: <DashboardIcon /> },
  { value: '/inventory', label: 'Inventory', icon: <InventoryIcon /> },
  { value: '/work-orders', label: 'Work Orders', icon: <WorkIcon /> },
  { value: '/customers', label: 'Customers', icon: <PeopleIcon /> },
  { value: '/schedule', label: 'Schedule', icon: <CalendarIcon /> },
  { value: '/reports', label: 'Reports', icon: <ReportsIcon /> },
  { value: '/time-entry', label: 'Time Entry', icon: <TimeIcon /> },
];

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const [settings, setSettings] = useState({
    theme: 'light',
    default_page: '/home',
  });

  // Communication settings state
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [smsExpanded, setSmsExpanded] = useState(false);
  const [commSettings, setCommSettings] = useState({
    email: null,
    sms_gateway: null,
    sms_twilio: null,
    twilio_available: false,
    carriers: []
  });
  const [emailForm, setEmailForm] = useState({
    host: 'smtp.gmail.com',
    port: 587,
    username: '',
    password: '',
    use_tls: true,
    use_ssl: false,
    from_name: 'MA Electrical',
    from_email: '',
    is_active: true,
  });
  // SMS Gateway settings (free - uses email)
  const [smsGatewayForm, setSmsGatewayForm] = useState({
    is_active: true,
  });
  // Twilio settings (paid - optional)
  const [smsTwilioForm, setSmsTwilioForm] = useState({
    account_sid: '',
    auth_token: '',
    from_number: '',
    is_active: false,
  });
  const [showTwilioSettings, setShowTwilioSettings] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingSmsGateway, setSavingSmsGateway] = useState(false);
  const [savingSmsTwilio, setSavingSmsTwilio] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSmsGateway, setTestingSmsGateway] = useState(false);
  const [testingSmsTwilio, setTestingSmsTwilio] = useState(false);
  const [testEmailDialog, setTestEmailDialog] = useState(false);
  const [testSmsGatewayDialog, setTestSmsGatewayDialog] = useState(false);
  const [testSmsTwilioDialog, setTestSmsTwilioDialog] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testCarrier, setTestCarrier] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Load user settings
      const data = await getUserSettings();
      setSettings({
        theme: data.theme || 'light',
        default_page: data.default_page || '/home',
      });

      // Load user info to check role
      try {
        const user = await getCurrentUser();
        setUserRole(user.role);

        // Load communication settings if admin or manager
        if (user.role === 'admin' || user.role === 'manager') {
          await loadCommunicationSettings();
        }
      } catch (err) {
        logger.log('Could not load user info');
      }
    } catch (err) {
      logger.log('Using default settings');
    } finally {
      setLoading(false);
    }
  };

  const loadCommunicationSettings = async () => {
    try {
      const data = await getCommunicationSettings();
      setCommSettings(data);

      // Populate forms with existing config
      if (data.email?.config) {
        setEmailForm(prev => ({
          ...prev,
          ...data.email.config,
          password: '', // Don't show masked password
          is_active: data.email.is_active,
        }));
      }
      // SMS Gateway settings
      if (data.sms_gateway) {
        setSmsGatewayForm({
          is_active: data.sms_gateway.is_active,
        });
      }
      // Twilio settings
      if (data.sms_twilio?.config) {
        setSmsTwilioForm(prev => ({
          ...prev,
          ...data.sms_twilio.config,
          auth_token: '', // Don't show masked token
          is_active: data.sms_twilio.is_active,
        }));
        setShowTwilioSettings(true);
      }
    } catch (err) {
      logger.log('Could not load communication settings');
    }
  };

  const handleSettingChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      setSaving(true);
      setError(null);
      await updateUserSettings(newSettings);
      setSuccess('Settings saved');

      if (key === 'theme') {
        applyTheme(value);
      }

      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to save settings');
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const applyTheme = (theme) => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleThemeToggle = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    handleSettingChange('theme', newTheme);
  };

  const handleSaveEmailSettings = async () => {
    try {
      setSavingEmail(true);
      setError(null);
      await saveEmailSettings(emailForm);
      setSuccess('Email settings saved successfully');
      await loadCommunicationSettings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save email settings: ' + err.message);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      setError('Please enter an email address');
      return;
    }
    try {
      setTestingEmail(true);
      setError(null);
      const result = await testEmailSettings(testEmailAddress);
      if (result.success) {
        setSuccess(result.message);
        setTestEmailDialog(false);
        await loadCommunicationSettings();
      } else {
        setError(result.message);
      }
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Test failed: ' + err.message);
    } finally {
      setTestingEmail(false);
    }
  };

  // SMS Gateway handlers (free email-based SMS)
  const handleSaveSmsGatewaySettings = async () => {
    try {
      setSavingSmsGateway(true);
      setError(null);
      await saveSmsGatewaySettings(smsGatewayForm);
      setSuccess('SMS Gateway enabled! Text messages will be sent via your email settings.');
      await loadCommunicationSettings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save SMS Gateway settings: ' + err.message);
    } finally {
      setSavingSmsGateway(false);
    }
  };

  const handleTestSmsGateway = async () => {
    if (!testPhoneNumber) {
      setError('Please enter a phone number');
      return;
    }
    if (!testCarrier) {
      setError('Please select your carrier');
      return;
    }
    try {
      setTestingSmsGateway(true);
      setError(null);
      const result = await testSmsGatewaySettings(testPhoneNumber, testCarrier);
      if (result.success) {
        setSuccess(result.message);
        setTestSmsGatewayDialog(false);
        await loadCommunicationSettings();
      } else {
        setError(result.message);
      }
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Test failed: ' + err.message);
    } finally {
      setTestingSmsGateway(false);
    }
  };

  // Twilio handlers (paid SMS service)
  const handleSaveSmsTwilioSettings = async () => {
    try {
      setSavingSmsTwilio(true);
      setError(null);
      await saveSmsSettings(smsTwilioForm);
      setSuccess('Twilio SMS settings saved successfully');
      await loadCommunicationSettings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save Twilio settings: ' + err.message);
    } finally {
      setSavingSmsTwilio(false);
    }
  };

  const handleTestSmsTwilio = async () => {
    if (!testPhoneNumber) {
      setError('Please enter a phone number');
      return;
    }
    try {
      setTestingSmsTwilio(true);
      setError(null);
      const result = await testSmsSettings(testPhoneNumber);
      if (result.success) {
        setSuccess(result.message);
        setTestSmsTwilioDialog(false);
        await loadCommunicationSettings();
      } else {
        setError(result.message);
      }
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Test failed: ' + err.message);
    } finally {
      setTestingSmsTwilio(false);
    }
  };

  const handleDeleteEmailSettings = async () => {
    if (!window.confirm('Are you sure you want to delete email settings?')) return;
    try {
      await deleteCommunicationSetting('email');
      setSuccess('Email settings deleted');
      setEmailForm({
        host: 'smtp.gmail.com',
        port: 587,
        username: '',
        password: '',
        use_tls: true,
        use_ssl: false,
        from_name: 'MA Electrical',
        from_email: '',
        is_active: true,
      });
      await loadCommunicationSettings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to delete: ' + err.message);
    }
  };

  const handleDeleteSmsSettings = async () => {
    if (!window.confirm('Are you sure you want to delete all SMS settings (Gateway and Twilio)?')) return;
    try {
      await deleteCommunicationSetting('sms');
      setSuccess('SMS settings deleted');
      setSmsGatewayForm({ is_active: true });
      setSmsTwilioForm({
        account_sid: '',
        auth_token: '',
        from_number: '',
        is_active: false,
      });
      setShowTwilioSettings(false);
      await loadCommunicationSettings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to delete: ' + err.message);
    }
  };

  const getStatusChip = (setting) => {
    if (!setting) {
      return <Chip label="Not Configured" size="small" color="default" />;
    }
    if (!setting.is_active) {
      return <Chip label="Disabled" size="small" color="warning" />;
    }
    if (setting.test_status === 'success') {
      return <Chip label="Active" size="small" color="success" icon={<CheckIcon />} />;
    }
    if (setting.test_status === 'failed') {
      return <Chip label="Test Failed" size="small" color="error" icon={<ErrorIcon />} />;
    }
    return <Chip label="Not Tested" size="small" color="info" />;
  };

  const isAdminOrManager = userRole === 'admin' || userRole === 'manager';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppHeader title="Settings" />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppHeader title="Settings" />

      <Box sx={{ flex: 1, overflow: 'auto', p: 3, bgcolor: 'grey.100' }}>
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          {/* Alerts */}
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

          {/* Appearance Settings */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaletteIcon /> Appearance
              </Typography>
            </Box>
            <List>
              <ListItem>
                <ListItemIcon>
                  {settings.theme === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
                </ListItemIcon>
                <ListItemText
                  primary="Dark Mode"
                  secondary={settings.theme === 'dark' ? 'Dark theme is enabled' : 'Light theme is enabled'}
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.theme === 'dark'}
                    onChange={handleThemeToggle}
                    disabled={saving}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>

          {/* Navigation Settings */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HomeIcon /> Navigation
              </Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Default Landing Page</InputLabel>
                <Select
                  value={settings.default_page}
                  label="Default Landing Page"
                  onChange={(e) => handleSettingChange('default_page', e.target.value)}
                  disabled={saving}
                >
                  {DEFAULT_PAGES.map((page) => (
                    <MenuItem key={page.value} value={page.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {page.icon}
                        {page.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This page will open when you log in or click the Home button.
              </Typography>
            </Box>
          </Paper>

          {/* Communication Settings - Admin/Manager Only */}
          {isAdminOrManager && (
            <>
              {/* Email Settings */}
              <Paper sx={{ mb: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'primary.main',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setEmailExpanded(!emailExpanded)}
                >
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon /> Email Settings (SMTP)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusChip(commSettings.email)}
                    {emailExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </Box>
                </Box>
                <Collapse in={emailExpanded}>
                  <Box sx={{ p: 3 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={8}>
                        <TextField
                          fullWidth
                          label="SMTP Server"
                          value={emailForm.host}
                          onChange={(e) => setEmailForm({ ...emailForm, host: e.target.value })}
                          placeholder="smtp.gmail.com"
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          label="Port"
                          type="number"
                          value={emailForm.port}
                          onChange={(e) => setEmailForm({ ...emailForm, port: parseInt(e.target.value) || 587 })}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Username (Email)"
                          value={emailForm.username}
                          onChange={(e) => setEmailForm({ ...emailForm, username: e.target.value })}
                          placeholder="your-email@gmail.com"
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Password / App Password"
                          type={showPassword ? 'text' : 'password'}
                          value={emailForm.password}
                          onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                          placeholder={commSettings.email ? '(unchanged)' : 'Enter password'}
                          size="small"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  size="small"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="From Name"
                          value={emailForm.from_name}
                          onChange={(e) => setEmailForm({ ...emailForm, from_name: e.target.value })}
                          placeholder="MA Electrical"
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="From Email"
                          value={emailForm.from_email}
                          onChange={(e) => setEmailForm({ ...emailForm, from_email: e.target.value })}
                          placeholder="quotes@maelectrical.com"
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={emailForm.use_tls}
                                onChange={(e) => setEmailForm({ ...emailForm, use_tls: e.target.checked, use_ssl: false })}
                              />
                            }
                            label="Use TLS (Port 587)"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={emailForm.use_ssl}
                                onChange={(e) => setEmailForm({ ...emailForm, use_ssl: e.target.checked, use_tls: false })}
                              />
                            }
                            label="Use SSL (Port 465)"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={emailForm.is_active}
                                onChange={(e) => setEmailForm({ ...emailForm, is_active: e.target.checked })}
                              />
                            }
                            label="Enable Email Sending"
                          />
                        </Box>
                      </Grid>
                      {commSettings.email?.test_message && (
                        <Grid item xs={12}>
                          <Alert severity={commSettings.email.test_status === 'success' ? 'success' : 'error'}>
                            Last test: {commSettings.email.test_message}
                            {commSettings.email.last_tested_at && (
                              <Typography variant="caption" display="block">
                                {new Date(commSettings.email.last_tested_at).toLocaleString()}
                              </Typography>
                            )}
                          </Alert>
                        </Grid>
                      )}
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                          {commSettings.email && (
                            <Button
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={handleDeleteEmailSettings}
                            >
                              Delete
                            </Button>
                          )}
                          <Button
                            variant="outlined"
                            startIcon={<SendIcon />}
                            onClick={() => setTestEmailDialog(true)}
                            disabled={!commSettings.email}
                          >
                            Send Test
                          </Button>
                          <Button
                            variant="contained"
                            onClick={handleSaveEmailSettings}
                            disabled={savingEmail}
                            startIcon={savingEmail ? <CircularProgress size={20} /> : null}
                          >
                            {savingEmail ? 'Saving...' : 'Save Email Settings'}
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      For Gmail, use an App Password (not your regular password). Go to Google Account &gt; Security &gt; 2-Step Verification &gt; App passwords.
                    </Typography>
                  </Box>
                </Collapse>
              </Paper>

              {/* SMS Settings */}
              <Paper sx={{ mb: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'primary.main',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSmsExpanded(!smsExpanded)}
                >
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SmsIcon /> SMS / Text Message Settings
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusChip(commSettings.sms_gateway)}
                    {smsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </Box>
                </Box>
                <Collapse in={smsExpanded}>
                  <Box sx={{ p: 3 }}>
                    {/* SMS Gateway (Free - Primary Option) */}
                    <Box sx={{ mb: 3, p: 2, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip label="FREE" size="small" color="success" />
                        Email-to-SMS Gateway (Recommended)
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Send text messages using your email settings - no extra accounts needed! Works with AT&T, Verizon, T-Mobile, and most US carriers.
                      </Typography>

                      {!commSettings.email ? (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          Configure your email settings above first, then you can enable SMS messaging.
                        </Alert>
                      ) : (
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={smsGatewayForm.is_active}
                                  onChange={(e) => setSmsGatewayForm({ ...smsGatewayForm, is_active: e.target.checked })}
                                />
                              }
                              label="Enable SMS via Email Gateway"
                            />
                          </Grid>
                          {commSettings.sms_gateway?.test_message && (
                            <Grid item xs={12}>
                              <Alert severity={commSettings.sms_gateway.test_status === 'success' ? 'success' : 'error'}>
                                Last test: {commSettings.sms_gateway.test_message}
                                {commSettings.sms_gateway.last_tested_at && (
                                  <Typography variant="caption" display="block">
                                    {new Date(commSettings.sms_gateway.last_tested_at).toLocaleString()}
                                  </Typography>
                                )}
                              </Alert>
                            </Grid>
                          )}
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                              <Button
                                variant="outlined"
                                startIcon={<SendIcon />}
                                onClick={() => setTestSmsGatewayDialog(true)}
                                disabled={!commSettings.sms_gateway}
                              >
                                Send Test
                              </Button>
                              <Button
                                variant="contained"
                                color="success"
                                onClick={handleSaveSmsGatewaySettings}
                                disabled={savingSmsGateway}
                                startIcon={savingSmsGateway ? <CircularProgress size={20} /> : null}
                              >
                                {savingSmsGateway ? 'Enabling...' : (commSettings.sms_gateway ? 'Update Gateway' : 'Enable SMS Gateway')}
                              </Button>
                            </Box>
                          </Grid>
                        </Grid>
                      )}
                    </Box>

                    {/* Twilio (Paid - Optional) */}
                    <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', mb: 1 }}
                        onClick={() => setShowTwilioSettings(!showTwilioSettings)}
                      >
                        <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label="PAID" size="small" color="default" variant="outlined" />
                          Twilio SMS (Optional Alternative)
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {commSettings.sms_twilio && getStatusChip(commSettings.sms_twilio)}
                          {showTwilioSettings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </Box>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Use Twilio for professional SMS delivery. Requires a Twilio account.
                      </Typography>

                      <Collapse in={showTwilioSettings}>
                        {!commSettings.twilio_available ? (
                          <Alert severity="info">
                            Twilio library will be available after the next server restart.
                          </Alert>
                        ) : (
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                label="Twilio Account SID"
                                value={smsTwilioForm.account_sid}
                                onChange={(e) => setSmsTwilioForm({ ...smsTwilioForm, account_sid: e.target.value })}
                                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                size="small"
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                label="Auth Token"
                                type={showAuthToken ? 'text' : 'password'}
                                value={smsTwilioForm.auth_token}
                                onChange={(e) => setSmsTwilioForm({ ...smsTwilioForm, auth_token: e.target.value })}
                                placeholder={commSettings.sms_twilio ? '(unchanged)' : 'Enter auth token'}
                                size="small"
                                InputProps={{
                                  endAdornment: (
                                    <InputAdornment position="end">
                                      <IconButton
                                        size="small"
                                        onClick={() => setShowAuthToken(!showAuthToken)}
                                      >
                                        {showAuthToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                      </IconButton>
                                    </InputAdornment>
                                  ),
                                }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                label="From Phone Number"
                                value={smsTwilioForm.from_number}
                                onChange={(e) => setSmsTwilioForm({ ...smsTwilioForm, from_number: e.target.value })}
                                placeholder="+1234567890"
                                size="small"
                                helperText="Your Twilio phone number in E.164 format"
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={smsTwilioForm.is_active}
                                    onChange={(e) => setSmsTwilioForm({ ...smsTwilioForm, is_active: e.target.checked })}
                                  />
                                }
                                label="Enable Twilio SMS"
                              />
                            </Grid>
                            {commSettings.sms_twilio?.test_message && (
                              <Grid item xs={12}>
                                <Alert severity={commSettings.sms_twilio.test_status === 'success' ? 'success' : 'error'}>
                                  Last test: {commSettings.sms_twilio.test_message}
                                  {commSettings.sms_twilio.last_tested_at && (
                                    <Typography variant="caption" display="block">
                                      {new Date(commSettings.sms_twilio.last_tested_at).toLocaleString()}
                                    </Typography>
                                  )}
                                </Alert>
                              </Grid>
                            )}
                            <Grid item xs={12}>
                              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                <Button
                                  variant="outlined"
                                  startIcon={<SendIcon />}
                                  onClick={() => setTestSmsTwilioDialog(true)}
                                  disabled={!commSettings.sms_twilio}
                                >
                                  Send Test
                                </Button>
                                <Button
                                  variant="contained"
                                  onClick={handleSaveSmsTwilioSettings}
                                  disabled={savingSmsTwilio}
                                  startIcon={savingSmsTwilio ? <CircularProgress size={20} /> : null}
                                >
                                  {savingSmsTwilio ? 'Saving...' : 'Save Twilio Settings'}
                                </Button>
                              </Box>
                            </Grid>
                          </Grid>
                        )}
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                          Get your Twilio credentials from <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer">console.twilio.com</a>
                        </Typography>
                      </Collapse>
                    </Box>

                    {/* Delete SMS Settings */}
                    {(commSettings.sms_gateway || commSettings.sms_twilio) && (
                      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Button
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={handleDeleteSmsSettings}
                        >
                          Delete All SMS Settings
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            </>
          )}

          {/* Info Card */}
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Settings are saved automatically when changed. Your preferences are stored securely
                and will be applied across all your devices when you log in.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialog} onClose={() => setTestEmailDialog(false)}>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Send test email to"
            value={testEmailAddress}
            onChange={(e) => setTestEmailAddress(e.target.value)}
            placeholder="your-email@example.com"
            sx={{ mt: 2 }}
            type="email"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestEmailDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleTestEmail}
            disabled={testingEmail}
            startIcon={testingEmail ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {testingEmail ? 'Sending...' : 'Send Test'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test SMS Gateway Dialog */}
      <Dialog open={testSmsGatewayDialog} onClose={() => setTestSmsGatewayDialog(false)}>
        <DialogTitle>Send Test SMS (Gateway)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Send a test text message via email-to-SMS gateway. Select your carrier and enter your phone number.
          </Typography>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Your Carrier</InputLabel>
            <Select
              value={testCarrier}
              label="Your Carrier"
              onChange={(e) => setTestCarrier(e.target.value)}
            >
              {(commSettings.carriers || []).map((carrier) => (
                <MenuItem key={carrier.code} value={carrier.code}>
                  {carrier.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Your Phone Number"
            value={testPhoneNumber}
            onChange={(e) => setTestPhoneNumber(e.target.value)}
            placeholder="1234567890"
            helperText="Enter 10-digit phone number (no dashes or spaces)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestSmsGatewayDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleTestSmsGateway}
            disabled={testingSmsGateway}
            startIcon={testingSmsGateway ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {testingSmsGateway ? 'Sending...' : 'Send Test'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test SMS Twilio Dialog */}
      <Dialog open={testSmsTwilioDialog} onClose={() => setTestSmsTwilioDialog(false)}>
        <DialogTitle>Send Test SMS (Twilio)</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Send test SMS to"
            value={testPhoneNumber}
            onChange={(e) => setTestPhoneNumber(e.target.value)}
            placeholder="+1234567890"
            sx={{ mt: 2 }}
            helperText="Enter phone number in E.164 format (e.g., +1234567890)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestSmsTwilioDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleTestSmsTwilio}
            disabled={testingSmsTwilio}
            startIcon={testingSmsTwilio ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {testingSmsTwilio ? 'Sending...' : 'Send Test'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SettingsPage;
