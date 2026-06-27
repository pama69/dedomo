import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";

/**
 * Pricing page - lets the user pick how many properties (1-10) to pay for,
 * then redirects to Stripe Checkout (subscription, EUR, +22% IVA).
 */
export default function Pricing() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [quota, setQuota] = useState(null);
  const [num, setNum] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [upgraded, setUpgraded] = useState(false);
  const [upgradedQty, setUpgradedQty] = useState(null);
  const cancelled = params.get("cancelled") === "1";

  useEffect(() => {
    api.get("/billing/quota").then((r) => {
      setQuota(r.data);
      const paid = r.data?.paid_properties || 0;
      const used = r.data?.properties_used || 1;
      // If already subscribed, default extra = 1; otherwise default = current used (min 1)
      if (r.data?.subscription) {
        setNum(1);
      } else {
        setNum(Math.max(1, paid || used || 1));
      }
    }).catch(() => setQuota(null));
  }, []);

  const priceFirst = quota?.price_first_eur ?? 19.99;
  const priceExtra = quota?.price_extra_eur ?? 9.99;
  const taxPercent = quota?.tax_percent ?? 22;
  const maxProps = quota?.max_paid_properties ?? 10;
  const isSubscribed = !!(quota?.subscription);
  const currentPaid = quota?.subscription?.quantity || 0;

  // Pricing logic: different for new vs upgrade
  const subtotal = isSubscribed
    ? num * priceExtra                                            // upgrade: all extra at 9.99
    : priceFirst + Math.max(0, num - 1) * priceExtra;            // new: first at 19.99, rest 9.99
  const tax = +(subtotal * taxPercent / 100).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  const openPortal = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.post("/billing/customer-portal", { return_url: window.location.href });
      if (r.data?.url) window.location.href = r.data.url;
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  const upgradeSubscription = async () => {
    setLoading(true);
    setError("");
    try {
      const expectedQty = currentPaid + num;
      await api.post("/billing/upgrade-subscription", { add_properties: num });
      setUpgradedQty(expectedQty);
      setUpgraded(true);
      // Refresh quota so the UI reflects the new quantity
      const r = await api.get("/billing/quota");
      const actualQty = r.data?.subscription?.quantity;
      if (actualQty) setUpgradedQty(actualQty);
      setQuota(r.data);
      setNum(1);
    } catch (e) {
      const status = e.response?.status;
      const detail = e.response?.data?.detail || e.message || "Errore sconosciuto";

      // 3D Secure: la banca richiede autenticazione supplementare
      if (status === 402 || (typeof detail === "string" && detail.includes("authentication_required"))) {
        setError("La tua banca richiede autenticazione. Verrai reindirizzato al portale Stripe per completare il pagamento in sicurezza…");
        try {
          const r = await api.post("/billing/customer-portal", { return_url: window.location.href });
          if (r.data?.url) {
            setTimeout(() => { window.location.href = r.data.url; }, 1500);
          }
        } catch {
          setError("La tua banca richiede autenticazione 3D Secure. Accedi al portale tramite il pulsante 'Gestisci abbonamento' per completare il pagamento.");
        }
        return;
      }

      const isCardError = typeof detail === "string" && (
        detail.toLowerCase().includes("card") ||
        detail.toLowerCase().includes("carta") ||
        detail.toLowerCase().includes("declined") ||
        detail.toLowerCase().includes("payment")
      );
      setError(
        isCardError
          ? `Pagamento non riuscito: ${detail}. Verifica la carta tramite "Gestisci abbonamento".`
          : `Errore: ${detail}`
      );
    } finally {
      setLoading(false);
    }
  };

  const startCheckout = async () => {
    setLoading(true);
    setError("");
    try {
      const origin = window.location.origin;
      const r = await api.post("/billing/create-checkout-session", {
        num_properties: num,
        origin_url: origin,
      });
      if (r.data?.url) {
        window.location.href = r.data.url;
      } else {
        setError("Risposta inattesa dal server");
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Errore checkout";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  if (upgraded) {
    const newQty = upgradedQty || quota?.subscription?.quantity || (currentPaid + 1);
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center gap-8 py-16 px-4 text-center">
          <div className="border border-emerald-500/50 bg-emerald-500/8 w-full max-w-md flex flex-col items-center gap-6 px-8 py-12"
            style={{ background: "hsl(140 20% 8%)", borderColor: "hsl(140 50% 35% / 0.5)" }}>
            <span className="text-5xl select-none">✓</span>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-emerald-300 leading-tight">
                Grazie per aver<br />esteso l'abbonamento
              </h2>
              <p className="text-zinc-300 text-base mt-2">
                Ora puoi gestire <b className="text-emerald-300">{newQty} {newQty === 1 ? "proprietà" : "proprietà"}</b>
              </p>
            </div>
            <p className="text-2xl font-bold tracking-[0.2em] uppercase text-zinc-100">
              Buon lavoro!
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 hover:text-zinc-100 cursor-pointer"
          >
            ← Torna alla dashboard
          </button>
        </div>
      </Layout>
    );
  }

  if (!quota) {
    return (
      <Layout>
        <p className="text-zinc-500 text-xs tracking-[0.3em] uppercase">Caricamento...</p>
      </Layout>
    );
  }

  if (quota.unlimited) {
    return (
      <Layout>
        <div className="border border-amber-500/40 bg-amber-500/5 p-4 flex flex-col gap-2">
          <span className="text-amber-300 text-lg font-bold">Account Illimitato</span>
          <span className="text-zinc-400 text-sm">
            Hai un piano illimitato attivo. Nessun pagamento richiesto.
          </span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6" data-testid="pricing-page">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-500">Piani</span>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">
            Sblocca tutte le funzioni
          </h2>
          <p className="text-zinc-400 text-sm">
            Hai usato <b className="text-zinc-200">{quota.trial_used}/{quota.trial_limit}</b> invii gratuiti.
            Passa al piano annuale per inviare senza limiti su tutte le tue proprietà.
          </p>
        </div>

        {cancelled && (
          <div className="border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-amber-300 text-[11px] font-mono">
            Checkout annullato. Nessun addebito effettuato.
          </div>
        )}

        {/* ── ABBONAMENTO ATTIVO ── */}
        {isSubscribed ? (
          <>
            <div className="border border-emerald-500/40 bg-emerald-500/5 p-4 flex flex-col gap-2" data-testid="current-sub">
              <span className="text-emerald-300 text-sm font-bold">
                Abbonamento attivo · {currentPaid} {currentPaid === 1 ? "proprietà" : "proprietà"}
              </span>
              <span className="text-zinc-400 text-[11px] font-mono">
                Stato: {quota.subscription.status}
                {quota.subscription.current_period_end && (
                  <> · Rinnovo: {new Date(quota.subscription.current_period_end * 1000).toLocaleDateString("it-IT")}</>
                )}
              </span>
              <button
                data-testid="open-portal-btn"
                onClick={openPortal}
                disabled={loading}
                className="self-start mt-1 border border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-300 text-[10px] tracking-[0.25em] uppercase px-3 py-2 cursor-pointer disabled:opacity-50"
              >
                Gestisci abbonamento →
              </button>
            </div>

            {/* Sezione integrazione solo se ci sono slot disponibili */}
            {currentPaid < maxProps && (
              <>
                {upgraded && (
                  <div className="border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-emerald-300 text-[12px] font-mono">
                    ✓ Abbonamento aggiornato a {quota?.subscription?.quantity} proprietà. L'importo proporzionale è stato addebitato sulla carta registrata.
                  </div>
                )}

                {error && (
                  <div className="border border-red-500/40 bg-red-500/5 px-3 py-2 text-red-300 text-[11px] font-mono">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-bold text-zinc-100">Integra abbonamento</h3>
                  <p className="text-zinc-400 text-sm">
                    Aggiungi proprietà al piano esistente. Ogni proprietà aggiuntiva costa{" "}
                    <b className="text-zinc-200">€ {priceExtra.toFixed(2)}/anno</b> (IVA esclusa).
                  </p>
                </div>

                {/* Slider proprietà aggiuntive */}
                <div className="border border-border p-4 flex flex-col gap-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
                      Proprietà da aggiungere
                    </span>
                    <span className="text-3xl font-bold font-mono text-zinc-100" data-testid="prop-count">
                      +{num}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={maxProps - currentPaid}
                    value={num}
                    onChange={(e) => setNum(parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                    data-testid="prop-count-slider"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                    <span>+1</span>
                    <span>+{maxProps - currentPaid}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 3, 5].filter(n => n <= maxProps - currentPaid).map((n) => (
                      <button
                        key={n}
                        onClick={() => setNum(n)}
                        className={`px-3 py-1 text-[10px] tracking-widest uppercase border cursor-pointer ${
                          num === n
                            ? "border-amber-500 bg-amber-500/10 text-amber-300"
                            : "border-border text-zinc-500 hover:border-amber-500/60"
                        }`}
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preventivo incrementale */}
                <div className="border border-border p-4 flex flex-col gap-3 font-mono">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400">Hai già</span>
                    <span className="text-zinc-500">{currentPaid} {currentPaid === 1 ? "proprietà" : "proprietà"} pagate</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400">+ {num} {num === 1 ? "proprietà aggiuntiva" : "proprietà aggiuntive"}</span>
                    <span className="text-zinc-200">€ {(num * priceExtra).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] border-t border-border pt-2">
                    <span className="text-zinc-400">Subtotale</span>
                    <span className="text-zinc-200">€ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400">IVA ({taxPercent}%)</span>
                    <span className="text-zinc-200">€ {tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base border-t border-amber-500/30 pt-3">
                    <span className="text-zinc-100 font-bold">COSTO AGGIUNTIVO / anno</span>
                    <span className="text-amber-400 font-bold" data-testid="total-eur">€ {total.toFixed(2)}</span>
                  </div>
                </div>

                {!upgraded && (
                  <>
                    <div className="border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex flex-col gap-1">
                      <span className="text-amber-300 text-[11px] font-bold uppercase tracking-widest">Addebito immediato pro-rata</span>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Cliccando il pulsante, <b className="text-zinc-200">€ {total.toFixed(2)}</b> (IVA inclusa) verranno addebitati immediatamente sulla carta registrata. L'importo è proporzionale ai giorni rimanenti del periodo di abbonamento corrente. Al prossimo rinnovo pagherai il piano completo ({currentPaid + num} proprietà).
                      </p>
                    </div>

                    <button
                      data-testid="upgrade-btn"
                      onClick={upgradeSubscription}
                      disabled={loading}
                      className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-4 uppercase tracking-[0.3em] text-sm cursor-pointer transition-colors"
                    >
                      {loading ? "Elaborazione…" : `Conferma e paga · € ${total.toFixed(2)}`}
                    </button>

                    <p className="text-[10px] text-zinc-500 text-center">
                      Pagamento sicuro su Stripe · piano totale dopo upgrade: {currentPaid + num} proprietà
                    </p>
                  </>
                )}

              </>
            )}

            {currentPaid >= maxProps && (
              <div className="border border-border p-4 text-zinc-500 text-[11px] font-mono text-center">
                Hai raggiunto il numero massimo di proprietà ({maxProps}). Contatta il supporto per aumentare il limite.
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── NUOVO ABBONAMENTO ── */}
            {/* Property count selector */}
            <div className="border border-border p-4 flex flex-col gap-4">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
                  Numero di proprietà
                </span>
                <span className="text-3xl font-bold font-mono text-zinc-100" data-testid="prop-count">
                  {num}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={maxProps}
                value={num}
                onChange={(e) => setNum(parseInt(e.target.value))}
                className="w-full accent-amber-500"
                data-testid="prop-count-slider"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                <span>1</span>
                <span>{maxProps}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {[1, 2, 3, 5, 10].filter(n => n <= maxProps).map((n) => (
                  <button
                    key={n}
                    onClick={() => setNum(n)}
                    data-testid={`pick-${n}`}
                    className={`px-3 py-1 text-[10px] tracking-widest uppercase border cursor-pointer ${
                      num === n
                        ? "border-amber-500 bg-amber-500/10 text-amber-300"
                        : "border-border text-zinc-500 hover:border-amber-500/60"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Pricing breakdown */}
            <div className="border border-border p-4 flex flex-col gap-3 font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Prima proprietà</span>
                <span className="text-zinc-200">€ {priceFirst.toFixed(2)}</span>
              </div>
              {num > 1 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-400">+ {num - 1} {num - 1 === 1 ? "proprietà extra" : "proprietà extra"}</span>
                  <span className="text-zinc-200">€ {((num - 1) * priceExtra).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] border-t border-border pt-2">
                <span className="text-zinc-400">Subtotale</span>
                <span className="text-zinc-200">€ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">IVA ({taxPercent}%)</span>
                <span className="text-zinc-200">€ {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base border-t border-amber-500/30 pt-3">
                <span className="text-zinc-100 font-bold">TOTALE / anno</span>
                <span className="text-amber-400 font-bold" data-testid="total-eur">€ {total.toFixed(2)}</span>
              </div>
            </div>

            {error && (
              <div className="border border-red-500/40 bg-red-500/5 px-3 py-2 text-red-300 text-[11px] font-mono">
                {error}
              </div>
            )}

            <button
              data-testid="checkout-btn"
              onClick={startCheckout}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-4 uppercase tracking-[0.3em] text-sm cursor-pointer transition-colors"
            >
              {loading ? "Reindirizzamento..." : `Sottoscrivi · € ${total.toFixed(2)}/anno`}
            </button>

            <p className="text-[10px] text-zinc-500 text-center">
              Pagamento sicuro su Stripe · annullabile in qualunque momento
            </p>
          </>
        )}

        <button
          onClick={() => navigate("/dashboard")}
          className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 hover:text-zinc-100 self-center cursor-pointer"
        >
          ← Torna alla dashboard
        </button>
      </div>
    </Layout>
  );
}
