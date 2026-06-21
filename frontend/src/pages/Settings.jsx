import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import DownloadManualButton from "@/components/DownloadManualButton";

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
  esenti_under_anni: 12,
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
      } else {
        await api.post("/properties", payload);
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Eliminare definitivamente questa struttura?")) return;
    await api.delete(`/properties/${id}`);
    await load();
  };

  if (editing) return <PropertyEditor p={editing} setP={setEditing} save={save} cancel={() => setEditing(null)} saving={saving} error={error} />;

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <h2
          className="text-2xl font-bold uppercase tracking-tight text-zinc-100"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          Strutture
        </h2>
        <button
          data-testid="add-property-btn"
          onClick={startNew}
          className="text-xs tracking-[0.25em] uppercase text-[#05050A] bg-zinc-100 hover:bg-white px-5 py-3 transition-colors cursor-pointer"
        >
          + Nuova
        </button>
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        <a
          href="/help"
          data-testid="settings-open-help"
          className="text-[10px] tracking-[0.25em] uppercase text-zinc-400 hover:text-zinc-100 cursor-pointer"
        >
          Apri Guida Online →
        </a>
        <DownloadManualButton testid="settings-download-manual" />
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
      ) : list.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center">
          <p className="text-zinc-400 text-sm mb-4">
            Nessuna struttura configurata.
          </p>
          <p className="text-zinc-600 text-xs">
            Premi "+ Nuova" per aggiungere la tua prima unità immobiliare.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((p) => (
            <div
              key={p.property_id}
              data-testid={`property-row-${p.property_id}`}
              className="bg-surface-1 border border-border p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-zinc-100">{p.nome}</p>
                <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mt-1 font-mono">
                  {p.comune || "—"} · CIN {p.cin || "—"} · [{p.mode}]
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(p)}
                  data-testid={`edit-property-${p.property_id}`}
                  className="text-[10px] tracking-[0.25em] uppercase text-zinc-400 hover:text-zinc-100 cursor-pointer"
                >
                  Modifica
                </button>
                <button
                  onClick={() => remove(p.property_id)}
                  data-testid={`delete-property-${p.property_id}`}
                  className="text-[10px] tracking-[0.25em] uppercase text-red-500 hover:text-red-400 cursor-pointer"
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <OwnerBankInfoSection properties={list} />
    </Layout>
  );
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 className="text-xs tracking-[0.3em] uppercase text-zinc-500">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", testid, placeholder, mono = true }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{label}</span>
      <input
        type={type}
        data-testid={testid}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-transparent border border-border px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 focus:ring-1 focus:ring-zinc-300 outline-none transition-all w-full text-sm ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

function Toggle({ label, value, onChange, testid }) {
  return (
    <label className="flex items-center justify-between border border-border px-4 py-3 cursor-pointer">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-400">{label}</span>
      <button
        type="button"
        data-testid={testid}
        onClick={() => onChange(!value)}
        className={`text-xs tracking-[0.25em] uppercase font-mono cursor-pointer ${value ? "text-emerald-500" : "text-zinc-600"}`}
      >
        [{value ? "ON" : "OFF"}]
      </button>
    </label>
  );
}

