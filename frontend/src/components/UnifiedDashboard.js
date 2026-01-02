import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import MobileDashboard from './MobileDashboard';
import DesktopDashboard from './DesktopDashboard';

function UnifiedDashboard() {
  // Use MUI's useMediaQuery to detect mobile vs desktop
  // Mobile: screens smaller than 1024px
  const isMobile = useMediaQuery('(max-width: 1023px)');

  // Show mobile dashboard on small screens, desktop dashboard on large screens
  return isMobile ? <MobileDashboard /> : <DesktopDashboard />;
}

export default UnifiedDashboard;
