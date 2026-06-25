import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
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
    if (password !== confirm) {
      setError("Le password non coincidono");
      return;
    }
    if (password.length < 8) {
      setError("La password deve essere di almeno 8 caratteri");
      return;
    }
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
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 30%, hsl(160 84% 42% / 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md flex flex-col items-center gap-10 animate-fade-in-up">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "hsl(var(--accent))", boxShadow: "0 0 12px hsl(var(--accent) / 0.6)" }}
            />
            <span className="typo-meta" style={{ color: "hsl(var(--accent))" }}>Nuova password</span>
          </div>
          <h1 className="typo-display text-primary-content">DEDOMO</h1>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {error && (
            <div
              className="w-full surface-card p-4"
              style={{
                borderColor: "hsl(var(--destructive) / 0.4)",
                backgroundColor: "hsl(var(--destructive) / 0.08)",
              }}
            >
              <span className="typo-small" style={{ color: "hsl(var(--destructive))" }}>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="typo-meta" style={{ color: "hsl(var(--muted-foreground))" }}>Nuova password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Minimo 8 caratteri"
              className="w-full px-4 py-3 rounded-lg border bg-transparent text-sm outline-none focus:ring-1"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="typo-meta" style={{ color: "hsl(var(--muted-foreground))" }}>Conferma password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Ripeti la password"
              className="w-full px-4 py-3 rounded-lg border bg-transparent text-sm outline-none focus:ring-1"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 text-base"
          >
            {loading ? "Salvataggio..." : "Salva nuova password"}
          </button>
        </form>
      </div>
    </div>
  );
}
