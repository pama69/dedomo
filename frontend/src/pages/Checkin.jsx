import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";

const emptyGuest = () => ({
  cognome: "",
  nome: "",
  sesso: "M",
  data_nascita: "",
  luogo_nascita: "",
  stato_nascita: "100000100",
  cittadinanza: "100000100",
  tipo_documento: "IDENT",
  numero_documento: "",
  stato_rilascio_documento: "100000100",
  codice_comune_nascita: "",
  sigla_provincia_nascita: "",
  is_foreign: false,
  paese_nome: "",
  _doc_preview: null,
});

export default function Checkin() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  // Default arrival = today (Europe/Rome)
  const todayRome = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }))
    .toISOString().slice(0, 10);
  const [dataArrivo, setDataArrivo] = useState(todayRome);
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

  // ============ STEP 1: dates ============
  const renderStep1 = () => (
    <>
      <StepHeader n="01" label="Soggiorno" />
      <div className="grid grid-cols-2 gap-3">
        <DateField label={`Arrivo (oggi)`} value={dataArrivo} onChange={setDataArrivo} testid="date-start-input" />
        <DateField label="Partenza" value={dataPartenza} onChange={setDataPartenza} testid="date-end-input" min={dataArrivo} />
      </div>
      <p className="text-zinc-500 text-[10px] tracking-[0.25em] uppercase font-mono">
        Data arrivo preimpostata a oggi · puoi modificarla se serve
      </p>
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
  const lookupComune = async (luogoNascita) => {
    if (!luogoNascita || !propertyId) return null;
    try {
      const r = await api.post(
        `/properties/${propertyId}/alloggiati/guess-codici`,
        { luogo_nascita: luogoNascita, is_foreign: false }
      );
      return r.data;
    } catch {
      return null;
    }
  };

  const lookupStato = async (paese, cittadinanza) => {
    if (!paese || !propertyId) return null;
    try {
      const r = await api.post(
        `/properties/${propertyId}/alloggiati/guess-codici`,
        { stato_nascita: paese, cittadinanza: cittadinanza || paese, is_foreign: true }
      );
      return r.data;
    } catch {
      return null;
    }
  };

  const handleOcr = async (file) => {
    setOcrError("");
    setOcrLoading(true);
    // Save preview for the user to verify against OCR data
    try {
      const previewUrl = URL.createObjectURL(file);
      setGuests((prev) => {
        const copy = [...prev];
        copy[activeGuestIdx] = { ...(copy[activeGuestIdx] || emptyGuest()), _doc_preview: previewUrl };
        return copy;
      });
    } catch {}
    try {
      const b64 = await fileToBase64(file);
      const r = await api.post("/ocr/document", {
        image_base64: b64,
        mime_type: file.type || "image/jpeg",
      });
      const data = r.data;

      // Detect foreign guest from OCR result
      const isForeign = !!data.is_foreign ||
        (data.cittadinanza_iso3 && data.cittadinanza_iso3.toUpperCase() !== "ITA" && data.cittadinanza_iso3 !== "");

      let comuneCode = "";
      let provSigla = "";
      let statoCode = "100000100";
      let cittadinanzaCode = "100000100";
      let paeseNome = "";

      if (isForeign) {
        // Resolve foreign country code via 'Luoghi' table
        const paeseQuery = data.stato_nascita_nome || data.cittadinanza_nome ||
                           data.stato_nascita_iso3 || data.cittadinanza_iso3 || "";
        const cittadinanzaQuery = data.cittadinanza_nome || data.cittadinanza_iso3 || paeseQuery;
        if (paeseQuery) {
          const guess = await lookupStato(paeseQuery, cittadinanzaQuery);
          if (guess?.stato_match?.codice) {
            statoCode = guess.stato_match.codice;
            paeseNome = guess.stato_match.nome;
          }
          cittadinanzaCode = guess?.cittadinanza_match?.codice || statoCode;
        }
      } else if (data.luogo_nascita) {
        // Italian guest: resolve comune
        const guess = await lookupComune(data.luogo_nascita);
        if (guess?.comune_match) {
          comuneCode = guess.comune_match.codice || "";
          provSigla = guess.comune_match.provincia || "";
        }
      }

      const mapDoc = (v) => {
        const m = {
          CARTA_IDENTITA: "IDENT",
          CARTA_IDENTITA_ELETTRONICA: "IDELE",
          PASSAPORTO: "PASOR",
          PATENTE: "PATEN",
        };
        return m[v] || v || "IDENT";
      };

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
          stato_nascita: statoCode,
          cittadinanza: cittadinanzaCode,
          tipo_documento: mapDoc(data.tipo_documento),
          numero_documento: data.numero_documento || g.numero_documento,
          // For foreigners: document released by their own country
          stato_rilascio_documento: isForeign ? statoCode : "100000100",
          codice_comune_nascita: isForeign ? "" : (comuneCode || g.codice_comune_nascita),
          sigla_provincia_nascita: isForeign ? "" : (provSigla || g.sigla_provincia_nascita),
          is_foreign: isForeign,
          paese_nome: paeseNome || data.stato_nascita_nome || "",
        };
        return copy;
      });
    } catch (e) {
      setOcrError(e.response?.data?.detail || "Errore OCR");
    } finally {
      setOcrLoading(false);
    }
  };

  // Resolve comune ISTAT code manually (when user edits luogo_nascita)
  const handleLuogoBlur = async (luogoNascita) => {
    if (!luogoNascita || !propertyId) return;
    const g = guests[activeGuestIdx];
    if (g?.codice_comune_nascita && g?.sigla_provincia_nascita) return;
    const guess = await lookupComune(luogoNascita);
    if (guess?.comune_match) {
      updateGuest(activeGuestIdx, "codice_comune_nascita", guess.comune_match.codice);
      updateGuest(activeGuestIdx, "sigla_provincia_nascita", guess.comune_match.provincia);
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
          {guests.map((gx, i) => {
            const lbl = gx.cognome
              ? `${gx.cognome}${gx.nome ? " " + gx.nome[0] + "." : ""}`
              : `Ospite ${i + 1}`;
            return (
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
                {i === 0 ? "★ " : ""}{lbl}
              </button>
            );
          })}
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
        <p className="text-zinc-600 text-[10px] tracking-widest uppercase font-mono">
          ★ Capofamiglia · gli altri verranno collegati
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="border-2 border-dashed border-[#1E1E28] bg-[#0E0E14] py-6 flex flex-col items-center justify-center hover:border-zinc-500 transition-colors cursor-pointer text-zinc-400 uppercase tracking-widest text-[10px] text-center">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              data-testid="capture-id-box"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0])}
            />
            {ocrLoading ? (
              <span className="font-mono animate-ocr-blink">…</span>
            ) : (
              <>
                <span className="text-zinc-300">Scatta foto</span>
                <span className="text-[9px] text-zinc-600 mt-1">CAMERA</span>
              </>
            )}
          </label>
          <label className="border-2 border-dashed border-[#1E1E28] bg-[#0E0E14] py-6 flex flex-col items-center justify-center hover:border-zinc-500 transition-colors cursor-pointer text-zinc-400 uppercase tracking-widest text-[10px] text-center">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              data-testid="upload-id-box"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0])}
            />
            {ocrLoading ? (
              <span className="font-mono animate-ocr-blink">SCANSIONE…</span>
            ) : (
              <>
                <span className="text-zinc-300">Carica file</span>
                <span className="text-[9px] text-zinc-600 mt-1">JPG · PNG</span>
              </>
            )}
          </label>
        </div>
        {ocrLoading && (
          <p className="text-center text-[10px] font-mono uppercase tracking-widest animate-ocr-blink">
            ANALISI DOCUMENTO IN CORSO...
          </p>
        )}
        {ocrError && (
          <p className="text-red-500 text-xs font-mono uppercase tracking-wider">
            [ ERR ] {ocrError}
          </p>
        )}

        {g._doc_preview && (
          <div className="border border-[#1E1E28] p-3 flex flex-col gap-2">
            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
              Foto Documento — Confronta con i dati estratti
            </span>
            <img
              src={g._doc_preview}
              alt="Documento"
              className="w-full max-h-64 object-contain bg-black"
            />
          </div>
        )}

        <div className="border border-amber-500/30 bg-amber-500/5 p-3 text-[10px] tracking-[0.25em] uppercase text-amber-400 font-mono">
          Verifica e correggi i dati estratti prima di proseguire
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Cognome" value={g.cognome} onChange={(v) => updateGuest(activeGuestIdx, "cognome", v.toUpperCase())} testid="guest-cognome" />
          <TextField label="Nome" value={g.nome} onChange={(v) => updateGuest(activeGuestIdx, "nome", v.toUpperCase())} testid="guest-nome" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Sesso" value={g.sesso} onChange={(v) => updateGuest(activeGuestIdx, "sesso", v)} testid="guest-sesso" options={[["M", "M"], ["F", "F"]]} />
          <DateField label="Data Nascita" value={g.data_nascita} onChange={(v) => updateGuest(activeGuestIdx, "data_nascita", v)} testid="guest-nascita" />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              data-testid="guest-foreign-toggle"
              checked={!!g.is_foreign}
              onChange={(e) => updateGuest(activeGuestIdx, "is_foreign", e.target.checked)}
              className="accent-zinc-100"
            />
            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-300 font-mono">
              Ospite straniero
            </span>
          </label>
          {g.is_foreign && g.paese_nome && (
            <span className="text-[10px] font-mono text-amber-400 ml-auto">
              [ {g.paese_nome} ]
            </span>
          )}
        </div>

        {g.is_foreign ? (
          <PaeseField
            paeseNome={g.paese_nome}
            statoCode={g.stato_nascita}
            propertyId={propertyId}
            onChange={(nome, codice) => {
              updateGuest(activeGuestIdx, "paese_nome", nome);
              updateGuest(activeGuestIdx, "stato_nascita", codice);
              updateGuest(activeGuestIdx, "cittadinanza", codice);
              updateGuest(activeGuestIdx, "stato_rilascio_documento", codice);
              updateGuest(activeGuestIdx, "codice_comune_nascita", "");
              updateGuest(activeGuestIdx, "sigla_provincia_nascita", "");
            }}
          />
        ) : (
          <ComuneNascitaField
            luogoNascita={g.luogo_nascita}
            comuneCode={g.codice_comune_nascita}
            provSigla={g.sigla_provincia_nascita}
            notFound={g._comune_not_found}
            propertyId={propertyId}
            onChange={(luogo, codice, prov) => {
              updateGuest(activeGuestIdx, "luogo_nascita", luogo);
              updateGuest(activeGuestIdx, "codice_comune_nascita", codice);
              updateGuest(activeGuestIdx, "sigla_provincia_nascita", prov);
              updateGuest(activeGuestIdx, "_comune_not_found", false);
            }}
          />
        )}
        <SelectField
          label="Tipo Documento"
          value={g.tipo_documento}
          onChange={(v) => updateGuest(activeGuestIdx, "tipo_documento", v)}
          testid="guest-tipodoc"
          options={[
            ["IDENT", "Carta d'Identità"],
            ["IDELE", "Carta d'Identità Elettronica"],
            ["PASOR", "Passaporto"],
            ["PATEN", "Patente"],
          ]}
        />
        <TextField label="Numero Documento" value={g.numero_documento} onChange={(v) => updateGuest(activeGuestIdx, "numero_documento", v.toUpperCase())} testid="guest-numdoc" />

        <details className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-mono">
          <summary className="cursor-pointer hover:text-zinc-400">
            Codici tecnici (avanzato)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <div className="text-zinc-500">Cod. Comune Nascita</div>
              <div className="text-zinc-300">{g.codice_comune_nascita || "—"}</div>
            </div>
            <div>
              <div className="text-zinc-500">Prov.</div>
              <div className="text-zinc-300">{g.sigla_provincia_nascita || "—"}</div>
            </div>
            <div>
              <div className="text-zinc-500">Cittadinanza</div>
              <div className="text-zinc-300">{g.cittadinanza || "—"}</div>
            </div>
            <div>
              <div className="text-zinc-500">Stato Nascita</div>
              <div className="text-zinc-300">{g.stato_nascita || "—"}</div>
            </div>
            <div>
              <div className="text-zinc-500">Luogo Rilascio Doc</div>
              <div className="text-zinc-300">{g.stato_rilascio_documento || "—"}</div>
            </div>
          </div>
        </details>

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
      // Strip UI-only fields before sending
      const cleanGuests = guests.map(({ _doc_preview, ...rest }) => rest);
      const r = await api.post("/checkin/submit", {
        property_id: propertyId,
        data_arrivo: dataArrivo,
        data_partenza: dataPartenza,
        guests: cleanGuests,
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
    const capo = guests[0];
    const familiari = guests.slice(1);
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

        {/* Tree view of guests: capofamiglia at root, familiari indented */}
        <div className="bg-[#0E0E14] border border-[#1E1E28] p-5 font-mono text-xs flex flex-col gap-2">
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-2">
            Struttura Familiare
          </p>
          {capo && (
            <div className="flex flex-col gap-2">
              <div className="text-zinc-100">
                <span className="text-amber-400">★</span>{" "}
                <span className="font-bold">{capo.cognome || "—"} {capo.nome}</span>
                <span className="text-zinc-500 ml-2">
                  {guests.length === 1 ? "[OSPITE SINGOLO]" : "[CAPOFAMIGLIA]"}
                </span>
              </div>
              {familiari.map((g, i) => (
                <div key={i} className="ml-6 flex items-center gap-2 text-zinc-300 border-l border-[#1E1E28] pl-4 py-1">
                  <span className="text-zinc-600">└</span>
                  <span className="font-bold">{g.cognome || "—"} {g.nome}</span>
                  <span className="text-zinc-500 text-[10px]">[FAMILIARE]</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details per guest in collapsible */}
        <details className="text-xs">
          <summary className="text-zinc-500 cursor-pointer text-[10px] tracking-[0.25em] uppercase hover:text-zinc-300">
            Dettagli dati ospite (verifica)
          </summary>
          <div className="flex flex-col gap-2 mt-3">
            {guests.map((g, i) => (
              <div key={i} className="bg-[#0E0E14] border border-[#1E1E28] p-4 font-mono text-xs">
                <p className="text-zinc-300 font-bold">
                  #{i + 1} — {g.cognome} {g.nome} [{g.sesso}]
                </p>
                <p className="text-zinc-500 mt-1">
                  {g.data_nascita} · {g.luogo_nascita} · {g.tipo_documento} {g.numero_documento}
                </p>
              </div>
            ))}
          </div>
        </details>

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
            label="TURISMO 5 / ROSS 1000"
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
          <div className="border-2 border-amber-500/60 bg-amber-500/10 p-4 flex flex-col gap-2">
            <p className="text-amber-300 text-xs tracking-[0.3em] uppercase font-bold">
              ⚠ Modalità TEST attiva
            </p>
            <p className="text-amber-200/80 text-[10px] font-mono leading-relaxed">
              Nessun dato è stato realmente inviato ai portali.<br/>
              · Alloggiati Web → solo validazione formato<br/>
              · Turismo 5 → solo XML generato in locale<br/>
              · Imposta di Soggiorno → solo calcolo locale<br/>
              Per inviare realmente, passa la struttura in PROD nelle Impostazioni.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isResult?.calculation && (
            <ComuneReceiptButton
              checkinId={result.checkin_id}
              guests={guests}
              importo={isResult.calculation.totale_imposta}
            />
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


function ComuneNascitaField({ luogoNascita, comuneCode, provSigla, notFound, propertyId, onChange }) {
  const cleanQuery = (s) => (s || "").replace(/\([^)]*\)/g, "").replace(/[^\w\s]/g, " ").trim();
  const [query, setQuery] = useState(cleanQuery(luogoNascita));
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(!!notFound);

  useEffect(() => {
    setQuery(cleanQuery(luogoNascita));
  }, [luogoNascita]);

  useEffect(() => {
    if (notFound) setShowSearch(true);
  }, [notFound]);

  const doSearch = async () => {
    if (!query.trim() || !propertyId) return;
    setSearching(true);
    try {
      const r = await api.get(
        `/properties/${propertyId}/alloggiati/comuni?q=${encodeURIComponent(query)}`
      );
      setResults(r.data?.results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pick = (c) => {
    onChange(c.nome, c.codice, c.provincia);
    setShowSearch(false);
    setResults([]);
  };

  const hasMatch = comuneCode && provSigla;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Luogo Nascita</span>
      <input
        type="text"
        data-testid="guest-luogo"
        value={luogoNascita || ""}
        onChange={(e) => onChange(e.target.value, "", "")}
        placeholder="Es. Pescara"
        className="bg-transparent border border-[#1E1E28] px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none w-full font-mono text-sm"
      />
      {hasMatch ? (
        <div className="flex items-center gap-2 text-[10px] font-mono mt-1">
          <span className="text-emerald-500">✓ {provSigla}</span>
          <span className="text-zinc-500">[ {comuneCode} ]</span>
          <button
            type="button"
            onClick={() => { setShowSearch(true); setQuery(luogoNascita || ""); }}
            className="ml-auto text-zinc-500 hover:text-zinc-100 uppercase tracking-widest cursor-pointer"
          >
            Cambia
          </button>
        </div>
      ) : luogoNascita ? (
        <div className="text-amber-400 text-[10px] font-mono mt-1">
          ⚠ Comune non riconosciuto. Cercalo manualmente:
        </div>
      ) : null}

      {showSearch && (
        <div className="border border-[#1E1E28] p-3 mt-2 flex flex-col gap-2 bg-[#0E0E14]">
          <div className="flex gap-2">
            <input
              type="text"
              data-testid="comune-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())}
              placeholder="Digita nome comune..."
              className="flex-1 bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm font-mono"
            />
            <button type="button" onClick={doSearch} disabled={searching} className="border border-[#1E1E28] hover:border-zinc-500 px-3 py-2 text-zinc-300 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50">
              {searching ? "..." : "Cerca"}
            </button>
          </div>
          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
              {results.map((c) => (
                <button key={c.codice} type="button" onClick={() => pick(c)} className="text-left text-[10px] font-mono text-zinc-300 hover:text-zinc-100 hover:bg-[#15151C] px-2 py-2 cursor-pointer">
                  {c.nome} {c.provincia ? `(${c.provincia})` : ""} — {c.codice}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaeseField({ paeseNome, statoCode, propertyId, onChange }) {
  const [query, setQuery] = useState(paeseNome || "");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const lastReqId = useRef(0);

  // Sync external value (e.g. from OCR) into local query when paeseNome changes
  useEffect(() => {
    if (paeseNome && paeseNome !== query) setQuery(paeseNome);
    // eslint-disable-next-line
  }, [paeseNome]);

  // Debounced live search
  useEffect(() => {
    if (!focused) return;
    const q = (query || "").trim();
    if (q.length < 2) { setResults([]); return; }
    const reqId = ++lastReqId.current;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const r = await api.get(
          `/properties/${propertyId}/alloggiati/paesi?q=${encodeURIComponent(q)}`,
        );
        if (reqId !== lastReqId.current) return;
        setResults(r.data?.results || []);
      } catch {
        if (reqId === lastReqId.current) setResults([]);
      } finally {
        if (reqId === lastReqId.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line
  }, [query, focused, propertyId]);

  const pick = (c) => {
    setQuery(c.nome);
    setResults([]);
    setFocused(false);
    setHighlighted(-1);
    onChange(c.nome, c.codice);
  };

  const onKey = (e) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      pick(results[highlighted]);
    } else if (e.key === "Escape") {
      setFocused(false);
    }
  };

  const hasMatch = !!statoCode && statoCode !== "100000100" && !!paeseNome;
  const showDropdown = focused && (results.length > 0 || searching);

  return (
    <div className="flex flex-col gap-1 relative">
      <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Paese (Cittadinanza)</span>
      <input
        type="text"
        data-testid="guest-paese"
        value={query}
        onChange={(e) => { setQuery(e.target.value.toUpperCase()); setHighlighted(-1); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={onKey}
        placeholder="Inizia a scrivere il paese..."
        autoComplete="off"
        className="bg-transparent border border-[#1E1E28] px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none w-full font-mono text-sm"
      />
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-[#1E1E28] bg-[#0E0E14] z-20 max-h-60 overflow-y-auto shadow-lg">
          {searching && results.length === 0 && (
            <div className="px-3 py-2 text-zinc-500 text-[10px] font-mono">Ricerca...</div>
          )}
          {results.map((c, i) => (
            <button
              key={c.codice}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              onMouseEnter={() => setHighlighted(i)}
              data-testid={`paese-result-${c.codice}`}
              className={`w-full text-left text-[11px] font-mono px-3 py-2 cursor-pointer ${
                highlighted === i
                  ? "bg-[#15151C] text-zinc-100"
                  : "text-zinc-300 hover:bg-[#15151C]"
              }`}
            >
              <span>{c.nome}</span>
              <span className="text-zinc-600 ml-2">{c.codice}</span>
            </button>
          ))}
          {!searching && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-2 text-zinc-500 text-[10px] font-mono">Nessun paese trovato</div>
          )}
        </div>
      )}
      {hasMatch && !focused && (
        <div className="flex items-center gap-2 text-[10px] font-mono mt-1">
          <span className="text-emerald-500">✓ {paeseNome}</span>
          <span className="text-zinc-500">[ {statoCode} ]</span>
        </div>
      )}
      {!hasMatch && paeseNome && !focused && (
        <div className="text-amber-400 text-[10px] font-mono mt-1">
          ⚠ Paese non risolto. Inizia a scrivere per cercarlo.
        </div>
      )}
    </div>
  );
}

function ComuneReceiptButton({ checkinId, guests, importo }) {
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [ospiteIdx, setOspiteIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!numero.trim()) { setError("Numero ricevuta obbligatorio"); return; }
    setLoading(true); setError("");
    try {
      const r = await api.post(`/checkins/${checkinId}/comune-receipt`, { numero_ricevuta: numero, data_ricevuta: data, ospite_index: ospiteIdx });
      // Fetch PDF via authenticated XHR (no inline navigation → not blocked by extensions)
      const pdfRes = await api.get(`/checkins/${checkinId}/comune-receipts/${r.data.index}`, { responseType: "blob" });
      // Use data: URL (more extension-friendly than blob:)
      const reader = new FileReader();
      reader.onload = () => {
        const a = document.createElement("a");
        a.href = reader.result;
        a.download = `ricevuta_comune_${numero}.pdf`;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(new Blob([pdfRes.data], { type: "application/pdf" }));
      setOpen(false); setNumero("");
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Errore generazione ricevuta");
    } finally { setLoading(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} data-testid="download-pdf-receipt" className="text-center border border-[#1E1E28] hover:border-zinc-500 px-6 py-4 uppercase tracking-widest text-xs text-zinc-300 cursor-pointer">
        Genera Ricevuta Imposta (PDF) — € {importo?.toFixed(2)}
      </button>
    );
  }
  return (
    <div className="border border-[#1E1E28] bg-[#0E0E14] p-4 flex flex-col gap-3">
      <p className="text-xs tracking-[0.3em] uppercase text-zinc-300">Nuova Ricevuta Comune</p>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">N. Ricevuta</span>
        <input type="text" data-testid="ricevuta-numero-input" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Es. 2026/001" className="bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-300 outline-none text-sm font-mono"/>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Data Ricevuta</span>
        <input type="date" data-testid="ricevuta-data-input" value={data} onChange={(e) => setData(e.target.value)} className="bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono"/>
      </label>
      {guests && guests.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Intestatario</span>
          <select value={ospiteIdx} onChange={(e) => setOspiteIdx(parseInt(e.target.value))} className="bg-transparent border border-[#1E1E28] px-3 py-2 text-zinc-100 focus:border-zinc-300 outline-none text-sm font-mono">
            {guests.map((g, i) => (<option key={i} value={i} className="bg-[#0E0E14]">{g.cognome} {g.nome}</option>))}
          </select>
        </label>
      )}
      {error && <p className="text-red-500 text-[10px] font-mono break-words">[ ERR ] {error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-[#1E1E28] hover:border-zinc-500 text-zinc-400 px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer">Annulla</button>
        <button type="button" onClick={submit} disabled={loading} data-testid="generate-ricevuta-btn" className="flex-1 bg-zinc-100 hover:bg-white text-[#05050A] px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50">
          {loading ? "Generazione..." : "Genera e scarica"}
        </button>
      </div>
    </div>
  );
}
