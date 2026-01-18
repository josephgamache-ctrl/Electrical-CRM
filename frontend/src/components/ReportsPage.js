import React, { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import AppHeader from './AppHeader';
import ProfitLossReport from './reports/ProfitLossReport';
import LaborTimecardsReport from './reports/LaborTimecardsReport';
import InventoryAnalyticsReport from './reports/InventoryAnalyticsReport';
import InventoryProjectionsReport from './reports/InventoryProjectionsReport';
import ProjectedVsActualReport from './reports/ProjectedVsActualReport';
import InventoryMovementReport from './reports/InventoryMovementReport';
import './ReportsPage.css';

function TabPanel({ children, value, index }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

function ReportsPage() {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Reports & Analytics" />

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Paper elevation={3} sx={{ mb: 3 }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '15px',
                fontWeight: 500,
                minHeight: 60,
                px: 3,
              },
              '& .Mui-selected': {
                color: 'primary.main',
                fontWeight: 600,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'primary.main',
                height: 3,
              },
            }}
          >
            <Tab
              label="Profit & Loss"
              icon={<span style={{ fontSize: '20px' }}>$</span>}
              iconPosition="start"
            />
            <Tab
              label="Labor & Timecards"
              icon={<span style={{ fontSize: '20px' }}>L</span>}
              iconPosition="start"
            />
            <Tab
              label="Projected vs Actual"
              icon={<span style={{ fontSize: '20px' }}>A</span>}
              iconPosition="start"
            />
            <Tab
              label="Inventory Analytics"
              icon={<span style={{ fontSize: '20px' }}>I</span>}
              iconPosition="start"
            />
            <Tab
              label="Inventory Movement"
              icon={<span style={{ fontSize: '20px' }}>M</span>}
              iconPosition="start"
            />
            <Tab
              label="Inventory Projections"
              icon={<span style={{ fontSize: '20px' }}>P</span>}
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        <TabPanel value={currentTab} index={0}>
          <ProfitLossReport />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <LaborTimecardsReport />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <ProjectedVsActualReport />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <InventoryAnalyticsReport />
        </TabPanel>

        <TabPanel value={currentTab} index={4}>
          <InventoryMovementReport />
        </TabPanel>

        <TabPanel value={currentTab} index={5}>
          <InventoryProjectionsReport />
        </TabPanel>
      </Container>
    </Box>
  );
}

export default ReportsPage;
