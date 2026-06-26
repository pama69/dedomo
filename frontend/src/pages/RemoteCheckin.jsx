import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { extractDocumentPublic } from "@/lib/ocr-client";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const pub = (path) => `${BACKEND}/api${path}`;

const TIPO_DOC = [
  { value: "IDENT",  label: "Carta d'identità" },
  { value: "IDELE",  label: "CIE (elettronica)" },
  { value: "PASOR",  label: "Passaporto" },
  { value: "PATEN",  label: "Patente di guida" },
];

const EMPTY_GUEST = {
  cognome: "", nome: "", sesso: "M",
  data_nascita: "",
  is_foreign: false,
  luogo_nascita: "", codice_comune_nascita: "", sigla_provincia_nascita: "",
  stato_nascita: "100000100", paese_nome: "",
  cittadinanza: "100000100",
  tipo_documento: "IDENT", numero_documento: "",
  stato_rilascio_documento: "100000100",
};

const I18N = {
  it: {
    title: "Check-in online",
    subtitle: (p) => `Struttura: ${p}`,
    period: (a, b) => `Arrivo ${fmtDate(a)} — Partenza ${fmtDate(b)}`,
    guestsTitle: "Ospiti",
    addGuest: "+ Aggiungi ospite",
    removeGuest: "Rimuovi",
    upload: "Scansiona documento",
    scanning: "Analisi in corso…",
    cognome: "Cognome *", nome: "Nome *",
    sesso: "Sesso *", m: "M", f: "F",
    dataNascita: "Data di nascita *",
    luogoNascita: "Luogo di nascita *",
    cittadinanza: "Cittadinanza *",
    tipoDoc: "Tipo documento *",
    numDoc: "Numero documento *",
    statoRilascio: "Stato rilascio doc",
    foreign: "Straniero",
    privacy: "Acconsento al trattamento dei miei dati personali ai sensi del GDPR per le finalità di registrazione obbligatoria presso le autorità di pubblica sicurezza.",
    submit: "Invia dati",
    sending: "Invio in corso…",
    successTitle: "Dati inviati!",
    successBody: "Il tuo host riceverà i dati e completerà le formalità di check-in. Grazie!",
    errorTitle: "Errore",
    expired: "Il link è scaduto. Contatta il tuo host.",
    notFound: "Link non trovato.",
    searchPlaceholder: "Cerca…",
    guest: (i) => i === 0 ? "Capogruppo" : `Ospite ${i + 1}`,
    ocrHint: "Carica una foto del documento per compilare automaticamente",
  },
  en: {
    title: "Online check-in",
    subtitle: (p) => `Property: ${p}`,
    period: (a, b) => `Arrival ${fmtDate(a)} — Departure ${fmtDate(b)}`,
    guestsTitle: "Guests",
    addGuest: "+ Add guest",
    removeGuest: "Remove",
    upload: "Scan document",
    scanning: "Analysing…",
    cognome: "Last name *", nome: "First name *",
    sesso: "Gender *", m: "M", f: "F",
    dataNascita: "Date of birth *",
    luogoNascita: "Place of birth *",
    cittadinanza: "Nationality *",
    tipoDoc: "Document type *",
    numDoc: "Document number *",
    statoRilascio: "Issuing country",
    foreign: "Foreign",
    privacy: "I consent to the processing of my personal data under GDPR for mandatory registration with public security authorities.",
    submit: "Submit",
    sending: "Submitting…",
    successTitle: "Data submitted!",
    successBody: "Your host will receive the data and complete the check-in formalities. Thank you!",
    errorTitle: "Error",
    expired: "This link has expired. Please contact your host.",
    notFound: "Link not found.",
    searchPlaceholder: "Search…",
    guest: (i) => i === 0 ? "Lead guest" : `Guest ${i + 1}`,
    ocrHint: "Upload a document photo to auto-fill",
  },
  de: {
    title: "Online-Check-in",
    subtitle: (p) => `Unterkunft: ${p}`,
    period: (a, b) => `Anreise ${fmtDate(a)} — Abreise ${fmtDate(b)}`,
    guestsTitle: "Reisende",
    addGuest: "+ Reisenden hinzufügen",
    removeGuest: "Entfernen",
    upload: "Dokument scannen",
    scanning: "Wird analysiert…",
    cognome: "Nachname *", nome: "Vorname *",
    sesso: "Geschlecht *", m: "M", f: "W",
    dataNascita: "Geburtsdatum *",
    luogoNascita: "Geburtsort *",
    cittadinanza: "Staatsangehörigkeit *",
    tipoDoc: "Dokumenttyp *",
    numDoc: "Dokumentnummer *",
    statoRilascio: "Ausstellerstaat",
    foreign: "Ausländisch",
    privacy: "Ich stimme der Verarbeitung meiner personenbezogenen Daten gemäß DSGVO für die Pflichtmeldung bei den Behörden zu.",
    submit: "Absenden",
    sending: "Wird gesendet…",
    successTitle: "Daten übermittelt!",
    successBody: "Ihr Gastgeber erhält die Daten und erledigt die Check-in-Formalitäten. Vielen Dank!",
    errorTitle: "Fehler",
    expired: "Dieser Link ist abgelaufen. Bitte kontaktieren Sie Ihren Gastgeber.",
    notFound: "Link nicht gefunden.",
    searchPlaceholder: "Suchen…",
    guest: (i) => i === 0 ? "Gruppenführer" : `Reisender ${i + 1}`,
    ocrHint: "Dokument-Foto hochladen zum automatischen Ausfüllen",
  },
  fr: {
    title: "Check-in en ligne",
    subtitle: (p) => `Hébergement : ${p}`,
    period: (a, b) => `Arrivée ${fmtDate(a)} — Départ ${fmtDate(b)}`,
    guestsTitle: "Voyageurs",
    addGuest: "+ Ajouter un voyageur",
    removeGuest: "Supprimer",
    upload: "Scanner le document",
    scanning: "Analyse en cours…",
    cognome: "Nom *", nome: "Prénom *",
    sesso: "Sexe *", m: "M", f: "F",
    dataNascita: "Date de naissance *",
    luogoNascita: "Lieu de naissance *",
    cittadinanza: "Nationalité *",
    tipoDoc: "Type de document *",
    numDoc: "Numéro de document *",
    statoRilascio: "État d'émission",
    foreign: "Étranger",
    privacy: "J'accepte le traitement de mes données personnelles conformément au RGPD pour l'enregistrement obligatoire auprès des autorités.",
    submit: "Envoyer",
    sending: "Envoi en cours…",
    successTitle: "Données envoyées !",
    successBody: "Votre hôte recevra les données et effectuera les formalités de check-in. Merci !",
    errorTitle: "Erreur",
    expired: "Ce lien a expiré. Contactez votre hôte.",
    notFound: "Lien introuvable.",
    searchPlaceholder: "Rechercher…",
    guest: (i) => i === 0 ? "Chef de groupe" : `Voyageur ${i + 1}`,
    ocrHint: "Téléchargez une photo du document pour remplir automatiquement",
  },
};

