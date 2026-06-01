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
    <div className="border border-[#1E1E28] p-4 flex flex-col gap-1" data-testid={testid}>
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{label}</span>
      <span className="text-2xl font-bold text-zinc-100 font-mono">{value}</span>
      {sub && <span className="text-[10px] font-mono text-zinc-500">{sub}</span>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="border border-[#1E1E28] p-4 flex flex-col gap-3">
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
              <div className="h-2 bg-[#1E1E28]">
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
              <div className="h-2 bg-[#1E1E28]">
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

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const reload = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setUsers(r.data?.users || []);
    } catch {/* */} finally { setLoading(false); }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

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
          className="flex-1 bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm font-mono"
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
        <div className="border border-[#1E1E28] overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead className="bg-[#0E0E14] border-b border-[#1E1E28]">
              <tr>
                <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-widest">Utente</th>
                <th className="text-center px-2 py-2 text-zinc-500 uppercase tracking-widest">Strutture</th>
                <th className="text-center px-2 py-2 text-zinc-500 uppercase tracking-widest">Check-in</th>
                <th className="text-left px-2 py-2 text-zinc-500 uppercase tracking-widest">Ultimo Check-in</th>
                <th className="text-left px-2 py-2 text-zinc-500 uppercase tracking-widest">Registrato</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-b border-[#1E1E28] hover:bg-[#0E0E14]" data-testid={`admin-user-${u.user_id}`}>
                  <td className="px-3 py-2 text-zinc-100">
                    <div className="flex flex-col">
                      <span>{u.email}</span>
                      {u.name && <span className="text-zinc-500 text-[9px]">{u.name}</span>}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center text-zinc-300">{u.properties_count}</td>
                  <td className="px-2 py-2 text-center text-emerald-500">{u.checkins_count}</td>
                  <td className="px-2 py-2 text-zinc-500">{fmtDate(u.last_checkin_at)}</td>
                  <td className="px-2 py-2 text-zinc-500">{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <h2 className="text-2xl font-bold uppercase tracking-tight text-zinc-100" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          Super Pannello
        </h2>
        <Link to="/" className="text-zinc-500 hover:text-zinc-100 text-[10px] uppercase tracking-[0.25em] cursor-pointer">
          ← App
        </Link>
      </div>

      <div className="flex gap-2 border-b border-[#1E1E28]">
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
