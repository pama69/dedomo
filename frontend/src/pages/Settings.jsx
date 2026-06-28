import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { usePushNotifications } from "@/lib/usePushNotifications";

const newFeedId = () => `feed_${Math.random().toString(36).slice(2, 10)}`;

// Converte i vecchi 3 URL fissi in una lista di feed nominati (retrocompatibilità).
const legacyToFeeds = (cal = {}) => {
  const out = [];
  if (cal.booking_ical_url) out.push({ id: "booking", name: "Booking", url: cal.booking_ical_url });
  if (cal.airbnb_ical_url) out.push({ id: "airbnb", name: "Airbnb", url: cal.airbnb_ical_url });
  if (cal.vrbo_ical_url) out.push({ id: "vrbo", name: "Vrbo", url: cal.vrbo_ical_url });
  return out;
};

const emptyAlloggiati = {
  utente: "",
  password: "",
  ws_key: "",
  tipo_account: "standard",
  id_appartamento: 0,
  enabled: true,
};
const emptyRoss = {
  regione: "Abruzzo",
  utente: "",
  password: "",
  endpoint_url: "",
  format: "soap_v2",
  codice_struttura: "",
  nome_prodotto: "Dedomo",
  n_camere: 1,
  n_letti: 2,
  enabled: true,
};
const emptyImposta = {
  tariffa_per_notte: 0,
  max_notti_tassabili: 7,
  esenti_under_anni: 16,
  endpoint_comune: "",
  enabled: true,
};

const newProperty = () => ({
  nome: "",
  indirizzo: "",
  comune: "",
  provincia: "",
  cap: "",
  cin: "",
  tipologia: "Casa Vacanza",
  proprietario: "",
  codice_fiscale: "",
  mode: "TEST",
  alloggiati: { ...emptyAlloggiati },
  ross1000: { ...emptyRoss },
  imposta_soggiorno: { ...emptyImposta },
  calendar: {
    booking_ical_url: "",
    airbnb_ical_url: "",
    vrbo_ical_url: "",
    color: "#10b981",
  },
});

