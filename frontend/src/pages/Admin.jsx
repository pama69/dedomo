import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const ACCENT = "#10b981";
const WARN = "#f59e0b";
const RED = "#ef4444";
const BLUE = "#3b82f6";

function Stat({ label, value, sub, testid }) {
  return (
    <div className="border border-border p-4 flex flex-col gap-1" data-testid={testid}>
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{label}</span>
      <span className="text-2xl font-bold text-zinc-100 font-mono">{value}</span>
      {sub && <span className="text-[10px] font-mono text-zinc-500">{sub}</span>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="border border-border p-4 flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-400">{title}</span>
      <div className="h-[220px]">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: "#0E0E14", border: "1px solid #1E1E28", fontSize: "11px", fontFamily: "monospace" },
  labelStyle: { color: "#a1a1aa" },
};

function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/overview")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Errore"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>;
  if (error) return <p className="text-red-500 text-sm font-mono">{error}</p>;
  if (!data) return null;

  const guestsPie = [
    { name: "Italiani", value: data.guests_30d.italian, color: ACCENT },
    { name: "Stranieri", value: data.guests_30d.foreign, color: WARN },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Utenti Totali" value={data.users.total} sub={`+${data.users.new_this_week} questa settimana`} testid="stat-users" />
        <Stat label="Attivi 30g" value={data.users.active_30d} sub="hanno fatto check-in" testid="stat-active" />
        <Stat label="Strutture" value={data.properties.total} testid="stat-properties" />
        <Stat label="Check-in Totali" value={data.checkins.total} sub={`${data.checkins.this_month} questo mese`} testid="stat-checkins" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Check-in Oggi" value={data.checkins.today} testid="stat-today" />
        <Stat label="Check-in Settimana" value={data.checkins.this_week} testid="stat-week" />
        <Stat
          label="Imposta Riscossa"
          value={`€ ${data.tourist_tax.total_eur.toFixed(2)}`}
          sub={`${data.tourist_tax.receipts_count} ricevute`}
          testid="stat-tax"
        />
        <Stat
          label="Retry Pending"
          value={data.retries.pending}
          sub={data.retries.exhausted > 0 ? `${data.retries.exhausted} esauriti` : "tutto ok"}
          testid="stat-retries"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Check-in Giornalieri (90gg)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.charts.daily_checkins_90d}>
              <CartesianGrid stroke="#1E1E28" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 9, fontFamily: "monospace" }} />
              <YAxis stroke="#71717a" tick={{ fontSize: 9, fontFamily: "monospace" }} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="checkins" stroke={ACCENT} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Nuovi Utenti (90gg)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.daily_signups_90d}>
              <CartesianGrid stroke="#1E1E28" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 9, fontFamily: "monospace" }} />
              <YAxis stroke="#71717a" tick={{ fontSize: 9, fontFamily: "monospace" }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="signups" fill={BLUE} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Composizione Ospiti (30gg)">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={guestsPie}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                style={{ fontSize: "10px", fontFamily: "monospace", fill: "#a1a1aa" }}
              >
                {guestsPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "10px", fontFamily: "monospace" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tasso Successo Portali (30gg)">
          <div className="flex flex-col gap-4 justify-center h-full">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-zinc-400">ALLOGGIATI WEB</span>
                <span className={data.success_rate_30d.alloggiati_web >= 90 ? "text-emerald-500" : data.success_rate_30d.alloggiati_web >= 70 ? "text-amber-400" : "text-red-500"}>
                  {data.success_rate_30d.alloggiati_web !== null ? `${data.success_rate_30d.alloggiati_web}%` : "—"}
                </span>
              </div>
              <div className="h-2 bg-surface-3">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${data.success_rate_30d.alloggiati_web || 0}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-zinc-600">
                {data.success_rate_30d.alloggiati_web_ok}/{data.success_rate_30d.alloggiati_web_total} invii OK
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-zinc-400">TURISMO 5</span>
                <span className={data.success_rate_30d.turismo5 >= 90 ? "text-emerald-500" : data.success_rate_30d.turismo5 >= 70 ? "text-amber-400" : "text-red-500"}>
                  {data.success_rate_30d.turismo5 !== null ? `${data.success_rate_30d.turismo5}%` : "—"}
                </span>
              </div>
              <div className="h-2 bg-surface-3">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${data.success_rate_30d.turismo5 || 0}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-zinc-600">
                {data.success_rate_30d.turismo5_ok}/{data.success_rate_30d.turismo5_total} invii OK
              </span>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function UserDetailModal({ userId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [unlimitedToggling, setUnlimitedToggling] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/user/${userId}`);
      setData(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userId]);

  const toggleDisabled = async () => {
    setToggling(true);
    setError("");
    try {
      const r = await api.post(`/admin/user/${userId}/toggle-disabled`);
      // Optimistic update
      const newDisabled = !!r.data?.disabled;
      setData((prev) => prev ? ({
        ...prev,
        user: {
          ...prev.user,
          disabled: newDisabled,
          disabled_at: newDisabled ? new Date().toISOString() : null,
        },
      }) : prev);
      // Authoritative refresh
      await load();
      onChanged && onChanged();
      setError(newDisabled ? "✓ Utente disabilitato" : "✓ Utente riattivato");
      setTimeout(() => setError(""), 3000);
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || `HTTP ${e.response?.status || "?"}`;
      setError(`Errore: ${msg}`);
    } finally {
      setToggling(false);
      setConfirmToggle(false);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("it-IT"); } catch { return iso; }
  };

  const toggleUnlimited = async () => {
    setUnlimitedToggling(true);
    setError("");
    try {
      const r = await api.post(`/admin/user/${userId}/toggle-unlimited`);
      const newVal = !!r.data?.unlimited;
      setData((prev) => prev ? ({
        ...prev,
        user: { ...prev.user, unlimited: newVal },
      }) : prev);
      onChanged && onChanged();
      setError(newVal ? "✓ Account reso ILLIMITATO" : "✓ Account riportato a piano standard");
      setTimeout(() => setError(""), 3000);
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || `HTTP ${e.response?.status || "?"}`;
      setError(`Errore: ${msg}`);
    } finally {
      setUnlimitedToggling(false);
    }
  };


  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
      data-testid="admin-user-detail-modal"
    >
      <div
        className="bg-surface-1 border border-border max-w-3xl w-full my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-400">Dettaglio Utente</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 cursor-pointer text-lg">✕</button>
        </div>
        {loading ? (
          <div className="p-6 text-zinc-500 text-sm font-mono">Caricamento...</div>
        ) : !data ? (
          <div className="p-6 text-red-500 text-sm font-mono">Errore</div>
        ) : (
          <div className="p-4 flex flex-col gap-4">
            {error && (
              <div
                data-testid="admin-user-status-msg"
                className={`text-[11px] font-mono px-3 py-2 border ${
                  error.startsWith("✓")
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/40 bg-red-500/10 text-red-300"
                }`}
              >
                {error}
              </div>
            )}
            {/* Header */}
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div className="flex flex-col">
                <span className="text-zinc-100 text-lg font-bold">{data.user.name || data.user.email}</span>
                <span className="text-zinc-500 text-[11px] font-mono">{data.user.email}</span>
                <span className="text-zinc-600 text-[10px] font-mono">Registrato {fmtDate(data.user.created_at)}</span>
              </div>
              <div className="flex items-center gap-3">
                {data.user.disabled && (
                  <span className="text-red-400 text-[10px] font-mono uppercase tracking-widest">
                    Disabilitato {data.user.disabled_at ? `il ${fmtDate(data.user.disabled_at)}` : ""}
                  </span>
                )}
                <button
                  onClick={() => setConfirmToggle(true)}
                  disabled={toggling || confirmToggle}
                  data-testid="admin-user-toggle-disabled"
                  className={`flex items-center gap-2 px-3 py-2 border text-[10px] uppercase tracking-[0.25em] cursor-pointer transition-colors disabled:opacity-50 ${
                    data.user.disabled
                      ? "border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/60 hover:bg-red-500/10 text-red-400"
                  }`}
                >
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${data.user.disabled ? "bg-red-500/30" : "bg-emerald-500/30"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-zinc-100 transition-all ${data.user.disabled ? "left-0.5" : "right-0.5"}`} />
                  </div>
                  {toggling ? "..." : (data.user.disabled ? "Riattiva" : "Disabilita")}
                </button>
                <button
                  onClick={toggleUnlimited}
                  disabled={unlimitedToggling}
                  data-testid="admin-user-toggle-unlimited"
                  title="Account illimitato: bypassa pagamenti e quota proprietà"
                  className={`flex items-center gap-2 px-3 py-2 border text-[10px] uppercase tracking-[0.25em] cursor-pointer transition-colors disabled:opacity-50 ${
                    data.user.unlimited
                      ? "border-amber-500/60 hover:bg-amber-500/10 text-amber-400"
                      : "border-border hover:border-amber-500 text-zinc-400 hover:text-amber-400"
                  }`}
                >
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${data.user.unlimited ? "bg-amber-500/40" : "bg-surface-3"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-zinc-100 transition-all ${data.user.unlimited ? "right-0.5" : "left-0.5"}`} />
                  </div>
                  {unlimitedToggling ? "..." : (data.user.unlimited ? "Illimitato ON" : "Illimitato OFF")}
                </button>
              </div>
            </div>

            {confirmToggle && (
              <div className={`border p-3 flex flex-col gap-2 ${data.user.disabled ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"}`}>
                <span className={`text-[11px] font-mono ${data.user.disabled ? "text-emerald-300" : "text-red-300"}`}>
                  {data.user.disabled
                    ? `Riattivare l'utente ${data.user.email}? Potrà di nuovo accedere all'app.`
                    : `Disabilitare l'utente ${data.user.email}? Tutte le sue sessioni saranno revocate immediatamente e non potrà più accedere finché non lo riattivi.`}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={toggleDisabled}
                    disabled={toggling}
                    data-testid="admin-user-toggle-confirm"
                    className={`flex-1 border px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50 ${
                      data.user.disabled
                        ? "border-emerald-500 hover:bg-emerald-500 hover:text-black text-emerald-400"
                        : "border-red-500 hover:bg-red-500 hover:text-white text-red-400"
                    }`}
                  >
                    {toggling ? "..." : data.user.disabled ? "Sì, riattiva" : "Sì, disabilita"}
                  </button>
                  <button
                    onClick={() => { setConfirmToggle(false); setError(""); }}
                    disabled={toggling}
                    className="flex-1 border border-border hover:border-zinc-500 text-zinc-400 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="border border-border p-3">
                <div className="text-[9px] tracking-[0.2em] uppercase text-zinc-500">Strutture</div>
                <div className="text-xl font-bold text-zinc-100 font-mono">{data.stats.properties_count}</div>
              </div>
              <div className="border border-border p-3">
                <div className="text-[9px] tracking-[0.2em] uppercase text-zinc-500">Check-in Totali</div>
                <div className="text-xl font-bold text-zinc-100 font-mono">{data.stats.checkins_total}</div>
                <div className="text-[9px] font-mono text-zinc-500">{data.stats.checkins_month} ultimo mese</div>
              </div>
              <div className="border border-border p-3">
                <div className="text-[9px] tracking-[0.2em] uppercase text-zinc-500">Imposta Riscossa</div>
                <div className="text-xl font-bold text-emerald-500 font-mono">€ {data.stats.tax_total_eur.toFixed(2)}</div>
                <div className="text-[9px] font-mono text-zinc-500">{data.stats.tax_receipts_count} ricevute</div>
              </div>
              <div className="border border-border p-3">
                <div className="text-[9px] tracking-[0.2em] uppercase text-zinc-500">Ospiti</div>
                <div className="text-xl font-bold text-zinc-100 font-mono">{data.stats.guests_italian + data.stats.guests_foreign}</div>
                <div className="text-[9px] font-mono text-zinc-500">{data.stats.guests_italian} IT · {data.stats.guests_foreign} EE</div>
              </div>
            </div>

            {/* Success rates */}
            <div className="border border-border p-3 flex flex-col gap-3">
              <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Tassi Successo Invii (PROD)</div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-zinc-400">Alloggiati Web</span>
                  <span className="text-emerald-500">{data.stats.alloggiati_success_pct !== null ? `${data.stats.alloggiati_success_pct}%` : "—"} ({data.stats.alloggiati_ok}/{data.stats.alloggiati_total})</span>
                </div>
                <div className="h-2 bg-surface-3"><div className="h-full bg-emerald-500" style={{ width: `${data.stats.alloggiati_success_pct || 0}%` }} /></div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-zinc-400">Turismo 5</span>
                  <span className="text-emerald-500">{data.stats.turismo5_success_pct !== null ? `${data.stats.turismo5_success_pct}%` : "—"} ({data.stats.turismo5_ok}/{data.stats.turismo5_total})</span>
                </div>
                <div className="h-2 bg-surface-3"><div className="h-full bg-emerald-500" style={{ width: `${data.stats.turismo5_success_pct || 0}%` }} /></div>
              </div>
            </div>

            {/* Properties */}
            <div className="border border-border p-3 flex flex-col gap-2">
              <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Strutture ({data.properties.length})</div>
              {data.properties.length === 0 ? (
                <p className="text-zinc-500 text-[11px] font-mono">Nessuna struttura configurata.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {data.properties.map((p) => (
                    <div key={p.property_id} className="text-[10px] font-mono text-zinc-300 flex justify-between border border-border px-2 py-1">
                      <span>{p.nome || "(senza nome)"}</span>
                      <span className="text-zinc-600">{p.comune} · {p.mode}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent checkins */}
            <div className="border border-border p-3 flex flex-col gap-2">
              <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Ultimi 20 Check-in</div>
              {data.recent_checkins.length === 0 ? (
                <p className="text-zinc-500 text-[11px] font-mono">Nessun check-in.</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                  {data.recent_checkins.map((c) => (
                    <div key={c.checkin_id} className="text-[10px] font-mono text-zinc-300 flex justify-between border border-border px-2 py-1">
                      <span>{c.data_arrivo} → {c.data_partenza} · {c.guests_count} ospiti</span>
                      <span className="text-zinc-500">{c.capogruppo}</span>
                      <span className={c.results?.alloggiati_web?.success ? "text-emerald-500" : "text-zinc-600"}>{c.mode}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setUsers(r.data?.users || []);
    } catch {/* */} finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, []);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("it-IT"); } catch { return iso; }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && reload()}
          placeholder="Cerca per email o nome..."
          data-testid="admin-users-search"
          className="flex-1 bg-transparent border border-border px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm font-mono"
        />
        <button
          onClick={reload}
          data-testid="admin-users-search-btn"
          className="border border-zinc-100 hover:bg-zinc-100 hover:text-black text-zinc-100 px-4 py-2 uppercase tracking-[0.25em] text-[10px] cursor-pointer transition-colors"
        >
          Cerca
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
      ) : users.length === 0 ? (
        <p className="text-zinc-500 text-sm font-mono">Nessun utente trovato.</p>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-widest">Utente</th>
                <th className="text-center px-2 py-2 text-zinc-500 uppercase tracking-widest">Strutture</th>
                <th className="text-center px-2 py-2 text-zinc-500 uppercase tracking-widest">Check-in</th>
                <th className="text-left px-2 py-2 text-zinc-500 uppercase tracking-widest">Ultimo</th>
                <th className="text-left px-2 py-2 text-zinc-500 uppercase tracking-widest">Stato</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.user_id}
                  className={`border-b border-border hover:bg-surface-1 cursor-pointer ${u.disabled ? "opacity-50" : ""}`}
                  onClick={() => setDetailId(u.user_id)}
                  data-testid={`admin-user-${u.user_id}`}
                >
                  <td className="px-3 py-2 text-zinc-100">
                    <div className="flex flex-col">
                      <span>{u.email}</span>
                      {u.name && <span className="text-zinc-500 text-[9px]">{u.name}</span>}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center text-zinc-300">{u.properties_count}</td>
                  <td className="px-2 py-2 text-center text-emerald-500">{u.checkins_count}</td>
                  <td className="px-2 py-2 text-zinc-500">{fmtDate(u.last_checkin_at)}</td>
                  <td className="px-2 py-2">
                    {u.disabled ? (
                      <span className="text-red-400 text-[9px] uppercase tracking-widest">[ DIS ]</span>
                    ) : (
                      <span className="text-emerald-500 text-[9px] uppercase tracking-widest">[ ATT ]</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <UserDetailModal
          userId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";

  useEffect(() => {
    if (user && user.is_admin === false) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  if (!user) return null;
  if (user.is_admin === false) return null;

  return (
    <Layout>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="typo-h1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          Super Pannello
        </h2>
        <Link to="/" className="text-zinc-500 hover:text-zinc-100 text-[10px] uppercase tracking-[0.25em] cursor-pointer">
          ← App
        </Link>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setParams({ tab: "overview" })}
          data-testid="admin-tab-overview"
          className={`text-[10px] tracking-[0.25em] uppercase px-4 py-2 cursor-pointer transition-colors ${
            tab === "overview" ? "text-zinc-100 border-b-2 border-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setParams({ tab: "users" })}
          data-testid="admin-tab-users"
          className={`text-[10px] tracking-[0.25em] uppercase px-4 py-2 cursor-pointer transition-colors ${
            tab === "users" ? "text-zinc-100 border-b-2 border-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Utenti
        </button>
      </div>

      {tab === "overview" ? <OverviewTab /> : <UsersTab />}
    </Layout>
  );
}