function fmtDate(d) {
  try { return new Date(d).toLocaleDateString("it-IT"); } catch { return d; }
}

// ── Autocomplete component ─────────────────────────────────────────
function Autocomplete({ token, type, value, label, placeholder, onSelect, disabled }) {
  const [q, setQ] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => { setQ(value || ""); }, [value]);

  const search = useCallback((s) => {
    clearTimeout(timer.current);
    if (!s || s.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(pub(`/public/remote-checkin/${token}/${type}?q=${encodeURIComponent(s)}`));
        const data = await r.json();
        setResults(data.luoghi || data.paesi || data.results || []);
        setOpen(true);
      } catch { setResults([]); }
      setLoading(false);
    }, 350);
  }, [token, type]);

  return (
    <div className="relative">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] tracking-widest uppercase text-zinc-500">{label}</span>
        <input
          type="text"
          value={q}
          disabled={disabled}
          onChange={(e) => { setQ(e.target.value); search(e.target.value); }}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="input-modern font-mono"
          autoComplete="off"
        />
      </label>
      {open && results.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 bg-surface-1 border border-border shadow-xl max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => { onSelect(r); setQ(r.nome || r.label || ""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-surface-2 text-zinc-200 border-b border-border/40 last:border-0 font-mono cursor-pointer"
            >
              {r.nome || r.label}
              {r.provincia && <span className="text-zinc-500 ml-2">({r.provincia})</span>}
              {r.stato && <span className="text-zinc-500 ml-2">{r.stato}</span>}
            </button>
          ))}
        </div>
      )}
      {loading && (
        <span className="absolute right-3 top-8 text-zinc-500 text-[10px]">…</span>
      )}
    </div>
  );
}

