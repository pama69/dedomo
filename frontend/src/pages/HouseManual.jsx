import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";

const EMPTY_MANUAL = {
  wifi: { ssid: "", password: "" },
  checkin: { from: "", to: "", note: "" },
  checkout: { by: "", note: "" },
  trash: { text: "" },
  parking: { text: "" },
  emergency: { text: "" },
  custom: [],
};

const EMOJI_OPTIONS = [
  "⚠️", "📝", "🔥", "💡", "📌", "🔔",
  "🔑", "🚿", "🛏️", "❄️", "📺", "🎮",
  "🍳", "🧺", "☕", "🍷", "🌳", "🚗",
  "🚲", "♿", "🐕", "🐈", "🏊", "🚴",
];

const SECTION_META = {
  wifi:      { icon: "📶", label: "Wi-Fi",            hint: "Rete e password — verrà mostrato anche come QR code" },
  checkin:   { icon: "🔑", label: "Check-in",         hint: "Orari e note per l'arrivo" },
  checkout:  { icon: "👋", label: "Check-out",        hint: "Orario massimo di uscita e note" },
  trash:     { icon: "♻️", label: "Raccolta rifiuti", hint: "Giorni di raccolta, dove buttare ogni frazione" },
  parking:   { icon: "🚗", label: "Parcheggio",       hint: "Dove parcheggiare, eventuali pass" },
  emergency: { icon: "🚨", label: "Emergenze",        hint: "Tuoi contatti, vicino di casa, numeri utili" },
};

