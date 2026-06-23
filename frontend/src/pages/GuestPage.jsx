import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";

// ── Palette vacanza ──────────────────────────────────────────
const C = {
  bg:        "#F7F2E8",
  sage:      "#7B9E7A",
  sageDk:    "#5A7A59",
  sageLt:    "#EEF4EE",
  tan:       "#C4A882",
  tanLt:     "#F5EDDF",
  text:      "#3C3527",
  textSm:    "#7A6E5E",
  white:     "#FFFFFF",
  border:    "rgba(60,53,39,0.10)",
};

// ── Traduzioni ───────────────────────────────────────────────
const T = {
  it: {
    loading:     "Preparando la tua pagina…",
    welcome:     "Benvenuto/a",
    at:          "presso",
    stay:        "Il tuo soggiorno",
    weather:     "Meteo di oggi",
    humidity:    "Umidità",
    wind:        "Vento",
    events:      "Sagre & eventi locali",
    eventsDesc:  "Entro 50 km · oggi e domani",
    markets:     "Mercati",
    marketsDesc: "Entro 30 km",
    attractions: "Da non perdere",
    attraDesc:   "Entro 100 km",
    noEvents:    "Nessun evento trovato per i prossimi giorni.",
    noMarkets:   "Nessun mercato trovato nella zona.",
    noAttr:      "Nessuna attrazione trovata.",
    expired:     "Questo link è scaduto.",
    notFound:    "Link non valido.",
    kmAway:      "km da qui",
    footer:      "Questa pagina è personale e riservata all'ospite.",
  },
  en: {
    loading:     "Preparing your page…",
    welcome:     "Welcome",
    at:          "at",
    stay:        "Your stay",
    weather:     "Today's weather",
    humidity:    "Humidity",
    wind:        "Wind",
    events:      "Local events & festivals",
    eventsDesc:  "Within 50 km · today & tomorrow",
    markets:     "Markets",
    marketsDesc: "Within 30 km",
    attractions: "Must see",
    attraDesc:   "Within 100 km",
    noEvents:    "No events found for the next few days.",
    noMarkets:   "No markets found nearby.",
    noAttr:      "No attractions found.",
    expired:     "This link has expired.",
    notFound:    "Invalid link.",
    kmAway:      "km away",
    footer:      "This page is personal and reserved for the guest.",
  },
  de: {
    loading:     "Ihre Seite wird vorbereitet…",
    welcome:     "Willkommen",
    at:          "in",
    stay:        "Ihr Aufenthalt",
    weather:     "Heutiges Wetter",
    humidity:    "Luftfeuchtigkeit",
    wind:        "Wind",
    events:      "Lokale Veranstaltungen",
    eventsDesc:  "Bis 50 km · heute & morgen",
    markets:     "Märkte",
    marketsDesc: "Bis 30 km",
    attractions: "Sehenswürdigkeiten",
    attraDesc:   "Bis 100 km",
    noEvents:    "Keine Veranstaltungen in den nächsten Tagen.",
    noMarkets:   "Keine Märkte in der Nähe.",
    noAttr:      "Keine Sehenswürdigkeiten gefunden.",
    expired:     "Dieser Link ist abgelaufen.",
    notFound:    "Ungültiger Link.",
    kmAway:      "km entfernt",
    footer:      "Diese Seite ist persönlich und nur für den Gast bestimmt.",
  },
  fr: {
    loading:     "Préparation de votre page…",
    welcome:     "Bienvenue",
    at:          "à",
    stay:        "Votre séjour",
    weather:     "Météo du jour",
    humidity:    "Humidité",
    wind:        "Vent",
    events:      "Événements locaux",
    eventsDesc:  "Dans un rayon de 50 km · aujourd'hui & demain",
    markets:     "Marchés",
    marketsDesc: "Dans un rayon de 30 km",
    attractions: "À ne pas manquer",
    attraDesc:   "Dans un rayon de 100 km",
    noEvents:    "Aucun événement trouvé pour les prochains jours.",
    noMarkets:   "Aucun marché trouvé à proximité.",
    noAttr:      "Aucune attraction trouvée.",
    expired:     "Ce lien a expiré.",
    notFound:    "Lien invalide.",
    kmAway:      "km d'ici",
    footer:      "Cette page est personnelle et réservée à l'hôte.",
  },
};

// ── Type icons (SVG mini) ────────────────────────────────────
const TYPE_BADGE = {
  borgo:       { label: "Borgo",      bg: "#F5EDDF", color: "#8B6914" },
  parco:       { label: "Parco",      bg: "#EEF4EE", color: "#5A7A59" },
  spiaggia:    { label: "Spiaggia",   bg: "#E8F3FA", color: "#2B7AB5" },
  città:       { label: "Città",      bg: "#F0EEF8", color: "#5C4F9A" },
  gastronomia: { label: "Gusto",      bg: "#FFF0EE", color: "#C14A2A" },
};

