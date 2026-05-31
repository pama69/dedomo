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
  const [tab, setTab] = useState("ricevute"); // ricevute | schedine
  const [downloading, setDownloading] = useState("");

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

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [decodedId]);

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
      <div className="border border-[#1E1E28] p-4 flex flex-col gap-3">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Filtri</span>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Da</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="filter-date-from"
              className="bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">A</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="filter-date-to"
              className="bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
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
            className="border border-[#1E1E28] hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-[0.25em] text-[10px] cursor-pointer"
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
      <div className="flex gap-2 border-b border-[#1E1E28]">
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
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
      ) : error ? (
        <p className="text-red-500 text-sm font-mono">{error}</p>
      ) : tab === "ricevute" ? (
        ricevute.length === 0 ? (
          <p className="text-zinc-500 text-sm font-mono border border-dashed border-[#1E1E28] p-8 text-center">
            Nessuna ricevuta nel periodo selezionato.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <button
                onClick={() => downloadZip("ricevute")}
                disabled={!!downloading}
                data-testid="download-ricevute-zip"
                className="text-[10px] tracking-[0.25em] uppercase text-amber-400 hover:text-amber-300 cursor-pointer disabled:opacity-50"
              >
                ↓ ZIP Ricevute
              </button>
            </div>
            {ricevute.map((r) => (
              <div
                key={`${r.checkin_id}-${r.receipt_index}`}
                data-testid={`ricevuta-row-${r.checkin_id}-${r.receipt_index}`}
                className="border border-[#1E1E28] p-3 flex flex-col gap-2"
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
        )
      ) : (
        // schedine tab
        schedine.length === 0 ? (
          <p className="text-zinc-500 text-sm font-mono border border-dashed border-[#1E1E28] p-8 text-center">
            Nessuna schedina Alloggiati Web nel periodo selezionato.
            <br />
            <span className="text-zinc-600 text-[10px]">
              Le ricevute Alloggiati Web sono disponibili solo per invii in modalità PRODUZIONE,
              24h dopo l'invio.
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
                className="border border-[#1E1E28] p-3 flex flex-col gap-2"
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
      )}
    </Layout>
  );
}