// ── Single guest form ─────────────────────────────────────────────
function GuestForm({ token, guest, onChange, t, index, onRemove, canRemove }) {
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrErr, setOcrErr] = useState("");
  const fileRef = useRef(null);

  const set = (field, val) => onChange({ ...guest, [field]: val });

  const handleOcr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrBusy(true);
    setOcrErr("");
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const result = await extractDocumentPublic(token, b64, file.type);
      if (result.error) { setOcrErr(result.error); return; }
      const isForeign = result.data ? result.data.stato_nascita_iso3 !== "ITA" : result.stato_nascita_iso3 !== "ITA";
      const d = result.data || result;
      onChange({
        ...guest,
        cognome: d.cognome || guest.cognome,
        nome: d.nome || guest.nome,
        sesso: d.sesso || guest.sesso,
        data_nascita: d.data_nascita || guest.data_nascita,
        luogo_nascita: d.luogo_nascita || guest.luogo_nascita,
        tipo_documento: d.tipo_documento === "CARTA_IDENTITA" ? "IDENT"
          : d.tipo_documento === "CARTA_IDENTITA_ELETTRONICA" ? "IDELE"
          : d.tipo_documento === "PASSAPORTO" ? "PASOR"
          : d.tipo_documento === "PATENTE" ? "PATEN"
          : guest.tipo_documento,
        numero_documento: d.numero_documento || guest.numero_documento,
        is_foreign: isForeign,
        paese_nome: isForeign ? (d.stato_nascita_nome || "") : "",
      });
    } catch { setOcrErr("Errore lettura documento"); }
    finally {
      setOcrBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="border border-border bg-surface-1 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-400 font-mono">
          {t.guest(index)}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove}
            className="text-[10px] uppercase tracking-widest text-red-400 hover:text-red-300 cursor-pointer"
          >
            {t.removeGuest}
          </button>
        )}
      </div>

      {/* OCR upload */}
      <div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleOcr} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={ocrBusy}
          className="w-full border border-dashed border-zinc-600 hover:border-zinc-400 text-zinc-400 hover:text-zinc-200 py-2.5 text-[10px] uppercase tracking-widest cursor-pointer transition-colors disabled:opacity-50"
        >
          {ocrBusy ? t.scanning : `📷 ${t.upload}`}
        </button>
        {ocrErr && <p className="text-zinc-500 text-[11px] mt-1">{ocrErr} — compila manualmente.</p>}
        <p className="text-zinc-600 text-[10px] mt-1">{t.ocrHint}</p>
      </div>

      {/* Straniero toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={guest.is_foreign}
          onChange={(e) => set("is_foreign", e.target.checked)}
          className="accent-amber-500 w-4 h-4"
        />
        <span className="text-xs text-zinc-400">{t.foreign}</span>
      </label>

      {/* Nome / Cognome */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">{t.cognome}</span>
          <input type="text" value={guest.cognome} onChange={(e) => set("cognome", e.target.value.toUpperCase())}
            className="input-modern font-mono" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">{t.nome}</span>
          <input type="text" value={guest.nome} onChange={(e) => set("nome", e.target.value.toUpperCase())}
            className="input-modern font-mono" />
        </label>
      </div>

      {/* Sesso / Data nascita */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">{t.sesso}</span>
          <select value={guest.sesso} onChange={(e) => set("sesso", e.target.value)} className="input-modern font-mono">
            <option value="M">{t.m}</option>
            <option value="F">{t.f}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">{t.dataNascita}</span>
          <input type="date" value={guest.data_nascita} onChange={(e) => set("data_nascita", e.target.value)}
            className="input-modern font-mono" />
        </label>
      </div>

      {/* Luogo nascita */}
      {guest.is_foreign ? (
        <Autocomplete
          token={token} type="paesi"
          value={guest.paese_nome}
          label={t.luogoNascita}
          placeholder="Germania, France…"
          onSelect={(r) => onChange({ ...guest, stato_nascita: r.codice || r.code || guest.stato_nascita, paese_nome: r.nome || r.label || "", luogo_nascita: r.nome || r.label || "", cittadinanza: r.codice || r.code || guest.cittadinanza, stato_rilascio_documento: r.codice || r.code || guest.stato_rilascio_documento })}
        />
      ) : (
        <Autocomplete
          token={token} type="comuni"
          value={guest.luogo_nascita}
          label={t.luogoNascita}
          placeholder="Roma, Milano…"
          onSelect={(r) => onChange({ ...guest, luogo_nascita: r.nome || r.label || "", codice_comune_nascita: r.codice || r.code || "", sigla_provincia_nascita: r.provincia || r.sigla || "" })}
        />
      )}

      {/* Cittadinanza (solo per italiani, stranieri la ereditano dal paese nascita) */}
      {!guest.is_foreign && (
        <Autocomplete
          token={token} type="paesi"
          value={guest.is_foreign ? guest.paese_nome : "ITALIA"}
          label={t.cittadinanza}
          placeholder="ITALIA"
          disabled={true}
        />
      )}

      {/* Documento */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">{t.tipoDoc}</span>
          <select value={guest.tipo_documento} onChange={(e) => set("tipo_documento", e.target.value)} className="input-modern font-mono">
            {TIPO_DOC.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">{t.numDoc}</span>
          <input type="text" value={guest.numero_documento}
            onChange={(e) => set("numero_documento", e.target.value.toUpperCase())}
            className="input-modern font-mono" />
        </label>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function RemoteCheckin() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | expired | notfound | sent | error
  const [guests, setGuests] = useState([{ ...EMPTY_GUEST }]);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const lang = info?.lang || "it";
  const t = I18N[lang] || I18N.it;

  useEffect(() => {
    fetch(pub(`/public/remote-checkin/${token}`))
      .then((r) => {
        if (r.status === 410) return setStatus("expired");
        if (!r.ok) return setStatus("notfound");
        return r.json().then((d) => {
          setInfo(d);
          if (d.existing_guests?.length > 0) setGuests(d.existing_guests);
          setStatus("ready");
        });
      })
      .catch(() => setStatus("notfound"));
  }, [token]);

  const addGuest = () => setGuests((g) => [...g, { ...EMPTY_GUEST }]);
  const removeGuest = (i) => setGuests((g) => g.filter((_, idx) => idx !== i));
  const updateGuest = (i, g) => setGuests((prev) => prev.map((old, idx) => idx === i ? g : old));

  const isValid = () => {
    if (!privacyOk) return false;
    return guests.every((g) =>
      g.cognome.trim() && g.nome.trim() && g.data_nascita &&
      g.numero_documento.trim() &&
      (g.is_foreign ? g.stato_nascita !== "100000100" : g.codice_comune_nascita)
    );
  };

  const submit = async () => {
    if (!isValid()) return;
    setSubmitting(true);
    setSubmitErr("");
    try {
      const r = await fetch(pub(`/public/remote-checkin/${token}/submit`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guests,
          privacy_consent: { accepted: true, accepted_at: new Date().toISOString() },
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setSubmitErr(d.detail || "Errore invio — riprova");
      } else {
        setStatus("sent");
      }
    } catch {
      setSubmitErr("Errore di rete — controlla la connessione e riprova");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest animate-pulse">Caricamento…</p>
    </div>
  );

  if (status === "expired") return (
    <Screen title="Link scaduto" body={t.expired} />
  );

  if (status === "notfound") return (
    <Screen title={t.errorTitle} body={t.notFound} />
  );

  if (status === "sent") return (
    <Screen title={t.successTitle} body={t.successBody} success />
  );

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="bg-background border-b border-border sticky top-0 z-10 px-4 py-3 flex items-center gap-3">
        <span className="text-[#5A7A59] font-bold text-sm tracking-[0.2em] font-mono">DEDOMO</span>
        <span className="text-zinc-600 text-xs">·</span>
        <span className="text-zinc-400 text-xs uppercase tracking-widest">{t.title}</span>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6 flex flex-col gap-6">
        {/* Property info */}
        <div className="border border-border bg-surface-1 p-4">
          <p className="text-zinc-100 font-medium">{info?.property_name}</p>
          <p className="text-zinc-500 text-[11px] font-mono mt-1">
            {t.period(info?.data_arrivo, info?.data_partenza)}
          </p>
        </div>

        {/* Guests */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm uppercase tracking-widest text-zinc-300">{t.guestsTitle}</h2>
            <span className="text-zinc-600 text-[10px] font-mono">{guests.length} ospite/i</span>
          </div>

          {guests.map((g, i) => (
            <GuestForm
              key={i}
              token={token}
              guest={g}
              index={i}
              onChange={(updated) => updateGuest(i, updated)}
              onRemove={() => removeGuest(i)}
              canRemove={guests.length > 1}
              t={t}
            />
          ))}

          <button
            type="button"
            onClick={addGuest}
            className="border border-dashed border-border hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 py-3 text-[10px] uppercase tracking-widest cursor-pointer transition-colors"
          >
            {t.addGuest}
          </button>
        </div>

        {/* Privacy */}
        <label className="flex gap-3 items-start cursor-pointer border border-border p-4 bg-surface-1">
          <input
            type="checkbox"
            checked={privacyOk}
            onChange={(e) => setPrivacyOk(e.target.checked)}
            className="accent-amber-500 w-4 h-4 mt-0.5 shrink-0"
          />
          <span className="text-zinc-400 text-[11px] leading-relaxed">{t.privacy}</span>
        </label>

        {submitErr && (
          <p className="text-red-400 text-[11px] font-mono border border-red-500/30 px-3 py-2">{submitErr}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!isValid() || submitting}
          className="bg-[#5A7A59] hover:bg-[#4a6a49] text-white py-4 uppercase tracking-[0.2em] text-xs font-bold cursor-pointer disabled:opacity-40 transition-colors"
        >
          {submitting ? t.sending : t.submit}
        </button>
      </div>
    </div>
  );
}

function Screen({ title, body, success }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-4">
      <span className="text-[#5A7A59] font-bold tracking-[0.2em] font-mono text-sm">DEDOMO</span>
      {success && <span className="text-emerald-400 text-4xl">✓</span>}
      <h1 className="text-zinc-100 text-lg font-medium">{title}</h1>
      <p className="text-zinc-400 text-sm text-center max-w-xs leading-relaxed">{body}</p>
    </div>
  );
}
