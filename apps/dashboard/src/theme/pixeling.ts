import { createTheme, alpha } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    neutral: Palette['primary'];
  }
  interface PaletteOptions {
    neutral?: PaletteOptions['primary'];
  }
}

export const pixelingTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563EB',
      light: '#3B82F6',
      dark: '#1D4ED8',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#8B5CF6',
      light: '#A78BFA',
      dark: '#7C3AED',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    info: {
      main: '#2563EB',
      light: '#3B82F6',
      dark: '#1D4ED8',
    },
    neutral: {
      main: '#717695',
      light: '#A0A4B8',
      dark: '#4A4F7A',
    },
    background: {
      default: '#F8F9FC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#373C5C',
      secondary: '#717695',
      disabled: '#A0A4B8',
    },
    divider: '#D0D5E6',
  },
  typography: {
    fontFamily: "'Wanted Sans Variable', 'wantedSans', 'Wanted Sans', 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', 'Inter', system-ui, -apple-system, sans-serif",
    h1: { fontSize: '24px', fontWeight: 700 },
    h2: { fontSize: '20px', fontWeight: 700 },
    h3: { fontSize: '18px', fontWeight: 600 },
    h4: { fontSize: '16px', fontWeight: 600 },
    h5: { fontSize: '14px', fontWeight: 600 },
    h6: { fontSize: '13px', fontWeight: 600 },
    body1: { fontSize: '14px', fontWeight: 400 },
    body2: { fontSize: '13px', fontWeight: 400 },
    caption: { fontSize: '12px', fontWeight: 400 },
    button: { fontSize: '14px', fontWeight: 500, textTransform: 'none' },
  },
  shape: { borderRadius: 8 },
  spacing: 4,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#F8F9FC', color: '#373C5C' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          padding: '8px 16px',
          fontWeight: 500,
          boxShadow: 'none',
          transition: 'all 0.2s ease',
          '&:hover': { boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)' },
        },
        containedPrimary: {
          backgroundColor: '#2563EB',
          '&:hover': { backgroundColor: '#1D4ED8' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
          border: '1px solid #D0D5E6',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            '& fieldset': { borderColor: '#D0D5E6' },
            '&:hover fieldset': { borderColor: '#2563EB' },
            '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: '2px' },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: '6px', fontWeight: 500, fontSize: '12px' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '14px',
          minWidth: 'auto',
          padding: '12px 16px',
          '&.Mui-selected': { color: '#2563EB' },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: '3px', borderRadius: '3px 3px 0 0', backgroundColor: '#2563EB' },
      },
    },
  },
});