export default function HouseManual() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/properties/${propertyId}`)
      .then((r) => {
        setProperty(r.data);
        const m = r.data.house_manual || {};
        setManual({
          ...EMPTY_MANUAL,
          ...m,
          wifi:      { ...EMPTY_MANUAL.wifi,      ...(m.wifi || {}) },
          checkin:   { ...EMPTY_MANUAL.checkin,   ...(m.checkin || {}) },
          checkout:  { ...EMPTY_MANUAL.checkout,  ...(m.checkout || {}) },
          trash:     { ...EMPTY_MANUAL.trash,     ...(m.trash || {}) },
          parking:   { ...EMPTY_MANUAL.parking,   ...(m.parking || {}) },
          emergency: { ...EMPTY_MANUAL.emergency, ...(m.emergency || {}) },
          custom: m.custom || [],
        });
      })
      .catch(() => setError("Impossibile caricare la proprietà."))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const updateField = (section, key, value) => {
    setManual((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  const addCustom = () => {
    const id = Math.random().toString(36).slice(2, 10);
    setManual((prev) => ({
      ...prev,
      custom: [
        ...prev.custom,
        { id, icon: "📝", title: "", text: "", order: prev.custom.length },
      ],
    }));
  };

  const updateCustom = (id, key, value) => {
    setManual((prev) => ({
      ...prev,
      custom: prev.custom.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    }));
  };

  const removeCustom = (id) => {
    setManual((prev) => ({ ...prev, custom: prev.custom.filter((c) => c.id !== id) }));
  };

  const moveCustom = (id, dir) => {
    setManual((prev) => {
      const idx = prev.custom.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.custom.length) return prev;
      const copy = [...prev.custom];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return { ...prev, custom: copy.map((c, i) => ({ ...c, order: i })) };
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      // Re-key custom 'order' progressivo prima del salvataggio
      const payload = {
        ...manual,
        custom: manual.custom.map((c, i) => ({ ...c, order: i })),
      };
      await api.put(`/properties/${propertyId}/manual`, payload);
      setSavedAt(new Date());
    } catch (e) {
      setError(e.response?.data?.detail || "Errore di salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest animate-ocr-blink">
          Caricamento…
        </p>
      </Layout>
    );
  }

  if (!property) {
    return (
      <Layout>
        <p className="text-red-500 text-sm font-mono">[ ERR ] {error || "Proprietà non trovata."}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div className="flex items-baseline gap-4 border-b border-border pb-4">
          <span className="text-sm font-mono font-semibold" style={{ color: "hsl(var(--accent))" }}>
            ★
          </span>
          <div className="flex flex-col">
            <h2 className="typo-h1">Manuale Casa</h2>
            <p className="typo-meta mt-1">{property.nome} · {property.comune || "—"}</p>
          </div>
          <button
            onClick={() => navigate("/settings")}
            className="ml-auto btn-ghost text-[10px] tracking-[0.25em] uppercase"
          >
            ← Settings
          </button>
        </div>

        <p className="text-zinc-400 text-xs leading-relaxed">
          Le informazioni che compili qui appariranno nella pagina personale dell'ospite, prima di
          meteo e suggerimenti. <strong>I campi vuoti vengono nascosti.</strong> Per ospiti
          stranieri il testo verrà tradotto automaticamente in inglese, tedesco o francese.
        </p>

        {/* SEZIONI STRUTTURATE */}
        <Section meta={SECTION_META.wifi}>
          <Field
            label="Nome rete (SSID)"
            value={manual.wifi.ssid}
            onChange={(v) => updateField("wifi", "ssid", v)}
            testid="manual-wifi-ssid"
          />
          <Field
            label="Password"
            value={manual.wifi.password}
            onChange={(v) => updateField("wifi", "password", v)}
            testid="manual-wifi-password"
          />
        </Section>

        <Section meta={SECTION_META.checkin}>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Dalle"
              type="time"
              value={manual.checkin.from || manual.checkin.from_ || ""}
              onChange={(v) => updateField("checkin", "from", v)}
              testid="manual-checkin-from"
            />
            <Field
              label="Alle"
              type="time"
              value={manual.checkin.to}
              onChange={(v) => updateField("checkin", "to", v)}
              testid="manual-checkin-to"
            />
          </div>
          <TextArea
            label="Note (opzionale)"
            value={manual.checkin.note}
            onChange={(v) => updateField("checkin", "note", v)}
            placeholder="Es. Le chiavi sono nella cassetta vicino al cancello, codice 1234"
            testid="manual-checkin-note"
          />
        </Section>

        <Section meta={SECTION_META.checkout}>
          <Field
            label="Entro le"
            type="time"
            value={manual.checkout.by}
            onChange={(v) => updateField("checkout", "by", v)}
            testid="manual-checkout-by"
          />
          <TextArea
            label="Note (opzionale)"
            value={manual.checkout.note}
            onChange={(v) => updateField("checkout", "note", v)}
            placeholder="Es. Lascia le chiavi sul tavolo della cucina"
            testid="manual-checkout-note"
          />
        </Section>

        <Section meta={SECTION_META.trash}>
          <TextArea
            value={manual.trash.text}
            onChange={(v) => updateField("trash", "text", v)}
            placeholder="Es. Lunedì organico (sacchetto marrone), martedì plastica e metalli (sacco giallo)..."
            testid="manual-trash"
          />
        </Section>

        <Section meta={SECTION_META.parking}>
          <TextArea
            value={manual.parking.text}
            onChange={(v) => updateField("parking", "text", v)}
            placeholder="Es. Parcheggio gratuito nel cortile interno, oppure strisce blu in via Roma (max 2h)"
            testid="manual-parking"
          />
        </Section>

        <Section meta={SECTION_META.emergency}>
          <TextArea
            value={manual.emergency.text}
            onChange={(v) => updateField("emergency", "text", v)}
            placeholder="Es. Paolo (proprietario): +39 333 1234567 — Vicino di casa Mario: +39 339 ..."
            testid="manual-emergency"
          />
        </Section>

        {/* SEZIONI CUSTOM */}
        <div className="border-t border-border pt-6 flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-medium text-zinc-100">Altre informazioni</h3>
            <span className="typo-meta">Aggiungi sezioni personalizzate</span>
          </div>

          {manual.custom.length === 0 && (
            <p className="text-zinc-500 text-xs font-mono">
              Nessuna sezione personalizzata. Aggiungine una per piscina, caminetto, animali, bici, ecc.
            </p>
          )}

          {manual.custom.map((c, i) => (
            <div
              key={c.id}
              className="border border-border bg-surface-1 p-4 flex flex-col gap-3"
              data-testid={`manual-custom-${c.id}`}
            >
              <div className="flex items-center gap-2">
                <EmojiPicker value={c.icon} onChange={(v) => updateCustom(c.id, "icon", v)} />
                <input
                  type="text"
                  value={c.title}
                  onChange={(e) => updateCustom(c.id, "title", e.target.value)}
                  placeholder="Titolo (es. Caminetto)"
                  maxLength={30}
                  className="input-modern flex-1"
                />
                <button
                  onClick={() => moveCustom(c.id, -1)}
                  disabled={i === 0}
                  className="btn-ghost text-xs px-2 disabled:opacity-30"
                  title="Sposta su"
                >↑</button>
                <button
                  onClick={() => moveCustom(c.id, 1)}
                  disabled={i === manual.custom.length - 1}
                  className="btn-ghost text-xs px-2 disabled:opacity-30"
                  title="Sposta giù"
                >↓</button>
                <button
                  onClick={() => removeCustom(c.id)}
                  className="btn-ghost text-xs px-2"
                  style={{ color: "hsl(var(--destructive))" }}
                  title="Rimuovi"
                >✕</button>
              </div>
              <TextArea
                value={c.text}
                onChange={(v) => updateCustom(c.id, "text", v)}
                placeholder="Descrizione (max 500 caratteri)"
                maxLength={500}
              />
            </div>
          ))}

          <button
            onClick={addCustom}
            data-testid="manual-add-custom"
            className="border border-dashed border-border text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 py-3 uppercase tracking-widest text-[10px] cursor-pointer transition-colors"
          >
            + Aggiungi sezione
          </button>
        </div>

        {/* SAVE BAR */}
        <div className="sticky bottom-0 bg-background border-t border-border py-4 flex items-center gap-3">
          {savedAt && !error && (
            <span className="text-emerald-500 text-[10px] font-mono uppercase tracking-widest">
              ✓ Salvato {savedAt.toLocaleTimeString("it-IT")}
            </span>
          )}
          {error && (
            <span className="text-red-500 text-[10px] font-mono">[ ERR ] {error}</span>
          )}
          <button
            onClick={save}
            disabled={saving}
            data-testid="manual-save-btn"
            className="ml-auto bg-zinc-100 hover:bg-white text-[#05050A] font-medium px-6 py-3 uppercase tracking-widest text-xs disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Salvataggio…" : "Salva manuale"}
          </button>
        </div>
      </div>
    </Layout>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function Section({ meta, children }) {
  return (
    <section className="border border-border bg-surface-1 p-5 flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-lg">{meta.icon}</span>
        <h3 className="text-base font-medium text-zinc-100">{meta.label}</h3>
      </div>
      <p className="typo-meta -mt-2">{meta.hint}</p>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, testid, type = "text" }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="typo-meta">{label}</span>
      <input
        type={type}
        data-testid={testid}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="input-modern font-mono"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, testid, maxLength = 500 }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="typo-meta">{label}</span>}
      <textarea
        data-testid={testid}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        className="input-modern font-mono resize-y leading-relaxed"
      />
      <span className="text-zinc-600 text-[10px] font-mono self-end">
        {(value || "").length} / {maxLength}
      </span>
    </label>
  );
}

function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-2xl w-12 h-12 border border-border bg-surface-2 hover:border-zinc-500 cursor-pointer shrink-0"
        title="Cambia icona"
      >
        {value || "📝"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 grid grid-cols-6 gap-3 bg-surface-1 border border-border p-4 shadow-2xl">
            {EMOJI_OPTIONS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => { onChange(em); setOpen(false); }}
                className={`text-2xl w-full aspect-square flex items-center justify-center hover:bg-surface-2 cursor-pointer rounded ${value === em ? "bg-surface-2 ring-1 ring-accent" : ""}`}
              >
                {em}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