export default function Settings() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // property object being edited
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await api.get("/properties");
    setList(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditing(newProperty());
    setError("");
  };

  const save = async () => {
    if (!editing.nome.trim()) {
      setError("Il nome della struttura è obbligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Normalize empty strings to numeric defaults before submit
      const payload = JSON.parse(JSON.stringify(editing));
      const num = (v, def = 0) => (v === "" || v === null || isNaN(v) ? def : Number(v));
      // Trim credential fields to remove accidental whitespace from copy-paste
      const trimStr = (v) => (typeof v === "string" ? v.trim() : v);
      ["utente", "password", "ws_key"].forEach((k) => {
        if (payload.alloggiati[k] !== undefined) payload.alloggiati[k] = trimStr(payload.alloggiati[k]);
      });
      ["utente", "password"].forEach((k) => {
        if (payload.ross1000[k] !== undefined) payload.ross1000[k] = trimStr(payload.ross1000[k]);
      });
      payload.ross1000.n_camere = num(payload.ross1000.n_camere, 1);
      payload.ross1000.n_letti = num(payload.ross1000.n_letti, 1);
      payload.imposta_soggiorno.tariffa_per_notte = num(payload.imposta_soggiorno.tariffa_per_notte, 0);
      payload.imposta_soggiorno.max_notti_tassabili = num(payload.imposta_soggiorno.max_notti_tassabili, 7);
      payload.imposta_soggiorno.esenti_under_anni = num(payload.imposta_soggiorno.esenti_under_anni, 0);
      payload.alloggiati.id_appartamento =
        payload.alloggiati.id_appartamento === "" ||
        payload.alloggiati.id_appartamento === undefined ||
        isNaN(payload.alloggiati.id_appartamento)
          ? null
          : Number(payload.alloggiati.id_appartamento);

      if (editing.property_id) {
        await api.put(`/properties/${editing.property_id}`, payload);
        setEditing(null);
      } else {
        const res = await api.post("/properties", payload);
        // Resta in modifica con l'ID appena creato → mostra subito URL iCal
        setEditing(res.data);
      }
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const removeAndExit = async (id) => {
    await api.delete(`/properties/${id}`);
    setEditing(null);
    await load();
  };

  if (editing) return <PropertyEditor p={editing} setP={setEditing} save={save} cancel={() => setEditing(null)} onDelete={removeAndExit} saving={saving} error={error} />;

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <h2 className="typo-h1">Strutture</h2>
        <button
          data-testid="add-property-btn"
          onClick={startNew}
          className="btn-accent"
        >
          + Nuova
        </button>
      </div>


      {loading ? (
        <div className="flex flex-col gap-2">
          <div className="skeleton h-16" />
          <div className="skeleton h-16" />
        </div>
      ) : list.length === 0 ? (
        <div className="surface-card p-12 text-center" style={{ borderStyle: "dashed" }}>
          <p className="typo-body mb-2">Nessuna struttura configurata</p>
          <p className="typo-small text-muted-content">
            Premi "+ Nuova" per aggiungere la tua prima unità immobiliare.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((p) => (
            <div
              key={p.property_id}
              data-testid={`property-row-${p.property_id}`}
              onClick={() => setEditing(p)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(p); } }}
              role="button"
              tabIndex={0}
              aria-label={`Apri scheda ${p.nome}`}
              className="surface-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer transition-all hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-md flex items-center justify-center flex-shrink-0 text-lg"
                  style={{
                    backgroundColor: "hsl(var(--surface-3))",
                    color: "hsl(var(--accent))",
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontWeight: 700,
                  }}
                >
                  {(p.nome || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-primary-content truncate leading-tight">{p.nome}</p>
                  <p className="typo-meta mt-1">
                    {p.comune || "—"}
                    <span className="mx-1.5 opacity-50">·</span>CIN {p.cin || "—"}
                    <span className="mx-1.5 opacity-50">·</span>
                    <span style={{ color: p.mode === "PROD" ? "hsl(var(--accent))" : "hsl(var(--text-muted))" }}>{p.mode}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <svg className="w-5 h-5 text-zinc-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      <OwnerBankInfoSection properties={list} />
      <PushNotificationSection />
      <DangerZoneSection />
    </Layout>
  );
}

function Section({ title, children }) {
  return (
    <div className="surface-card p-5 flex flex-col gap-4">
      <h3 className="typo-h3">{title}</h3>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", testid, placeholder, mono = true, autoComplete, noAutofill = false }) {
  const [active, setActive] = useState(false);
  // Random id/name per mount so Chrome can't pattern-match to saved credentials
  const [uid] = useState(() => `_f_${Math.random().toString(36).slice(2)}`);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="typo-meta">{label}</span>
      <input
        id={noAutofill ? uid : undefined}
        type={type}
        data-testid={testid}
        value={value ?? ""}
        readOnly={noAutofill && !active}
        onFocus={() => noAutofill && setActive(true)}
        onBlur={() => noAutofill && setActive(false)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={active || !noAutofill ? placeholder : undefined}
        autoComplete={noAutofill ? "one-time-code" : (autoComplete || "off")}
        name={noAutofill ? uid : (testid ? `_nofill_${testid}` : undefined)}
        data-lpignore="true"
        data-1p-ignore
        className={`input-modern ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

function Toggle({ label, value, onChange, testid }) {
  return (
    <label
      className="flex items-center justify-between rounded-lg px-4 py-3 cursor-pointer transition-colors"
      style={{
        backgroundColor: value ? "hsl(var(--accent) / 0.08)" : "hsl(var(--surface-2))",
        border: `1px solid ${value ? "hsl(var(--accent) / 0.35)" : "hsl(var(--border))"}`,
      }}
      onClick={() => onChange(!value)}
    >
      <span className="typo-meta" style={{ color: value ? "hsl(var(--accent))" : "hsl(var(--text-muted))" }}>
        {label}
      </span>
      <button
        type="button"
        data-testid={testid}
        onClick={(e) => { e.preventDefault(); onChange(!value); }}
        className="relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0"
        style={{
          width: 40, height: 22,
          backgroundColor: value ? "hsl(var(--accent))" : "hsl(var(--surface-3))",
        }}
        aria-pressed={value}
      >
        <span
          className="absolute top-0.5 rounded-full bg-white transition-all"
          style={{ width: 18, height: 18, left: value ? 20 : 2 }}
        />
      </button>
    </label>
  );
}

function PropertyEditor({ p, setP, save, cancel, onDelete, saving, error }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const upd = (path, val) => {
    setP((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] === undefined || obj[keys[i]] === null) {
          obj[keys[i]] = {};
        }
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = val;
      return copy;
    });
  };

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <h2 className="typo-h1">
          {p.property_id ? "Modifica Struttura" : "Nuova Struttura"}
        </h2>
        <button
          onClick={cancel}
          data-testid="cancel-edit-btn"
          className="btn-ghost"
        >
          ← Indietro
        </button>
      </div>

      <Section title="Dati Struttura">
        <Field label="Nome" value={p.nome} onChange={(v) => upd("nome", v)} testid="prop-nome" placeholder="Es. Villa Mare" mono={false} />
        <Field label="Indirizzo" value={p.indirizzo} onChange={(v) => upd("indirizzo", v)} testid="prop-indirizzo" mono={false} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Comune" value={p.comune} onChange={(v) => upd("comune", v)} testid="prop-comune" mono={false} />
          <Field label="Prov." value={p.provincia} onChange={(v) => upd("provincia", v)} testid="prop-prov" mono={false} />
          <Field label="CAP" value={p.cap} onChange={(v) => upd("cap", v)} testid="prop-cap" />
        </div>
        <Field label="CIN (Codice Identificativo Nazionale)" value={p.cin} onChange={(v) => upd("cin", v)} testid="prop-cin" />

        <div className="border-t border-border pt-3 flex flex-col gap-3">
          <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Intestazione Ricevute Imposta di Soggiorno</p>
          <Field label="Proprietario" value={p.proprietario || ""} onChange={(v) => upd("proprietario", v)} testid="prop-proprietario" placeholder="Es. Mario Rossi" mono={false} />
          <Field label="Codice Fiscale" value={p.codice_fiscale || ""} onChange={(v) => upd("codice_fiscale", (v || "").toUpperCase())} testid="prop-codice-fiscale" placeholder="RSSMRA80A01H501U" />
        </div>

        <Toggle
          label={`Modalità — [${p.mode}]`}
          value={p.mode === "PROD"}
          onChange={(v) => upd("mode", v ? "PROD" : "TEST")}
          testid="test-prod-toggle"
        />
        <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-mono">
          {p.mode === "TEST"
            ? "TEST: validazione senza invio reale"
            : "PROD: invii reali ai portali"}
        </p>
      </Section>

      <Section title="Alloggiati Web (Polizia)">
        <Toggle label="Abilita Alloggiati Web" value={p.alloggiati.enabled} onChange={(v) => upd("alloggiati.enabled", v)} testid="aw-enabled" />
        <Field label="Utente" value={p.alloggiati.utente} onChange={(v) => upd("alloggiati.utente", v)} testid="aw-utente" noAutofill />
        <Field label="Password" type="text" value={p.alloggiati.password} onChange={(v) => upd("alloggiati.password", v)} testid="aw-password" noAutofill />
        <Field label="WS Key (incolla qui — visibile per verifica)" type="text" value={p.alloggiati.ws_key} onChange={(v) => upd("alloggiati.ws_key", v)} testid="aw-wskey" noAutofill />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Tipo Account</span>
          <select
            data-testid="aw-tipo-account"
            value={p.alloggiati.tipo_account}
            onChange={(e) => upd("alloggiati.tipo_account", e.target.value)}
            className="input-modern font-mono"
          >
            <option value="standard" className="bg-surface-1">Standard (hotel, B&amp;B, struttura unica)</option>
            <option value="appartamenti" className="bg-surface-1">Gestore Appartamenti (con ID per ogni appartamento)</option>
            <option value="appartamenti_file_unico" className="bg-surface-1">Gestore Appartamenti (file unico)</option>
          </select>
        </label>
        {p.alloggiati.tipo_account === "appartamenti" && (
          <ApartmentSelector
            propertyId={p.property_id}
            value={p.alloggiati.id_appartamento}
            onChange={(v) => upd("alloggiati.id_appartamento", v)}
            disabled={!p.property_id}
          />
        )}
        {p.property_id && (
          <>
            <p className="text-amber-400 text-[10px] font-mono tracking-widest uppercase">
              ⚠ Salva prima di fare il test — il test legge le credenziali dal database.
            </p>
            <TestCredentialsButton propertyId={p.property_id} />
          </>
        )}
      </Section>

      <Section title="Turismo 5 / Ross 1000 (Regione)">
        <Toggle label="Abilita Turismo 5" value={p.ross1000.enabled} onChange={(v) => upd("ross1000.enabled", v)} testid="r1k-enabled" />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Regione</span>
          <select
            data-testid="r1k-regione"
            value={p.ross1000.regione}
            onChange={(e) => upd("ross1000.regione", e.target.value)}
            className="input-modern font-mono"
          >
            {["Abruzzo","Basilicata","Calabria","Emilia-Romagna","Lazio","Liguria","Lombardia","Marche","Molise","Piemonte","Sardegna","Toscana","Veneto"].map((r) => (
              <option key={r} value={r} className="bg-surface-1">{r}</option>
            ))}
          </select>
        </label>
        <Field label="Codice Struttura (rilasciato dalla Regione)" value={p.ross1000.codice_struttura} onChange={(v) => upd("ross1000.codice_struttura", v)} testid="r1k-codstruttura" />
        <Field label="Utente" value={p.ross1000.utente} onChange={(v) => upd("ross1000.utente", v)} testid="r1k-utente" noAutofill />
        <Field label="Password" type="text" value={p.ross1000.password} onChange={(v) => upd("ross1000.password", v)} testid="r1k-password" noAutofill />
        <div className="grid grid-cols-2 gap-3">
          <Field label="N. Camere" type="number" value={p.ross1000.n_camere ?? ""} onChange={(v) => upd("ross1000.n_camere", v === "" ? "" : parseInt(v))} testid="r1k-camere" />
          <Field label="N. Letti totali" type="number" value={p.ross1000.n_letti ?? ""} onChange={(v) => upd("ross1000.n_letti", v === "" ? "" : parseInt(v))} testid="r1k-letti" />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Modalità invio</span>
          <select
            data-testid="r1k-format"
            value={p.ross1000.format}
            onChange={(e) => upd("ross1000.format", e.target.value)}
            className="input-modern font-mono"
          >
            <option value="soap_v2" className="bg-surface-1">Web service automatico (consigliato)</option>
            <option value="csv_manual" className="bg-surface-1">CSV manuale (download + upload)</option>
          </select>
        </label>
        {p.property_id && p.ross1000.format === "soap_v2" && (
          <TestTurismo5Button propertyId={p.property_id} />
        )}
      </Section>

      <Section title="Imposta di Soggiorno (Comune)">
        <Toggle label="Abilita Imposta di Soggiorno" value={p.imposta_soggiorno.enabled} onChange={(v) => upd("imposta_soggiorno.enabled", v)} testid="is-enabled" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tariffa / notte (€)" type="number" value={p.imposta_soggiorno.tariffa_per_notte ?? ""} onChange={(v) => upd("imposta_soggiorno.tariffa_per_notte", v === "" ? "" : parseFloat(v))} testid="is-tariffa" />
          <Field label="Max notti tassabili" type="number" value={p.imposta_soggiorno.max_notti_tassabili ?? ""} onChange={(v) => upd("imposta_soggiorno.max_notti_tassabili", v === "" ? "" : parseInt(v))} testid="is-maxnotti" />
        </div>
        <Field label="Esenti sotto i (anni)" type="number" value={p.imposta_soggiorno.esenti_under_anni ?? ""} onChange={(v) => upd("imposta_soggiorno.esenti_under_anni", v === "" ? "" : parseInt(v))} testid="is-esenti" />
        <Field label="Endpoint Comune (opzionale)" value={p.imposta_soggiorno.endpoint_comune} onChange={(v) => upd("imposta_soggiorno.endpoint_comune", v)} testid="is-endpoint" placeholder="https://..." />
      </Section>

      <Section title="Calendario / Sincronizzazione iCal">
        {(() => {
          const feeds = p.calendar?.feeds ?? legacyToFeeds(p.calendar);
          const setFeeds = (next) => upd("calendar.feeds", next);
          return (
            <div className="flex flex-col gap-3">
              <p className="text-zinc-500 text-[11px] font-mono leading-relaxed">
                Collega i calendari dei portali (Booking, Airbnb, Vrbo…). Il <strong>nome</strong> che scegli
                verrà mostrato sul calendario accanto alle prenotazioni importate.
              </p>

              {feeds.length === 0 && (
                <p className="text-zinc-500 text-xs font-mono italic">Nessun calendario collegato.</p>
              )}

              {feeds.map((f, i) => (
                <div key={f.id || i} className="flex flex-col gap-2 border border-border rounded-lg p-3 bg-zinc-900/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
                      Calendario {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFeeds(feeds.filter((_, j) => j !== i))}
                      data-testid={`cal-feed-remove-${i}`}
                      className="text-red-400 hover:text-red-300 text-[10px] tracking-wider uppercase cursor-pointer"
                    >
                      Rimuovi
                    </button>
                  </div>
                  <Field
                    label="Nome (es. Booking, Airbnb…)"
                    value={f.name || ""}
                    onChange={(v) => setFeeds(feeds.map((x, j) => (j === i ? { ...x, name: v } : x)))}
                    testid={`cal-feed-name-${i}`}
                    placeholder="Booking.com"
                  />
                  <Field
                    label="URL iCal (entrata)"
                    value={f.url || ""}
                    onChange={(v) => setFeeds(feeds.map((x, j) => (j === i ? { ...x, url: v } : x)))}
                    testid={`cal-feed-url-${i}`}
                    placeholder="https://...calendar.ics"
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => setFeeds([...feeds, { id: newFeedId(), name: "", url: "" }])}
                data-testid="cal-feed-add"
                className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-emerald-500/40 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="text-sm font-bold tracking-wider uppercase">Aggiungi calendario da collegare</span>
              </button>
            </div>
          );
        })()}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Colore Appartamento</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={p.calendar?.color || "#10b981"}
              onChange={(e) => upd("calendar.color", e.target.value)}
              data-testid="cal-color"
              className="w-12 h-10 bg-transparent border border-border rounded-lg cursor-pointer"
            />
            <span className="text-zinc-400 text-[11px] font-mono">{p.calendar?.color || "#10b981"}</span>
          </div>
        </div>
        <PersonalIcalField propertyId={p.property_id} />
      </Section>

      {error && (
        <div
          className="rounded-lg px-4 py-3 typo-small"
          style={{ backgroundColor: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.3)", color: "hsl(var(--destructive))" }}
        >
          {error}
        </div>
      )}

      {/* Bottone Manuale & Mail — visibile solo su strutture già salvate */}
      {p.property_id && (
        <button
          type="button"
          onClick={() => navigate(`/settings/properties/${p.property_id}/manual`)}
          className="w-full flex items-center justify-center gap-3 py-4 border-2 border-emerald-500/40 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <span className="text-sm font-bold tracking-wider uppercase">Configura Manuale casa e mail personalizzata</span>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={cancel} className="btn-secondary flex-1 py-3.5">
          Annulla
        </button>
        <button
          onClick={save}
          disabled={saving}
          data-testid="save-property-btn"
          className="btn-accent flex-1 py-3.5"
        >
          {saving ? "Salvataggio..." : "Salva struttura"}
        </button>
      </div>

      {/* ── Zona pericolosa: elimina struttura ── */}
      {p.property_id && (
        <div className="mt-8 pt-6 border-t border-red-500/20 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.25em] uppercase text-red-400/80 font-bold">Zona pericolosa</span>
            <p className="text-zinc-500 text-[11px] font-mono">
              L'eliminazione è definitiva: rimuove la struttura e la sua configurazione. Gli invii già archiviati non vengono toccati.
            </p>
          </div>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              data-testid="delete-property-btn"
              className="w-full flex items-center justify-center gap-2 py-3.5 border border-red-500/40 rounded-lg bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-sm font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Elimina questa struttura
            </button>
          ) : (
            <div className="flex flex-col gap-2 border border-red-500/50 rounded-lg bg-red-500/10 p-4">
              <p className="text-red-300 text-sm font-medium">
                Sei sicuro? Questa azione non può essere annullata.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="btn-secondary flex-1 py-3 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await onDelete(p.property_id);
                    } catch (e) {
                      setDeleting(false);
                      setConfirmDelete(false);
                      alert(e.response?.data?.detail || "Errore durante l'eliminazione");
                    }
                  }}
                  disabled={deleting}
                  data-testid="confirm-delete-property-btn"
                  className="flex-1 py-3 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50"
                >
                  {deleting ? "Eliminazione..." : "Sì, elimina"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}


function TestCredentialsButton({ propertyId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.post(`/properties/${propertyId}/alloggiati/test`);
      setResult(r.data);
    } catch (e) {
      setResult({
        success: false,
        message: e.response?.data?.detail || "Errore richiesta",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        data-testid="test-alloggiati-btn"
        className="btn-secondary w-full disabled:opacity-50"
      >
        {loading ? "Test in corso..." : "Test credenziali Alloggiati Web"}
      </button>
      {result && (
        <div
          className={`border p-3 font-mono text-[10px] ${
            result.success
              ? "border-emerald-500/40 text-emerald-400"
              : "border-red-500/40 text-red-400"
          }`}
        >
          <div className="font-bold tracking-widest">
            [{result.success ? "OK" : "ERR"}] {result.step || ""}
          </div>
          {result.message && (
            <div className="text-zinc-400 mt-1 break-words">
              {result.message}
            </div>
          )}
          {result.ws_key_debug && (
            <div className="text-zinc-500 mt-2 border-t border-zinc-700 pt-2 text-[9px] flex flex-col gap-0.5">
              <span>Utente nel DB: <span className="text-zinc-300">{result.ws_key_debug.utente || "—"}</span></span>
              <span>WsKey nel DB: <span className="text-zinc-300">{result.ws_key_debug.len_stripped} chars</span> · inizia con <span className="text-zinc-300">&quot;{result.ws_key_debug.first8}&quot;</span> · finisce con <span className="text-zinc-300">&quot;{result.ws_key_debug.last8}&quot;</span></span>
              <span>Contiene <span className="text-zinc-300">+</span>: {result.ws_key_debug.has_plus ? <span className="text-emerald-400">sì</span> : <span className="text-red-400">NO</span>} &nbsp;|&nbsp; Contiene <span className="text-zinc-300">=</span>: {result.ws_key_debug.has_equals ? <span className="text-emerald-400">sì</span> : <span className="text-red-400">NO</span>}</span>
              {result.ws_key_debug.has_whitespace && <span className="text-amber-400">⚠ spazi trovati agli estremi (rimossi)</span>}
            </div>
          )}
          {result.test_schedina && (
            <div className="text-zinc-500 mt-2 border-t border-zinc-700 pt-2">
              Metodo usato: <span className="text-amber-400">{result.test_schedina.tipo_account_used}</span><br/>
              ID Appartamento: <span className="text-amber-400">{result.test_schedina.id_appartamento_used || "—"}</span><br/>
              Lunghezza schedina: <span className="text-amber-400">{result.test_schedina.schedina_length}</span> chars
            </div>
          )}
          {result.token_expires && (
            <div className="text-zinc-500 mt-1">
              Token valido fino al {result.token_expires}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function TestTurismo5Button({ propertyId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.post(`/properties/${propertyId}/turismo5/test`);
      setResult(r.data);
    } catch (e) {
      setResult({
        success: false,
        message: e.response?.data?.detail || "Errore richiesta",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        data-testid="test-turismo5-btn"
        className="btn-secondary w-full disabled:opacity-50"
      >
        {loading ? "Test in corso..." : "Test credenziali Turismo 5"}
      </button>
      {result && (
        <div
          className={`border p-3 font-mono text-[10px] ${
            result.success
              ? "border-emerald-500/40 text-emerald-400"
              : "border-red-500/40 text-red-400"
          }`}
        >
          <div className="font-bold tracking-widest">
            [{result.success ? "OK" : "ERR"}] HTTP {result.status_code ?? "—"}
          </div>
          {result.endpoint && (
            <div className="text-zinc-500 mt-1 break-all">
              {result.endpoint}
            </div>
          )}
          {result.message && (
            <div className="text-zinc-400 mt-1 break-words">
              {result.message}
            </div>
          )}
          {result.response_preview && (
            <pre className="text-zinc-600 mt-2 whitespace-pre-wrap break-all text-[9px]">
              {result.response_preview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}


function ApartmentSelector({ propertyId, value, onChange, disabled }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [csvRaw, setCsvRaw] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError("");
    setCsvRaw("");
    try {
      const r = await api.post(`/properties/${propertyId}/alloggiati/appartamenti`);
      if (r.data.success) {
        setItems(r.data.appartamenti || []);
        setCsvRaw(r.data.csv_raw || "");
        setLoaded(true);
        if (!value && r.data.appartamenti?.length === 1) {
          onChange(r.data.appartamenti[0].id);
        }
      } else {
        // Cod.50 = tabella vuota → user has no apartments yet
        setItems([]);
        setCsvRaw(r.data.csv_raw || "");
        setLoaded(true);
        setError(r.data.message || "");
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Errore richiesta");
    } finally {
      setLoading(false);
    }
  };

  const handleAdded = (newList) => {
    setItems(newList);
    setShowAddForm(false);
    setError("");
    // Auto-select the last (most recently added)
    if (newList.length > 0) {
      onChange(newList[newList.length - 1].id);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
        ID Appartamento
      </span>
      {disabled ? (
        <p className="text-zinc-600 text-[10px] font-mono">
          Salva prima la struttura per caricare i tuoi appartamenti.
        </p>
      ) : !loaded ? (
        <button
          type="button"
          onClick={load}
          disabled={loading}
          data-testid="load-appartamenti-btn"
          className="btn-secondary w-full disabled:opacity-50"
        >
          {loading ? "Caricamento..." : "Carica miei appartamenti da Alloggiati Web"}
        </button>
      ) : error && items.length === 0 ? (
        <div className="border border-red-500/40 rounded-lg bg-red-500/5 p-3 font-mono text-[10px] text-red-400 flex flex-col gap-2">
          <span className="font-bold">[ ERR ] Impossibile caricare appartamenti</span>
          <span className="text-zinc-400 break-words">{error}</span>
          <span className="text-zinc-500">Verifica che le credenziali siano corrette e salvate, poi riprova.</span>
          <button type="button" onClick={load} disabled={loading} className="self-start text-zinc-500 hover:text-zinc-100 uppercase tracking-widest text-[10px] cursor-pointer">
            {loading ? "Caricamento..." : "↻ Riprova"}
          </button>
        </div>
      ) : items.length > 0 ? (
        <>
          <select
            data-testid="aw-idappartamento"
            value={value !== undefined && value !== null && value !== "" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : parseInt(e.target.value))}
            className="input-modern font-mono"
          >
            <option value="" className="bg-surface-1">— Seleziona appartamento —</option>
            {items.map((a) => (
              <option key={a.id} value={a.id} className="bg-surface-1">
                [{a.id}] {a.descrizione} — {a.comune} ({a.prov})
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={load}
              className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 hover:text-zinc-100 cursor-pointer"
            >
              Ricarica lista
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 hover:text-zinc-100 cursor-pointer"
            >
              + Nuovo appartamento
            </button>
          </div>
        </>
      ) : (
        <div className="border border-amber-500/40 rounded-lg p-3 font-mono text-[10px] text-amber-400 flex flex-col gap-3">
          <div>
            [ ATTENZIONE ] La lista è vuota. Possibili cause:
            <ul className="mt-2 text-zinc-400 list-disc list-inside space-y-1">
              <li>Account "Gestore Appartamenti" appena attivato</li>
              <li>Appartamento pre-creato dalla Questura (spesso ID=1)</li>
              <li>Appartamento gestito esternamente (es. via Turismo 5)</li>
            </ul>
          </div>
          {csvRaw ? (
            <div className="border-t border-amber-500/30 pt-3 flex flex-col gap-1">
              <span className="text-zinc-500">CSV grezzo da Alloggiati Web:</span>
              <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap break-words bg-black/30 p-2">{csvRaw}</pre>
            </div>
          ) : null}
          <div className="border-t border-amber-500/30 pt-3 flex flex-col gap-2">
            <span className="text-zinc-300">Soluzione 1 — Prova ID di default:</span>
            <div className="flex gap-2">
              <input
                type="number"
                data-testid="aw-idappartamento-manual"
                value={value || ""}
                onChange={(e) => onChange(parseInt(e.target.value) || 0)}
                placeholder="es. 1"
                className="flex-1 bg-transparent border border-border rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => onChange(1)}
                className="border border-border rounded-lg hover:border-zinc-500 px-3 py-2 text-zinc-300 uppercase tracking-widest text-[10px] cursor-pointer"
              >
                Usa 1
              </button>
            </div>
            <span className="text-zinc-500 mt-1">
              Salva e poi fai il "Test credenziali" per verificare se l'ID funziona.
            </span>
          </div>
          <div className="border-t border-amber-500/30 pt-3">
            <span className="text-zinc-300">Soluzione 2 — Crea un nuovo appartamento:</span>
            {!showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                data-testid="add-new-appartamento-btn"
                className="block mt-2 text-zinc-300 hover:text-zinc-100 uppercase tracking-widest cursor-pointer underline"
              >
                + Aggiungi nuovo
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={load}
            className="self-start text-zinc-500 hover:text-zinc-100 uppercase tracking-widest cursor-pointer"
          >
            ↻ Ricarica lista
          </button>
        </div>
      )}
      {showAddForm && (
        <AddApartmentForm
          propertyId={propertyId}
          onAdded={handleAdded}
          onCancel={() => setShowAddForm(false)}
        />
      )}
      {error && !showAddForm && items.length > 0 && (
        <p className="text-red-500 text-[10px] font-mono break-words">
          [ ERR ] {error}
        </p>
      )}
    </div>
  );
}

function AddApartmentForm({ propertyId, onAdded, onCancel }) {
  const [form, setForm] = useState({
    descrizione: "",
    comune_codice: "",
    comune_nome: "",
    indirizzo: "",
    proprietario: "",
  });
  const [comuneQuery, setComuneQuery] = useState("");
  const [comuneResults, setComuneResults] = useState([]);
  const [searchingComuni, setSearchingComuni] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const searchComuni = async () => {
    if (!comuneQuery.trim()) return;
    setSearchingComuni(true);
    try {
      const r = await api.get(
        `/properties/${propertyId}/alloggiati/comuni?q=${encodeURIComponent(comuneQuery)}`
      );
      setComuneResults(r.data.results || []);
    } catch (e) {
      setError(e.response?.data?.detail || "Errore ricerca");
    } finally {
      setSearchingComuni(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!form.descrizione || !form.comune_codice || !form.indirizzo || !form.proprietario) {
      setError("Tutti i campi sono obbligatori.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.post(`/properties/${propertyId}/alloggiati/appartamenti/nuovo`, {
        descrizione: form.descrizione,
        comune_codice: form.comune_codice,
        indirizzo: form.indirizzo,
        proprietario: form.proprietario,
      });
      if (r.data.success) {
        onAdded(r.data.appartamenti || []);
      } else {
        setError(r.data.message || "Errore aggiunta");
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Errore richiesta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 flex flex-col gap-3 bg-surface-1">
      <p className="text-xs tracking-[0.25em] uppercase text-zinc-300">
        Nuovo Appartamento
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Descrizione</span>
        <input
          type="text"
          data-testid="new-app-descrizione"
          value={form.descrizione}
          onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
          placeholder="Es. Villa Mare Appartamento 2"
          className="bg-transparent border border-border rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Comune (ricerca per nome)</span>
        <div className="flex gap-2">
          <input
            type="text"
            data-testid="new-app-comune-query"
            value={comuneQuery}
            onChange={(e) => setComuneQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchComuni())}
            placeholder="Es. Pescara"
            className="flex-1 bg-transparent border border-border rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm"
          />
          <button
            type="button"
            onClick={searchComuni}
            disabled={searchingComuni}
            className="border border-border rounded-lg hover:border-zinc-500 px-4 text-zinc-300 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
          >
            {searchingComuni ? "..." : "Cerca"}
          </button>
        </div>
        {comuneResults.length > 0 && (
          <select
            data-testid="new-app-comune-select"
            value={form.comune_codice}
            onChange={(e) => {
              const c = comuneResults.find((x) => x.codice === e.target.value);
              setForm({
                ...form,
                comune_codice: e.target.value,
                comune_nome: c ? c.nome : "",
              });
            }}
            className="bg-transparent border border-border rounded-lg px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm mt-1"
          >
            <option value="" className="bg-surface-1">— Seleziona comune —</option>
            {comuneResults.map((c) => (
              <option key={c.codice} value={c.codice} className="bg-surface-1">
                {c.nome} ({c.provincia}) — {c.codice}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Indirizzo</span>
        <input
          type="text"
          data-testid="new-app-indirizzo"
          value={form.indirizzo}
          onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
          placeholder="Es. Via Roma, 25"
          className="bg-transparent border border-border rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Proprietario</span>
        <input
          type="text"
          data-testid="new-app-proprietario"
          value={form.proprietario}
          onChange={(e) => setForm({ ...form, proprietario: e.target.value })}
          placeholder="Nome Cognome del proprietario"
          className="bg-transparent border border-border rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm"
        />
      </label>
      {error && (
        <p className="text-red-500 text-[10px] font-mono break-words">
          [ ERR ] {error}
        </p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-border rounded-lg hover:border-zinc-500 text-zinc-400 px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          data-testid="confirm-add-appartamento-btn"
          className="flex-1 bg-zinc-100 hover:bg-white text-[#05050A] font-medium px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
        >
          {submitting ? "Aggiunta..." : "Aggiungi"}
        </button>
      </div>
    </div>
  );
}


function PersonalIcalField({ propertyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    setErr(false);
    api.get(`/calendar/personal-url/${propertyId}`)
      .then((r) => setData(r.data))
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (!propertyId) {
    return (
      <p className="typo-small text-muted-content italic">
        Salva la struttura per ottenere l'URL iCal da esportare verso i portali.
      </p>
    );
  }
  if (loading) return <p className="typo-small text-muted-content">Caricamento URL iCal...</p>;
  if (err || !data) return (
    <p className="typo-small" style={{ color: "hsl(var(--destructive))" }}>
      Errore nel recupero dell'URL iCal. Riprova dopo aver salvato.
    </p>
  );
  // L'URL di export DEVE essere assoluto (i portali lo scaricano dai loro server).
  // Preferisci l'url assoluto dal backend; altrimenti costruiscilo dall'origin corrente.
  const envBase = process.env.REACT_APP_BACKEND_URL;
  const base = (data.url && /^https?:\/\//i.test(data.url))
    ? null
    : (envBase || window.location.origin);
  const fullUrl = base ? `${base}${data.path}` : data.url;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="typo-meta">Calendario Personale · URL iCal (uscita)</span>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={fullUrl}
          data-testid="cal-personal-url"
          onClick={(e) => e.target.select()}
          className="input-modern flex-1 text-[11px] font-mono"
        />
        <button
          type="button"
          onClick={copy}
          data-testid="cal-personal-copy"
          className="btn-secondary"
          style={copied ? { color: "hsl(var(--accent))", borderColor: "hsl(var(--accent) / 0.5)" } : undefined}
        >
          {copied ? "Copiato ✓" : "Copia"}
        </button>
      </div>
      <span className="typo-small text-muted-content">
        Incolla questo URL nei tuoi profili Booking/Airbnb/Vrbo per esportare le tue prenotazioni manuali.
      </span>
    </div>
  );
}



// ============================================================
// Owner Bank Info Section — per Codice Fiscale proprietario
// ============================================================

function OwnerBankInfoSection({ properties }) {
  const [bankList, setBankList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCf, setEditingCf] = useState(null);

  // Build unique CF set from properties (any CF that has been entered)
  const cfMap = {};
  for (const p of properties || []) {
    const cf = (p.codice_fiscale || "").toUpperCase().trim();
    if (!cf) continue;
    if (!cfMap[cf]) {
      cfMap[cf] = { codice_fiscale: cf, intestatario: p.proprietario || "" };
    }
  }
  const cfs = Object.values(cfMap);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/owner-bank-info");
      setBankList(r.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getBank = (cf) => bankList.find((b) => b.codice_fiscale === cf) || null;

  if (cfs.length === 0) return null;

  return (
    <div className="border-t border-border pt-6 mt-6 flex flex-col gap-3">
      <div>
        <h3 className="typo-h1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          Dati Bancari per Proprietario
        </h3>
        <p className="text-zinc-500 text-xs mt-1">
          IBAN, Banca e SWIFT/BIC associati al codice fiscale del proprietario. Usati nelle ricevute di locazione.
        </p>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cfs.map((c) => {
            const bank = getBank(c.codice_fiscale);
            const hasIban = bank && bank.iban;
            return (
              <div
                key={c.codice_fiscale}
                data-testid={`owner-bank-row-${c.codice_fiscale}`}
                className="bg-surface-1 border border-border rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-100">{c.intestatario || "—"}</p>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mt-1 font-mono">
                    CF {c.codice_fiscale}
                  </p>
                  {hasIban ? (
                    <p className="text-[10px] font-mono text-emerald-400 mt-1 break-all">
                      {bank.iban}
                      {bank.banca && <span className="text-zinc-500"> · {bank.banca}</span>}
                    </p>
                  ) : (
                    <p className="text-[10px] font-mono text-amber-500 mt-1">
                      IBAN da configurare
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setEditingCf(c.codice_fiscale)}
                  data-testid={`edit-bank-${c.codice_fiscale}`}
                  className="text-[10px] tracking-[0.25em] uppercase text-zinc-400 hover:text-zinc-100 cursor-pointer shrink-0"
                >
                  {hasIban ? "Modifica" : "Configura"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editingCf && (
        <OwnerBankInfoModal
          cf={editingCf}
          intestatario={cfMap[editingCf]?.intestatario || ""}
          onClose={() => setEditingCf(null)}
          onSaved={() => { setEditingCf(null); load(); }}
        />
      )}
    </div>
  );
}

function OwnerBankInfoModal({ cf, intestatario, onClose, onSaved }) {
  const [data, setData] = useState({
    codice_fiscale: cf,
    intestatario: intestatario || "",
    iban: "",
    banca: "",
    swift: "",
    next_receipt_num: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    api.get(`/owner-bank-info/${cf}`).then((r) => {
      if (alive) {
        setData({
          codice_fiscale: cf,
          intestatario: r.data.intestatario || intestatario || "",
          iban: r.data.iban || "",
          banca: r.data.banca || "",
          swift: r.data.swift || "",
          next_receipt_num: r.data.next_receipt_num || 1,
        });
        setLoading(false);
      }
    }).catch(() => { setLoading(false); });
    return () => { alive = false; };
  }, [cf, intestatario]);

  const save = async () => {
    setErr("");
    setSaving(true);
    try {
      await api.put(`/owner-bank-info/${cf}`, data);
      onSaved && onSaved();
    } catch (e) {
      setErr(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      data-testid={`bank-modal-${cf}`}
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg max-w-md w-full p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold uppercase text-zinc-100" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Dati Bancari
          </h3>
          <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 font-mono mt-1">
            CF: {cf}
          </p>
        </div>

        {loading ? (
          <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
        ) : (
          <>
            <Field label="Intestatario" value={data.intestatario} onChange={(v) => setData({ ...data, intestatario: v })} testid="bank-intestatario" placeholder="Nome Cognome" mono={false} />
            <Field label="IBAN" value={data.iban} onChange={(v) => setData({ ...data, iban: v.toUpperCase().replace(/\s/g, "") })} testid="bank-iban" placeholder="IT60X0542811101000000123456" />
            <Field label="Nome Banca" value={data.banca} onChange={(v) => setData({ ...data, banca: v })} testid="bank-banca" placeholder="es. Intesa Sanpaolo" mono={false} />
            <Field label="SWIFT / BIC" value={data.swift} onChange={(v) => setData({ ...data, swift: v.toUpperCase() })} testid="bank-swift" placeholder="es. BCITITMM" />
            <Field
              label="Prossimo Numero Ricevuta"
              value={data.next_receipt_num}
              onChange={(v) => setData({ ...data, next_receipt_num: parseInt(v) || 1 })}
              testid="bank-next-num"
              type="number"
              placeholder="1"
            />
            {err && (
              <p data-testid="bank-error" className="text-red-400 text-[10px] font-mono">{err}</p>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={save}
                disabled={saving}
                data-testid="bank-save"
                className="flex-1 text-[10px] tracking-[0.25em] uppercase text-[#05050A] bg-zinc-100 hover:bg-white px-5 py-3 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? "Salvataggio..." : "Salva"}
              </button>
              <button
                onClick={onClose}
                data-testid="bank-cancel"
                className="text-[10px] tracking-[0.25em] uppercase text-zinc-400 border border-border rounded-lg hover:border-zinc-500 px-5 py-3 transition-colors cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// NOTIFICHE PUSH
// ============================================================

function PushNotificationSection() {
  const { isSupported, isSubscribed, permission, isIOS, isStandalone, loading, subscribe, unsubscribe } =
    usePushNotifications();
  const [testStatus, setTestStatus] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [channels, setChannels] = useState({ push: true, email: false });
  const [email, setEmail] = useState("");
  const [savingCh, setSavingCh] = useState(false);

  useEffect(() => {
    api.get("/auth/me")
      .then((r) => {
        setEmail(r.data?.email || "");
        if (r.data?.notification_channels) setChannels(r.data.notification_channels);
      })
      .catch(() => {});
  }, []);

  const saveChannels = async (next) => {
    setChannels(next); // ottimistico
    setSavingCh(true);
    try {
      await api.put("/me/notification-channels", next);
    } catch {
      // ripristina in caso di errore
      try { const r = await api.get("/auth/me"); if (r.data?.notification_channels) setChannels(r.data.notification_channels); } catch {/* noop */}
    } finally {
      setSavingCh(false);
    }
  };

  const sendTest = async () => {
    setTestLoading(true);
    setTestStatus("");
    try {
      const r = await api.post("/push/test");
      setTestStatus(r.data.sent ? "✓ Inviata — controlla il dispositivo" : "✗ " + (r.data.error || "errore sconosciuto"));
    } catch (e) {
      setTestStatus("✗ " + (e.response?.data?.detail || e.message));
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="surface-card p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-400">Notifiche</span>
        <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
          Scegli come ricevere gli avvisi (arrivi e partenze, esiti degli invii).
        </p>
      </div>

      {/* Scelta canali */}
      <div className="flex flex-col gap-2">
        <Toggle
          label={`Email${channels.email && email ? " · " + email : ""}`}
          value={channels.email}
          onChange={(v) => saveChannels({ ...channels, email: v })}
          testid="notif-email-toggle"
        />
        <Toggle
          label="Notifiche push (app / cellulare)"
          value={channels.push}
          onChange={(v) => saveChannels({ ...channels, push: v })}
          testid="notif-push-toggle"
        />
        {!channels.push && !channels.email && (
          <p className="text-[10px] font-mono text-amber-400">
            ⚠ Nessun canale attivo: riceverai gli avvisi solo nella campanella in alto.
          </p>
        )}
      </div>

      {/* Controlli dispositivo push — solo se il canale push è attivo */}
      {channels.push && (
      <div className="border-t border-border pt-4 flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Push su questo dispositivo</span>

      {!isSupported && (
        <p className="text-[11px] text-zinc-500 font-mono">
          Il tuo browser non supporta le notifiche push.
        </p>
      )}

      {isSupported && isIOS && !isStandalone && (
        <div className="border border-amber-500/30 rounded-lg bg-amber-500/5 p-3 flex flex-col gap-1">
          <p className="text-[11px] text-amber-300">Su iPhone le notifiche richiedono un passaggio:</p>
          <p className="text-[11px] text-zinc-400">
            Tocca <span className="text-zinc-200">Condividi ↑</span> in Safari →{" "}
            <span className="text-zinc-200">"Aggiungi alla schermata Home"</span> → riapri Dedomo dall'icona.
          </p>
        </div>
      )}

      {isSupported && permission === "denied" && (
        <p className="text-[11px] text-red-400 font-mono">
          Notifiche bloccate dal browser. Vai nelle impostazioni del browser per riabilitarle.
        </p>
      )}

      {isSupported && permission !== "denied" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-mono ${isSubscribed ? "text-emerald-400" : "text-zinc-500"}`}>
              {isSubscribed ? "✓ Notifiche attive" : "○ Notifiche non attive"}
            </span>
            {isSubscribed ? (
              <button
                onClick={unsubscribe}
                disabled={loading}
                className="border border-zinc-700 rounded-lg hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 px-3 py-1 uppercase tracking-widest text-[9px] cursor-pointer disabled:opacity-50"
              >
                {loading ? "..." : "Disattiva"}
              </button>
            ) : (
              <button
                onClick={async () => { setSubError(""); const r = await subscribe(); if (!r.ok) setSubError(r.error || "Errore sconosciuto"); }}
                disabled={loading || (isIOS && !isStandalone)}
                className="border border-emerald-500/60 rounded-lg hover:bg-emerald-500/10 text-emerald-400 px-3 py-1 uppercase tracking-widest text-[9px] cursor-pointer disabled:opacity-50"
              >
                {loading ? "..." : "Attiva"}
              </button>
            )}
            {subError && <span className="text-[10px] font-mono text-red-400">✗ {subError}</span>}
          </div>

          {isSubscribed && (
            <div className="flex items-center gap-3">
              <button
                onClick={sendTest}
                disabled={testLoading}
                className="border border-zinc-600 rounded-lg hover:border-zinc-400 text-zinc-400 px-3 py-1 uppercase tracking-widest text-[9px] cursor-pointer disabled:opacity-50"
              >
                {testLoading ? "Invio..." : "Prova notifiche"}
              </button>
              {testStatus && (
                <span className="text-[10px] font-mono text-zinc-500">{testStatus}</span>
              )}
            </div>
          )}
        </div>
      )}
      </div>
      )}
    </div>
  );
}

function DangerZoneSection() {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    setErr("");
    try {
      await api.delete("/auth/account");
      navigate("/login");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Errore durante la cancellazione.");
      setDeleting(false);
    }
  };

  return (
    <div className="surface-card p-5 flex flex-col gap-4 border border-red-900/40">
      <h3 className="typo-h3" style={{ color: "hsl(var(--destructive))" }}>Zona pericolosa</h3>
      <p className="text-zinc-400 text-[12px] leading-relaxed">
        La cancellazione dell'account è permanente: verranno eliminati tutte le strutture, i checkin e i dati associati.
        Le transazioni di pagamento vengono anonimizzate per obbligo fiscale.
      </p>
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="self-start border border-red-700 rounded-lg hover:border-red-500 text-red-500 hover:text-red-300 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer transition-colors"
        >
          Cancella account
        </button>
      ) : (
        <div className="flex flex-col gap-3 border border-red-800 rounded-lg p-4 bg-red-950/20">
          <p className="text-red-300 text-[12px] font-semibold">Sei sicuro? Questa operazione non può essere annullata.</p>
          {err && <p className="text-red-400 text-[11px] font-mono">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="border border-red-600 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-200 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50 transition-colors"
            >
              {deleting ? "Cancellazione…" : "Sì, cancella tutto"}
            </button>
            <button
              onClick={() => { setConfirm(false); setErr(""); }}
              disabled={deleting}
              className="border border-zinc-700 rounded-lg hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 px-4 py-2 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
