import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Container, Alert, useMediaQuery } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import HomePage from './components/HomePage';
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import TMDBStatusBanner from './components/TMDBStatusBanner';
import WelcomePopup from './components/WelcomePopup';
import WelcomeBanner from './components/WelcomeBanner';

function App() {
  const isMobile = useMediaQuery('(max-width:768px)');
  const [forceOpenPopup, setForceOpenPopup] = useState(false);

  const handleBannerClick = () => {
    setForceOpenPopup(true);
  };

  const handlePopupClose = () => {
    setForceOpenPopup(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#191a1a' }}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Logo placeholder - 1.5x bigger */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img
            src={`${process.env.PUBLIC_URL}/logo.png`}
            alt="Credit Offset France"
            style={{ maxHeight: '120px', objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          <Box
            sx={{
              display: 'none',
              fontSize: '2rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #F27F1B 0%, #F2441D 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Credit Offset France
          </Box>
        </Box>

        {/* Welcome Banner - sous le logo */}
        <WelcomeBanner onClick={handleBannerClick} />

        {/* Welcome Popup */}
        <WelcomePopup forceOpen={forceOpenPopup} onClose={handlePopupClose} />

        {/* TMDB Status Banner */}
        <TMDBStatusBanner />

        {/* Mobile Warning */}
        {isMobile && (
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
            Ce site est optimisé pour une utilisation sur ordinateur. Certains
            éléments peuvent ne pas être pleinement utilisables sur mobile.
          </Alert>
        )}

        {/* Routes */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;
