import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";

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

function PasswordInput({ value, onChange, placeholder = "Minimo 8 caratteri" }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete="new-password"
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

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md surface-card p-8 text-center flex flex-col gap-4">
          <p className="typo-body" style={{ color: "hsl(var(--destructive))" }}>
            Link non valido. Richiedi un nuovo reset dalla pagina di login.
          </p>
          <Link to="/login" className="btn-primary px-8 py-3">Vai al login</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Le password non coincidono"); return; }
    if (password.length < 8) { setError("La password deve essere di almeno 8 caratteri"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Errore. Il link potrebbe essere scaduto.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md surface-card p-8 flex flex-col items-center gap-6 text-center">
          <span style={{ fontSize: 48 }}>✅</span>
          <h2 className="typo-heading text-primary-content">Password aggiornata</h2>
          <p className="typo-body" style={{ color: "hsl(var(--muted-foreground))" }}>
            Puoi ora accedere con le nuove credenziali.
          </p>
          <Link to="/login" className="btn-primary px-8 py-3">Vai al login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(50% 40% at 50% 30%, hsl(160 84% 42% / 0.08) 0%, transparent 70%)" }} />
      <div className="relative w-full max-w-md flex flex-col items-center gap-10 animate-fade-in-up">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsl(var(--accent))", boxShadow: "0 0 12px hsl(var(--accent) / 0.6)" }} />
            <span className="typo-meta" style={{ color: "hsl(var(--accent))" }}>Nuova password</span>
          </div>
          <h1 className="typo-display text-primary-content">DEDOMO</h1>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {error && (
            <div className="w-full surface-card p-4" style={{ borderColor: "hsl(var(--destructive) / 0.4)", backgroundColor: "hsl(var(--destructive) / 0.08)" }}>
              <span className="typo-small" style={{ color: "hsl(var(--destructive))" }}>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="typo-meta" style={{ color: "hsl(var(--muted-foreground))" }}>Nuova password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="typo-meta" style={{ color: "hsl(var(--muted-foreground))" }}>Conferma password</label>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ripeti la password" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? "Salvataggio..." : "Salva nuova password"}
          </button>
        </form>
      </div>
    </div>
  );
}
