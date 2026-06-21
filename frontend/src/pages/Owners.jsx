import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";

export default function Owners() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/owners")
      .then((r) => setOwners(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Errore caricamento"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="flex items-center gap-3">
        <Link
          to="/archive"
          data-testid="back-to-archive"
          className="text-zinc-500 hover:text-zinc-100 text-[10px] uppercase tracking-[0.25em] cursor-pointer"
        >
          ← Archivio
        </Link>
      </div>

      <h2
        className="typo-h1"
        style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
      >
        Proprietari / Codici Fiscali
      </h2>

      <p className="text-zinc-500 text-[11px] font-mono leading-relaxed">
        Elenco dei proprietari configurati. Clicca per visualizzare schedine Alloggiati
        Web e ricevute Imposta di Soggiorno in ordine cronologico, filtrabili per periodo,
        e scaricare singolarmente o in archivio ZIP.
      </p>

      {loading ? (
        <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
      ) : error ? (
        <p className="text-red-500 text-sm font-mono">{error}</p>
      ) : owners.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center">
          <p className="text-zinc-400 text-sm mb-3">
            Nessun proprietario configurato.
          </p>
          <p className="text-zinc-600 text-[11px] font-mono">
            Imposta "Proprietario" e "Codice Fiscale" negli appartamenti in Impostazioni.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {owners.map((o) => (
            <Link
              key={o.id}
              to={`/archive/owners/${encodeURIComponent(o.id)}`}
              data-testid={`owner-card-${o.id}`}
              className="border border-border hover:border-zinc-500 p-4 flex flex-col gap-2 cursor-pointer transition-colors"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-zinc-100 text-base font-bold uppercase tracking-tight">
                  {o.proprietario || "—"}
                </span>
                <span className="text-zinc-500 text-[10px] font-mono uppercase">
                  {o.codice_fiscale || "Senza CF"}
                </span>
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-zinc-500">
                <span>Appartamenti: <span className="text-zinc-300">{o.properties?.length || 0}</span></span>
                <span>Check-in: <span className="text-emerald-500">{o.checkins_count}</span></span>
                <span>Ricevute: <span className="text-amber-400">{o.receipts_count}</span></span>
              </div>
              {o.properties && o.properties.length > 0 && (
                <div className="text-[10px] font-mono text-zinc-600">
                  {o.properties.map((p) => p.nome).filter(Boolean).join(" · ")}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
