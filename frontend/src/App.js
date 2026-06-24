import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Component } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#060608", color: "#F4F4F6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "monospace" }}>
          <h1 style={{ color: "#14B981", fontSize: "1.2rem", marginBottom: "1rem" }}>DEDOMO — Errore applicazione</h1>
          <pre style={{ color: "#EF4444", background: "#1a1a2e", padding: "1rem", borderRadius: "8px", maxWidth: "600px", overflow: "auto", fontSize: "0.75rem" }}>
            {this.state.error.toString()}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button onClick={() => window.location.href = "/"} style={{ marginTop: "1.5rem", padding: "0.75rem 2rem", background: "#14B981", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.875rem" }}>
            Ricarica
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Checkin from "@/pages/Checkin";
import Settings from "@/pages/Settings";
import Archive from "@/pages/Archive";
import Owners from "@/pages/Owners";
import OwnerArchive from "@/pages/OwnerArchive";
import Admin from "@/pages/Admin";
import CalendarPage from "@/pages/Calendar";
import Help from "@/pages/Help";
import Pricing from "@/pages/Pricing";
import BillingSuccess from "@/pages/BillingSuccess";
import GuestPage from "@/pages/GuestPage";
import Landing from "@/pages/Landing";
import Privacy from "@/pages/Privacy";

function AppRouter() {
  const location = useLocation();
  // Check URL fragment synchronously to handle OAuth callback before other routes
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/checkin" element={<Checkin />} />
      <Route path="/archive" element={<Archive />} />
      <Route path="/archive/owners" element={<Owners />} />
      <Route path="/archive/owners/:ownerId" element={<OwnerArchive />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/help" element={<Help />} />
      <Route path="/billing/pricing" element={<Pricing />} />
      <Route path="/billing/success" element={<BillingSuccess />} />
      <Route path="/guest/:token" element={<GuestPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}

export default App;
