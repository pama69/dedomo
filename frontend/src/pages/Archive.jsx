import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";

const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function monthLabel(key) {
  // key = "2026-06"
  const [y, m] = key.split("-");
  return `${MONTHS_IT[parseInt(m) - 1]} ${y}`;
}

export default function Archive() {
  const [items, setItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [activeProperty, setActiveProperty] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({}); // { "<prop>::<month>": true } — opt-in
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  const isDeletable = (c) => {
    if (c.mode !== "TEST") return false;
    const aw = c.results?.alloggiati_web;
    const t5 = c.results?.ross1000;
    return !!(aw && t5);
  };

  const toggleSelect = (id) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setBulkMsg("");
    try {
      const ids = Array.from(selectedIds);
      const r = await api.post("/checkins/bulk-delete", { checkin_ids: ids });
      setSelectedIds(new Set());
      setBulkConfirm(false);
      setBulkMsg(`${r.data.deleted} check-in eliminati.${r.data.skipped?.length ? ` ${r.data.skipped.length} saltati.` : ""}`);
      const fresh = await api.get("/checkins");
      setItems(fresh.data);
      setTimeout(() => setBulkMsg(""), 5000);
    } catch (e) {
      setBulkMsg(`Errore: ${e.response?.data?.detail || e.message}`);
    } finally {
      setBulkBusy(false);
    }
  };

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

  // For active property, group by month/year (sorted desc, most recent month first)
  const monthsForProperty = (propId) => {
    const list = grouped[propId] || [];
    const map = {};
    for (const c of list) {
      const d = new Date(c.data_arrivo);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    const keys = Object.keys(map).sort().reverse();
    return keys.map((k) => ({
      key: k,
      label: monthLabel(k),
      items: map[k].sort((a, b) => (a.data_arrivo < b.data_arrivo ? 1 : -1)),
    }));
  };

  const reloadCheckin = async (checkinId) => {
    try {
      const r = await api.get(`/checkins/${checkinId}`);
      setItems((prev) => prev.map((x) => (x.checkin_id === checkinId ? r.data : x)));
    } catch (e) {
      try {
        const r = await api.get("/checkins");
        setItems(r.data);
      } catch (_) { /* noop */ }
    }
  };

  const toggleMonth = (key) => {
    setExpandedMonths((s) => ({ ...s, [key]: !s[key] }));
  };

  return (
    <Layout>
      <h2 className="typo-h1">Archivio Invii</h2>

      {/* Sub-nav */}
      <div className="flex gap-2 flex-wrap">
        <Link
          to="/archive/owners"
          data-testid="nav-archive-owners"
          className="btn-secondary"
        >
          → Archivio per Proprietario / Codice Fiscale
        </Link>
      </div>

      <RefreshReceiptsButton />

      {loading ? (
        <div className="flex flex-col gap-2">
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
        </div>
      ) : items.length === 0 ? (
        <div className="surface-card p-12 text-center" style={{ borderStyle: "dashed" }}>
          <p className="typo-body text-muted-content">Nessun check-in archiviato</p>
        </div>
      ) : (
        <>
          {/* Property tabs */}
          <div className="flex gap-2 flex-wrap border-b border-border pb-3">
            {properties.map((p) => {
              const count = grouped[p.property_id]?.length || 0;
              const isActive = activeProperty === p.property_id;
              return (
                <button
                  key={p.property_id}
                  onClick={() => { setActiveProperty(p.property_id); setExpanded(null); }}
                  data-testid={`archive-tab-${p.property_id}`}
                  className="typo-meta rounded-lg px-4 py-2 cursor-pointer transition-colors"
                  style={{
                    border: `1px solid ${isActive ? "hsl(var(--accent) / 0.5)" : "hsl(var(--border))"}`,
                    backgroundColor: isActive ? "hsl(var(--accent) / 0.1)" : "transparent",
                    color: isActive ? "hsl(var(--accent))" : "hsl(var(--text-muted))",
                  }}
                >
                  {p.nome} <span style={{ opacity: 0.6 }}>({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            {selectedIds.size > 0 && (
              <div data-testid="bulk-action-bar" className="bg-amber-500/10 border border-amber-500/40 px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-amber-300 text-[11px] font-mono">
                  {selectedIds.size} selezionato/i (solo TEST con AW + T5)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedIds(new Set()); setBulkConfirm(false); }}
                    data-testid="bulk-clear"
                    className="text-[10px] tracking-[0.25em] uppercase text-zinc-400 hover:text-zinc-100 border border-border hover:border-zinc-500 px-3 py-2 cursor-pointer"
                  >
                    Deseleziona
                  </button>
                  {!bulkConfirm ? (
                    <button
                      type="button"
                      onClick={() => setBulkConfirm(true)}
                      data-testid="bulk-delete"
                      className="text-[10px] tracking-[0.25em] uppercase text-red-400 hover:text-red-300 border border-red-500/40 hover:border-red-400 px-3 py-2 cursor-pointer"
                    >
                      🗑 Elimina selezionati
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={bulkDelete}
                      disabled={bulkBusy}
                      data-testid="bulk-delete-confirm"
                      className="text-[10px] tracking-[0.25em] uppercase text-white bg-red-500 hover:bg-red-400 px-3 py-2 cursor-pointer disabled:opacity-50"
                    >
                      {bulkBusy ? "Eliminazione..." : "Conferma eliminazione"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {bulkMsg && (
              <p data-testid="bulk-msg" className={`text-[11px] font-mono px-3 py-2 border ${bulkMsg.toLowerCase().startsWith("errore") ? "text-red-400 border-red-500/40 bg-red-500/10" : "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"}`}>
                {bulkMsg}
              </p>
            )}
            {monthsForProperty(activeProperty).map((mon) => {
              const monthExpanded = expandedMonths[`${activeProperty}::${mon.key}`];
              return (
                <div key={mon.key} className="flex flex-col gap-2" data-testid={`archive-month-${mon.key}`}>
                  <button
                    type="button"
                    onClick={() => toggleMonth(`${activeProperty}::${mon.key}`)}
                    data-testid={`archive-month-toggle-${mon.key}`}
                    className="flex justify-between items-center w-full bg-surface-1 border border-border hover:border-zinc-500 px-4 py-2 cursor-pointer transition-colors text-left"
                  >
                    <span className="text-[11px] tracking-[0.25em] uppercase text-zinc-300 font-mono">
                      {mon.label} <span className="text-zinc-600">· {mon.items.length} invio/i</span>
                    </span>
                    <span className="text-zinc-500 text-xs font-mono">{monthExpanded ? "▼" : "▶"}</span>
                  </button>
                  {monthExpanded && mon.items.map((c) => {
                    const aw = c.results?.alloggiati_web;
                    const r1k = c.results?.ross1000;
                    const is_ = c.results?.imposta_soggiorno;
                    const isOpen = expanded === c.checkin_id;
                    const deletable = isDeletable(c);
                    const isSelected = selectedIds.has(c.checkin_id);
                    return (
                      <div
                        key={c.checkin_id}
                        data-testid={`archive-row-${c.checkin_id}`}
                        className={`bg-surface-1 border ml-3 transition-colors ${isSelected ? "border-amber-500/60" : "border-border"}`}
                      >
                        <div className="flex items-stretch">
                          {deletable && (
                            <label
                              className="flex items-center px-3 border-r border-border cursor-pointer hover:bg-surface-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(c.checkin_id)}
                                data-testid={`select-checkin-${c.checkin_id}`}
                                className="accent-amber-500 w-4 h-4 cursor-pointer"
                              />
                            </label>
                          )}
                          <button
                            onClick={() => setExpanded(isOpen ? null : c.checkin_id)}
                            className="flex-1 p-4 flex justify-between items-center text-left cursor-pointer hover:bg-surface-2 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-zinc-100">
                                {new Date(c.data_arrivo).toLocaleDateString("it-IT")} → {new Date(c.data_partenza).toLocaleDateString("it-IT")}
                              </p>
                              <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mt-1 font-mono">
                                {c.guests?.[0]
                                  ? `${c.guests[0].cognome || ''} ${c.guests[0].nome || ''}`.trim()
                                  : "—"}
                                {c.guests?.length > 1 && (
                                  <span className="text-zinc-600"> (+{c.guests.length - 1})</span>
                                )}
                                {" · "}[{c.mode}] · {new Date(c.created_at).toLocaleString("it-IT")}
                              </p>
                            </div>
                            <div className="flex gap-2 font-mono text-[10px]">
                              <Tag ok={aw?.success} skipped={aw?.skipped} label="AW" />
                              <Tag ok={r1k?.success} skipped={r1k?.skipped} label="T5" />
                              <Tag ok={is_?.success} skipped={is_?.skipped} label="IS" />
                            </div>
                          </button>
                        </div>

                        {isOpen && (
                          <div className="border-t border-border p-4 flex flex-col gap-3 font-mono text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="text-zinc-500">OSPITI</span>
                              {c.guests?.map((g, i) => (
                                <div key={i} className="flex flex-col gap-0.5 border-b border-border/40 pb-2 last:border-0 last:pb-0 mt-1">
                                  <span className="text-zinc-100">
                                    #{i + 1} {g.cognome} {g.nome}
                                    {i === 0 && <span className="text-zinc-600 ml-2">capofamiglia</span>}
                                  </span>
                                  <span className="text-zinc-500">
                                    {[
                                      g.tipo_documento && g.numero_documento
                                        ? `${g.tipo_documento} ${g.numero_documento}`
                                        : null,
                                      g.data_nascita
                                        ? `n. ${new Date(g.data_nascita).toLocaleDateString("it-IT")}`
                                        : null,
                                      g.cittadinanza_nome || g.paese_nome || null,
                                    ].filter(Boolean).join(" · ")}
                                  </span>
                                </div>
                              ))}
                              {c.guests?.length > 0 && (
                                <GuestPageLink checkinId={c.checkin_id} />
                              )}
                      </div>
                      {is_?.calculation && (
                        <div className="border-t border-border pt-3 flex justify-between">
                          <span className="text-zinc-500">IMPOSTA SOGGIORNO</span>
                          <span className="text-emerald-500">€ {is_.calculation.totale_imposta.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-2 mt-2">
                        <GenerateLocazioneButton
                          checkinId={c.checkin_id}
                          guests={c.guests}
                          imposta={is_?.calculation?.totale_imposta || 0}
                          onGenerated={() => reloadCheckin(c.checkin_id)}
                        />
                        {c.locazione_receipts && c.locazione_receipts.length > 0 && (
                          <div className="flex flex-col gap-1 border border-sky-500/30 p-3 bg-sky-500/5">
                            <span className="text-[10px] tracking-[0.25em] uppercase text-sky-400 mb-1">Ricevute Locazione</span>
                            {c.locazione_receipts.map((rc, idx) => (
                              <LocazioneReceiptRow
                                key={idx}
                                checkinId={c.checkin_id}
                                index={idx}
                                receipt={rc}
                                onDeleted={() => reloadCheckin(c.checkin_id)}
                              />
                            ))}
                          </div>
                        )}
                        {(() => {
                          const prop = properties.find((p) => p.property_id === c.property_id);
                          const istEnabled = prop?.imposta_soggiorno?.enabled;
                          const importoCalc = is_?.calculation?.totale_imposta ?? 0;
                          if (!istEnabled && !is_?.calculation) return null;
                          return (
                            <GenerateReceiptButton
                              checkinId={c.checkin_id}
                              guests={c.guests}
                              importo={importoCalc}
                              onGenerated={() => reloadCheckin(c.checkin_id)}
                            />
                          );
                        })()}
                        {c.comune_receipts && c.comune_receipts.length > 0 && (
                          <div className="flex flex-col gap-1 border border-amber-500/30 p-3 bg-amber-500/5">
                            <span className="text-[10px] tracking-[0.25em] uppercase text-amber-400 mb-1">Ricevute Imposta di Soggiorno</span>
                            {c.comune_receipts.map((rc, idx) => (
                              <DownloadReceiptBtn
                                key={idx}
                                checkinId={c.checkin_id}
                                index={idx}
                                receipt={rc}
                                onDeleted={() => reloadCheckin(c.checkin_id)}
                              />
                            ))}
                          </div>
                        )}
                        {c.mode === "PROD" && aw?.success && (
                          c.alloggiati_ricevuta_pdf ? (
                            <DownloadAlloggiatiBtn checkinId={c.checkin_id} />
                          ) : (
                            <span className="text-center border border-border text-zinc-500 px-4 py-3 uppercase tracking-widest text-[10px]">
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

function DownloadReceiptBtn({ checkinId, index, receipt, onDeleted }) {
  const numero = receipt?.numero || "";
  const data = receipt?.data || "";
  const importo = receipt?.importo || 0;
  const shareToken = receipt?.share_token || "";

  const [busy, setBusy] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const printReceipt = () => {
    // Use HTML preview endpoint (window.print friendly)
    const url = `${api.defaults.baseURL}/checkins/${checkinId}/comune-receipts/${index}?download=0`;
    window.open(url, "_blank", "noopener");
  };

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

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/checkins/${checkinId}/comune-receipts/${index}`);
      onDeleted && onDeleted();
    } catch (e) {
      setErr(e.response?.data?.detail || "Errore eliminazione");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-amber-500/20 pt-2">
      <div className="flex justify-between items-center text-[10px] font-mono">
        <div className="flex flex-col">
          <span className="text-zinc-100">N. {numero}</span>
          <span className="text-zinc-500">{data} · {receipt?.ospite_nome || ""}</span>
        </div>
        <span className="text-amber-400 font-bold">€ {importo?.toFixed(2)}</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={printReceipt}
          data-testid={`comune-receipt-print-${checkinId}-${index}`}
          className="flex-1 text-center border border-amber-500/40 hover:border-amber-400 text-amber-400 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
        >
          🖨 Stampa
        </button>
        {!pdfUrl ? (
          <button
            type="button"
            onClick={preparePdf}
            disabled={!!busy}
            data-testid={`comune-receipt-download-${checkinId}-${index}`}
            className="flex-1 text-center border border-border hover:border-zinc-500 text-zinc-400 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
          >
            {busy === "pdf" ? "..." : "↓ Prepara PDF"}
          </button>
        ) : (
          <a
            href={pdfUrl}
            download={`ricevuta_comune_${numero}.pdf`}
            data-testid={`comune-receipt-pdf-link-${checkinId}-${index}`}
            className="flex-1 text-center border border-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer animate-pulse no-underline"
          >
            ✓ Salva PDF
          </a>
        )}
        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          data-testid={`comune-receipt-email-${checkinId}-${index}`}
          className="text-center border border-amber-500/40 hover:border-amber-400 text-amber-400 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
        >
          ✉ Invia
        </button>
        {!confirmDel ? (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            data-testid={`comune-receipt-delete-${checkinId}-${index}`}
            className="text-center border border-red-500/40 hover:border-red-400 text-red-400 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
          >
            Elimina
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              data-testid={`comune-receipt-delete-confirm-${checkinId}-${index}`}
              className="text-center bg-red-500 hover:bg-red-400 text-white px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
            >
              {deleting ? "..." : "Conferma"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDel(false)}
              className="text-center border border-border text-zinc-400 px-2 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {emailOpen && (
        <SendComuneReceiptByEmailModal
          receipt={receipt}
          shareToken={shareToken}
          onClose={() => setEmailOpen(false)}
        />
      )}
      {err && <p className="text-[10px] text-red-400 font-mono">{err}</p>}
    </div>
  );
}

function SendComuneReceiptByEmailModal({ receipt, shareToken, onClose }) {
  const [email, setEmail] = useState("");
  const [firma, setFirma] = useState("");

  const numero = receipt?.numero || "";
  const ospite = receipt?.ospite_nome || "Cliente";
  const importo = (receipt?.importo || 0).toFixed(2);
  const dataR = receipt?.data ? new Date(receipt.data).toLocaleDateString("it-IT") : "";
  const periodoStart = receipt?.data_arrivo
    ? new Date(receipt.data_arrivo).toLocaleDateString("it-IT")
    : "";
  const periodoEnd = receipt?.data_partenza
    ? new Date(receipt.data_partenza).toLocaleDateString("it-IT")
    : "";

  const origin = window.location.origin;
  const publicLink = shareToken
    ? `${origin}/api/public/comune-receipt/${shareToken}`
    : "(link non disponibile — rigenera la ricevuta)";

  const subject = `Ricevuta Imposta di Soggiorno N. ${numero}`;
  const bodyLines = [
    `Gentile ${ospite},`,
    "",
    `in allegato la ricevuta dell'imposta di soggiorno per il soggiorno${periodoStart ? ` dal ${periodoStart} al ${periodoEnd}` : ""}.`,
    "",
    `Numero ricevuta: ${numero}`,
    `Data: ${dataR}`,
    `Importo: € ${importo}`,
    "",
    "Scarica la ricevuta da questo link:",
    publicLink,
    "",
    "Cordiali saluti,",
    firma || "",
  ];
  const body = bodyLines.join("\n");
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const sendMail = () => {
    if (!email) return;
    window.location.href = mailto;
    setTimeout(onClose, 800);
  };
  const copyLink = () => {
    if (!shareToken) return;
    navigator.clipboard?.writeText(publicLink).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      data-testid={`comune-email-modal-${numero}`}
      onClick={onClose}
    >
      <div
        className="bg-background border border-amber-500/40 max-w-lg w-full p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold uppercase text-amber-300" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            ✉ Invia Ricevuta al Cliente
          </h3>
          <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 font-mono mt-1">
            N. {numero} · {ospite} · € {importo}
          </p>
        </div>
        <p className="text-zinc-400 text-[11px] leading-relaxed">
          Si aprirà il tuo programma email predefinito con oggetto e testo già compilati.
          La mail verrà spedita <strong className="text-zinc-200">dal tuo indirizzo</strong>.
          Il cliente troverà nel corpo della mail un link diretto per scaricare il PDF.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">Email del cliente</span>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.it"
            data-testid="comune-email-input"
            className="bg-surface-1 border border-border focus:border-amber-500 px-3 py-2 text-zinc-100 outline-none font-mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">Firma</span>
          <input
            type="text"
            value={firma}
            onChange={(e) => setFirma(e.target.value)}
            placeholder="Nome host"
            data-testid="comune-email-firma"
            className="bg-surface-1 border border-border focus:border-amber-500 px-3 py-2 text-zinc-100 outline-none font-mono"
          />
        </label>
        <details className="border border-border p-3 text-[10px]">
          <summary className="text-zinc-400 cursor-pointer uppercase tracking-widest">
            Anteprima testo email
          </summary>
          <pre className="text-zinc-300 mt-2 whitespace-pre-wrap break-words text-[11px] font-mono">
{body}
          </pre>
        </details>
        {shareToken && (
          <div className="flex gap-2 items-center text-[10px] font-mono">
            <span className="text-zinc-500 shrink-0">Link PDF pubblico:</span>
            <span className="text-amber-300 break-all flex-1 truncate" title={publicLink}>
              {publicLink}
            </span>
            <button
              type="button"
              onClick={copyLink}
              data-testid="comune-email-copy-link"
              className="border border-border hover:border-zinc-500 text-zinc-400 px-2 py-1 cursor-pointer shrink-0"
            >
              Copia
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={sendMail}
            disabled={!email}
            data-testid="comune-email-send"
            className="flex-1 text-center bg-amber-500 hover:bg-amber-400 text-[#05050A] px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50 font-bold"
          >
            Apri Programma Email
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid="comune-email-cancel"
            className="text-center border border-border hover:border-zinc-500 text-zinc-400 px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer"
          >
            Annulla
          </button>
        </div>
      </div>
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
    const cleaned = (numero || "").replace(/\D/g, "");
    if (!cleaned) { setError("Numero ricevuta obbligatorio (solo cifre)"); return; }
    setLoading(true); setError("");
    try {
      await api.post(`/checkins/${checkinId}/comune-receipt`, {
        numero_ricevuta: cleaned,
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
        Genera Ricevuta Imposta
      </button>
    );
  }

  return (
    <div className="border border-amber-500/40 p-4 flex flex-col gap-3 bg-surface-1">
      <span className="text-[10px] tracking-[0.25em] uppercase text-amber-400">Genera Ricevuta Imposta di Soggiorno</span>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Numero Ricevuta</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
          placeholder="Es. 1"
          autoFocus
          data-testid={`gen-receipt-numero-${checkinId}`}
          className="bg-transparent border border-border px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm font-mono"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Data Ricevuta</span>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          data-testid={`gen-receipt-data-${checkinId}`}
          className="bg-transparent border border-border px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Intestatario</span>
        <select
          value={ospiteIdx}
          onChange={(e) => setOspiteIdx(Number(e.target.value))}
          data-testid={`gen-receipt-ospite-${checkinId}`}
          className="bg-transparent border border-border px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
        >
          {(guests || []).map((g, i) => (
            <option key={i} value={i} className="bg-surface-1 text-zinc-100">
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
          className="border border-border hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
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
        className="self-start border border-border hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
      >
        {loading ? "Recupero in corso..." : "↻ Recupera ricevute Alloggiati Web"}
      </button>
      {msg && (
        <p className="text-zinc-500 text-[10px] font-mono">{msg}</p>
      )}
      <p className="text-zinc-600 text-[10px] font-mono">
        Recupero automatico ogni ora. Le ricevute sono disponibili 24h dopo l&apos;invio.
      </p>
    </div>
  );
}

// ============================================================
// LOCAZIONE RECEIPT — Generate button + modal
// ============================================================

function GenerateLocazioneButton({ checkinId, guests, imposta, onGenerated }) {
  const [open, setOpen] = useState(false);
  const [importo, setImporto] = useState("");
  const [numero, setNumero] = useState("");
  const [autoNumero, setAutoNumero] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");

  const capogruppo = guests?.[0]
    ? `${guests[0].cognome || ""} ${guests[0].nome || ""}`.trim()
    : "";

  const importoNum = parseFloat(importo.replace(",", ".")) || 0;
  const bollo = importoNum > 77.47 ? 2.0 : 0.0;
  const totale = importoNum + (imposta || 0) + bollo;

  const submit = async () => {
    if (importoNum <= 0) {
      setErr("Importo non valido");
      return;
    }
    setErr("");
    setGenerating(true);
    try {
      await api.post(`/checkins/${checkinId}/locazione-receipts`, {
        importo_locazione: importoNum,
        numero_ricevuta: autoNumero ? "" : numero.trim(),
      });
      setOpen(false);
      setImporto("");
      setNumero("");
      onGenerated && onGenerated();
    } catch (e) {
      setErr(e.response?.data?.detail || "Errore generazione ricevuta");
    } finally {
      setGenerating(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`gen-locazione-btn-${checkinId}`}
        className="text-center border border-sky-500/40 hover:border-sky-400 hover:bg-sky-500/10 text-sky-400 px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer transition-colors"
      >
        Genera Ricevuta Locazione
      </button>
    );
  }

  return (
    <div className="border border-sky-500/50 bg-sky-500/5 p-4 flex flex-col gap-3" data-testid={`loc-modal-${checkinId}`}>
      <p className="text-[10px] tracking-[0.25em] uppercase text-sky-400 font-bold">
        Nuova Ricevuta di Locazione
      </p>

      {capogruppo && (
        <div className="text-[10px] font-mono text-zinc-400">
          Capogruppo: <span className="text-zinc-100">{capogruppo}</span>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-widest uppercase text-zinc-500">Importo Locazione (€)</span>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={importo}
          onChange={(e) => setImporto(e.target.value)}
          placeholder="850,00"
          data-testid={`loc-importo-${checkinId}`}
          className="bg-surface-1 border border-border focus:border-sky-500 px-3 py-2 text-zinc-100 outline-none font-mono"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] tracking-widest uppercase text-zinc-500">Numero Ricevuta</span>
        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          <input
            type="checkbox"
            checked={autoNumero}
            onChange={(e) => setAutoNumero(e.target.checked)}
            data-testid={`loc-auto-${checkinId}`}
          />
          Auto-incrementale per CF (consigliato)
        </label>
        {!autoNumero && (
          <input
            type="text"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="es. RL-2026/047"
            data-testid={`loc-numero-${checkinId}`}
            className="bg-surface-1 border border-border focus:border-sky-500 px-3 py-2 text-zinc-100 outline-none font-mono"
          />
        )}
      </div>

      {importoNum > 0 && (
        <div className="border border-border p-3 flex flex-col gap-1 text-[11px] font-mono">
          <div className="flex justify-between text-zinc-400"><span>Canone</span><span className="text-zinc-100">€ {importoNum.toFixed(2)}</span></div>
          {imposta > 0 && (
            <div className="flex justify-between text-zinc-400"><span>Imposta soggiorno</span><span className="text-zinc-100">€ {imposta.toFixed(2)}</span></div>
          )}
          {bollo > 0 && (
            <div className="flex justify-between text-amber-400"><span>Marca da bollo</span><span>€ {bollo.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between border-t border-border pt-1 mt-1">
            <span className="text-sky-400 font-bold">TOTALE</span>
            <span className="text-sky-300 font-bold">€ {totale.toFixed(2)}</span>
          </div>
        </div>
      )}

      {err && (
        <p data-testid={`loc-error-${checkinId}`} className="text-[10px] text-red-400 font-mono break-words">{err}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={generating || importoNum <= 0}
          data-testid={`loc-submit-${checkinId}`}
          className="flex-1 text-center bg-sky-500 hover:bg-sky-400 text-[#05050A] px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50 font-bold"
        >
          {generating ? "Genero..." : "Genera Ricevuta"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setErr(""); }}
          data-testid={`loc-cancel-${checkinId}`}
          className="text-center border border-border hover:border-zinc-500 text-zinc-400 px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

function LocazioneReceiptRow({ checkinId, index, receipt, onDeleted }) {
  const [busy, setBusy] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const numero = receipt.numero || "";
  const totale = receipt.totale || 0;
  const dataEm = receipt.data_emissione || "";
  const shareToken = receipt.share_token || "";

  const printReceipt = () => {
    const url = `${api.defaults.baseURL}/checkins/${checkinId}/locazione-receipts/${index}/html`;
    window.open(url, "_blank", "noopener");
  };

  const preparePdf = async () => {
    setErr("");
    setPdfUrl("");
    setBusy("pdf");
    try {
      const r = await api.get(`/checkins/${checkinId}/locazione-receipts/${index}`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErr("Impossibile preparare il PDF.");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/checkins/${checkinId}/locazione-receipts/${index}`);
      onDeleted && onDeleted();
    } catch (e) {
      setErr(e.response?.data?.detail || "Errore eliminazione");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-sky-500/20 pt-2">
      <div className="flex justify-between items-center text-[10px] font-mono">
        <div className="flex flex-col">
          <span className="text-zinc-100">{numero}</span>
          <span className="text-zinc-500">{dataEm} · {receipt.capogruppo_nome || ""}</span>
        </div>
        <span className="text-sky-400 font-bold">€ {totale.toFixed(2)}</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={printReceipt}
          data-testid={`loc-print-${checkinId}-${index}`}
          className="flex-1 text-center border border-sky-500/40 hover:border-sky-400 text-sky-400 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
        >
          🖨 Stampa
        </button>
        {!pdfUrl ? (
          <button
            type="button"
            onClick={preparePdf}
            disabled={!!busy}
            data-testid={`loc-prepare-pdf-${checkinId}-${index}`}
            className="flex-1 text-center border border-border hover:border-zinc-500 text-zinc-400 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
          >
            {busy === "pdf" ? "..." : "↓ Prepara PDF"}
          </button>
        ) : (
          <a
            href={pdfUrl}
            download={`ricevuta_locazione_${numero.replace(/\//g, "_")}.pdf`}
            data-testid={`loc-pdf-link-${checkinId}-${index}`}
            className="flex-1 text-center border border-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer animate-pulse no-underline"
          >
            ✓ Salva PDF
          </a>
        )}
        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          data-testid={`loc-email-${checkinId}-${index}`}
          className="text-center border border-amber-500/40 hover:border-amber-400 text-amber-400 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
        >
          ✉ Invia
        </button>
        {!confirmDel ? (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            data-testid={`loc-delete-${checkinId}-${index}`}
            className="text-center border border-red-500/40 hover:border-red-400 text-red-400 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
          >
            Elimina
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              data-testid={`loc-confirm-delete-${checkinId}-${index}`}
              className="text-center bg-red-500 hover:bg-red-400 text-white px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
            >
              {deleting ? "..." : "Conferma"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDel(false)}
              className="text-center border border-border text-zinc-400 px-2 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {emailOpen && (
        <SendReceiptByEmailModal
          receipt={receipt}
          shareToken={shareToken}
          onClose={() => setEmailOpen(false)}
        />
      )}
      {err && <p className="text-[10px] text-red-400 font-mono">{err}</p>}
    </div>
  );
}

function GuestPageLink({ checkinId }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.post(`/checkins/${checkinId}/guest-token`)
      .then((r) => setUrl(r.data.url || ""))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [checkinId]);

  const copy = useCallback(() => {
    if (!url) return;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [url]);

  if (loading) return (
    <span className="text-zinc-600 text-[10px] font-mono mt-1">carico pagina ospite...</span>
  );
  if (!url) return null;

  return (
    <div className="flex items-center gap-2 mt-1 border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
      <span className="text-emerald-500 shrink-0 text-[10px]">🔗</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-400 hover:text-emerald-300 underline truncate flex-1 text-[10px]"
        title={url}
      >
        Pagina personale ospite
      </a>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 hover:text-emerald-300 px-2 py-1 text-[10px] cursor-pointer transition-colors"
      >
        {copied ? "✓ Copiato" : "Copia link"}
      </button>
    </div>
  );
}

function SendReceiptByEmailModal({ receipt, shareToken, onClose }) {
  const [email, setEmail] = useState("");
  const [propietario, setPropietario] = useState(receipt.proprietario_nome || "");

  const numero = receipt.numero || "";
  const periodoStart = receipt.periodo_inizio
    ? new Date(receipt.periodo_inizio).toLocaleDateString("it-IT")
    : "";
  const periodoEnd = receipt.periodo_fine
    ? new Date(receipt.periodo_fine).toLocaleDateString("it-IT")
    : "";
  const totale = (receipt.totale || 0).toFixed(2);
  // Public link to the PDF
  const origin = window.location.origin;
  const publicLink = shareToken
    ? `${origin}/api/public/locazione/${shareToken}`
    : "(link non disponibile — rigenera la ricevuta)";

  const subject = `Ricevuta di locazione ${numero}`;
  const body = [
    `Gentile ${receipt.capogruppo_nome || "Cliente"},`,
    "",
    `in allegato la ricevuta di locazione per il soggiorno dal ${periodoStart} al ${periodoEnd}.`,
    "",
    `Numero ricevuta: ${numero}`,
    `Totale: € ${totale}`,
    "",
    `Scarica la ricevuta da questo link:`,
    publicLink,
    "",
    "Cordiali saluti,",
    propietario || "",
  ].join("\n");

  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const sendMail = () => {
    if (!email) return;
    window.location.href = mailto;
    setTimeout(onClose, 800);
  };

  const copyLink = () => {
    if (!shareToken) return;
    navigator.clipboard?.writeText(publicLink).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      data-testid={`email-modal-${receipt.numero}`}
      onClick={onClose}
    >
      <div
        className="bg-background border border-amber-500/40 max-w-lg w-full p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold uppercase text-amber-300" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            ✉ Invia Ricevuta al Cliente
          </h3>
          <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 font-mono mt-1">
            {numero} · {receipt.capogruppo_nome}
          </p>
        </div>

        <p className="text-zinc-400 text-[11px] leading-relaxed">
          Si aprirà il tuo programma email predefinito (Gmail web, Outlook, Mail) con oggetto e
          testo già compilati. La mail verrà spedita <strong className="text-zinc-200">dal tuo indirizzo</strong>.
          Il cliente troverà nel corpo della mail un link diretto per scaricare il PDF.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">Email del cliente</span>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.it"
            data-testid="email-input"
            className="bg-surface-1 border border-border focus:border-amber-500 px-3 py-2 text-zinc-100 outline-none font-mono"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">Firma (proprietario)</span>
          <input
            type="text"
            value={propietario}
            onChange={(e) => setPropietario(e.target.value)}
            data-testid="email-firma"
            className="bg-surface-1 border border-border focus:border-amber-500 px-3 py-2 text-zinc-100 outline-none font-mono"
          />
        </label>

        <details className="border border-border p-3 text-[10px]">
          <summary className="text-zinc-400 cursor-pointer uppercase tracking-widest">
            Anteprima testo email
          </summary>
          <pre className="text-zinc-300 mt-2 whitespace-pre-wrap break-words text-[11px] font-mono">
{body}
          </pre>
        </details>

        {shareToken && (
          <div className="flex gap-2 items-center text-[10px] font-mono">
            <span className="text-zinc-500 shrink-0">Link PDF pubblico:</span>
            <span className="text-amber-300 break-all flex-1 truncate" title={publicLink}>
              {publicLink}
            </span>
            <button
              type="button"
              onClick={copyLink}
              data-testid="email-copy-link"
              className="border border-border hover:border-zinc-500 text-zinc-400 px-2 py-1 cursor-pointer shrink-0"
            >
              Copia
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={sendMail}
            disabled={!email}
            data-testid="email-send"
            className="flex-1 text-center bg-amber-500 hover:bg-amber-400 text-[#05050A] px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50 font-bold"
          >
            Apri Programma Email
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid="email-cancel"
            className="text-center border border-border hover:border-zinc-500 text-zinc-400 px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