function TypeBadge({ type }) {
  const t = TYPE_BADGE[type] || { label: type || "Posto", bg: "#F5F5F5", color: "#555" };
  return (
    <span style={{
      background: t.bg, color: t.color,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
      padding: "2px 8px", borderRadius: 20, textTransform: "uppercase",
    }}>{t.label}</span>
  );
}

// ── Card base ────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 16,
      boxShadow: "0 2px 20px rgba(60,53,39,0.07)",
      padding: "1.25rem 1.5rem",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Section header ───────────────────────────────────────────
function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ margin: "2rem 0 0.75rem", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <h2 style={{
          fontFamily: "'Cabinet Grotesk', sans-serif",
          fontSize: 18, fontWeight: 700,
          color: C.text, margin: 0, letterSpacing: "-0.02em",
        }}>{title}</h2>
      </div>
      {subtitle && (
        <p style={{ fontSize: 12, color: C.textSm, margin: 0, paddingLeft: 28 }}>{subtitle}</p>
      )}
    </div>
  );
}

// ── Weather icon ─────────────────────────────────────────────
function WeatherIcon({ icon, size = 64 }) {
  if (!icon) return null;
  return (
    <img
      src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
      alt="meteo"
      width={size}
      height={size}
      style={{ display: "block" }}
    />
  );
}

// ── Skeleton ─────────────────────────────────────────────────
function Skeleton({ h = 80, br = 16 }) {
  return (
    <div style={{
      background: "linear-gradient(90deg, #EDE8DF 25%, #E4DDCF 50%, #EDE8DF 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.6s infinite",
      height: h, borderRadius: br,
    }} />
  );
}

