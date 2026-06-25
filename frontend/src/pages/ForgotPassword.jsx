import { useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Errore. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md surface-card p-8 flex flex-col items-center gap-6 text-center">
          <span style={{ fontSize: 48 }}>✉️</span>
          <h2 className="typo-heading text-primary-content">Email inviata</h2>
          <p className="typo-body" style={{ color: "hsl(var(--muted-foreground))" }}>
            Se <strong>{email}</strong> è registrata, riceverai un link per reimpostare la password.
            <br /><br />
            Il link scade tra 1 ora.
          </p>
          <Link to="/login" className="btn-primary px-8 py-3">Torna al login</Link>
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
            <span className="typo-meta" style={{ color: "hsl(var(--accent))" }}>Recupero accesso</span>
          </div>
          <h1 className="typo-display text-primary-content">DEDOMO</h1>
          <p className="typo-meta mt-5">Inserisci la tua email per ricevere il link di reset</p>
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 text-base"
          >
            {loading ? "Invio in corso..." : "Invia link di reset"}
          </button>

          <p className="typo-small text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
            <Link to="/login" style={{ color: "hsl(var(--accent))" }}>← Torna al login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