function PropertyEditor({ p, setP, save, cancel, saving, error }) {
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
        <h2
          className="text-2xl font-bold uppercase tracking-tight text-zinc-100"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          {p.property_id ? "Modifica Struttura" : "Nuova Struttura"}
        </h2>
        <button
          onClick={cancel}
          data-testid="cancel-edit-btn"
          className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 hover:text-zinc-100 cursor-pointer"
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
        <Field label="Utente" value={p.alloggiati.utente} onChange={(v) => upd("alloggiati.utente", v)} testid="aw-utente" />
        <Field label="Password" type="password" value={p.alloggiati.password} onChange={(v) => upd("alloggiati.password", v)} testid="aw-password" />
        <Field label="WS Key" type="password" value={p.alloggiati.ws_key} onChange={(v) => upd("alloggiati.ws_key", v)} testid="aw-wskey" />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Tipo Account</span>
          <select
            data-testid="aw-tipo-account"
            value={p.alloggiati.tipo_account}
            onChange={(e) => upd("alloggiati.tipo_account", e.target.value)}
            className="bg-transparent border border-border px-4 py-3 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm"
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
          <TestCredentialsButton propertyId={p.property_id} />
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
            className="bg-transparent border border-border px-4 py-3 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm"
          >
            {["Abruzzo","Basilicata","Calabria","Emilia-Romagna","Lazio","Liguria","Lombardia","Marche","Molise","Piemonte","Sardegna","Toscana","Veneto"].map((r) => (
              <option key={r} value={r} className="bg-surface-1">{r}</option>
            ))}
          </select>
        </label>
        <Field label="Codice Struttura (rilasciato dalla Regione)" value={p.ross1000.codice_struttura} onChange={(v) => upd("ross1000.codice_struttura", v)} testid="r1k-codstruttura" />
        <Field label="Utente" value={p.ross1000.utente} onChange={(v) => upd("ross1000.utente", v)} testid="r1k-utente" />
        <Field label="Password" type="password" value={p.ross1000.password} onChange={(v) => upd("ross1000.password", v)} testid="r1k-password" />
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
            className="bg-transparent border border-border px-4 py-3 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm"
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
        <Field
          label="Booking · URL iCal (entrata)"
          value={p.calendar?.booking_ical_url || ""}
          onChange={(v) => upd("calendar.booking_ical_url", v)}
          testid="cal-booking-url"
          placeholder="https://admin.booking.com/.../calendar.ics"
        />
        <Field
          label="Airbnb · URL iCal (entrata)"
          value={p.calendar?.airbnb_ical_url || ""}
          onChange={(v) => upd("calendar.airbnb_ical_url", v)}
          testid="cal-airbnb-url"
          placeholder="https://www.airbnb.it/calendar/ical/..."
        />
        <Field
          label="Vrbo · URL iCal (entrata)"
          value={p.calendar?.vrbo_ical_url || ""}
          onChange={(v) => upd("calendar.vrbo_ical_url", v)}
          testid="cal-vrbo-url"
          placeholder="https://www.vrbo.com/icalendar/..."
        />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Colore Appartamento</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={p.calendar?.color || "#10b981"}
              onChange={(e) => upd("calendar.color", e.target.value)}
              data-testid="cal-color"
              className="w-12 h-10 bg-transparent border border-border cursor-pointer"
            />
            <span className="text-zinc-400 text-[11px] font-mono">{p.calendar?.color || "#10b981"}</span>
          </div>
        </div>
        {p.property_id && (
          <PersonalIcalField propertyId={p.property_id} />
        )}
      </Section>

      {error && <p className="text-red-500 text-xs font-mono uppercase tracking-wider">[ ERRORE ] {error}</p>}

      <div className="flex gap-3 mt-4">
        <button
          onClick={cancel}
          className="flex-1 border border-border hover:border-zinc-500 text-zinc-300 px-6 py-4 uppercase tracking-widest text-xs transition-colors cursor-pointer"
        >
          Annulla
        </button>
        <button
          onClick={save}
          disabled={saving}
          data-testid="save-property-btn"
          className="flex-1 bg-zinc-100 hover:bg-white text-[#05050A] font-medium px-6 py-4 uppercase tracking-widest text-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
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
        className="border border-border hover:border-zinc-500 text-zinc-300 px-4 py-3 uppercase tracking-widest text-[10px] transition-colors cursor-pointer disabled:opacity-50"
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
        className="border border-border hover:border-zinc-500 text-zinc-300 px-4 py-3 uppercase tracking-widest text-[10px] transition-colors cursor-pointer disabled:opacity-50"
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
  const [loaded, setLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError("");
    try {
      const r = await api.post(`/properties/${propertyId}/alloggiati/appartamenti`);
      if (r.data.success) {
        setItems(r.data.appartamenti || []);
        setLoaded(true);
        if (!value && r.data.appartamenti?.length === 1) {
          onChange(r.data.appartamenti[0].id);
        }
      } else {
        // Cod.50 = tabella vuota → user has no apartments yet
        setItems([]);
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
          className="border border-border hover:border-zinc-500 text-zinc-300 px-4 py-3 uppercase tracking-widest text-[10px] transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? "Caricamento..." : "Carica miei appartamenti da Alloggiati Web"}
        </button>
      ) : items.length > 0 ? (
        <>
          <select
            data-testid="aw-idappartamento"
            value={value !== undefined && value !== null && value !== "" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : parseInt(e.target.value))}
            className="bg-transparent border border-border px-4 py-3 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm"
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
        <div className="border border-amber-500/40 p-3 font-mono text-[10px] text-amber-400 flex flex-col gap-3">
          <div>
            [ ATTENZIONE ] La lista è vuota. Possibili cause:
            <ul className="mt-2 text-zinc-400 list-disc list-inside space-y-1">
              <li>Account "Gestore Appartamenti" appena attivato</li>
              <li>Appartamento pre-creato dalla Questura (spesso ID=1)</li>
              <li>Appartamento gestito esternamente (es. via Turismo 5)</li>
            </ul>
          </div>
          <div className="border-t border-amber-500/30 pt-3 flex flex-col gap-2">
            <span className="text-zinc-300">Soluzione 1 — Prova ID di default:</span>
            <div className="flex gap-2">
              <input
                type="number"
                data-testid="aw-idappartamento-manual"
                value={value || ""}
                onChange={(e) => onChange(parseInt(e.target.value) || 0)}
                placeholder="es. 1"
                className="flex-1 bg-transparent border border-border px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => onChange(1)}
                className="border border-border hover:border-zinc-500 px-3 py-2 text-zinc-300 uppercase tracking-widest text-[10px] cursor-pointer"
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
    <div className="border border-border p-4 flex flex-col gap-3 bg-surface-1">
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
          className="bg-transparent border border-border px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm"
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
            className="flex-1 bg-transparent border border-border px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm"
          />
          <button
            type="button"
            onClick={searchComuni}
            disabled={searchingComuni}
            className="border border-border hover:border-zinc-500 px-4 text-zinc-300 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50"
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
            className="bg-transparent border border-border px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm mt-1"
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
          className="bg-transparent border border-border px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm"
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
          className="bg-transparent border border-border px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm"
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
          className="flex-1 border border-border hover:border-zinc-500 text-zinc-400 px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer"
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    api.get(`/calendar/personal-url/${propertyId}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null));
  }, [propertyId]);

  if (!data) return null;
  const fullUrl = `${process.env.REACT_APP_BACKEND_URL}${data.path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Calendario Personale · URL iCal (uscita)</span>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={fullUrl}
          data-testid="cal-personal-url"
          onClick={(e) => e.target.select()}
          className="flex-1 bg-surface-1 border border-border px-3 py-2 text-zinc-100 text-[10px] font-mono outline-none"
        />
        <button
          type="button"
          onClick={copy}
          data-testid="cal-personal-copy"
          className="border border-border hover:border-emerald-500 text-zinc-300 hover:text-emerald-400 px-3 py-2 uppercase tracking-widest text-[10px] cursor-pointer"
        >
          {copied ? "Copiato ✓" : "Copia"}
        </button>
      </div>
      <span className="text-zinc-600 text-[10px] font-mono">
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
        <h3 className="text-2xl font-bold uppercase tracking-tight text-zinc-100" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
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
                className="bg-surface-1 border border-border p-4 flex items-center justify-between gap-4"
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
        className="bg-background border border-border max-w-md w-full p-6 flex flex-col gap-4"
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
                className="text-[10px] tracking-[0.25em] uppercase text-zinc-400 border border-border hover:border-zinc-500 px-5 py-3 transition-colors cursor-pointer"
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