// ── Main component ───────────────────────────────────────────
export default function GuestPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Override dark admin theme
  useEffect(() => {
    const prev = { bg: document.body.style.background, color: document.body.style.color };
    document.body.style.background = C.bg;
    document.body.style.color = C.text;
    return () => {
      document.body.style.background = prev.bg;
      document.body.style.color = prev.color;
    };
  }, []);

  useEffect(() => {
    api.get(`/guest/${token}`)
      .then(r => setData(r.data))
      .catch(e => {
        const status = e.response?.status;
        setError(status === 410 ? "expired" : status === 404 ? "notFound" : "error");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const lang = data?.lang || "it";
  const txt = T[lang] || T.it;

  return (
    <>
      {/* CSS animations */}
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .gp-fadein { animation: fadeUp .5s ease both; }
        .gp-card-hover { transition: transform .2s ease, box-shadow .2s ease; }
        .gp-card-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(60,53,39,0.12); }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Geist', sans-serif" }}>

        {/* ── HERO ───────────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(160deg, ${C.sageDk} 0%, ${C.sage} 60%, #8FB48E 100%)`,
          padding: "3rem 1.5rem 2.5rem",
          textAlign: "center",
          color: C.white,
        }}>
          <p style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.75, margin: "0 0 0.5rem" }}>
            {loading ? "…" : txt.welcome}
          </p>
          <h1 style={{
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontSize: "clamp(2rem, 8vw, 3rem)",
            fontWeight: 800, letterSpacing: "-0.04em",
            margin: "0 0 0.25rem", lineHeight: 1.1,
          }}>
            {loading ? " " : (data?.guest_name || "Ospite")}
          </h1>
          {!loading && data && (
            <p style={{ fontSize: 15, opacity: 0.85, margin: "0.25rem 0 0" }}>
              {txt.at} <strong>{data.property_name}</strong>
              {data.comune ? ` · ${data.comune}` : ""}
            </p>
          )}
          {!loading && data?.checkin_date && (
            <p style={{ fontSize: 12, opacity: 0.65, margin: "0.75rem 0 0", letterSpacing: "0.04em" }}>
              {data.checkin_date} → {data.checkout_date}
            </p>
          )}
          {/* Decorazione onda */}
          <svg viewBox="0 0 1440 40" style={{ display: "block", width: "100%", marginTop: "2rem", marginBottom: "-1px" }} preserveAspectRatio="none">
            <path d="M0,20 C360,40 1080,0 1440,20 L1440,40 L0,40 Z" fill={C.bg} />
          </svg>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────── */}
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0.5rem 1rem 5rem" }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
              <Skeleton h={110} />
              <Skeleton h={80} />
              <Skeleton h={80} />
              <Skeleton h={80} />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <div style={{ fontSize: 48, marginBottom: "1rem" }}>🍃</div>
              <p style={{ color: C.textSm, fontSize: 15 }}>{txt[error] || "Errore."}</p>
            </div>
          )}

          {/* Data */}
          {!loading && data && !error && (
            <div className="gp-fadein">

              {/* ── METEO ─────────────────────────────────────── */}
              <SectionTitle icon="🌤" title={txt.weather} />
              {data.weather ? (
                <Card className="gp-card-hover">
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <WeatherIcon icon={data.weather.icon} size={72} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: "'Cabinet Grotesk', sans-serif",
                        fontSize: 42, fontWeight: 800, color: C.text,
                        letterSpacing: "-0.05em", lineHeight: 1,
                      }}>
                        {data.weather.temp}°C
                      </div>
                      <div style={{ color: C.textSm, fontSize: 15, marginTop: 4 }}>
                        {data.weather.description}
                      </div>
                      <div style={{ display: "flex", gap: "1.25rem", marginTop: 8, flexWrap: "wrap" }}>
                        <Pill color={C.sage}>↓ {data.weather.temp_min}°</Pill>
                        <Pill color={C.tan}>↑ {data.weather.temp_max}°</Pill>
                        {data.weather.humidity && <Pill>{txt.humidity} {data.weather.humidity}%</Pill>}
                        {data.weather.wind_kmh && <Pill>{txt.wind} {data.weather.wind_kmh} km/h</Pill>}
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <EmptyNote>{lang === "it" ? "Dati meteo non disponibili." : lang === "de" ? "Wetterdaten nicht verfügbar." : lang === "fr" ? "Données météo non disponibles." : "Weather data not available."}</EmptyNote>
              )}

              {/* ── EVENTI ───────────────────────────────────── */}
              <SectionTitle icon="🎪" title={txt.events} subtitle={txt.eventsDesc} />
              {data.events?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {data.events.map((ev, i) => (
                    <Card key={i} className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 15, flex: 1 }}>{ev.title}</div>
                        {ev.url && (
                          <a href={ev.url} target="_blank" rel="noreferrer" style={{
                            flexShrink: 0, fontSize: 11, fontWeight: 600,
                            color: C.sage, textDecoration: "none",
                            background: C.sageLt, borderRadius: 20,
                            padding: "3px 10px", whiteSpace: "nowrap",
                          }}>
                            Info →
                          </a>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", marginTop: 6, flexWrap: "wrap" }}>
                        {ev.location && <MetaChip icon="📍">{ev.location}</MetaChip>}
                        {ev.date && <MetaChip icon="📅">{ev.date}</MetaChip>}
                        {ev.time && <MetaChip icon="🕐">{ev.time}</MetaChip>}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyNote>{txt.noEvents}</EmptyNote>
              )}

              {/* ── MERCATI ──────────────────────────────────── */}
              <SectionTitle icon="🛒" title={txt.markets} subtitle={txt.marketsDesc} />
              {data.markets?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {data.markets.map((m, i) => (
                    <Card key={i} className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 15 }}>{m.title}</div>
                      <div style={{ display: "flex", gap: "0.75rem", marginTop: 4, flexWrap: "wrap" }}>
                        {m.location && <MetaChip icon="📍">{m.location}</MetaChip>}
                        {m.days && <MetaChip icon="📅">{m.days}</MetaChip>}
                        {m.time && <MetaChip icon="🕐">{m.time}</MetaChip>}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyNote>{txt.noMarkets}</EmptyNote>
              )}

              {/* ── ATTRAZIONI ───────────────────────────────── */}
              <SectionTitle icon="🗺️" title={txt.attractions} subtitle={txt.attraDesc} />
              {data.attractions?.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "0.75rem" }}>
                  {data.attractions.map((a, i) => (
                    <Card key={i} className="gp-card-hover" style={{ padding: "1.1rem 1.25rem", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <TypeBadge type={a.type} />
                        {a.distance_km && (
                          <span style={{ fontSize: 11, color: C.textSm }}>{a.distance_km} {txt.kmAway}</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{a.title}</div>
                      {a.description && (
                        <div style={{ fontSize: 13, color: C.textSm, lineHeight: 1.5, flex: 1 }}>{a.description}</div>
                      )}
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noreferrer" style={{
                          display: "inline-block", marginTop: 4,
                          fontSize: 12, fontWeight: 600, color: C.sage,
                          textDecoration: "none",
                        }}>
                          Scopri di più →
                        </a>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyNote>{txt.noAttr}</EmptyNote>
              )}

              {/* ── FOOTER ───────────────────────────────────── */}
              <div style={{
                marginTop: "3rem", paddingTop: "1.5rem",
                borderTop: `1px solid ${C.border}`,
                textAlign: "center",
              }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "0.4rem",
                  color: C.textSm, fontSize: 12,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.sage, display: "inline-block" }} />
                  <span style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>DEDOMO</span>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>{txt.footer}</span>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────

function Pill({ children, color = "#888" }) {
  return (
    <span style={{
      fontSize: 12, color,
      background: color + "18",
      padding: "2px 10px", borderRadius: 20,
      fontWeight: 600,
    }}>{children}</span>
  );
}

function MetaChip({ icon, children }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: C.textSm }}>
      <span style={{ fontSize: 11 }}>{icon}</span>
      {children}
    </span>
  );
}

function EmptyNote({ children }) {
  return (
    <div style={{
      background: C.tanLt, borderRadius: 12,
      padding: "1rem 1.25rem",
      color: C.textSm, fontSize: 13, fontStyle: "italic",
    }}>{children}</div>
  );
}
