import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import TopNavMenu from "@/components/TopNavMenu";
import NotificationsBell from "@/components/NotificationsBell";
import { useAuth } from "@/contexts/AuthContext";

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [verified, setVerified] = useState(!!location.state?.user || !!user);
  const [subStatus, setSubStatus] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.get("/billing/quota").then((r) => {
      setSubStatus(r.data?.subscription?.status ?? null);
    }).catch(() => {});
  }, [user]);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-text-muted border-t-accent animate-spin" />
          <p className="typo-meta">Caricamento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sfumatura ambient di sfondo per dare profondità */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(160 84% 42% / 0.06) 0%, transparent 70%)",
        }}
      />

      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          borderColor: "hsl(var(--border-subtle))",
          backgroundColor: "hsl(var(--background) / 0.78)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 group"
          >
            <span
              data-testid="dedomo-logotype"
              className="text-2xl font-bold uppercase tracking-tight text-primary-content transition-colors group-hover:text-white"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: "-0.04em" }}
            >
              DEDOMO
            </span>
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-accent" style={{ backgroundColor: "hsl(var(--accent))" }} />
          </Link>

          <div className="flex items-center gap-1.5">
            {user?.is_admin && (
              <Link
                to="/admin"
                data-testid="header-admin-link"
                className="btn-ghost"
                style={{ color: "hsl(var(--warning))" }}
              >
                Admin
              </Link>
            )}
            <NotificationsBell />
            <button
              data-testid="logout-button"
              onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
              className="btn-ghost"
            >
              Esci
            </button>
            <TopNavMenu />
          </div>
        </div>
      </header>

      {subStatus === "past_due" && (
        <div
          className="w-full px-4 py-3 flex items-center justify-between gap-4"
          style={{ background: "hsl(38 80% 12%)", borderBottom: "1px solid hsl(38 80% 30% / 0.5)" }}
        >
          <span className="text-amber-300 text-[11px] font-mono">
            ⚠ Il rinnovo del tuo abbonamento non è andato a buon fine. Aggiorna il metodo di pagamento per continuare ad usare Dedomo.
          </span>
          <button
            onClick={async () => {
              try {
                const r = await api.post("/billing/customer-portal", { return_url: window.location.href });
                if (r.data?.url) window.location.href = r.data.url;
              } catch {}
            }}
            className="flex-shrink-0 border border-amber-500/60 hover:bg-amber-500/10 text-amber-300 text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 cursor-pointer transition-colors"
          >
            Aggiorna carta →
          </button>
        </div>
      )}

      <main className="w-full max-w-5xl mx-auto pb-16 pt-8 px-4 sm:px-6 flex flex-col gap-8 animate-fade-in-up">
        {children}
      </main>
    </div>
  );
}
