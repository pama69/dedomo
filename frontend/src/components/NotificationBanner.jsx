import { useState, useEffect } from "react";
import { usePushNotifications } from "@/lib/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";

const DISMISSED_KEY = "dedomo_push_dismissed";

export default function NotificationBanner() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, permission, isIOS, isStandalone, loading, subscribe } =
    usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    setDismissed(!!localStorage.getItem(DISMISSED_KEY));
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleSubscribe = async () => {
    const r = await subscribe();
    if (r.ok) setJustEnabled(true);
  };

  // Nessun banner se:
  // - utente non loggato (pagine pubbliche)
  // - push non supportato
  // - già iscritto
  // - permesso negato (non possiamo fare nulla)
  // - utente ha già dismissato
  if (!user || !isSupported || isSubscribed || permission === "denied" || dismissed) return null;

  // iOS non standalone: mostra istruzioni per aggiungere alla home
  if (isIOS && !isStandalone) {
    return (
      <div className="bg-zinc-900 border-b border-amber-500/30 px-4 py-3 flex items-start gap-3">
        <span className="text-amber-400 text-lg mt-0.5">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            <span className="text-amber-400 font-semibold">Per ricevere notifiche su iPhone</span>{" "}
            apri il menu{" "}
            <span className="text-zinc-100">Condividi ↑</span> e tocca{" "}
            <span className="text-zinc-100">"Aggiungi alla schermata Home"</span>. Poi riapri Dedomo
            dall'icona.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-zinc-600 hover:text-zinc-400 text-[18px] leading-none cursor-pointer flex-shrink-0"
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>
    );
  }

  // Banner successo
  if (justEnabled) {
    return (
      <div className="bg-emerald-950/60 border-b border-emerald-500/30 px-4 py-2 flex items-center gap-3">
        <span className="text-emerald-400 text-sm">✓</span>
        <p className="text-[11px] text-emerald-300 flex-1">
          Notifiche attivate — ti avviseremo quando le ricevute Alloggiati Web sono pronte.
        </p>
        <button
          onClick={handleDismiss}
          className="text-zinc-600 hover:text-zinc-400 text-[18px] leading-none cursor-pointer"
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>
    );
  }

  // Banner principale
  return (
    <div className="bg-zinc-900 border-b border-zinc-700/50 px-4 py-2.5 flex items-center gap-3">
      <span className="text-zinc-400 text-sm flex-shrink-0">🔔</span>
      <p className="text-[11px] text-zinc-400 flex-1 min-w-0">
        Attiva le notifiche push per sapere quando le ricevute Alloggiati Web sono pronte, senza dover riaprire l'app.
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="border border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-400 px-3 py-1.5 uppercase tracking-widest text-[9px] cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "..." : "Attiva"}
        </button>
        <button
          onClick={handleDismiss}
          className="text-zinc-600 hover:text-zinc-400 text-[18px] leading-none cursor-pointer"
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>
    </div>
  );
}
