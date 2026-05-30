import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

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
  nome_prodotto: "Ospitalo",
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
  mode: "TEST",
  alloggiati: { ...emptyAlloggiati },
  ross1000: { ...emptyRoss },
  imposta_soggiorno: { ...emptyImposta },
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
      if (editing.property_id) {
        await api.put(`/properties/${editing.property_id}`, editing);
      } else {
        await api.post("/properties", editing);
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

      {loading ? (
        <p className="text-zinc-500 text-sm font-mono">Caricamento...</p>
      ) : list.length === 0 ? (
        <div className="border border-dashed border-[#1E1E28] p-12 text-center">
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
              className="bg-[#0E0E14] border border-[#1E1E28] p-4 flex items-center justify-between"
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
    </Layout>
  );
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[#1E1E28] pt-6">
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
        className={`bg-transparent border border-[#1E1E28] px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 focus:ring-1 focus:ring-zinc-300 outline-none transition-all w-full text-sm ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

function Toggle({ label, value, onChange, testid }) {
  return (
    <label className="flex items-center justify-between border border-[#1E1E28] px-4 py-3 cursor-pointer">
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
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
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
            className="bg-transparent border border-[#1E1E28] px-4 py-3 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm"
          >
            <option value="standard" className="bg-[#0E0E14]">Standard (hotel, B&amp;B, struttura unica)</option>
            <option value="appartamenti" className="bg-[#0E0E14]">Gestore Appartamenti (con ID per ogni appartamento)</option>
            <option value="appartamenti_file_unico" className="bg-[#0E0E14]">Gestore Appartamenti (file unico)</option>
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
            className="bg-transparent border border-[#1E1E28] px-4 py-3 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm"
          >
            {["Abruzzo","Basilicata","Calabria","Emilia-Romagna","Lazio","Liguria","Lombardia","Marche","Molise","Piemonte","Sardegna","Toscana","Veneto"].map((r) => (
              <option key={r} value={r} className="bg-[#0E0E14]">{r}</option>
            ))}
          </select>
        </label>
        <Field label="Codice Struttura (rilasciato dalla Regione)" value={p.ross1000.codice_struttura} onChange={(v) => upd("ross1000.codice_struttura", v)} testid="r1k-codstruttura" />
        <Field label="Utente" value={p.ross1000.utente} onChange={(v) => upd("ross1000.utente", v)} testid="r1k-utente" />
        <Field label="Password" type="password" value={p.ross1000.password} onChange={(v) => upd("ross1000.password", v)} testid="r1k-password" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="N. Camere" type="number" value={p.ross1000.n_camere} onChange={(v) => upd("ross1000.n_camere", parseInt(v) || 1)} testid="r1k-camere" />
          <Field label="N. Letti totali" type="number" value={p.ross1000.n_letti} onChange={(v) => upd("ross1000.n_letti", parseInt(v) || 1)} testid="r1k-letti" />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Modalità invio</span>
          <select
            data-testid="r1k-format"
            value={p.ross1000.format}
            onChange={(e) => upd("ross1000.format", e.target.value)}
            className="bg-transparent border border-[#1E1E28] px-4 py-3 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm"
          >
            <option value="soap_v2" className="bg-[#0E0E14]">Web service automatico (consigliato)</option>
            <option value="csv_manual" className="bg-[#0E0E14]">CSV manuale (download + upload)</option>
          </select>
        </label>
        {p.property_id && p.ross1000.format === "soap_v2" && (
          <TestTurismo5Button propertyId={p.property_id} />
        )}
      </Section>

      <Section title="Imposta di Soggiorno (Comune)">
        <Toggle label="Abilita Imposta di Soggiorno" value={p.imposta_soggiorno.enabled} onChange={(v) => upd("imposta_soggiorno.enabled", v)} testid="is-enabled" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tariffa / notte (€)" type="number" value={p.imposta_soggiorno.tariffa_per_notte} onChange={(v) => upd("imposta_soggiorno.tariffa_per_notte", parseFloat(v) || 0)} testid="is-tariffa" />
          <Field label="Max notti tassabili" type="number" value={p.imposta_soggiorno.max_notti_tassabili} onChange={(v) => upd("imposta_soggiorno.max_notti_tassabili", parseInt(v) || 0)} testid="is-maxnotti" />
        </div>
        <Field label="Esenti sotto i (anni)" type="number" value={p.imposta_soggiorno.esenti_under_anni} onChange={(v) => upd("imposta_soggiorno.esenti_under_anni", parseInt(v) || 0)} testid="is-esenti" />
        <Field label="Endpoint Comune (opzionale)" value={p.imposta_soggiorno.endpoint_comune} onChange={(v) => upd("imposta_soggiorno.endpoint_comune", v)} testid="is-endpoint" placeholder="https://..." />
      </Section>

      {error && <p className="text-red-500 text-xs font-mono uppercase tracking-wider">[ ERRORE ] {error}</p>}

      <div className="flex gap-3 mt-4">
        <button
          onClick={cancel}
          className="flex-1 border border-[#1E1E28] hover:border-zinc-500 text-zinc-300 px-6 py-4 uppercase tracking-widest text-xs transition-colors cursor-pointer"
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
        className="border border-[#1E1E28] hover:border-zinc-500 text-zinc-300 px-4 py-3 uppercase tracking-widest text-[10px] transition-colors cursor-pointer disabled:opacity-50"
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
        className="border border-[#1E1E28] hover:border-zinc-500 text-zinc-300 px-4 py-3 uppercase tracking-widest text-[10px] transition-colors cursor-pointer disabled:opacity-50"
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
        setError(r.data.message || "Errore caricamento");
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Errore richiesta");
    } finally {
      setLoading(false);
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
          className="border border-[#1E1E28] hover:border-zinc-500 text-zinc-300 px-4 py-3 uppercase tracking-widest text-[10px] transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? "Caricamento..." : "Carica miei appartamenti da Alloggiati Web"}
        </button>
      ) : items.length === 0 ? (
        <p className="text-amber-500 text-[10px] font-mono">
          [ ATTENZIONE ] Nessun appartamento registrato. Aggiungine uno dal portale Alloggiati Web.
        </p>
      ) : (
        <>
          <select
            data-testid="aw-idappartamento"
            value={value || ""}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            className="bg-transparent border border-[#1E1E28] px-4 py-3 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm"
          >
            <option value="" className="bg-[#0E0E14]">— Seleziona appartamento —</option>
            {items.map((a) => (
              <option key={a.id} value={a.id} className="bg-[#0E0E14]">
                [{a.id}] {a.descrizione} — {a.comune} ({a.prov})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 hover:text-zinc-100 self-start cursor-pointer"
          >
            Ricarica lista
          </button>
        </>
      )}
      {error && (
        <p className="text-red-500 text-[10px] font-mono break-words">
          [ ERR ] {error}
        </p>
      )}
    </div>
  );
}
