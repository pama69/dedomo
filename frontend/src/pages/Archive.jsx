import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

export default function Archive() {
  const [items, setItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [activeProperty, setActiveProperty] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/checkins").then((r) => r.data),
      api.get("/properties").then((r) => r.data),
    ])
      .then(([c, p]) => {
        setItems(c);
        setProperties(p);
        if (p.length > 0) setActiveProperty(p[0].property_id);
      })
      .finally(() => setLoading(false));
  }, []);

  // Group check-ins by property
  const grouped = {};
  for (const c of items) {
    if (!grouped[c.property_id]) grouped[c.property_id] = [];
    grouped[c.property_id].push(c);
  }

  return (
    <Layout>
      <h2
        className="text-2xl font-bold uppercase tracking-tight text-zinc-100"
        style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
      >
        Archivio Invii
      </h2>

      <RefreshReceiptsButton />

      {loading ? (
        <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-[#1E1E28] p-12 text-center">
          <p className="text-zinc-400 text-sm">Nessun check-in archiviato.</p>
        </div>
      ) : (
        <>
          {/* Property tabs */}
          <div className="flex gap-2 flex-wrap border-b border-[#1E1E28] pb-3">
            {properties.map((p) => {
              const count = grouped[p.property_id]?.length || 0;
              const isActive = activeProperty === p.property_id;
              return (
                <button
                  key={p.property_id}
                  onClick={() => { setActiveProperty(p.property_id); setExpanded(null); }}
                  data-testid={`archive-tab-${p.property_id}`}
                  className={`text-[10px] tracking-[0.25em] uppercase border px-4 py-2 cursor-pointer transition-colors ${
                    isActive
                      ? "border-zinc-100 text-zinc-100"
                      : "border-[#1E1E28] text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {p.nome} <span className="text-zinc-600">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            {(grouped[activeProperty] || []).map((c) => {
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
                        {new Date(c.data_arrivo).toLocaleDateString("it-IT")} → {new Date(c.data_partenza).toLocaleDateString("it-IT")}
                      </p>
                      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mt-1 font-mono">
                        {c.guests?.length || 0} ospite/i · [{c.mode}] · {new Date(c.created_at).toLocaleString("it-IT")}
                      </p>
                    </div>
                    <div className="flex gap-2 font-mono text-[10px]">
                      <Tag ok={aw?.success} skipped={aw?.skipped} label="AW" />
                      <Tag ok={r1k?.success} skipped={r1k?.skipped} label="T5" />
                      <Tag ok={is_?.success} skipped={is_?.skipped} label="IS" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[#1E1E28] p-4 flex flex-col gap-3 font-mono text-xs">
                      <div className="flex flex-col gap-1">
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
                        {r1k?.xml_preview && (
                          <details className="border border-[#1E1E28] p-3 text-[10px]">
                            <summary className="text-zinc-400 cursor-pointer uppercase tracking-widest">
                              Anteprima XML Turismo 5
                            </summary>
                            <pre className="text-zinc-500 mt-2 whitespace-pre-wrap break-all text-[9px]">
                              {r1k.xml_preview}
                            </pre>
                          </details>
                        )}
                        {aw?.schedine_preview && (
                          <details className="border border-[#1E1E28] p-3 text-[10px]">
                            <summary className="text-zinc-400 cursor-pointer uppercase tracking-widest">
                              Anteprima Schedine Alloggiati Web
                            </summary>
                            <pre className="text-zinc-500 mt-2 whitespace-pre-wrap break-all text-[9px]">
                              {aw.schedine_preview.join("\n")}
                            </pre>
                          </details>
                        )}
                        {c.mode === "PROD" && aw?.success && (
                          <a
                            href={`${api.defaults.baseURL}/checkins/${c.checkin_id}/alloggiati-ricevuta`}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`aw-pdf-${c.checkin_id}`}
                            className={`text-center border px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer transition-colors ${
                              c.alloggiati_ricevuta_pdf
                                ? "border-emerald-500/40 text-emerald-400 hover:border-emerald-400"
                                : "border-[#1E1E28] text-zinc-500 hover:border-zinc-500"
                            }`}
                          >
                            {c.alloggiati_ricevuta_pdf
                              ? "✓ Ricevuta Alloggiati Web (PDF)"
                              : "Ricevuta Alloggiati Web — Disponibile dopo 24h"}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {(grouped[activeProperty] || []).length === 0 && (
              <p className="text-zinc-600 text-xs font-mono mt-4">
                [ NESSUN INVIO PER QUESTA STRUTTURA ]
              </p>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}

function Tag({ ok, skipped, label }) {
  const tag = skipped ? "SKIP" : ok ? "OK" : "ERR";
  const color = skipped ? "text-zinc-500" : ok ? "text-emerald-500" : "text-red-500";
  return <span className={color}>{label} [{tag}]</span>;
}

function RefreshReceiptsButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    setLoading(true);
    setMsg("");
    try {
      const r = await api.post("/admin/refresh-receipts");
      setMsg(`Ricevute totali in archivio: ${r.data.total_cached_receipts}`);
    } catch (e) {
      setMsg(e.response?.data?.detail || "Errore");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        data-testid="refresh-receipts-btn"
        className="self-start border border-[#1E1E28] hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
      >
        {loading ? "Recupero in corso..." : "↻ Recupera ricevute Alloggiati Web"}
      </button>
      {msg && (
        <p className="text-zinc-500 text-[10px] font-mono">{msg}</p>
      )}
      <p className="text-zinc-600 text-[10px] font-mono">
        Recupero automatico ogni ora. Le ricevute sono disponibili 24h dopo l'invio.
      </p>
    </div>
  );
}
