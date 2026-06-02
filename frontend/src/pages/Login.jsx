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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#05050A] px-4">
      <div className="w-full max-w-lg flex flex-col items-center gap-16">
        <div className="text-center">
          <h1
            data-testid="ospitalo-logotype"
            className="text-7xl md:text-8xl font-bold uppercase tracking-tighter text-zinc-100 leading-none"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            OSPITALO
          </h1>
          <p className="mt-6 text-xs tracking-[0.3em] uppercase text-zinc-500">
            Comunicazione Ospiti / Case Vacanza
          </p>
        </div>

        {isDisabled && (
          <div
            data-testid="login-error-disabled"
            className="w-full border border-red-500/60 bg-red-500/10 px-4 py-3 flex flex-col gap-1"
          >
            <span className="text-red-400 text-xs tracking-[0.3em] uppercase font-bold">
              UTENTE DISABILITATO
            </span>
            <span className="text-red-300/80 text-[10px] font-mono">
              Il tuo account è stato disabilitato dall'amministratore. Contatta il supporto per riattivarlo.
            </span>
          </div>
        )}

        <div className="w-full flex flex-col gap-4">
          <button
            data-testid="google-login-button"
            onClick={handleLogin}
            className="w-full bg-zinc-100 text-[#05050A] font-medium px-6 py-5 uppercase tracking-widest hover:bg-white active:scale-[0.98] transition-all cursor-pointer text-sm"
          >
            Accedi con Google
          </button>
          <p className="text-center text-[10px] tracking-[0.2em] uppercase text-zinc-600 mt-2">
            Alloggiati Web · Ross 1000 · Imposta di Soggiorno
          </p>
        </div>
      </div>
    </div>
  );
}
