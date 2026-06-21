import { useSearchParams } from "react-router-dom";

export default function Login() {
  const [params] = useSearchParams();
  const error = params.get("error");
  const isDisabled = error === "disabled";

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Ambient glow di sfondo */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 30%, hsl(160 84% 42% / 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md flex flex-col items-center gap-12 animate-fade-in-up">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "hsl(var(--accent))", boxShadow: "0 0 12px hsl(var(--accent) / 0.6)" }}
            />
            <span className="typo-meta" style={{ color: "hsl(var(--accent))" }}>Sistema operativo</span>
          </div>
          <h1
            data-testid="dedomo-logotype"
            className="typo-display text-primary-content"
          >
            DEDOMO
          </h1>
          <p className="typo-meta mt-5">
            Comunicazione Ospiti · Case Vacanza
          </p>
        </div>

        {isDisabled && (
          <div
            data-testid="login-error-disabled"
            className="w-full surface-card p-4 flex flex-col gap-1"
            style={{
              borderColor: "hsl(var(--destructive) / 0.4)",
              backgroundColor: "hsl(var(--destructive) / 0.08)",
            }}
          >
            <span
              className="typo-meta"
              style={{ color: "hsl(var(--destructive))", fontWeight: 700 }}
            >
              ⚠ Utente disabilitato
            </span>
            <span className="typo-small" style={{ color: "hsl(var(--destructive) / 0.8)" }}>
              Il tuo account è stato disabilitato dall'amministratore. Contatta il supporto per riattivarlo.
            </span>
          </div>
        )}

        <div className="w-full flex flex-col gap-4">
          <button
            data-testid="google-login-button"
            onClick={handleLogin}
            className="btn-primary w-full py-4 text-base"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Accedi con Google
          </button>
          <p className="typo-meta text-center mt-3">
            Alloggiati Web · Ross 1000 · Imposta di Soggiorno
          </p>
        </div>
      </div>
    </div>
  );
}
