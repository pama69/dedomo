import { useState } from "react";
import api from "@/lib/api";

/**
 * Pulsante "Scarica Manuale" — pattern originale che funzionava in incognito.
 */
export default function DownloadManualButton({ variant = "default", testid = "download-manual-btn" }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onClick = async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await api.get("/manual/download", { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      const reader = new FileReader();
      reader.onload = () => {
        const a = document.createElement("a");
        a.href = reader.result;
        a.download = "manuale_dedomo.pdf";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.onerror = () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "manuale_dedomo.pdf";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      setErr("Impossibile scaricare il manuale.");
    } finally {
      setLoading(false);
    }
  };

  const baseCls =
    variant === "primary"
      ? "text-[10px] tracking-[0.25em] uppercase text-[#05050A] bg-zinc-100 hover:bg-white px-5 py-3 transition-colors cursor-pointer"
      : "text-[10px] tracking-[0.25em] uppercase text-zinc-400 hover:text-zinc-100 border border-[#1E1E28] hover:border-zinc-500 px-4 py-2.5 transition-colors cursor-pointer";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        data-testid={testid}
        className={`${baseCls} ${loading ? "opacity-60 cursor-wait" : ""}`}
      >
        {loading ? "Generazione…" : "↓ Scarica Manuale (PDF)"}
      </button>
      {err && (
        <span data-testid="download-manual-error" className="text-[10px] text-red-500 font-mono">
          {err}
        </span>
      )}
    </div>
  );
}
