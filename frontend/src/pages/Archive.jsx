import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

export default function Archive() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api
      .get("/checkins")
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <h2
        className="text-2xl font-bold uppercase tracking-tight text-zinc-100"
        style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
      >
        Archivio
      </h2>

      {loading ? (
        <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-[#1E1E28] p-12 text-center">
          <p className="text-zinc-400 text-sm">Nessun check-in archiviato.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((c) => {
            const aw = c.results?.alloggiati_web;
            const r1k = c.results?.ross1000;
            const is_ = c.results?.imposta_soggiorno;
            const isOpen = expanded === c.checkin_id;
            return (
              <div
                key={c.checkin_id}
                data-testid={`archive-row-${c.checkin_id}`}
                className="bg-[#0E0E14] border border-[#1E1E28]"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : c.checkin_id)}
                  className="w-full p-4 flex justify-between items-center text-left cursor-pointer hover:bg-[#15151C] transition-colors"
                >
                  <div>
                    <p className="font-medium text-zinc-100">
                      {c.property_name}
                    </p>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mt-1 font-mono">
                      {new Date(c.created_at).toLocaleString("it-IT")} ·
                      {" "}{c.guests?.length || 0} ospite/i · [{c.mode}]
                    </p>
                  </div>
                  <div className="flex gap-2 font-mono text-[10px]">
                    <Tag ok={aw?.success} skipped={aw?.skipped} label="AW" />
                    <Tag ok={r1k?.success} skipped={r1k?.skipped} label="R1K" />
                    <Tag ok={is_?.success} skipped={is_?.skipped} label="IS" />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[#1E1E28] p-4 flex flex-col gap-3 font-mono text-xs">
                    <Row label="ARRIVO" value={new Date(c.data_arrivo).toLocaleDateString("it-IT")} />
                    <Row label="PARTENZA" value={new Date(c.data_partenza).toLocaleDateString("it-IT")} />
                    <div className="flex flex-col gap-1 mt-2">
                      <span className="text-zinc-500">OSPITI</span>
                      {c.guests?.map((g, i) => (
                        <span key={i} className="text-zinc-200">
                          #{i + 1} {g.cognome} {g.nome} — {g.tipo_documento} {g.numero_documento}
                        </span>
                      ))}
                    </div>
                    {is_?.calculation && (
                      <div className="border-t border-[#1E1E28] pt-3 flex justify-between">
                        <span className="text-zinc-500">IMPOSTA SOGGIORNO</span>
                        <span className="text-emerald-500">€ {is_.calculation.totale_imposta.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-2 mt-2">
                      {is_?.calculation && (
                        <a
                          href={`${api.defaults.baseURL}/checkins/${c.checkin_id}/receipt-pdf`}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`pdf-${c.checkin_id}`}
                          className="text-center border border-[#1E1E28] hover:border-zinc-500 px-4 py-3 uppercase tracking-widest text-[10px] text-zinc-300 cursor-pointer"
                        >
                          Scarica Ricevuta (PDF)
                        </a>
                      )}
                      {r1k?.csv_content && (
                        <a
                          href={`${api.defaults.baseURL}/checkins/${c.checkin_id}/ross1000-csv`}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`csv-${c.checkin_id}`}
                          className="text-center border border-[#1E1E28] hover:border-zinc-500 px-4 py-3 uppercase tracking-widest text-[10px] text-zinc-300 cursor-pointer"
                        >
                          Scarica CSV Ross 1000
                        </a>
                      )}
                      {c.mode === "PROD" && (
                        <a
                          href={`${api.defaults.baseURL}/checkins/${c.checkin_id}/alloggiati-ricevuta`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-center border border-[#1E1E28] hover:border-zinc-500 px-4 py-3 uppercase tracking-widest text-[10px] text-zinc-300 cursor-pointer"
                        >
                          Ricevuta Alloggiati Web (PDF)
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-100">{value}</span>
    </div>
  );
}

function Tag({ ok, skipped, label }) {
  const tag = skipped ? "SKIP" : ok ? "OK" : "ERR";
  const color = skipped ? "text-zinc-500" : ok ? "text-emerald-500" : "text-red-500";
  return <span className={color}>{label} [{tag}]</span>;
}
