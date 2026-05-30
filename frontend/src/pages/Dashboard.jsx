import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";

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
      <button
        data-testid="main-checkin-button"
        onClick={() => {
          if (properties.length === 0) {
            navigate("/settings");
          } else {
            navigate("/checkin");
          }
        }}
        className="w-full h-36 flex flex-col items-center justify-center bg-zinc-100 text-[#05050A] hover:bg-white active:scale-[0.98] transition-all cursor-pointer"
      >
        <span
          className="text-4xl font-bold uppercase tracking-widest"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          CHECK IN
        </span>
        <span className="text-[10px] mt-2 tracking-[0.3em] uppercase opacity-60">
          Avvia nuovo check-in
        </span>
      </button>

      <div>
        <h2
          className="text-xs tracking-[0.3em] uppercase text-zinc-500 mb-4"
        >
          Riepilogo Strutture
        </h2>
        {loading ? (
          <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
        ) : properties.length === 0 ? (
          <div className="border border-dashed border-[#1E1E28] p-8 text-center">
            <p className="text-zinc-400 text-sm mb-4">
              Nessuna struttura configurata.
            </p>
            <button
              data-testid="setup-first-property"
              onClick={() => navigate("/settings")}
              className="text-xs tracking-[0.25em] uppercase text-zinc-100 border border-[#1E1E28] hover:border-zinc-500 px-6 py-3 transition-colors cursor-pointer"
            >
              Configura Prima Struttura
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {properties.map((p) => (
              <div
                key={p.property_id}
                data-testid={`property-card-${p.property_id}`}
                className="bg-[#0E0E14] border border-[#1E1E28] p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-100">{p.nome}</p>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mt-1 font-mono">
                    {p.comune || "—"} · [{p.mode}]
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs tracking-[0.3em] uppercase text-zinc-500 mb-4">
          Ultimi Invii
        </h2>
        {recent.length === 0 ? (
          <p className="text-zinc-600 text-xs font-mono">[ NESSUN INVIO ]</p>
        ) : (
          <div className="flex flex-col gap-1 font-mono text-xs">
            {recent.map((c) => {
              const aw = c.results?.alloggiati_web;
              const r1k = c.results?.ross1000;
              return (
                <div
                  key={c.checkin_id}
                  className="bg-[#0E0E14] border border-[#1E1E28] p-3 flex flex-col gap-1"
                >
                  <div className="flex justify-between text-zinc-400">
                    <span>{new Date(c.created_at).toLocaleString("it-IT")}</span>
                    <span>[{c.mode}]</span>
                  </div>
                  <div className="text-zinc-200">{c.property_name}</div>
                  <div className="flex gap-3 text-[10px]">
                    <span className={aw?.success ? "text-emerald-500" : "text-red-500"}>
                      AW [{aw?.success ? "OK" : aw?.skipped ? "SKIP" : "ERR"}]
                    </span>
                    <span className={r1k?.success ? "text-emerald-500" : "text-red-500"}>
                      R1K [{r1k?.success ? "OK" : r1k?.skipped ? "SKIP" : "ERR"}]
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
