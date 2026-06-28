import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import api from "@/lib/api";

// Escape per WIFI: secondo WPA QR spec — solo ; , : " e \
const escWifi = (s) => (s || "").replace(/([\\;,":])/g, "\\$1");
const wifiQrString = (ssid, password) =>
  `WIFI:T:${password ? "WPA" : "nopass"};S:${escWifi(ssid)};P:${escWifi(password)};;`;

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
    weather:     "Com'è il tempo oggi",
    humidity:    "Umidità",
    wind:        "Vento",
    events:      "Cosa succede nei dintorni",
    eventsDesc:  "Sagre, feste ed eventi locali · entro 50 km",
    markets:     "Prodotti freschi dai contadini",
    marketsDesc: "Mercati rionali e settimanali · entro 15 km",
    attractions: "I nostri suggerimenti per voi",
    attraDesc:   "I posti più belli da visitare · entro 100 km",
    noEvents:    "Nessun evento trovato per i prossimi giorni.",
    noMarkets:   "Nessun mercato trovato nella zona.",
    noAttr:      "Nessuna attrazione trovata.",
    expired:     "Questo link è scaduto.",
    notFound:    "Link non valido.",
    kmAway:      "km da qui",
    footer:      "Questa pagina è personale e riservata all'ospite.",
    learnMore:   "Scopri di più →",
    viewOnMaps:  "📍 Vedi su Google Maps",
    house:       "La tua casa",
    houseDesc:   "Tutto quello che serve sapere per il tuo soggiorno",
    wifi:        "Wi-Fi",
    wifiCopy:    "Copia password",
    wifiCopied:  "Copiato!",
    wifiQrHint:  "Inquadra il QR con il telefono per collegarti",
    checkinT:    "Check-in",
    checkoutT:   "Check-out",
    trashT:      "Raccolta rifiuti",
    parkingT:    "Parcheggio",
    emergencyT:  "Emergenze",
    restaurants:    "Dove mangiare bene",
    restaurantsDesc:"Ristoranti e trattorie consigliati nelle vicinanze",
    transport:      "Muoversi nei dintorni",
    transportDesc:  "Trasporti pubblici, linee e fermate",
    supermarkets:   "Fare la spesa",
    supermarketsDesc:"Supermercati e negozi alimentari più vicini",
    pharmacy:       "Salute e farmacie",
    pharmacyDesc:   "Farmacie e pronto soccorso più vicino",
    beaches:        "Spiagge e natura",
    beachesDesc:    "Spiagge e parchi raggiungibili dalla struttura",
    airport:        "Aeroporto e stazione",
    airportDesc:    "Come arrivare e ripartire",
    taxi:           "Taxi e transfer",
    taxiDesc:       "Servizi di taxi, NCC e navette",
  },
  en: {
    loading:     "Preparing your page…",
    welcome:     "Welcome",
    at:          "at",
    stay:        "Your stay",
    weather:     "Today's weather",
    humidity:    "Humidity",
    wind:        "Wind",
    events:      "What's on nearby",
    eventsDesc:  "Local events & festivals · within 50 km",
    markets:     "Fresh produce from local farmers",
    marketsDesc: "Weekly markets · within 15 km",
    attractions: "Our suggestions for you",
    attraDesc:   "The most beautiful places to visit · within 100 km",
    noEvents:    "No events found for the next few days.",
    noMarkets:   "No markets found nearby.",
    noAttr:      "No attractions found.",
    expired:     "This link has expired.",
    notFound:    "Invalid link.",
    kmAway:      "km away",
    footer:      "This page is personal and reserved for the guest.",
    learnMore:   "Learn more →",
    viewOnMaps:  "📍 View on Google Maps",
    house:       "Your home",
    houseDesc:   "Everything you need to know during your stay",
    wifi:        "Wi-Fi",
    wifiCopy:    "Copy password",
    wifiCopied:  "Copied!",
    wifiQrHint:  "Scan the QR code with your phone to connect",
    checkinT:    "Check-in",
    checkoutT:   "Check-out",
    trashT:      "Trash collection",
    parkingT:    "Parking",
    emergencyT:  "Emergency contacts",
    restaurants:    "Where to eat well",
    restaurantsDesc:"Recommended restaurants and trattorias nearby",
    transport:      "Getting around",
    transportDesc:  "Public transport, lines and stops",
    supermarkets:   "Groceries",
    supermarketsDesc:"Nearest supermarkets and food shops",
    pharmacy:       "Health & pharmacies",
    pharmacyDesc:   "Pharmacies and nearest emergency room",
    beaches:        "Beaches & nature",
    beachesDesc:    "Beaches and parks reachable from the property",
    airport:        "Airport & station",
    airportDesc:    "How to arrive and depart",
    taxi:           "Taxi & transfers",
    taxiDesc:       "Taxi, private hire and shuttle services",
  },
  de: {
    loading:     "Ihre Seite wird vorbereitet…",
    welcome:     "Willkommen",
    at:          "in",
    stay:        "Ihr Aufenthalt",
    weather:     "Das Wetter heute",
    humidity:    "Luftfeuchtigkeit",
    wind:        "Wind",
    events:      "Was ist los in der Nähe",
    eventsDesc:  "Veranstaltungen & Feste · bis 50 km",
    markets:     "Frische Produkte vom Bauern",
    marketsDesc: "Wochenmärkte · bis 15 km",
    attractions: "Unsere Empfehlungen für Sie",
    attraDesc:   "Die schönsten Ausflugsziele · bis 100 km",
    noEvents:    "Keine Veranstaltungen in den nächsten Tagen.",
    noMarkets:   "Keine Märkte in der Nähe.",
    noAttr:      "Keine Sehenswürdigkeiten gefunden.",
    expired:     "Dieser Link ist abgelaufen.",
    notFound:    "Ungültiger Link.",
    kmAway:      "km entfernt",
    footer:      "Diese Seite ist persönlich und nur für den Gast bestimmt.",
    learnMore:   "Mehr erfahren →",
    viewOnMaps:  "📍 Auf Google Maps anzeigen",
    house:       "Ihre Unterkunft",
    houseDesc:   "Alles, was Sie für Ihren Aufenthalt wissen müssen",
    wifi:        "WLAN",
    wifiCopy:    "Passwort kopieren",
    wifiCopied:  "Kopiert!",
    wifiQrHint:  "Scannen Sie den QR-Code mit Ihrem Telefon",
    checkinT:    "Check-in",
    checkoutT:   "Check-out",
    trashT:      "Müllabfuhr",
    parkingT:    "Parken",
    emergencyT:  "Notfallkontakte",
    restaurants:    "Gut essen gehen",
    restaurantsDesc:"Empfohlene Restaurants und Trattorien in der Nähe",
    transport:      "Unterwegs sein",
    transportDesc:  "Öffentliche Verkehrsmittel, Linien und Haltestellen",
    supermarkets:   "Einkaufen",
    supermarketsDesc:"Nächste Supermärkte und Lebensmittelgeschäfte",
    pharmacy:       "Gesundheit & Apotheken",
    pharmacyDesc:   "Apotheken und nächste Notaufnahme",
    beaches:        "Strände & Natur",
    beachesDesc:    "Strände und Parks in der Nähe der Unterkunft",
    airport:        "Flughafen & Bahnhof",
    airportDesc:    "An- und Abreise",
    taxi:           "Taxi & Transfer",
    taxiDesc:       "Taxi-, Mietwagen- und Shuttle-Dienste",
  },
  fr: {
    loading:     "Préparation de votre page…",
    welcome:     "Bienvenue",
    at:          "à",
    stay:        "Votre séjour",
    weather:     "La météo du jour",
    humidity:    "Humidité",
    wind:        "Vent",
    events:      "Que se passe-t-il ici",
    eventsDesc:  "Événements et fêtes locales · dans 50 km",
    markets:     "Produits frais du terroir",
    marketsDesc: "Marchés locaux · dans 15 km",
    attractions: "Nos coups de cœur pour vous",
    attraDesc:   "Les plus beaux endroits à visiter · dans 100 km",
    noEvents:    "Aucun événement trouvé pour les prochains jours.",
    noMarkets:   "Aucun marché trouvé à proximité.",
    noAttr:      "Aucune attraction trouvée.",
    expired:     "Ce lien a expiré.",
    notFound:    "Lien invalide.",
    kmAway:      "km d'ici",
    footer:      "Cette page est personnelle et réservée à l'hôte.",
    learnMore:   "En savoir plus →",
    viewOnMaps:  "📍 Voir sur Google Maps",
    house:       "Votre logement",
    houseDesc:   "Tout ce qu'il faut savoir pour votre séjour",
    wifi:        "Wi-Fi",
    wifiCopy:    "Copier le mot de passe",
    wifiCopied:  "Copié !",
    wifiQrHint:  "Scannez le QR avec votre téléphone pour vous connecter",
    checkinT:    "Arrivée",
    checkoutT:   "Départ",
    trashT:      "Collecte des déchets",
    parkingT:    "Stationnement",
    emergencyT:  "Numéros d'urgence",
    restaurants:    "Où bien manger",
    restaurantsDesc:"Restaurants et trattorias recommandés à proximité",
    transport:      "Se déplacer",
    transportDesc:  "Transports en commun, lignes et arrêts",
    supermarkets:   "Faire les courses",
    supermarketsDesc:"Supermarchés et épiceries les plus proches",
    pharmacy:       "Santé et pharmacies",
    pharmacyDesc:   "Pharmacies et urgences les plus proches",
    beaches:        "Plages et nature",
    beachesDesc:    "Plages et parcs accessibles depuis le logement",
    airport:        "Aéroport et gare",
    airportDesc:    "Comment arriver et repartir",
    taxi:           "Taxi et transferts",
    taxiDesc:       "Services de taxi, VTC et navettes",
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
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:0.35} 40%{transform:translateY(-10px);opacity:1} }
        @keyframes breathe { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
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
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "4rem 1rem", gap: "1.75rem",
            }}>
              {/* Spinning ring + leaf */}
              <div style={{ position: "relative", width: 80, height: 80 }}>
                <svg viewBox="0 0 80 80" style={{ position: "absolute", inset: 0, animation: "spin 1.6s linear infinite" }}>
                  <circle cx="40" cy="40" r="34"
                    fill="none"
                    stroke={C.sage}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="48 165"
                  />
                </svg>
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, animation: "breathe 2.4s ease-in-out infinite",
                }}>
                  🌿
                </div>
              </div>

              {/* Loading text */}
              <p style={{
                color: C.textSm, fontSize: 13,
                letterSpacing: "0.08em", textTransform: "uppercase",
                animation: "breathe 2.4s ease-in-out infinite",
              }}>
                {T.it.loading}
              </p>

              {/* Bouncing dots */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: C.sage,
                    animation: `bounce 1.3s ease-in-out ${i * 0.18}s infinite`,
                  }} />
                ))}
              </div>
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

              {/* ── LA TUA CASA ──────────────────────────────── */}
              <HouseSection data={data} txt={txt} />

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
                        {m.location && (
                          <MetaChip icon="📍">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.location)}`}
                              target="_blank"
                              rel="noreferrer"
                              title={txt.viewOnMaps}
                              style={{ color: C.sage, textDecoration: "underline", textUnderlineOffset: 2 }}
                            >
                              {m.location}
                            </a>
                          </MetaChip>
                        )}
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
                    <Card key={i} className="gp-card-hover" style={{ padding: 0, display: "flex", flexDirection: "column", gap: 0, overflow: "hidden" }}>
                      {a.image_url && (
                        <img
                          src={a.image_url.replace(/^http:\/\//i, "https://")}
                          alt={a.title}
                          onError={(e) => { e.target.style.display = "none"; }}
                          style={{
                            width: "100%", height: 150,
                            objectFit: "cover", display: "block",
                          }}
                        />
                      )}
                      <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 6 }}>
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
                        {a.maps_url && (
                          <a href={a.maps_url} target="_blank" rel="noreferrer" style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            marginTop: 6, fontSize: 12, fontWeight: 600,
                            color: C.sageDk, textDecoration: "none",
                            background: C.sageLt, borderRadius: 20,
                            padding: "4px 12px",
                          }}>
                            {txt.viewOnMaps}
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyNote>{txt.noAttr}</EmptyNote>
              )}

              {/* ── RISTORANTI ───────────────────────────────── */}
              {data.restaurants?.length > 0 && (
                <>
                  <SectionTitle icon="🍽️" title={txt.restaurants} subtitle={txt.restaurantsDesc} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {data.restaurants.map((r, i) => (
                      <Card key={i} className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</div>
                          {r.distance_km != null && (
                            <span style={{ fontSize: 11, color: C.textSm, whiteSpace: "nowrap" }}>{r.distance_km} {txt.kmAway}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: 6, flexWrap: "wrap" }}>
                          {r.cuisine && <MetaChip icon="🍝">{r.cuisine}</MetaChip>}
                          {r.specialty && <MetaChip icon="⭐">{r.specialty}</MetaChip>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* ── TRASPORTI ────────────────────────────────── */}
              {data.transport?.length > 0 && (
                <>
                  <SectionTitle icon="🚌" title={txt.transport} subtitle={txt.transportDesc} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {data.transport.map((t, i) => (
                      <Card key={i} className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>
                          {t.type}{t.line ? ` · ${t.line}` : ""}
                        </div>
                        {Array.isArray(t.destinations) && t.destinations.length > 0 && (
                          <div style={{ fontSize: 13, color: C.textSm, marginTop: 4 }}>
                            {t.destinations.join(" · ")}
                          </div>
                        )}
                        {t.frequency && (
                          <div style={{ marginTop: 6 }}><MetaChip icon="🕐">{t.frequency}</MetaChip></div>
                        )}
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* ── SUPERMERCATI ─────────────────────────────── */}
              {data.supermarkets?.length > 0 && (
                <>
                  <SectionTitle icon="🛒" title={txt.supermarkets} subtitle={txt.supermarketsDesc} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {data.supermarkets.map((s, i) => (
                      <Card key={i} className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{s.name}</div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: 6, flexWrap: "wrap" }}>
                          {s.hours && <MetaChip icon="🕐">{s.hours}</MetaChip>}
                          {s.notes && <MetaChip icon="ℹ️">{s.notes}</MetaChip>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* ── FARMACIE ─────────────────────────────────── */}
              {data.pharmacy?.length > 0 && (
                <>
                  <SectionTitle icon="💊" title={txt.pharmacy} subtitle={txt.pharmacyDesc} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {data.pharmacy.map((p, i) => (
                      <Card key={i} className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{p.name}</div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: 6, flexWrap: "wrap" }}>
                          {p.type && <MetaChip icon="🏥">{p.type}</MetaChip>}
                          {p.address && <MetaChip icon="📍">{p.address}</MetaChip>}
                          {p.hours && <MetaChip icon="🕐">{p.hours}</MetaChip>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* ── SPIAGGE E PARCHI ─────────────────────────── */}
              {data.beaches_parks?.length > 0 && (
                <>
                  <SectionTitle icon="🏖️" title={txt.beaches} subtitle={txt.beachesDesc} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {data.beaches_parks.map((b, i) => (
                      <Card key={i} className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{b.name}</div>
                          {b.distance_km != null && (
                            <span style={{ fontSize: 11, color: C.textSm, whiteSpace: "nowrap" }}>{b.distance_km} {txt.kmAway}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: 6, flexWrap: "wrap" }}>
                          {b.type && <MetaChip icon="🌊">{b.type}</MetaChip>}
                          {b.features && <MetaChip icon="✨">{b.features}</MetaChip>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* ── AEROPORTO E STAZIONE ─────────────────────── */}
              {data.airport_station?.length > 0 && (
                <>
                  <SectionTitle icon="✈️" title={txt.airport} subtitle={txt.airportDesc} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {data.airport_station.map((a, i) => (
                      <Card key={i} className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{a.name}</div>
                          {a.distance_km != null && (
                            <span style={{ fontSize: 11, color: C.textSm, whiteSpace: "nowrap" }}>{a.distance_km} {txt.kmAway}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: 6, flexWrap: "wrap" }}>
                          {a.type && <MetaChip icon="🚉">{a.type}</MetaChip>}
                          {a.connections && <MetaChip icon="🔗">{a.connections}</MetaChip>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* ── TAXI ─────────────────────────────────────── */}
              {data.taxi?.length > 0 && (
                <>
                  <SectionTitle icon="🚕" title={txt.taxi} subtitle={txt.taxiDesc} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {data.taxi.map((t, i) => (
                      <Card key={i} className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{t.service}</div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: 6, flexWrap: "wrap" }}>
                          {t.contact && <MetaChip icon="📞">{t.contact}</MetaChip>}
                          {t.notes && <MetaChip icon="ℹ️">{t.notes}</MetaChip>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
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

// ── House Manual Section ─────────────────────────────────────
function HouseSection({ data, txt }) {
  const m = data?.house_manual || {};
  const wifi = m.wifi || {};
  const ci = m.checkin || {};
  const co = m.checkout || {};
  const ciFrom = ci.from || ci.from_ || "";
  const trash = (m.trash || {}).text;
  const parking = (m.parking || {}).text;
  const emergency = (m.emergency || {}).text;
  const custom = (m.custom || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  const hasAnything =
    wifi.ssid || (ciFrom || ci.to || ci.note) || (co.by || co.note) ||
    trash || parking || emergency || custom.length > 0;
  if (!hasAnything) return null;

  const formatCheckin = () => {
    const range = [ciFrom, ci.to].filter(Boolean).join(" – ");
    return [range, ci.note].filter(Boolean).join(" · ");
  };
  const formatCheckout = () => [co.by && `entro le ${co.by}`, co.note].filter(Boolean).join(" · ");

  return (
    <>
      <SectionTitle icon="🏡" title={txt.house} subtitle={txt.houseDesc} />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {wifi.ssid && <WifiCard wifi={wifi} txt={txt} />}
        {(ciFrom || ci.to || ci.note) && (
          <InfoCard icon="🔑" title={txt.checkinT} text={formatCheckin()} />
        )}
        {(co.by || co.note) && (
          <InfoCard icon="👋" title={txt.checkoutT} text={formatCheckout()} />
        )}
        {trash && <InfoCard icon="♻️" title={txt.trashT} text={trash} />}
        {parking && <InfoCard icon="🚗" title={txt.parkingT} text={parking} />}
        {emergency && <InfoCard icon="🚨" title={txt.emergencyT} text={emergency} />}
        {custom.map((c) => (
          <InfoCard key={c.id} icon={c.icon || "📝"} title={c.title} text={c.text} />
        ))}
      </div>
    </>
  );
}

function WifiCard({ wifi, txt }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wifi.password || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <Card className="gp-card-hover">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>📶</span>{txt.wifi}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 14, color: C.text, wordBreak: "break-all" }}>
            <div><span style={{ color: C.textSm, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>SSID</span> · {wifi.ssid}</div>
            {wifi.password && (
              <div style={{ marginTop: 4 }}>
                <span style={{ color: C.textSm, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</span> · {wifi.password}
              </div>
            )}
          </div>
          {wifi.password && (
            <button
              onClick={copy}
              style={{
                marginTop: 10, fontSize: 12, fontWeight: 600,
                background: copied ? C.sage : C.sageLt,
                color: copied ? C.white : C.sageDk,
                border: "none", borderRadius: 20,
                padding: "5px 14px", cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {copied ? txt.wifiCopied : txt.wifiCopy}
            </button>
          )}
        </div>
        {wifi.password && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ background: C.white, padding: 8, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <QRCodeSVG value={wifiQrString(wifi.ssid, wifi.password)} size={96} level="M" />
            </div>
            <div style={{ fontSize: 10, color: C.textSm, marginTop: 4, maxWidth: 120 }}>
              {txt.wifiQrHint}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function InfoCard({ icon, title, text }) {
  if (!text) return null;
  return (
    <Card className="gp-card-hover" style={{ padding: "1rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
        <span style={{ fontSize: 20, lineHeight: 1.2 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && (
            <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>{title}</div>
          )}
          <div style={{ color: C.textSm, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {text}
          </div>
        </div>
      </div>
    </Card>
  );
}
