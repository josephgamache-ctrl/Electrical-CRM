import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { getTheme } from "./theme";
import { SettingsProvider, useSettings } from "./settings/SettingsContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./components/Login";
import Home from "./components/Home";
import UnifiedDashboard from "./components/UnifiedDashboard";
import InventoryList from "./components/InventoryList";
import InventoryScanner from "./components/InventoryScanner";
import WorkOrdersList from "./components/WorkOrdersList";
import WorkOrderDetail from "./components/WorkOrderDetail";
import JobsList from "./components/JobsList";
import JobView from "./components/JobView";
import UserManagement from "./components/admin/UserManagement";
import ContradictionsReport from "./components/admin/ContradictionsReport";
import ManagerWorkerAssignments from "./components/admin/ManagerWorkerAssignments";
import PTOApprovalPage from "./components/admin/PTOApprovalPage";
import Timesheet from "./components/time/Timesheet";
import ReportsPage from "./components/ReportsPage";
import MobileDashboard from "./components/MobileDashboard";
import Customers from "./components/Customers";
import Schedule from "./components/Schedule";
import InvoiceList from "./components/InvoiceList";
import InvoiceDetail from "./components/InvoiceDetail";
import PurchaseOrders from "./components/PurchaseOrders";
import OrderPlanning from "./components/OrderPlanning";
import QuotesList from "./components/QuotesList";
import QuoteDetail from "./components/QuoteDetail";
import QuoteForm from "./components/QuoteForm";
import ProfilePage from "./components/ProfilePage";
import SettingsPage from "./components/SettingsPage";
import VansList from "./components/VansList";
import ReturnRackPage from "./components/ReturnRackPage";
import JobMaterialScanner from "./components/JobMaterialScanner";
import { getCurrentUser } from "./api";

function AppContent() {
  const { settings } = useSettings();
  const theme = getTheme(settings.theme);

  const isAuthenticated = () => {
    return !!localStorage.getItem("token");
  };

  const PrivateRoute = ({ children }) => {
    return isAuthenticated() ? children : <Navigate to="/login" />;
  };

  const AdminRoute = ({ children }) => {
    const [isAdmin, setIsAdmin] = React.useState(null);

    React.useEffect(() => {
      const checkAdmin = async () => {
        try {
          const userData = await getCurrentUser();
          setIsAdmin(userData.role === 'admin');
        } catch (err) {
          setIsAdmin(false);
        }
      };
      checkAdmin();
    }, []);

    if (isAdmin === null) {
      return <div>Loading...</div>;
    }

    return isAdmin ? children : <Navigate to="/" />;
  };

  // Route for Admin OR Manager access (e.g., Work Orders)
  const AdminOrManagerRoute = ({ children }) => {
    const [hasAccess, setHasAccess] = React.useState(null);

    React.useEffect(() => {
      const checkAccess = async () => {
        try {
          const userData = await getCurrentUser();
          setHasAccess(userData.role === 'admin' || userData.role === 'manager');
        } catch (err) {
          setHasAccess(false);
        }
      };
      checkAccess();
    }, []);

    if (hasAccess === null) {
      return <div>Loading...</div>;
    }

    return hasAccess ? children : <Navigate to="/" />;
  };

  // Route for Admin OR Office access (e.g., Invoices)
  const AdminOrOfficeRoute = ({ children }) => {
    const [hasAccess, setHasAccess] = React.useState(null);

    React.useEffect(() => {
      const checkAccess = async () => {
        try {
          const userData = await getCurrentUser();
          setHasAccess(userData.role === 'admin' || userData.role === 'office');
        } catch (err) {
          setHasAccess(false);
        }
      };
      checkAccess();
    }, []);

    if (hasAccess === null) {
      return <div>Loading...</div>;
    }

    return hasAccess ? children : <Navigate to="/" />;
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/home"
            element={
              <PrivateRoute>
                <UnifiedDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <PrivateRoute>
                <InventoryList />
              </PrivateRoute>
            }
          />
          <Route
            path="/inventory/scan"
            element={
              <PrivateRoute>
                <InventoryScanner />
              </PrivateRoute>
            }
          />
          <Route
            path="/vans"
            element={
              <PrivateRoute>
                <VansList />
              </PrivateRoute>
            }
          />
          <Route
            path="/return-rack"
            element={
              <PrivateRoute>
                <ReturnRackPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/job-scanner"
            element={
              <PrivateRoute>
                <JobMaterialScanner />
              </PrivateRoute>
            }
          />
          <Route
            path="/work-orders"
            element={
              <AdminOrManagerRoute>
                <WorkOrdersList />
              </AdminOrManagerRoute>
            }
          />
          <Route
            path="/work-orders/:id"
            element={
              <AdminOrManagerRoute>
                <WorkOrderDetail />
              </AdminOrManagerRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <PrivateRoute>
                <JobsList />
              </PrivateRoute>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <PrivateRoute>
                <JobView />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/contradictions"
            element={
              <AdminRoute>
                <ContradictionsReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/manager-workers"
            element={
              <AdminRoute>
                <ManagerWorkerAssignments />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/pto-approval"
            element={
              <AdminOrManagerRoute>
                <PTOApprovalPage />
              </AdminOrManagerRoute>
            }
          />
          <Route
            path="/time-entry"
            element={<Navigate to="/timesheet" replace />}
          />
          <Route
            path="/my-timecard"
            element={
              <PrivateRoute>
                <Timesheet />
              </PrivateRoute>
            }
          />
          <Route
            path="/timesheet"
            element={
              <PrivateRoute>
                <Timesheet />
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <AdminRoute>
                <ReportsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/mobile-dashboard"
            element={
              <PrivateRoute>
                <MobileDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <PrivateRoute>
                <Customers />
              </PrivateRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <PrivateRoute>
                <Schedule />
              </PrivateRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <AdminOrOfficeRoute>
                <InvoiceList />
              </AdminOrOfficeRoute>
            }
          />
          <Route
            path="/invoices/:id"
            element={
              <AdminOrOfficeRoute>
                <InvoiceDetail />
              </AdminOrOfficeRoute>
            }
          />
          <Route
            path="/purchase-orders"
            element={
              <AdminRoute>
                <PurchaseOrders />
              </AdminRoute>
            }
          />
          <Route
            path="/order-planning"
            element={
              <AdminRoute>
                <OrderPlanning />
              </AdminRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <SettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/quotes"
            element={
              <AdminOrManagerRoute>
                <QuotesList />
              </AdminOrManagerRoute>
            }
          />
          <Route
            path="/quotes/new"
            element={
              <AdminOrManagerRoute>
                <QuoteForm />
              </AdminOrManagerRoute>
            }
          />
          <Route
            path="/quotes/:id"
            element={
              <AdminOrManagerRoute>
                <QuoteDetail />
              </AdminOrManagerRoute>
            }
          />
          <Route
            path="/quotes/:id/edit"
            element={
              <AdminOrManagerRoute>
                <QuoteForm />
              </AdminOrManagerRoute>
            }
          />
          <Route path="/" element={<Navigate to="/home" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
