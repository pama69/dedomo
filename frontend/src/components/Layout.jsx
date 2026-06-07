import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import TopNavMenu from "@/components/TopNavMenu";
import NotificationsBell from "@/components/NotificationsBell";
import { useAuth } from "@/contexts/AuthContext";

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [verified, setVerified] = useState(!!location.state?.user || !!user);

  useEffect(() => {
    if (location.state?.user || user) {
      setVerified(true);
      return;
    }
    if (loading) return;
    api.get("/auth/me").then(() => setVerified(true)).catch(() => navigate("/login", { replace: true }));
  }, [location, navigate, user, loading]);

  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05050A]">
        <p className="text-zinc-500 text-xs tracking-[0.3em] uppercase">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050A] text-zinc-100">
      <header className="border-b border-[#1E1E28] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 bg-[#05050A]/95 backdrop-blur-xl z-40">
        <h1
          className="text-2xl font-bold uppercase tracking-tighter text-zinc-100"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          DEDOMO
        </h1>
        <div className="flex items-center gap-2">
          {user?.is_admin && (
            <Link
              to="/admin"
              data-testid="header-admin-link"
              className="text-[10px] tracking-[0.25em] uppercase text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              Admin
            </Link>
          )}
          <NotificationsBell />
          <button
            data-testid="logout-button"
            onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
            className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            Esci
          </button>
          <TopNavMenu />
        </div>
      </header>
      <main className="w-full max-w-3xl mx-auto pb-12 pt-8 px-4 sm:px-6 flex flex-col gap-8">
        {children}
      </main>
    </div>
  );
}
