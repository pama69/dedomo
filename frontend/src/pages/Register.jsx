import { useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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
      await api.post("/auth/register", { email, password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Errore durante la registrazione");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md surface-card p-8 flex flex-col items-center gap-6 text-center">
          <span style={{ fontSize: 48 }}>📬</span>
          <h2 className="typo-heading text-primary-content">Controlla la tua email</h2>
          <p className="typo-body" style={{ color: "hsl(var(--muted-foreground))" }}>
            Abbiamo inviato un link di conferma a <strong>{email}</strong>.<br />
            Clicca il link per attivare il tuo account.
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
            <span className="typo-meta" style={{ color: "hsl(var(--accent))" }}>Crea account</span>
          </div>
          <h1 className="typo-display text-primary-content">DEDOMO</h1>
          <p className="typo-meta mt-5">Registrati per iniziare</p>
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
            className="btn-primary w-full py-4 text-base mt-2"
          >
            {loading ? "Registrazione in corso..." : "Crea account"}
          </button>

          <p className="typo-small text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
            Hai già un account?{" "}
            <Link to="/login" style={{ color: "hsl(var(--accent))" }}>Accedi</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
