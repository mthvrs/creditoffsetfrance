import React, { useState, useEffect } from 'react';
import { Alert } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import axios from 'axios';

function TMDBStatusBanner() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch TMDB status
  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/status/tmdb');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch TMDB status:', error);
      // Silently fail - don't show banner on fetch error
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check immediately on mount
    fetchStatus();

    // Poll every 5 minutes
    const interval = setInterval(() => {
      fetchStatus();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Don't render anything while loading or if no issues
  if (loading || !status || !status.hasIssues) {
    return null;
  }

  // Determine severity based on status keywords
  const getSeverity = () => {
    const apiStatus = status.services?.api?.status || '';
    const imageStatus = status.services?.image?.status || '';
    
    const combinedStatus = `${apiStatus} ${imageStatus}`.toLowerCase();
    
    if (combinedStatus.includes('major outage') || combinedStatus.includes('partial outage')) {
      return 'error';
    }
    
    return 'warning';
  };

  const severity = getSeverity();
  const icon = severity === 'error' ? <ErrorIcon /> : <WarningIcon />;

  return (
    <Alert 
      severity={severity} 
      icon={icon}
      sx={{ mb: 3 }}
    >
      {status.message}
    </Alert>
  );
}

export default TMDBStatusBanner;
