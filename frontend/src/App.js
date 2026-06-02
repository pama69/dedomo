import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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

function AppRouter() {
  const location = useLocation();
  // Check URL fragment synchronously to handle OAuth callback before other routes
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/checkin" element={<Checkin />} />
      <Route path="/archive" element={<Archive />} />
      <Route path="/archive/owners" element={<Owners />} />
      <Route path="/archive/owners/:ownerId" element={<OwnerArchive />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
