import { useNavigate } from "react-router-dom";

/**
 * PaywallModal — shown when a user hits the quota limit (5 free PROD submissions
 * exhausted, or property cap exceeded). Pure inline modal — never uses
 * window.confirm or any native dialog (which is blocked in the sandbox).
 *
 * Props:
 *   open: bool
 *   reason: "trial_exceeded" | "properties_exceeded" | custom string
 *   onClose: () => void
 *   details: { used, limit, paid?, ... } (optional)
 */
export default function PaywallModal({ open, reason, onClose, details = {} }) {
  const navigate = useNavigate();
  if (!open) return null;

  const isProps = reason === "quota_properties_exceeded";

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
      data-testid="paywall-modal"
      onClick={onClose}
    >
      <div
        className="bg-[#0E0E14] border border-amber-500/40 max-w-md w-full p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] tracking-[0.3em] uppercase text-amber-400">Limite raggiunto</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 text-lg cursor-pointer"
            data-testid="paywall-close"
          >
            ✕
          </button>
        </div>

        <h2 className="text-2xl font-bold text-zinc-100">
          {isProps ? "Aggiungi un piano" : "Hai esaurito i 5 invii gratuiti"}
        </h2>

        <p className="text-zinc-400 text-sm leading-relaxed">
          {isProps ? (
            <>
              Hai <b className="text-zinc-100">{details.used}</b> proprietà ma il tuo piano ne copre{" "}
              <b className="text-zinc-100">{details.paid}</b>.<br />
              Effettua l&apos;upgrade per inviare con tutte le proprietà.
            </>
          ) : (
            <>
              Hai usato tutti i <b className="text-zinc-100">{details.limit || 5}</b> invii gratuiti.
              Continua con un piano annuale a partire da <b className="text-amber-400">€ 19.99/anno</b>.
            </>
          )}
        </p>

        <div className="border border-[#1E1E28] p-3 flex flex-col gap-2 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-zinc-500">Prima proprietà</span>
            <span className="text-zinc-200">€ 19.99 / anno</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Ogni proprietà extra (max 10)</span>
            <span className="text-zinc-200">€ 9.99 / anno</span>
          </div>
          <div className="flex justify-between text-zinc-600 pt-1 border-t border-[#1E1E28]">
            <span>+ IVA 22%</span>
            <span>annullabile in qualsiasi momento</span>
          </div>
        </div>

        <button
          data-testid="paywall-upgrade-btn"
          onClick={() => navigate("/billing/pricing")}
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 uppercase tracking-[0.25em] text-xs cursor-pointer"
        >
          Sblocca ora →
        </button>

        <button
          onClick={onClose}
          className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 hover:text-zinc-100 cursor-pointer"
        >
          Più tardi
        </button>
      </div>
    </div>
  );
}
