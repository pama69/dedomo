import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function PasswordInput({ value, onChange, placeholder = "••••••••", autoComplete = "current-password" }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required
        placeholder={placeholder}
        className="w-full px-4 py-3 pr-11 rounded-lg border bg-transparent text-sm outline-none focus:ring-1"
        style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: "hsl(var(--foreground))" }}
        tabIndex={-1}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") === "disabled" ? "Account disabilitato. Contatta il supporto." : "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      setUser(res.data);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Errore durante l'accesso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(50% 40% at 50% 30%, hsl(160 84% 42% / 0.08) 0%, transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md flex flex-col items-center gap-10 animate-fade-in-up">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsl(var(--accent))", boxShadow: "0 0 12px hsl(var(--accent) / 0.6)" }} />
            <span className="typo-meta" style={{ color: "hsl(var(--accent))" }}>Sistema operativo</span>
          </div>
          <h1 data-testid="dedomo-logotype" className="typo-display text-primary-content">DEDOMO</h1>
          <p className="typo-meta mt-5">Comunicazione Ospiti · Case Vacanza</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {error && (
            <div className="w-full surface-card p-4" style={{ borderColor: "hsl(var(--destructive) / 0.4)", backgroundColor: "hsl(var(--destructive) / 0.08)" }}>
              <span className="typo-small" style={{ color: "hsl(var(--destructive))" }}>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="typo-meta" style={{ color: "hsl(var(--muted-foreground))" }}>Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tua@email.it"
              className="w-full px-4 py-3 rounded-lg border bg-transparent text-sm outline-none focus:ring-1"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="typo-meta" style={{ color: "hsl(var(--muted-foreground))" }}>Password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="typo-small" style={{ color: "hsl(var(--accent))" }}>
              Password dimenticata?
            </Link>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>

          <p className="typo-small text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
            Non hai un account?{" "}
            <Link to="/register" style={{ color: "hsl(var(--accent))" }}>Registrati</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
