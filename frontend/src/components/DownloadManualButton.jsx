import { useState } from "react";
import api from "@/lib/api";

/**
 * Strategia "two-step" che funziona su qualsiasi Chrome:
 * 1. Click → scarica il file via axios + crea un blob: URL nel DOM
 * 2. Appare un link grande cliccabile → utente lo clicca → Chrome scarica
 *
 * Nessun click programmatic, nessun data: URL, nessun window.open.
 * Il link è un <a download> renderizzato e cliccato DALL'UTENTE.
 */
export default function DownloadManualButton({ variant = "default", testid = "download-manual-btn" }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [blobUrl, setBlobUrl] = useState("");

  const prepare = async () => {
    setErr("");
    setBlobUrl("");
    setLoading(true);
    try {
      const r = await api.get("/manual/download", { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (e) {
      setErr("Impossibile preparare il manuale.");
    } finally {
      setLoading(false);
    }
  };

  const baseCls =
    variant === "primary"
      ? "text-[10px] tracking-[0.25em] uppercase text-[#05050A] bg-zinc-100 hover:bg-white px-5 py-3 transition-colors cursor-pointer"
      : "text-[10px] tracking-[0.25em] uppercase text-zinc-400 hover:text-zinc-100 border border-[#1E1E28] hover:border-zinc-500 px-4 py-2.5 transition-colors cursor-pointer";

  return (
    <div className="flex flex-col gap-2 items-end">
      {!blobUrl && (
        <button
          type="button"
          onClick={prepare}
          disabled={loading}
          data-testid={testid}
          className={`${baseCls} ${loading ? "opacity-60 cursor-wait" : ""}`}
        >
          {loading ? "Preparo manuale…" : "↓ Scarica Manuale (PDF)"}
        </button>
      )}
      {blobUrl && (
        <a
          href={blobUrl}
          download="manuale_dedomo.pdf"
          data-testid={`${testid}-link`}
          className="text-[11px] tracking-[0.25em] uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-400 hover:bg-emerald-500/30 px-5 py-3 transition-colors cursor-pointer animate-pulse"
        >
          ✓ Pronto — Clicca qui per salvare il PDF
        </a>
      )}
      {err && (
        <span data-testid="download-manual-error" className="text-[10px] text-red-500 font-mono">
          {err}
        </span>
      )}
    </div>
  );
}
