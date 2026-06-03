const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * Pulsante "Scarica Manuale" — link diretto al backend.
 * Stesso identico meccanismo di "incollare l'URL nella barra degli indirizzi",
 * che è l'unico che funziona affidabilmente su ogni configurazione di Chrome.
 */
export default function DownloadManualButton({ variant = "default", testid = "download-manual-btn" }) {
  const url = `${BACKEND}/api/manual/download`;
  const baseCls =
    variant === "primary"
      ? "text-[10px] tracking-[0.25em] uppercase text-[#05050A] bg-zinc-100 hover:bg-white px-5 py-3 transition-colors cursor-pointer no-underline"
      : "text-[10px] tracking-[0.25em] uppercase text-zinc-400 hover:text-zinc-100 border border-[#1E1E28] hover:border-zinc-500 px-4 py-2.5 transition-colors cursor-pointer no-underline";

  return (
    <a
      href={url}
      data-testid={testid}
      className={baseCls}
    >
      ↓ Scarica Manuale (PDF)
    </a>
  );
}
