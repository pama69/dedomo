import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

function startOfMonth(d) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function fmtISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtMonthName(d) {
  return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}
function getCalendarGrid(monthStart) {
  // Returns a 6×7 grid (42 days) starting from Monday before/on the 1st
  const first = new Date(monthStart);
  const dayOfWeek = (first.getDay() + 6) % 7; // 0=Mon
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - dayOfWeek);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export default function Calendar() {
  const [monthStart, setMonthStart] = useState(startOfMonth(new Date()));
  const [events, setEvents] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  const cells = useMemo(() => getCalendarGrid(monthStart), [monthStart]);
  const rangeFrom = fmtISO(cells[0]);
  const rangeTo = fmtISO(cells[41]);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/calendar/events?date_from=${rangeFrom}&date_to=${rangeTo}`);
      setEvents(r.data?.events || []);
      setProperties(r.data?.properties || []);
    } catch { /* */ } finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [rangeFrom, rangeTo]);

  const forceRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const r = await api.post("/calendar/refresh");
      setRefreshMsg(`✓ ${r.data.properties_refreshed} strutture aggiornate · ${r.data.total_events} eventi importati`);
      await reload();
      setTimeout(() => setRefreshMsg(""), 5000);
    } catch (e) {
      setRefreshMsg(e.response?.data?.detail || "Errore aggiornamento");
      setTimeout(() => setRefreshMsg(""), 5000);
    } finally {
      setRefreshing(false);
    }
  };

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const ev of events) {
      // Backend uses iCal-style exclusive end → for display we want inclusive,
      // so the bar covers the departure day too. Iterate [start..end] inclusive.
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      const cur = new Date(s);
      while (cur <= e) {
        const k = fmtISO(cur);
        if (!map[k]) map[k] = [];
        const isStart = cur.getTime() === s.getTime();
        const isEnd = cur.getTime() === e.getTime();
        const type = isStart && isEnd ? "full" : isStart ? "start" : isEnd ? "end" : "middle";
        map[k].push({ event: ev, type });
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  const today = fmtISO(new Date());

  return (
    <Layout>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold uppercase tracking-tight text-zinc-100" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          Calendario
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={forceRefresh}
            disabled={refreshing}
            data-testid="cal-force-refresh"
            className="border border-blue-500/60 hover:bg-blue-500/10 text-blue-400 px-3 py-2 text-[10px] uppercase tracking-widest cursor-pointer disabled:opacity-50"
          >
            {refreshing ? "Aggiornamento..." : "↻ Forza Aggiornamento"}
          </button>
          <button
            onClick={() => setMonthStart(addMonths(monthStart, -1))}
            data-testid="cal-prev-month"
            className="border border-border hover:border-zinc-500 text-zinc-300 px-3 py-2 text-[10px] uppercase tracking-widest cursor-pointer"
          >←</button>
          <span className="text-zinc-100 text-sm uppercase tracking-widest min-w-[140px] text-center font-mono">
            {fmtMonthName(monthStart)}
          </span>
          <button
            onClick={() => setMonthStart(addMonths(monthStart, 1))}
            data-testid="cal-next-month"
            className="border border-border hover:border-zinc-500 text-zinc-300 px-3 py-2 text-[10px] uppercase tracking-widest cursor-pointer"
          >→</button>
          <button
            onClick={() => setAddOpen(true)}
            data-testid="cal-add"
            className="ml-2 border border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-400 px-3 py-2 text-base uppercase tracking-widest cursor-pointer leading-none"
          >+</button>
        </div>
      </div>

      {refreshMsg && (
        <div data-testid="cal-refresh-msg" className="text-[10px] font-mono text-emerald-400 border border-emerald-500/40 px-3 py-2 bg-emerald-500/5">
          {refreshMsg}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 border border-border p-3" data-testid="cal-legend">
        {properties.length === 0 ? (
          <span className="text-zinc-500 text-[11px] font-mono">Nessuna struttura configurata.</span>
        ) : (
          properties.map((p) => (
            <div key={p.property_id} className="flex items-center gap-2 text-[10px] font-mono text-zinc-300">
              <span className="inline-block w-4 h-4" style={{ backgroundColor: p.color }} />
              <span>{p.nome}</span>
            </div>
          ))
        )}
        <div className="ml-auto flex gap-3 text-[9px] font-mono text-zinc-500">
          <span>B Booking</span><span>A Airbnb</span><span>V Vrbo</span><span>P Personale</span>
        </div>
      </div>

      {loading && <p className="text-zinc-500 text-[11px] font-mono">Caricamento...</p>}

      {/* Calendar grid */}
      <div className="border border-border">
        <div className="grid grid-cols-7 border-b border-border">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
            <div key={d} className="px-2 py-2 text-[9px] tracking-widest uppercase text-zinc-500 text-center font-mono border-r border-border last:border-r-0">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(96px, auto)" }}>
          {cells.map((d, i) => {
            const k = fmtISO(d);
            const inMonth = d.getMonth() === monthStart.getMonth();
            const dayEvents = eventsByDay[k] || [];
            const isToday = k === today;
            return (
              <div
                key={i}
                data-testid={`cal-day-${k}`}
                className={`border-r border-b border-border last:border-r-0 p-1 flex flex-col gap-0.5 ${!inMonth ? "bg-background" : ""}`}
              >
                <span className={`text-[10px] font-mono ${isToday ? "text-emerald-500 font-bold" : inMonth ? "text-zinc-400" : "text-zinc-700"}`}>
                  {d.getDate()}
                </span>
                <div className="flex flex-col gap-0.5">
                  {(() => {
                    // Group day entries by property_id (or event id as fallback)
                    const groups = new Map();
                    for (const en of dayEvents) {
                      const k = en.event.property_id || en.event.id;
                      if (!groups.has(k)) groups.set(k, []);
                      groups.get(k).push(en);
                    }
                    const groupArr = Array.from(groups.values());
                    return (
                      <>
                        {groupArr.slice(0, 3).map((group, gi) => {
                          const startEntry = group.find((x) => x.type === "start");
                          const endEntry = group.find((x) => x.type === "end");
                          const middleEntry = group.find((x) => x.type === "middle" || x.type === "full");
                          // Priority: full/middle > split(start+end) > start > end
                          if (middleEntry) {
                            return <DayBar key={gi} event={middleEntry.event} variant="full" onEdit={setEditEvent} />;
                          }
                          if (startEntry && endEntry) {
                            return (
                              <div key={gi} className="grid grid-cols-2 gap-[2px]">
                                <DayBar event={endEntry.event} variant="end" onEdit={setEditEvent} />
                                <DayBar event={startEntry.event} variant="start" onEdit={setEditEvent} />
                              </div>
                            );
                          }
                          if (startEntry) {
                            return (
                              <div key={gi} className="grid grid-cols-2 gap-[2px]">
                                <div />
                                <DayBar event={startEntry.event} variant="start" onEdit={setEditEvent} />
                              </div>
                            );
                          }
                          if (endEntry) {
                            return (
                              <div key={gi} className="grid grid-cols-2 gap-[2px]">
                                <DayBar event={endEntry.event} variant="end" onEdit={setEditEvent} />
                                <div />
                              </div>
                            );
                          }
                          return null;
                        })}
                        {groupArr.length > 3 && (
                          <span className="text-[9px] font-mono text-zinc-500 px-1.5">+{groupArr.length - 3}</span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {addOpen && (
        <BookingModal
          properties={properties}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); reload(); }}
        />
      )}
      {editEvent && (
        <BookingModal
          properties={properties}
          booking={editEvent}
          onClose={() => setEditEvent(null)}
          onSaved={() => { setEditEvent(null); reload(); }}
          onDeleted={() => { setEditEvent(null); reload(); }}
        />
      )}
    </Layout>
  );
}

function BookingModal({ properties, booking, onClose, onSaved, onDeleted }) {
  const isEdit = !!booking;
  const [propertyId, setPropertyId] = useState(booking?.property_id || properties[0]?.property_id || "");
  const [start, setStart] = useState(booking?.start || fmtISO(new Date()));
  const [end, setEnd] = useState(booking?.end || fmtISO(new Date()));
  const [notes, setNotes] = useState(booking?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!propertyId) { setError("Seleziona una struttura"); return; }
    if (!start || !end) { setError("Date obbligatorie"); return; }
    if (end < start) { setError("Data fine prima della data inizio"); return; }
    setSaving(true); setError("");
    try {
      if (isEdit) {
        await api.patch(`/calendar/manual/${booking.booking_id}`, { start, end, notes });
      } else {
        await api.post("/calendar/manual", { property_id: propertyId, start, end, notes });
      }
      onSaved && onSaved();
    } catch (e) {
      setError(e.response?.data?.detail || "Errore");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!booking?.booking_id) {
      setError("ID prenotazione mancante");
      return;
    }
    setSaving(true); setError("");
    try {
      await api.delete(`/calendar/manual/${booking.booking_id}`);
      onDeleted && onDeleted();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Errore eliminazione");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="cal-booking-modal">
      <div className="bg-surface-1 border border-border max-w-md w-full my-8 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-400">
            {isEdit ? "Modifica Prenotazione" : "Nuova Prenotazione"}
          </span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 cursor-pointer text-lg">✕</button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Struttura</span>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              disabled={isEdit}
              data-testid="cal-booking-property"
              className="bg-transparent border border-border px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono disabled:opacity-50"
            >
              {properties.map((p) => (
                <option key={p.property_id} value={p.property_id} className="bg-surface-1">
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Data Arrivo</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                data-testid="cal-booking-start"
                className="bg-transparent border border-border px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Data Partenza</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                data-testid="cal-booking-end"
                className="bg-transparent border border-border px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Note</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              data-testid="cal-booking-notes"
              placeholder="Note libere..."
              className="bg-transparent border border-border px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm font-mono resize-none"
            />
          </label>
          {error && <p className="text-red-400 text-[10px] font-mono">[ ERR ] {error}</p>}
          <div className="flex gap-2 mt-2">
            <button
              onClick={save}
              disabled={saving}
              data-testid="cal-booking-save"
              className="flex-1 border border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
            >
              {saving ? "..." : isEdit ? "Salva" : "Crea"}
            </button>
            {isEdit && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                data-testid="cal-booking-delete"
                className="border border-red-500/60 hover:bg-red-500/10 text-red-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
              >
                Elimina
              </button>
            )}
            <button
              onClick={onClose}
              className="border border-border hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
            >
              Annulla
            </button>
          </div>
          {isEdit && confirmDelete && (
            <div className="border border-red-500/40 p-3 flex flex-col gap-2 bg-red-500/5 mt-2">
              <span className="text-[10px] font-mono text-red-300">
                Eliminare definitivamente questa prenotazione? L'azione non può essere annullata.
              </span>
              <div className="flex gap-2">
                <button
                  onClick={remove}
                  disabled={saving}
                  data-testid="cal-booking-delete-confirm"
                  className="flex-1 border border-red-500 hover:bg-red-500 hover:text-white text-red-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Eliminazione..." : "Sì, elimina"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={saving}
                  className="flex-1 border border-border hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayBar({ event, variant, onEdit }) {
  // variant: "full" | "start" | "end"
  // - full: bar takes the whole cell width
  // - start: right half (booking starts this day)
  // - end: left half (booking ends this day)
  const showLabel = variant !== "end"; // never label on the check-out half
  const title = `${event.property_name} · ${event.source}${event.notes ? ` · ${event.notes}` : ""}`;
  return (
    <button
      type="button"
      onClick={() => event.editable && onEdit(event)}
      data-testid={`cal-event-${event.id}-${variant}`}
      style={{ backgroundColor: event.color }}
      className={`text-left text-[9px] font-mono text-white truncate px-1.5 py-0.5 ${
        event.editable ? "cursor-pointer hover:opacity-80" : "cursor-default"
      }`}
      title={title}
    >
      {showLabel ? (
        <>
          <span className="font-bold mr-1">{event.source}</span>
          <span className="opacity-80">{event.property_name?.slice(0, variant === "start" ? 6 : 12)}</span>
        </>
      ) : (
        <span className="opacity-0">·</span>
      )}
    </button>
  );
}

