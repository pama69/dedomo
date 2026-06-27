import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import NewRemoteCheckinModal from "@/components/NewRemoteCheckinModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const [showRemoteModal, setShowRemoteModal] = useState(false);

  useEffect(() => {
    api.get("/properties").then((r) => {
      setProperties(r.data);
      setPropertiesLoaded(true);
    });
  }, []);

  return (
    <>
      <Layout>
        {/* ── HERO CHECK-IN ── */}
        <button
          data-testid="main-checkin-button"
          onClick={() => {
            if (properties.length === 0) navigate("/settings");
            else navigate("/checkin");
          }}
          className="group relative w-full overflow-hidden rounded-xl cursor-pointer transition-transform active:scale-[0.995]"
          style={{
            background: "linear-gradient(135deg, hsl(var(--surface-2)) 0%, hsl(var(--surface-1)) 100%)",
            border: "1px solid hsl(var(--border))",
            padding: 0,
          }}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, hsl(var(--accent) / 0.6), transparent)" }}
          />
          <div
            aria-hidden
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[120%] h-48 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.18), transparent)" }}
          />
          <div className="relative flex flex-col items-center justify-center py-14 px-6">
            <span className="typo-meta mb-3" style={{ color: "hsl(var(--accent))" }}>
              ◆ Nuovo Check-In
            </span>
            <span
              className="text-5xl sm:text-6xl font-bold uppercase tracking-tight text-primary-content"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: "-0.045em" }}
            >
              CHECK IN
            </span>
            <span className="typo-small text-secondary-content mt-3">
              Acquisisci documenti e invia ai portali
            </span>
          </div>
        </button>

        {/* ── REMOTE CHECK-IN ── */}
        <button
          onClick={() => setShowRemoteModal(true)}
          className="group relative w-full overflow-hidden cursor-pointer transition-all active:scale-[0.998]"
          style={{
            background: "linear-gradient(135deg, hsl(0 20% 10%) 0%, hsl(0 15% 8%) 100%)",
            border: "1px solid hsl(0 50% 30% / 0.5)",
            padding: 0,
            boxShadow: "0 0 24px hsl(0 70% 40% / 0.15), inset 0 1px 0 hsl(0 60% 50% / 0.1)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, hsl(0 70% 50% / 0.5), transparent)" }}
          />
          <div
            aria-hidden
            className="absolute -top-12 left-1/2 -translate-x-1/2 w-[80%] h-24 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: "radial-gradient(closest-side, hsl(0 80% 50% / 0.12), transparent)" }}
          />
          <div className="relative flex items-center justify-center gap-3 py-4 px-6">
            <span
              className="text-base font-semibold uppercase tracking-wider"
              style={{ color: "hsl(0 70% 65%)", fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: "-0.02em" }}
            >
              Check-in Remoto
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(0 40% 50%)" }}>
              · invia form all'ospite →
            </span>
          </div>
        </button>

        {/* ── STATO SISTEMA ── */}
        <SystemStatus />

        {/* ── LOG EVENTI ── */}
        <SystemEventLog />

      </Layout>

      {showRemoteModal && (
        <NewRemoteCheckinModal
          properties={properties}
          onClose={() => setShowRemoteModal(false)}
          onCreated={() => setShowRemoteModal(false)}
        />
      )}
    </>
  );
}

/* ── Stato sistema (health check reale) ── */
function SystemStatus() {
  const [status, setStatus] = useState("checking"); // checking | online | offline

  useEffect(() => {
    api.get("/health")
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);

  const cfg = {
    checking: { dot: "#6b7280", label: "Verifica in corso…", bg: "hsl(var(--surface-1))", border: "hsl(var(--border))" },
    online:   { dot: "#4ade80", label: "Sistema online",      bg: "hsl(130 15% 10%)",      border: "hsl(130 30% 22%)" },
    offline:  { dot: "#f87171", label: "Sistema non raggiungibile", bg: "hsl(0 15% 10%)", border: "hsl(0 30% 25%)" },
  }[status];

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: cfg.dot, boxShadow: status === "online" ? `0 0 6px ${cfg.dot}` : "none" }}
      />
      <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-300">{cfg.label}</span>
      {status === "online" && (
        <span className="ml-auto text-[10px] font-mono text-zinc-600">API /health OK</span>
      )}
    </div>
  );
}

/* ── Log eventi sistema ── */
function SystemEventLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/events")
      .then((r) => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="typo-h2">Log eventi</h2>
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">ultimi 10</span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="typo-small text-muted-content">Nessun evento ancora registrato</p>
        </div>
      ) : (
        <div className="flex flex-col" style={{ border: "1px solid hsl(var(--border))" }}>
          {events.map((ev, i) => (
            <EventRow key={i} ev={ev} last={i === events.length - 1} />
          ))}
        </div>
      )}
    </section>
  );
}

const STATUS_CFG = {
  ok:    { dot: "#4ade80", text: "text-emerald-400" },
  error: { dot: "#f87171", text: "text-red-400" },
  info:  { dot: "#60a5fa", text: "text-blue-400" },
  skip:  { dot: "#6b7280", text: "text-zinc-500" },
};

const MODE_CFG = {
  PROD:   { bg: "hsl(var(--accent) / 0.15)", color: "hsl(var(--accent))" },
  TEST:   { bg: "hsl(var(--border))",         color: "hsl(var(--text-muted))" },
  REMOTO: { bg: "hsl(0 30% 18%)",             color: "hsl(0 60% 60%)" },
};

function EventRow({ ev, last }) {
  const cfg = STATUS_CFG[ev.status] || STATUS_CFG.info;
  const modeCfg = MODE_CFG[ev.mode] || MODE_CFG.TEST;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 hover:bg-surface-1 transition-colors"
      style={{ borderBottom: last ? "none" : "1px solid hsl(var(--border))" }}
    >
      {/* Indicatore stato */}
      <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
        <span
          className="w-2 h-2 rounded-full mt-1"
          style={{ backgroundColor: cfg.dot, boxShadow: ev.status === "ok" ? `0 0 5px ${cfg.dot}66` : "none" }}
        />
      </div>

      {/* Contenuto */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-semibold ${cfg.text}`}>{ev.label}</span>
          <span
            className="text-[9px] font-mono uppercase px-1.5 py-0.5"
            style={{ background: modeCfg.bg, color: modeCfg.color }}
          >
            {ev.mode}
          </span>
        </div>
        <p className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">
          {ev.property_name}
          {ev.detail && <span className="text-zinc-600"> · {ev.detail}</span>}
        </p>
      </div>

      {/* Timestamp */}
      <span className="text-[10px] font-mono text-zinc-600 flex-shrink-0 mt-0.5">
        {fmtTs(ev.ts)}
      </span>
    </div>
  );
}

function fmtTs(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)  return "ora";
    if (diffMin < 60) return `${diffMin}m fa`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)   return `${diffH}h fa`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1)  return "ieri";
    if (diffD < 7)    return `${diffD}g fa`;
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  } catch { return "—"; }
}
