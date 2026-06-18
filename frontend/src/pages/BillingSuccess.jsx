import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";

/**
 * Billing success page - the URL Stripe redirects to after checkout.
 * Polls /billing/checkout-status/{session_id} until the payment is confirmed.
 */
export default function BillingSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");

  const [status, setStatus] = useState("checking"); // checking | paid | failed | expired
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setStatus("failed");
      setError("session_id mancante");
      return;
    }
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const r = await api.get(`/billing/checkout-status/${sessionId}`);
        setDetails(r.data);
        if (r.data.payment_status === "paid") {
          setStatus("paid");
          return;
        }
        if (r.data.status === "expired") {
          setStatus("expired");
          return;
        }
        // Keep polling up to ~30s
        if (attempts >= 15) {
          setStatus("failed");
          setError("Tempo scaduto. Controlla la tua email per la conferma.");
          return;
        }
        setAttempts((a) => a + 1);
        setTimeout(poll, 2000);
      } catch (e) {
        setStatus("failed");
        setError(e.response?.data?.detail || e.message || "Errore");
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <Layout>
      <div className="flex flex-col gap-6 items-center text-center py-8" data-testid="billing-success-page">
        {status === "checking" && (
          <>
            <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <h2 className="text-2xl font-bold text-zinc-100">Verifica pagamento...</h2>
            <p className="text-zinc-400 text-sm">Stiamo confermando la tua sottoscrizione con Stripe.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-3xl">✓</span>
            </div>
            <h2 className="text-2xl font-bold text-emerald-400">Pagamento confermato!</h2>
            <p className="text-zinc-400 text-sm">
              Il tuo abbonamento è attivo per <b className="text-zinc-100">{details?.quantity || "—"} proprietà</b>.
              Riceverai la ricevuta via email.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/dashboard")}
                data-testid="goto-dashboard-btn"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 uppercase tracking-[0.25em] text-xs cursor-pointer"
              >
                Vai alla dashboard
              </button>
              <button
                onClick={() => navigate("/billing/pricing")}
                className="border border-[#1E1E28] hover:border-zinc-500 text-zinc-400 px-6 py-3 uppercase tracking-[0.25em] text-xs cursor-pointer"
              >
                Gestisci abbonamento
              </button>
            </div>
          </>
        )}
        {(status === "failed" || status === "expired") && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-red-400 text-3xl">✕</span>
            </div>
            <h2 className="text-2xl font-bold text-red-400">
              {status === "expired" ? "Sessione scaduta" : "Verifica non riuscita"}
            </h2>
            <p className="text-zinc-400 text-sm">{error || "Riprova o controlla la tua email."}</p>
            <button
              onClick={() => navigate("/billing/pricing")}
              className="border border-amber-500 hover:bg-amber-500 hover:text-black text-amber-400 px-6 py-3 uppercase tracking-[0.25em] text-xs cursor-pointer"
            >
              Torna ai piani
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
