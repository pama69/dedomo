import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import DownloadManualButton from "@/components/DownloadManualButton";

export default function Dashboard() {
  const navigate = useNavigate();
  const [recent, setRecent] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/checkins").then((r) => r.data),
      api.get("/properties").then((r) => r.data),
    ])
      .then(([c, p]) => {
        setRecent(c.slice(0, 5));
        setProperties(p);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      {/* ── HERO CHECK-IN ── */}
      <button
        data-testid="main-checkin-button"
        onClick={() => {
          if (properties.length === 0) {
            navigate("/settings");
          } else {
            navigate("/checkin");
          }
        }}
        className="group relative w-full overflow-hidden rounded-xl cursor-pointer transition-transform active:scale-[0.995]"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--surface-2)) 0%, hsl(var(--surface-1)) 100%)",
          border: "1px solid hsl(var(--border))",
          padding: 0,
        }}
      >
        {/* Highlight luce dall'alto */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, hsl(var(--accent) / 0.6), transparent)" }}
        />
        {/* Glow di sfondo */}
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
        onClick={() => navigate("/archive")}
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
          <span className="text-base font-semibold uppercase tracking-wider" style={{ color: "hsl(0 70% 65%)", fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
            Check-in Remoto
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(0 40% 50%)" }}>
            · invia form all'ospite →
          </span>
        </div>
      </button>

      {/* ── STATS QUICK ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Strutture"
          value={loading ? null : properties.length}
          hint={properties.length === 0 ? "Nessuna configurata" : "Attive"}
        />
        <StatCard
          label="Ultimi Invii"
          value={loading ? null : recent.length}
          hint="Negli ultimi 30 giorni"
        />
        <StatCard
          label="Stato Sistema"
          value={<span style={{ color: "hsl(var(--accent))" }}>● Online</span>}
          hint="Tutti i servizi attivi"
          asValueNode
        />
      </div>

      {/* ── STRUTTURE ── */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="typo-h2">Riepilogo Strutture</h2>
          <button
            onClick={() => navigate("/settings")}
            className="btn-ghost"
          >
            Gestisci →
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        ) : properties.length === 0 ? (
          <div
            className="surface-card p-10 text-center"
            style={{ borderStyle: "dashed" }}
          >
            <p className="typo-body mb-5">
              Nessuna struttura configurata
            </p>
            <button
              data-testid="setup-first-property"
              onClick={() => navigate("/settings")}
              className="btn-accent"
            >
              Configura Prima Struttura
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {properties.map((p) => (
              <button
                key={p.property_id}
                data-testid={`property-card-${p.property_id}`}
                onClick={() => navigate(`/settings#${p.property_id}`)}
                className="surface-interactive p-4 flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: "hsl(var(--surface-3))",
                      color: "hsl(var(--accent))",
                      fontFamily: "'Cabinet Grotesk', sans-serif",
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {(p.nome || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-primary-content truncate">{p.nome}</p>
                    <p className="typo-meta mt-0.5">
                      {p.comune || "—"}
                      <span className="mx-2 opacity-50">·</span>
                      <span style={{ color: p.mode === "PROD" ? "hsl(var(--accent))" : "hsl(var(--text-muted))" }}>
                        {p.mode}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="text-muted-content" aria-hidden>→</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── ULTIMI INVII ── */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="typo-h2">Ultimi Invii</h2>
          {recent.length > 0 && (
            <button
              onClick={() => navigate("/archive")}
              className="btn-ghost"
            >
              Archivio completo →
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="surface-card p-6 text-center">
            <p className="typo-small text-muted-content">
              Nessun invio ancora effettuato
            </p>
          </div>
        ) : (
          <div className="surface-card overflow-hidden">
            {recent.map((c, i) => {
              const aw = c.results?.alloggiati_web;
              const r1k = c.results?.ross1000;
              const isLast = i === recent.length - 1;
              return (
                <div
                  key={c.checkin_id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    borderBottom: isLast ? "none" : "1px solid hsl(var(--border-subtle))",
                  }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-primary-content font-medium truncate">
                      {c.property_name}
                    </span>
                    <span className="typo-meta mt-0.5">
                      {new Date(c.created_at).toLocaleString("it-IT", {
                        day: "2-digit", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      <span className="mx-2 opacity-50">·</span>
                      {c.mode}
                    </span>
                  </div>
                  <div className="flex gap-1.5 ml-3 flex-shrink-0">
                    <StatusPill kind={aw} label="AW" />
                    <StatusPill kind={r1k} label="R1K" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── GUIDA ── */}
      <div
        className="surface-card p-5 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-col gap-1">
          <span className="typo-meta">Guida d'uso</span>
          <span className="typo-body text-primary-content">Manuale passo-passo in italiano</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/help")}
            data-testid="dashboard-open-help"
            className="btn-ghost"
          >
            Apri guida online →
          </button>
          <DownloadManualButton testid="dashboard-download-manual" />
        </div>
      </div>
    </Layout>
  );
}

/* ── SUB-COMPONENTS ── */

function StatCard({ label, value, hint, asValueNode = false }) {
  return (
    <div className="surface-card p-4">
      <p className="typo-meta">{label}</p>
      <p
        className="mt-2 text-2xl font-bold text-primary-content"
        style={{ fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: "-0.025em" }}
      >
        {value === null ? <span className="skeleton inline-block w-8 h-6" /> : asValueNode ? value : value}
      </p>
      {hint && <p className="typo-small text-muted-content mt-1">{hint}</p>}
    </div>
  );
}

function StatusPill({ kind, label }) {
  if (!kind) return null;
  const cls = kind.success ? "badge-success" : kind.skipped ? "badge-neutral" : "badge-error";
  const text = kind.success ? "OK" : kind.skipped ? "SKIP" : "ERR";
  return (
    <span className={`badge ${cls}`}>
      <span className="font-mono opacity-70">{label}</span>
      {text}
    </span>
  );
}
