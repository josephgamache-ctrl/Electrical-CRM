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
    divider: mode === "light" ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)",
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
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--bg-paper": mode === "light" ? "#FFFFFF" : "#1E1E1E",
          "--bg-default": mode === "light" ? "#F5F7FA" : "#121212",
          "--bg-hover": mode === "light" ? "#f8f9fa" : "#2d2d2d",
          "--bg-active": mode === "light" ? "linear-gradient(135deg, #e8eaf6 0%, #f3e5f5 100%)" : "linear-gradient(135deg, #2d2d4d 0%, #3d2d3d 100%)",
          "--border-color": mode === "light" ? "#e9ecef" : "#404040",
          "--text-primary": mode === "light" ? "#1e2656" : "#ffffff",
          "--text-secondary": mode === "light" ? "#6c757d" : "#b0b0b0",
          // Mobile Dashboard specific variables
          "--mobile-dashboard-bg": mode === "light"
            ? "linear-gradient(180deg, #1e2656 0%, #2a3166 100%)"
            : "linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 100%)",
          "--mobile-stats-bg": mode === "light"
            ? "linear-gradient(135deg, #1e2656 0%, #2d3875 100%)"
            : "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          "--mobile-stats-text": mode === "light" ? "white" : "#ffffff",
          "--mobile-stats-text-muted": mode === "light" ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.7)",
          "--mobile-circle-bg": mode === "light" ? "#2a2f5a" : "#333333",
          "--mobile-quick-actions-bg": mode === "light" ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.05)",
        },
      },
    },
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
