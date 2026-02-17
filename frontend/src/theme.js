import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#F27F1B', // Orange
      light: '#F26A1B', // Light orange
      dark: '#F2441D', // Orange-red
    },
    secondary: {
      main: '#F26A1B',
      light: '#F27F1B',
      dark: '#F2441D',
    },
    background: {
      default: '#191a1a',
      paper: '#222323',
    },
    text: {
      primary: '#F2F2F2',
      secondary: '#cbd5e1',
    },
    error: {
      main: '#dc2626', // Bright red for warnings
      light: '#ef4444',
      dark: '#991b1b',
    },
    warning: {
      main: '#ea580c', // Distinct orange-red for warnings
      light: '#f97316',
      dark: '#c2410c',
    },
    success: {
      main: '#10b981',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
  },
});
