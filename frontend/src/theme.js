import { createTheme } from "@mui/material/styles";

export const getTheme = (mode = "light") => createTheme({
  palette: {
    mode,
    primary: {
      main: "#FF6B00",  // Orange for electrical/warning
      light: "#FF8C33",
      dark: "#CC5600"
    },
    secondary: {
      main: "#1976D2",  // Blue for professional
      light: "#42A5F5",
      dark: "#1565C0"
    },
    success: { main: "#2E7D32" },  // Green for good stock
    warning: { main: "#ED6C02" },  // Orange for low stock
    error: { main: "#D32F2F" },    // Red for critical
    info: { main: "#0288D1" },
    background: {
      default: mode === "light" ? "#F5F7FA" : "#121212",
      paper: mode === "light" ? "#FFFFFF" : "#1E1E1E"
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 500 },
    button: { fontWeight: 600, textTransform: "none" },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          transition: "0.3s",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 20px",
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

export const theme = getTheme("light");
