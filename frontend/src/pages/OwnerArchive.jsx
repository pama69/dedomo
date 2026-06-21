import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";

export default function OwnerArchive() {
  const { ownerId } = useParams();
  const decodedId = decodeURIComponent(ownerId || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tab, setTab] = useState("ricevute"); // ricevute | schedine | locazione
  const [downloading, setDownloading] = useState("");
  const [showMonthlySummary, setShowMonthlySummary] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      const r = await api.get(`/owners/${encodeURIComponent(decodedId)}/archive?${params}`);
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Errore caricamento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [decodedId]);

  const downloadFile = async (url, filename) => {
    setDownloading(filename);
    try {
      const r = await api.get(url, { responseType: "blob" });
      const blob = new Blob([r.data], { type: r.headers["content-type"] || "application/octet-stream" });
      const reader = new FileReader();
      reader.onload = () => {
        const a = document.createElement("a");
        a.href = reader.result;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      alert(e.response?.data?.detail || "Errore download");
    } finally {
      setDownloading("");
    }
  };

  const downloadZip = async (categoria) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    params.append("categoria", categoria);
    const safeId = decodedId.replace(/[^A-Za-z0-9]/g, "_").slice(0, 20);
    await downloadFile(
      `/owners/${encodeURIComponent(decodedId)}/archive/zip?${params}`,
      `archivio_${categoria}_${safeId}.zip`,
    );
  };

  const schedine = data?.schedine || [];
  const ricevute = data?.ricevute || [];
  const [locazione, setLocazione] = useState([]);

  // Load locazione receipts only if CF is present (not NOCF::)
  useEffect(() => {
    if (decodedId.startsWith("NOCF::")) {
      setLocazione([]);
      return;
    }
    api.get(`/owners/${encodeURIComponent(decodedId)}/locazione-receipts`)
      .then((r) => setLocazione(r.data || []))
      .catch(() => setLocazione([]));
  }, [decodedId, data]);

  return (
    <Layout>
      <div className="flex items-center gap-3">
        <Link
          to="/archive/owners"
          data-testid="back-to-owners"
          className="text-zinc-500 hover:text-zinc-100 text-[10px] uppercase tracking-[0.25em] cursor-pointer"
        >
          ← Proprietari
        </Link>
      </div>

      <h2
        className="text-2xl font-bold uppercase tracking-tight text-zinc-100"
        style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
      >
        {data?.properties && data.properties.length > 0
          ? (decodedId.startsWith("NOCF::") ? decodedId.slice(6) : decodedId)
          : "Archivio Proprietario"}
      </h2>

      {/* Filters */}
      <div className="border border-border p-4 flex flex-col gap-3">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Filtri</span>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Da</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="filter-date-from"
              className="bg-transparent border border-border px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">A</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="filter-date-to"
              className="bg-transparent border border-border px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
            />
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={reload}
            data-testid="apply-filters"
            className="border border-zinc-100 hover:bg-zinc-100 hover:text-black text-zinc-100 px-4 py-2 uppercase tracking-[0.25em] text-[10px] cursor-pointer transition-colors"
          >
            Applica
          </button>
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); setTimeout(reload, 0); }}
            className="border border-border hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-[0.25em] text-[10px] cursor-pointer"
          >
            Reset
          </button>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => downloadZip("all")}
              disabled={!!downloading}
              data-testid="download-all-zip"
              className="border border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-400 px-4 py-2 uppercase tracking-[0.25em] text-[10px] cursor-pointer disabled:opacity-50"
            >
              {downloading ? "..." : "↓ ZIP Tutto"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("ricevute")}
          data-testid="tab-ricevute"
          className={`text-[10px] tracking-[0.25em] uppercase px-4 py-2 cursor-pointer transition-colors ${
            tab === "ricevute" ? "text-zinc-100 border-b-2 border-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Ricevute Imposta ({ricevute.length})
        </button>
        <button
          onClick={() => setTab("schedine")}
          data-testid="tab-schedine"
          className={`text-[10px] tracking-[0.25em] uppercase px-4 py-2 cursor-pointer transition-colors ${
            tab === "schedine" ? "text-zinc-100 border-b-2 border-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Schedine Alloggiati ({schedine.length})
        </button>
        <button
          onClick={() => setTab("locazione")}
          data-testid="tab-locazione"
          className={`text-[10px] tracking-[0.25em] uppercase px-4 py-2 cursor-pointer transition-colors ${
            tab === "locazione" ? "text-sky-300 border-b-2 border-sky-400" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Ricevute Locazione ({locazione.length})
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
      ) : error ? (
        <p className="text-red-500 text-sm font-mono">{error}</p>
      ) : tab === "ricevute" ? (
        <>
          <div className="flex justify-end gap-3 mb-2">
            <button
              onClick={() => setShowMonthlySummary(true)}
              disabled={decodedId.startsWith("NOCF::")}
              data-testid="open-monthly-summary"
              className="text-[10px] tracking-[0.25em] uppercase text-sky-400 hover:text-sky-300 cursor-pointer disabled:opacity-50"
            >
              📊 Riepilogo Mensile
            </button>
            {ricevute.length > 0 && (
              <button
                onClick={() => downloadZip("ricevute")}
                disabled={!!downloading}
                data-testid="download-ricevute-zip"
                className="text-[10px] tracking-[0.25em] uppercase text-amber-400 hover:text-amber-300 cursor-pointer disabled:opacity-50"
              >
                ↓ ZIP Ricevute
              </button>
            )}
          </div>
          {ricevute.length === 0 ? (
            <p className="text-zinc-500 text-sm font-mono border border-dashed border-border p-8 text-center">
              Nessuna ricevuta nel periodo selezionato.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {ricevute.map((r) => (
                <div
                  key={`${r.checkin_id}-${r.receipt_index}`}
                  data-testid={`ricevuta-row-${r.checkin_id}-${r.receipt_index}`}
                  className="border border-border p-3 flex flex-col gap-2"
                >
                  <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <span className="text-zinc-100 text-sm font-mono">
                      N. {r.numero} · {r.data}
                    </span>
                    <span className="text-emerald-500 text-sm font-mono">
                      € {r.importo?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                    <span>Capogruppo: <span className="text-zinc-300">{r.capogruppo || r.ospite_nome}</span></span>
                    <span>{r.property_name}</span>
                  </div>
                  <button
                    onClick={() => downloadFile(
                      `/checkins/${r.checkin_id}/comune-receipts/${r.receipt_index}`,
                      `ricevuta_${r.numero}.pdf`,
                    )}
                    disabled={!!downloading}
                    data-testid={`download-ricevuta-${r.checkin_id}-${r.receipt_index}`}
                    className="self-start text-[10px] tracking-[0.25em] uppercase text-zinc-300 hover:text-zinc-100 cursor-pointer disabled:opacity-50"
                  >
                    ↓ Scarica PDF
                  </button>
                </div>
              ))}
            </div>
          )}
          {showMonthlySummary && (
            <MonthlySummaryModal
              cf={decodedId}
              onClose={() => setShowMonthlySummary(false)}
            />
          )}
        </>
      ) : tab === "schedine" ? (
        // schedine tab
        schedine.length === 0 ? (
          <p className="text-zinc-500 text-sm font-mono border border-dashed border-border p-8 text-center">
            Nessuna schedina Alloggiati Web nel periodo selezionato.
            <br />
            <span className="text-zinc-600 text-[10px]">
              Le ricevute Alloggiati Web sono disponibili solo per invii in modalità PRODUZIONE,
              24h dopo l&apos;invio.
            </span>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <button
                onClick={() => downloadZip("schedine")}
                disabled={!!downloading}
                data-testid="download-schedine-zip"
                className="text-[10px] tracking-[0.25em] uppercase text-emerald-400 hover:text-emerald-300 cursor-pointer disabled:opacity-50"
              >
                ↓ ZIP Schedine
              </button>
            </div>
            {schedine.map((s) => (
              <div
                key={s.checkin_id}
                data-testid={`schedina-row-${s.checkin_id}`}
                className="border border-border p-3 flex flex-col gap-2"
              >
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <span className="text-zinc-100 text-sm font-mono">
                    Capogruppo: {s.capogruppo || "—"}
                  </span>
                  <span className="text-zinc-500 text-sm font-mono">
                    {s.data_arrivo} → {s.data_partenza}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>Ospiti: <span className="text-zinc-300">{s.ospiti_count}</span></span>
                  <span>{s.property_name}</span>
                </div>
                <button
                  onClick={() => downloadFile(
                    `/checkins/${s.checkin_id}/alloggiati-ricevuta`,
                    `schedina_${s.checkin_id}.pdf`,
                  )}
                  disabled={!!downloading}
                  data-testid={`download-schedina-${s.checkin_id}`}
                  className="self-start text-[10px] tracking-[0.25em] uppercase text-zinc-300 hover:text-zinc-100 cursor-pointer disabled:opacity-50"
                >
                  ↓ Scarica PDF (se disponibile)
                </button>
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === "locazione" && !loading && (
        locazione.length === 0 ? (
          <p className="text-zinc-500 text-sm font-mono border border-dashed border-border p-8 text-center">
            Nessuna ricevuta di locazione per questo proprietario.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {locazione.map((r) => (
              <div
                key={`${r.checkin_id}-${r.index}`}
                data-testid={`locazione-row-${r.checkin_id}-${r.index}`}
                className="border border-sky-500/30 bg-sky-500/5 p-3 flex flex-col gap-2"
              >
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <span className="text-zinc-100 text-sm font-mono">
                    {r.numero} · {r.data_emissione}
                  </span>
                  <span className="text-sky-300 text-sm font-mono font-bold">
                    € {r.totale?.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 flex-wrap gap-2">
                  <span>Capogruppo: <span className="text-zinc-300">{r.capogruppo_nome}</span></span>
                  <span>{r.property_name}</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-600 flex-wrap gap-2">
                  <span>Locazione: € {r.importo_locazione?.toFixed(2)}</span>
                  {r.imposta_soggiorno > 0 && <span>Imposta: € {r.imposta_soggiorno?.toFixed(2)}</span>}
                  {r.marca_bollo > 0 && <span className="text-amber-500">Bollo: € {r.marca_bollo?.toFixed(2)}</span>}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => window.open(`${api.defaults.baseURL}/checkins/${r.checkin_id}/locazione-receipts/${r.index}/html`, "_blank", "noopener")}
                    data-testid={`view-locazione-${r.checkin_id}-${r.index}`}
                    className="text-[10px] tracking-[0.25em] uppercase text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    🖨 Stampa
                  </button>
                  <button
                    onClick={() => downloadFile(
                      `/checkins/${r.checkin_id}/locazione-receipts/${r.index}?download=1`,
                      `ricevuta_locazione_${r.numero.replace(/\//g, "_")}.pdf`,
                    )}
                    disabled={!!downloading}
                    data-testid={`download-locazione-${r.checkin_id}-${r.index}`}
                    className="text-[10px] tracking-[0.25em] uppercase text-zinc-300 hover:text-zinc-100 cursor-pointer disabled:opacity-50"
                  >
                    ↓ Scarica PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Layout>
  );
}

function MonthlySummaryModal({ cf, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    api.get(`/owners/${encodeURIComponent(cf)}/comune-receipts/monthly-summary`)
      .then((r) => { if (alive) { setRows(r.data || []); setLoading(false); } })
      .catch((e) => { if (alive) { setErr(e.response?.data?.detail || "Errore caricamento"); setLoading(false); } });
    return () => { alive = false; };
  }, [cf]);

  const totals = rows.reduce(
    (acc, r) => ({
      persone: acc.persone + (r.persone_paganti || 0),
      notti: acc.notti + (r.notti_totali || 0),
      imposta: acc.imposta + (r.totale_imposta || 0),
      ricevute: acc.ricevute + (r.receipts_count || 0),
    }),
    { persone: 0, notti: 0, imposta: 0, ricevute: 0 },
  );

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      data-testid="monthly-summary-modal"
      onClick={onClose}
    >
      <div
        className="bg-background border border-sky-500/40 max-w-3xl w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-baseline">
          <div>
            <h3 className="text-lg font-bold uppercase text-sky-300" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              📊 Riepilogo Mensile — Imposta di Soggiorno
            </h3>
            <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 font-mono mt-1">
              Solo ricevute con trasmissione Alloggiati Web in PROD
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="monthly-summary-close"
            className="text-zinc-400 hover:text-zinc-100 cursor-pointer text-xl"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
        ) : err ? (
          <p className="text-red-400 text-sm font-mono">{err}</p>
        ) : rows.length === 0 ? (
          <p className="text-zinc-500 text-sm font-mono border border-dashed border-border p-6 text-center">
            Nessuna ricevuta in modalità PROD con trasmissione Alloggiati Web andata a buon fine.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1.4fr_repeat(5,1fr)] gap-2 text-[9px] tracking-[0.2em] uppercase text-zinc-500 font-mono border-b border-border pb-2">
              <span>Mese / Anno</span>
              <span className="text-right">Prima Ric.</span>
              <span className="text-right">Ultima Ric.</span>
              <span className="text-right">Pers. Pag.</span>
              <span className="text-right">Notti Tot.</span>
              <span className="text-right">Imposta €</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.month_key}
                data-testid={`monthly-row-${r.month_key}`}
                className="grid grid-cols-[1.4fr_repeat(5,1fr)] gap-2 text-[11px] font-mono py-2 border-b border-border/40 hover:bg-surface-1 items-baseline"
              >
                <span className="text-zinc-100">{r.month_label}</span>
                <span className="text-right text-zinc-300 truncate" title={r.primo}>{r.primo}</span>
                <span className="text-right text-zinc-300 truncate" title={r.ultimo}>{r.ultimo}</span>
                <span className="text-right text-zinc-300">{r.persone_paganti}</span>
                <span className="text-right text-zinc-300">{r.notti_totali}</span>
                <span className="text-right text-emerald-400 font-bold">€ {r.totale_imposta.toFixed(2)}</span>
              </div>
            ))}
            <div
              data-testid="monthly-totals"
              className="grid grid-cols-[1.4fr_repeat(5,1fr)] gap-2 text-[11px] font-mono py-3 border-t-2 border-sky-500/50 bg-sky-500/5 items-baseline mt-2"
            >
              <span className="text-sky-300 font-bold uppercase tracking-widest text-[10px]">TOTALE</span>
              <span className="text-right text-zinc-500">—</span>
              <span className="text-right text-zinc-500">—</span>
              <span className="text-right text-zinc-100 font-bold">{totals.persone}</span>
              <span className="text-right text-zinc-100 font-bold">{totals.notti}</span>
              <span className="text-right text-emerald-300 font-bold">€ {totals.imposta.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono mt-2">
              {totals.ricevute} ricevute · raggruppate per data emissione
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

