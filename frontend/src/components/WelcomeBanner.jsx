import React from 'react';
import { Box, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const WelcomeBanner = ({ onClick }) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: 1,
        px: 2,
        mb: 3,
        bgcolor: 'rgba(242, 127, 27, 0.15)',
        border: '1px solid rgba(242, 127, 27, 0.3)',
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          bgcolor: 'rgba(242, 127, 27, 0.25)',
          borderColor: 'rgba(242, 127, 27, 0.5)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <InfoOutlinedIcon sx={{ color: '#F27F1B', fontSize: '1.2rem' }} />
      <Typography
        variant="body2"
        sx={{
          color: '#F27F1B',
          fontWeight: 500,
        }}
      >
        Nouvelle version du site, plus d'infos ici...
      </Typography>
    </Box>
  );
};

export default WelcomeBanner;
