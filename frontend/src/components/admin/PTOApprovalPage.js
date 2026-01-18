import React from 'react';
import { Box, Container } from '@mui/material';
import AppHeader from '../AppHeader';
import PTOApproval from './PTOApproval';

function PTOApprovalPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="PTO Approval" showSearch={false} />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <PTOApproval />
      </Container>
    </Box>
  );
}

export default PTOApprovalPage;
