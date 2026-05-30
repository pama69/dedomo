import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";

const emptyGuest = () => ({
  cognome: "",
  nome: "",
  sesso: "M",
  data_nascita: "",
  luogo_nascita: "",
  stato_nascita: "ITA",
  cittadinanza: "ITA",
  tipo_documento: "CARTA_IDENTITA",
  numero_documento: "",
  stato_rilascio_documento: "ITA",
  codice_comune_nascita: "",
});

export default function Checkin() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [dataArrivo, setDataArrivo] = useState("");
  const [dataPartenza, setDataPartenza] = useState("");
  const [guests, setGuests] = useState([]);
  const [activeGuestIdx, setActiveGuestIdx] = useState(0);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/properties").then((r) => setProperties(r.data));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  // ============ STEP 1: dates ============
  const renderStep1 = () => (
    <>
      <StepHeader n="01" label="Date Soggiorno" />
      <div className="grid grid-cols-2 gap-3">
        <DateField label="Data Arrivo" value={dataArrivo} onChange={setDataArrivo} testid="date-start-input" />
        <DateField label="Data Partenza" value={dataPartenza} onChange={setDataPartenza} testid="date-end-input" min={dataArrivo} />
      </div>
      <NextBtn
        disabled={!dataArrivo || !dataPartenza || dataPartenza <= dataArrivo}
        onClick={() => setStep(2)}
        testid="next-step-1"
      />
    </>
  );

  // ============ STEP 2: property ============
  const renderStep2 = () => (
    <>
      <StepHeader n="02" label="Seleziona Proprietà" />
      <div className="flex flex-col gap-2">
        {properties.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nessuna proprietà configurata.</p>
        ) : (
          properties.map((p) => (
            <button
              key={p.property_id}
              data-testid={`select-property-${p.property_id}`}
              onClick={() => setPropertyId(p.property_id)}
              className={`text-left p-4 border transition-colors cursor-pointer ${
                propertyId === p.property_id
                  ? "border-zinc-100 bg-[#15151C]"
                  : "border-[#1E1E28] hover:border-zinc-500"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-zinc-100">{p.nome}</p>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mt-1 font-mono">
                    {p.comune} · [{p.mode}]
                  </p>
                </div>
                {propertyId === p.property_id && (
                  <span className="text-emerald-500 font-mono text-xs">[ ✓ ]</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
      <div className="flex gap-3 mt-4">
        <BackBtn onClick={() => setStep(1)} />
        <NextBtn disabled={!propertyId} onClick={() => { setGuests([emptyGuest()]); setStep(3); }} testid="next-step-2" />
      </div>
    </>
  );

  // ============ STEP 3: OCR / guests ============
  const handleOcr = async (file) => {
    setOcrError("");
    setOcrLoading(true);
    try {
      const b64 = await fileToBase64(file);
      const r = await api.post("/ocr/document", {
        image_base64: b64,
        mime_type: file.type || "image/jpeg",
      });
      const data = r.data;
      setGuests((prev) => {
        const copy = [...prev];
        const g = copy[activeGuestIdx] || emptyGuest();
        copy[activeGuestIdx] = {
          ...g,
          cognome: data.cognome || g.cognome,
          nome: data.nome || g.nome,
          sesso: data.sesso || g.sesso,
          data_nascita: data.data_nascita || g.data_nascita,
          luogo_nascita: data.luogo_nascita || g.luogo_nascita,
          stato_nascita: data.stato_nascita || g.stato_nascita,
          cittadinanza: data.cittadinanza || g.cittadinanza,
          tipo_documento: data.tipo_documento || g.tipo_documento,
          numero_documento: data.numero_documento || g.numero_documento,
          stato_rilascio_documento: data.stato_rilascio_documento || g.stato_rilascio_documento,
        };
        return copy;
      });
    } catch (e) {
      setOcrError(e.response?.data?.detail || "Errore OCR");
    } finally {
      setOcrLoading(false);
    }
  };

  const updateGuest = (idx, field, value) => {
    setGuests((prev) => {
      const c = [...prev];
      c[idx] = { ...c[idx], [field]: value };
      return c;
    });
  };

  const renderStep3 = () => {
    const g = guests[activeGuestIdx] || emptyGuest();
    return (
      <>
        <StepHeader n="03" label={`Ospite ${activeGuestIdx + 1} / ${guests.length}`} />

        <div className="flex gap-2 flex-wrap">
          {guests.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveGuestIdx(i)}
              data-testid={`guest-tab-${i}`}
              className={`text-[10px] tracking-[0.25em] uppercase border px-4 py-2 cursor-pointer transition-colors ${
                i === activeGuestIdx
                  ? "border-zinc-100 text-zinc-100"
                  : "border-[#1E1E28] text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Ospite {i + 1}
            </button>
          ))}
          <button
            data-testid="add-guest-btn"
            onClick={() => {
              setGuests([...guests, emptyGuest()]);
              setActiveGuestIdx(guests.length);
            }}
            className="text-[10px] tracking-[0.25em] uppercase border border-dashed border-[#1E1E28] text-zinc-500 hover:text-zinc-100 px-4 py-2 cursor-pointer"
          >
            + Aggiungi
          </button>
        </div>

        <label className="border-2 border-dashed border-[#1E1E28] bg-[#0E0E14] p-10 flex flex-col items-center justify-center hover:border-zinc-500 transition-colors cursor-pointer text-zinc-400 uppercase tracking-widest text-xs text-center">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            data-testid="upload-id-box"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0])}
          />
          {ocrLoading ? (
            <span className="font-mono">SCANSIONE IN CORSO...</span>
          ) : (
            <>
              <span className="text-zinc-300">Carica foto documento</span>
              <span className="text-[10px] text-zinc-600 mt-2 tracking-widest">
                CIE · Passaporto · Patente (JPG/PNG)
              </span>
            </>
          )}
        </label>
        {ocrError && (
          <p className="text-red-500 text-xs font-mono uppercase tracking-wider">
            [ ERR ] {ocrError}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Cognome" value={g.cognome} onChange={(v) => updateGuest(activeGuestIdx, "cognome", v.toUpperCase())} testid="guest-cognome" />
          <TextField label="Nome" value={g.nome} onChange={(v) => updateGuest(activeGuestIdx, "nome", v.toUpperCase())} testid="guest-nome" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Sesso" value={g.sesso} onChange={(v) => updateGuest(activeGuestIdx, "sesso", v)} testid="guest-sesso" options={[["M", "M"], ["F", "F"]]} />
          <DateField label="Data Nascita" value={g.data_nascita} onChange={(v) => updateGuest(activeGuestIdx, "data_nascita", v)} testid="guest-nascita" />
        </div>
        <TextField label="Luogo Nascita" value={g.luogo_nascita} onChange={(v) => updateGuest(activeGuestIdx, "luogo_nascita", v)} testid="guest-luogo" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Stato Nascita (ISO3)" value={g.stato_nascita} onChange={(v) => updateGuest(activeGuestIdx, "stato_nascita", v.toUpperCase())} testid="guest-statonasc" />
          <TextField label="Cittadinanza (ISO3)" value={g.cittadinanza} onChange={(v) => updateGuest(activeGuestIdx, "cittadinanza", v.toUpperCase())} testid="guest-citt" />
        </div>
        <SelectField
          label="Tipo Documento"
          value={g.tipo_documento}
          onChange={(v) => updateGuest(activeGuestIdx, "tipo_documento", v)}
          testid="guest-tipodoc"
          options={[
            ["CARTA_IDENTITA", "Carta d'Identità"],
            ["PASSAPORTO", "Passaporto"],
            ["PATENTE", "Patente"],
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Numero Documento" value={g.numero_documento} onChange={(v) => updateGuest(activeGuestIdx, "numero_documento", v.toUpperCase())} testid="guest-numdoc" />
          <TextField label="Stato Rilascio (ISO3)" value={g.stato_rilascio_documento} onChange={(v) => updateGuest(activeGuestIdx, "stato_rilascio_documento", v.toUpperCase())} testid="guest-statorilascio" />
        </div>

        {guests.length > 1 && (
          <button
            onClick={() => {
              const c = guests.filter((_, i) => i !== activeGuestIdx);
              setGuests(c);
              setActiveGuestIdx(Math.max(0, activeGuestIdx - 1));
            }}
            className="text-[10px] tracking-[0.25em] uppercase text-red-500 hover:text-red-400 self-start cursor-pointer"
          >
            Rimuovi ospite {activeGuestIdx + 1}
          </button>
        )}

        <div className="flex gap-3 mt-4">
          <BackBtn onClick={() => setStep(2)} />
          <NextBtn
            disabled={!g.cognome || !g.nome || !g.data_nascita}
            onClick={() => setStep(4)}
            testid="next-step-3"
            label="Riepilogo →"
          />
        </div>
      </>
    );
  };

  // ============ STEP 4: review ============
  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const r = await api.post("/checkin/submit", {
        property_id: propertyId,
        data_arrivo: dataArrivo,
        data_partenza: dataPartenza,
        guests,
      });
      setResult(r.data);
      setStep(5);
    } catch (e) {
      setError(e.response?.data?.detail || "Errore invio");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep4 = () => {
    const prop = properties.find((p) => p.property_id === propertyId);
    return (
      <>
        <StepHeader n="04" label="Riepilogo" />
        <div className="bg-[#0E0E14] border border-[#1E1E28] p-5 font-mono text-xs flex flex-col gap-2">
          <Row label="STRUTTURA" value={prop?.nome} />
          <Row label="MODALITÀ" value={`[${prop?.mode}]`} />
          <Row label="ARRIVO" value={new Date(dataArrivo).toLocaleDateString("it-IT")} />
          <Row label="PARTENZA" value={new Date(dataPartenza).toLocaleDateString("it-IT")} />
          <Row label="OSPITI" value={guests.length} />
        </div>
        <div className="flex flex-col gap-2">
          {guests.map((g, i) => (
            <div key={i} className="bg-[#0E0E14] border border-[#1E1E28] p-4 font-mono text-xs">
              <p className="text-zinc-300 font-bold">
                #{i + 1} — {g.cognome} {g.nome} [{g.sesso}]
              </p>
              <p className="text-zinc-500 mt-1">
                {g.data_nascita} · {g.cittadinanza} · {g.tipo_documento} {g.numero_documento}
              </p>
            </div>
          ))}
        </div>
        {error && (
          <p className="text-red-500 text-xs font-mono uppercase tracking-wider">
            [ ERR ] {error}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <BackBtn onClick={() => setStep(3)} />
          <button
            onClick={submit}
            disabled={submitting}
            data-testid="submit-portals-button"
            className="flex-1 bg-zinc-100 hover:bg-white text-[#05050A] font-medium px-6 py-4 uppercase tracking-widest text-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Invio in corso..." : "Invia ai Portali"}
          </button>
        </div>
      </>
    );
  };

  // ============ STEP 5: results ============
  const renderStep5 = () => {
    const aw = result?.alloggiati_web;
    const r1k = result?.ross1000;
    const isResult = result?.imposta_soggiorno;
    return (
      <>
        <StepHeader n="05" label="Esito Invio" />
        <div className="font-mono text-xs flex flex-col gap-2">
          <ResultRow
            label="ALLOGGIATI WEB"
            ok={aw?.success}
            skipped={aw?.skipped}
            message={aw?.message || aw?.mode}
          />
          <ResultRow
            label="ROSS 1000"
            ok={r1k?.success}
            skipped={r1k?.skipped}
            message={r1k?.message || r1k?.mode}
          />
          <ResultRow
            label="IMPOSTA SOGGIORNO"
            ok={isResult?.success}
            skipped={isResult?.skipped}
            message={
              isResult?.calculation
                ? `Totale: € ${isResult.calculation.totale_imposta.toFixed(2)}`
                : isResult?.message
            }
          />
        </div>

        {result?.test_mode && (
          <p className="text-amber-500 text-[10px] tracking-[0.25em] uppercase font-mono">
            [ MODALITÀ TEST ATTIVA — NESSUN INVIO REALE EFFETTUATO ]
          </p>
        )}

        <div className="flex flex-col gap-2">
          {isResult?.calculation && (
            <a
              href={`${api.defaults.baseURL}/checkins/${result.checkin_id}/receipt-pdf`}
              target="_blank"
              rel="noreferrer"
              data-testid="download-pdf-receipt"
              className="text-center border border-[#1E1E28] hover:border-zinc-500 px-6 py-4 uppercase tracking-widest text-xs text-zinc-300 cursor-pointer"
            >
              Scarica Ricevuta Imposta (PDF)
            </a>
          )}
          {r1k?.csv_content && (
            <a
              href={`${api.defaults.baseURL}/checkins/${result.checkin_id}/ross1000-csv`}
              target="_blank"
              rel="noreferrer"
              data-testid="download-ross-csv"
              className="text-center border border-[#1E1E28] hover:border-zinc-500 px-6 py-4 uppercase tracking-widest text-xs text-zinc-300 cursor-pointer"
            >
              Scarica CSV Ross 1000
            </a>
          )}
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          data-testid="back-to-dashboard"
          className="bg-zinc-100 hover:bg-white text-[#05050A] font-medium px-6 py-4 uppercase tracking-widest text-xs transition-all cursor-pointer"
        >
          Fatto
        </button>
      </>
    );
  };

  return (
    <Layout>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
    </Layout>
  );
}

// ===== sub-components =====
function StepHeader({ n, label }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-[#1E1E28] pb-4">
      <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-500 font-mono">/{n}</span>
      <h2
        className="text-2xl font-bold uppercase tracking-tight text-zinc-100"
        style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
      >
        {label}
      </h2>
    </div>
  );
}

function TextField({ label, value, onChange, testid, type = "text" }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{label}</span>
      <input
        type={type}
        data-testid={testid}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border border-[#1E1E28] px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 focus:ring-1 focus:ring-zinc-300 outline-none transition-all w-full font-mono text-sm"
      />
    </label>
  );
}

function DateField(props) {
  return <TextField {...props} type="date" />;
}

function SelectField({ label, value, onChange, options, testid }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{label}</span>
      <select
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border border-[#1E1E28] px-4 py-3 text-zinc-100 focus:border-zinc-300 outline-none font-mono text-sm"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-[#0E0E14]">{l}</option>
        ))}
      </select>
    </label>
  );
}

function NextBtn({ disabled, onClick, testid, label = "Continua →" }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      data-testid={testid}
      className="flex-1 bg-zinc-100 hover:bg-white text-[#05050A] font-medium px-6 py-4 uppercase tracking-widest text-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}

function BackBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 border border-[#1E1E28] hover:border-zinc-500 text-zinc-300 px-6 py-4 uppercase tracking-widest text-xs transition-colors cursor-pointer"
    >
      ← Indietro
    </button>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-100">{value}</span>
    </div>
  );
}

function ResultRow({ label, ok, skipped, message }) {
  const tag = skipped ? "SKIP" : ok ? "OK" : "ERR";
  const color = skipped ? "text-zinc-500" : ok ? "text-emerald-500" : "text-red-500";
  return (
    <div className="bg-[#0E0E14] border border-[#1E1E28] p-4 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-zinc-300">{label}</span>
        <span className={`${color} font-bold`}>[ {tag} ]</span>
      </div>
      {message && <p className="text-zinc-500 text-[10px] break-words">{message}</p>}
    </div>
  );
}

const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
