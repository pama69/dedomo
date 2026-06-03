import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

      {/* Sub-nav */}
      <div className="flex gap-2 flex-wrap">
        <Link
          to="/archive/owners"
          data-testid="nav-archive-owners"
          className="border border-[#1E1E28] hover:border-emerald-500/60 hover:text-emerald-400 text-zinc-300 px-4 py-2 uppercase tracking-[0.25em] text-[10px] cursor-pointer transition-colors"
        >
          → Archivio per Proprietario / Codice Fiscale
        </Link>
      </div>

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
                          <GenerateReceiptButton
                            checkinId={c.checkin_id}
                            guests={c.guests}
                            importo={is_.calculation.totale_imposta}
                            onGenerated={() => window.location.reload()}
                          />
                        )}
                        {c.comune_receipts && c.comune_receipts.length > 0 && (
                          <div className="flex flex-col gap-1 border border-[#1E1E28] p-3">
                            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-1">Ricevute Imposta di Soggiorno</span>
                            {c.comune_receipts.map((rc, idx) => (
                              <DownloadReceiptBtn
                                key={idx}
                                checkinId={c.checkin_id}
                                index={idx}
                                numero={rc.numero}
                                data={rc.data}
                                importo={rc.importo}
                                onDeleted={() => window.location.reload()}
                              />
                            ))}
                          </div>
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
                          c.alloggiati_ricevuta_pdf ? (
                            <DownloadAlloggiatiBtn checkinId={c.checkin_id} />
                          ) : (
                            <span className="text-center border border-[#1E1E28] text-zinc-500 px-4 py-3 uppercase tracking-widest text-[10px]">
                              Ricevuta Alloggiati Web — Disponibile dopo 24h
                            </span>
                          )
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

function downloadBlob(blob, filename) {
  // Use the same approach as DownloadManualButton (which works for the user):
  // FileReader → data: URL → programmatic <a> click.
  // This is the most compatible across Chrome/Firefox/Safari, in or out of iframe.
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
  reader.onerror = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  reader.readAsDataURL(blob);
}

function DownloadReceiptBtn({ checkinId, index, numero, data, importo, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pngUrl, setPngUrl] = useState("");

  const toggle = () => setOpen((v) => !v);

  // Two-step: fetch file via axios → store blob URL in state → render <a download>
  // which the user clicks directly. Guaranteed to work in any Chrome configuration.
  const preparePdf = async () => {
    setErr("");
    setPdfUrl("");
    setBusy("pdf");
    try {
      const r = await api.get(`/checkins/${checkinId}/comune-receipts/${index}`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErr("Impossibile preparare il PDF.");
    } finally {
      setBusy("");
    }
  };

  const preparePng = async () => {
    setErr("");
    setPngUrl("");
    setBusy("png");
    try {
      const r = await api.get(`/checkins/${checkinId}/comune-receipts/${index}/preview`, {
        responseType: "blob",
        params: { download: 1 },
      });
      const blob = new Blob([r.data], { type: "image/png" });
      setPngUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErr("Impossibile preparare il PNG.");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Eliminare la ricevuta N. ${numero}? Potrai poi generarne una nuova con dati corretti.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/checkins/${checkinId}/comune-receipts/${index}`);
      onDeleted && onDeleted();
    } catch (e) {
      setErr(`Errore eliminazione: ${e.response?.data?.detail || e.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const previewSrc = `${api.defaults.baseURL}/checkins/${checkinId}/comune-receipts/${index}/preview`;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        data-testid={`comune-receipt-${checkinId}-${index}`}
        className="flex justify-between items-center text-[10px] font-mono text-zinc-300 hover:text-zinc-100 hover:bg-[#15151C] px-2 py-2 cursor-pointer"
      >
        <span>N. {numero} — {data}</span>
        <span className="text-emerald-500">€ {importo?.toFixed(2)} {open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          <img
            src={previewSrc}
            alt={`Ricevuta ${numero}`}
            className="w-full border border-[#1E1E28] bg-white"
            data-testid={`comune-receipt-preview-${checkinId}-${index}`}
          />
          <p className="text-zinc-500 text-[10px] font-mono leading-relaxed">
            Tasto destro sull'immagine → "Salva immagine come..." per salvare la ricevuta.
            <br/>Oppure usa i pulsanti qui sotto.
          </p>
          <div className="flex gap-2 flex-wrap">
            {!pngUrl ? (
              <button
                type="button"
                onClick={preparePng}
                disabled={!!busy}
                data-testid={`comune-receipt-png-${checkinId}-${index}`}
                className="flex-1 text-center border border-emerald-500/40 hover:border-emerald-400 text-emerald-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
              >
                {busy === "png" ? "Preparo PNG…" : "↓ Prepara PNG"}
              </button>
            ) : (
              <a
                href={pngUrl}
                download={`ricevuta_${numero}.png`}
                data-testid={`comune-receipt-png-link-${checkinId}-${index}`}
                className="flex-1 text-center border border-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer animate-pulse no-underline"
              >
                ✓ CLICCA QUI PER SALVARE PNG
              </a>
            )}
            {!pdfUrl ? (
              <button
                type="button"
                onClick={preparePdf}
                disabled={!!busy}
                data-testid={`comune-receipt-download-${checkinId}-${index}`}
                className="flex-1 text-center border border-[#1E1E28] hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
              >
                {busy === "pdf" ? "Preparo PDF…" : "↓ Prepara PDF"}
              </button>
            ) : (
              <a
                href={pdfUrl}
                download={`ricevuta_comune_${numero}.pdf`}
                data-testid={`comune-receipt-download-link-${checkinId}-${index}`}
                className="flex-1 text-center border border-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer animate-pulse no-underline"
              >
                ✓ CLICCA QUI PER SALVARE PDF
              </a>
            )}
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              data-testid={`comune-receipt-delete-${checkinId}-${index}`}
              className="text-center border border-red-500/40 hover:border-red-400 text-red-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
            >
              {deleting ? "..." : "Elimina/Rigenera"}
            </button>
          </div>
          {err && (
            <p
              data-testid={`comune-receipt-error-${checkinId}-${index}`}
              className="text-[10px] font-mono px-2 py-1 text-red-400 bg-red-500/10 border border-red-500/30"
            >
              {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GenerateReceiptButton({ checkinId, guests, importo, onGenerated }) {
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [ospiteIdx, setOspiteIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!numero.trim()) { setError("Numero ricevuta obbligatorio"); return; }
    setLoading(true); setError("");
    try {
      await api.post(`/checkins/${checkinId}/comune-receipt`, {
        numero_ricevuta: numero,
        data_ricevuta: data,
        ospite_index: ospiteIdx,
      });
      setOpen(false); setNumero("");
      onGenerated && onGenerated();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Errore generazione ricevuta");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`gen-receipt-${checkinId}`}
        className="text-center border border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-400 text-amber-400 px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer transition-colors"
      >
        + Genera Ricevuta Imposta (€ {importo?.toFixed(2)})
      </button>
    );
  }

  return (
    <div className="border border-amber-500/40 p-4 flex flex-col gap-3 bg-[#0E0E14]">
      <span className="text-[10px] tracking-[0.25em] uppercase text-amber-400">Genera Ricevuta Imposta di Soggiorno</span>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Numero Ricevuta</span>
        <input
          type="text"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="Es. 2026/001"
          autoFocus
          data-testid={`gen-receipt-numero-${checkinId}`}
          className="bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm font-mono"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Data Ricevuta</span>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          data-testid={`gen-receipt-data-${checkinId}`}
          className="bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Intestatario</span>
        <select
          value={ospiteIdx}
          onChange={(e) => setOspiteIdx(Number(e.target.value))}
          data-testid={`gen-receipt-ospite-${checkinId}`}
          className="bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
        >
          {(guests || []).map((g, i) => (
            <option key={i} value={i} className="bg-[#0E0E14] text-zinc-100">
              #{i + 1} {g.cognome} {g.nome}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-red-400 text-[10px] font-mono">[ ERR ] {error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          data-testid={`gen-receipt-submit-${checkinId}`}
          className="flex-1 border border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
        >
          {loading ? "..." : "Genera"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="border border-[#1E1E28] hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

function DownloadAlloggiatiBtn({ checkinId }) {
  const [loading, setLoading] = useState(false);
  const dl = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/checkins/${checkinId}/alloggiati-ricevuta`, { responseType: "blob" });
      downloadBlob(new Blob([r.data], { type: "application/pdf" }), `ricevuta_alloggiati_${checkinId}.pdf`);
    } finally { setLoading(false); }
  };
  return (
    <button
      type="button"
      onClick={dl}
      disabled={loading}
      data-testid={`aw-pdf-${checkinId}`}
      className="text-center border border-emerald-500/40 text-emerald-400 hover:border-emerald-400 px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
    >
      {loading ? "Download..." : "✓ Ricevuta Alloggiati Web (PDF)"}
    </button>
  );
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
