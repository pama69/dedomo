import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import DownloadManualButton from "@/components/DownloadManualButton";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const asset = (name) => `${BACKEND}/api/manual/assets/${name}`;

const CHAPTERS = [
  {
    id: "login",
    n: "01",
    title: "Primo accesso",
    intro:
      "Dedomo si autentica esclusivamente tramite Google. Non gestisce password proprie: massima sicurezza e niente account da ricordare.",
    steps: [
      "Apri il link dell'applicazione nel browser (Chrome o Safari consigliati).",
      "Premi il pulsante ACCEDI CON GOOGLE.",
      "Seleziona l'account Google da usare. Al primo accesso Google chiederà i permessi base (nome, email).",
      "Verrai reindirizzato in automatico alla Dashboard.",
    ],
    tip: "Usa sempre lo stesso account Google: tutte le tue strutture, credenziali e archivio sono legate a quell'identità.",
    images: [{ src: "01_login.png", caption: "Schermata di accesso. Un solo pulsante: accedi con Google." }],
  },
  {
    id: "dashboard",
    n: "02",
    title: "Dashboard",
    intro:
      "La Dashboard è il punto di partenza dopo il login. In alto trovi il pulsante gigante CHECK-IN, sotto il riepilogo delle strutture e gli ultimi invii effettuati ai portali.",
    steps: [
      "Premi CHECK-IN per avviare un nuovo invio ospiti.",
      "Nella sezione RIEPILOGO STRUTTURE vedi tutte le strutture configurate, con comune e modalità (TEST/PROD).",
      "ULTIMI INVII mostra le ultime comunicazioni con esito per ogni portale.",
      "In basso trovi la barra di navigazione persistente: CHECK-IN, CALENDARIO, ARCHIVIO, IMPOSTAZIONI.",
    ],
    images: [{ src: "02_dashboard.png", caption: "Dashboard: CHECK-IN sopra, riepilogo strutture al centro." }],
  },
  {
    id: "settings",
    n: "03",
    title: "Impostazioni — Configurazione strutture",
    intro:
      "Prima di poter effettuare check-in devi configurare almeno una struttura con le credenziali dei portali. Apri IMPOSTAZIONI dalla barra in basso.",
    steps: [
      "Premi + NUOVA STRUTTURA per creare la prima struttura.",
      "Dati Struttura: Nome, Indirizzo, Comune, Provincia, CAP, CIN.",
      "Proprietario e Codice Fiscale (compaiono nell'intestazione delle ricevute Imposta di Soggiorno).",
      "Imposta Modalità TEST finché non sei sicuro dei flussi.",
      "Sezione Alloggiati Web: Utente, Password, WSKey (rilasciati dalla Questura). Attiva il toggle.",
      "Sezione Turismo 5 / Ross 1000: Utente, Password, Codice Struttura, Regione. Attiva il toggle.",
      "Sezione Imposta di Soggiorno: tariffa per notte, max notti tassabili, esenzioni per età.",
      "Sezione Calendari: URL iCal di Booking, Airbnb, Vrbo per la sincronizzazione automatica.",
      "Premi SALVA. Le credenziali vengono cifrate nel database.",
    ],
    warn:
      "Senza credenziali Alloggiati Web E Ross 1000 / Turismo 5, il pulsante CONTINUA del check-in resta disabilitato. È una protezione: non si può inviare senza essere abilitati.",
    images: [
      { src: "04_settings_property_top.png", caption: "Dati struttura: nome, indirizzo, proprietario, CIN, modalità." },
      { src: "04b_settings_alloggiati.png", caption: "Sezione Alloggiati Web." },
      { src: "04c_settings_ross1000.png", caption: "Sezione Ross 1000 / Turismo 5." },
      { src: "04d_settings_imposta.png", caption: "Sezione Imposta di Soggiorno." },
      { src: "04e_settings_calendar.png", caption: "Sezione Calendari iCal." },
    ],
  },
  {
    id: "checkin",
    n: "04",
    title: "Check-in — Wizard 5 step",
    intro:
      "Il check-in è un wizard a 5 step. Inizia premendo CHECK-IN dalla Dashboard. Puoi usare l'OCR per estrarre automaticamente i dati dal documento.",
    steps: [
      "STEP 1 — Date: arrivo preimpostato a oggi, modificalo se serve. Imposta la data di partenza.",
      "STEP 2 — Struttura: scegli la struttura. Se mancano credenziali appare un banner CREDENZIALI INCOMPLETE con link diretto alle Impostazioni.",
      "STEP 3 — Ospiti: SCATTA FOTO o CARICA FILE del documento. L'AI estrae Cognome, Nome, Sesso, Data nascita, Luogo nascita, Cittadinanza, Documento. Controlla sempre i dati.",
      "Se l'ospite è straniero spunta OSPITE STRANIERO: cambiano i campi per cittadinanza e Stato di nascita.",
      "Premi + AGGIUNGI per inserire familiari. Il primo è capofamiglia, gli altri vengono collegati.",
      "STEP 4 — Riepilogo: controlla tutto e premi INVIA.",
      "STEP 5 — Esito per ogni portale: [OK] verde se ok, [ERR] rosso con messaggio. Gli errori transient vengono ritentati automaticamente in background.",
    ],
    tip: "Per OCR ottimale: foto nitida, luce uniforme, niente riflessi. Per la carta d'identità italiana inquadra anche il retro con la MRZ.",
    images: [
      { src: "05_checkin_step1.png", caption: "Step 1 — Date." },
      { src: "06_checkin_step2.png", caption: "Step 2 — Struttura." },
      { src: "07_checkin_step3_ocr.png", caption: "Step 3 — OCR + dati ospite." },
    ],
  },
  {
    id: "calendar",
    n: "05",
    title: "Calendario",
    intro:
      "Il Calendario unifica tutte le prenotazioni: Booking, Airbnb, Vrbo (importate via iCal) e quelle aggiunte manualmente. Utile come overview per evitare overbooking.",
    steps: [
      "Apri CALENDARIO dalla barra in basso.",
      "Le prenotazioni delle OTA appaiono con un colore per portale.",
      "Premi + NUOVA PRENOTAZIONE per inserire una prenotazione diretta manuale.",
      "Il sistema aggiorna automaticamente le fonti iCal in background.",
      "Esporta il calendario PERSONAL come .ics per sincronizzarlo con Google Calendar o Apple Calendar.",
    ],
    images: [{ src: "08_calendar.png", caption: "Calendario unificato multi-OTA." }],
  },
  {
    id: "archive",
    n: "06",
    title: "Archivio",
    intro:
      "Tutti i check-in restano in Archivio in modo permanente. Da qui scarichi le ricevute Alloggiati Web, le ricevute Imposta di Soggiorno (PDF) e i CSV Ross 1000, anche a distanza di anni.",
    steps: [
      "Apri ARCHIVIO dalla barra in basso.",
      "Filtra per struttura, periodo o esito.",
      "Premi su un check-in per il dettaglio.",
      "Scarica i PDF (ricevuta Alloggiati, ricevuta Imposta) e i CSV (Ross 1000).",
    ],
    images: [{ src: "09_archive.png", caption: "Archivio permanente con esito per ogni portale." }],
  },
  {
    id: "testprod",
    n: "07",
    title: "Modalità TEST / PROD",
    intro:
      "Ogni struttura ha una sua modalità indipendente. TEST è il default: nessun invio reale ai portali, solo validazione. PROD invia davvero.",
    steps: [
      "In Impostazioni → Modifica struttura, sezione Dati Struttura, trovi il toggle MODALITÀ — [TEST] / [PROD].",
      "Tieni una struttura in TEST finché non hai validato almeno un check-in completo senza errori.",
      "Passa a PROD solo quando sei sicuro: gli invii in PROD non possono essere annullati dal pannello.",
    ],
    tip: "Suggerimento: la prima settimana lascia tutto in TEST. Fai un check-in finto con un tuo documento e controlla che lo stato finale sia [OK] su Alloggiati e Ross 1000. Solo allora passa in PROD.",
    warn:
      "In PROD, eventuali correzioni a schedine già inviate devono essere fatte direttamente sui portali ufficiali (Alloggiati Web e Ross 1000). Lo storno non è automatizzato.",
  },
  {
    id: "faq",
    n: "08",
    title: "FAQ ed errori comuni",
    intro: "Risposte rapide ai problemi più frequenti.",
    faqs: [
      {
        q: "Il pulsante CONTINUA è disabilitato",
        a: "Mancano credenziali Alloggiati Web o Ross 1000 per quella struttura. Vai in Impostazioni → Modifica struttura e completa le sezioni dedicate.",
      },
      {
        q: "L'OCR non riconosce il documento",
        a: "Verifica che la foto sia nitida, ben illuminata e senza riflessi. Per le carte d'identità con MRZ inquadra anche il retro. In ultima istanza puoi sempre compilare a mano.",
      },
      {
        q: "Errore [ERR] su Alloggiati Web — autenticazione fallita",
        a: "Controlla Utente, Password e WSKey nelle Impostazioni della struttura. La WSKey è quella rilasciata dalla Questura, non la password del portale.",
      },
      {
        q: "Errore transitorio (timeout, 5xx)",
        a: "Niente panico: il sistema riprova automaticamente in background. Controlla lo stato dall'Archivio.",
      },
      {
        q: "Non vedo le prenotazioni di Booking nel calendario",
        a: "Verifica che l'URL iCal incollato in Impostazioni sia quello giusto (deve finire con .ics) e che la struttura su Booking abbia almeno una prenotazione futura.",
      },
      {
        q: "Voglio cambiare l'intestazione delle ricevute Imposta di Soggiorno",
        a: "Impostazioni → Modifica struttura → Dati Struttura → Proprietario e Codice Fiscale. Le prossime ricevute useranno i nuovi dati.",
      },
    ],
  },
];

export default function Help() {
  const [active, setActive] = useState(CHAPTERS[0].id);

  // Track scroll to highlight active TOC item
  useEffect(() => {
    const handler = () => {
      let current = CHAPTERS[0].id;
      for (const ch of CHAPTERS) {
        const el = document.getElementById(`ch-${ch.id}`);
        if (el && el.getBoundingClientRect().top < 120) {
          current = ch.id;
        }
      }
      setActive(current);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const goTo = (id) => {
    const el = document.getElementById(`ch-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-1">Guida online</p>
          <h2
            className="text-3xl font-bold uppercase tracking-tight text-zinc-100"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            Manuale d'uso
          </h2>
          <p className="text-zinc-400 text-sm mt-2">
            Setup e utilizzo passo-passo, in italiano.
          </p>
        </div>
        <DownloadManualButton testid="help-download-manual" variant="primary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 mt-4">
        {/* TOC */}
        <nav
          data-testid="help-toc"
          className="md:sticky md:top-4 self-start border-l border-[#1E1E28] pl-4 flex flex-col gap-2"
        >
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-2">Indice</p>
          {CHAPTERS.map((ch) => (
            <button
              key={ch.id}
              data-testid={`help-toc-${ch.id}`}
              onClick={() => goTo(ch.id)}
              className={`text-left text-[11px] tracking-[0.15em] uppercase cursor-pointer transition-colors py-1 ${
                active === ch.id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="font-mono mr-2 text-zinc-600">{ch.n}</span>
              {ch.title.split("—")[0].trim()}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex flex-col gap-10">
          {CHAPTERS.map((ch) => (
            <Chapter key={ch.id} ch={ch} />
          ))}
        </div>
      </div>
    </Layout>
  );
}

function Chapter({ ch }) {
  return (
    <section
      id={`ch-${ch.id}`}
      data-testid={`help-chapter-${ch.id}`}
      className="flex flex-col gap-4 scroll-mt-6"
    >
      <header className="flex items-baseline gap-4 border-b border-[#1E1E28] pb-3">
        <span className="font-mono text-xs text-zinc-500">{ch.n}</span>
        <h3
          className="text-xl font-bold uppercase tracking-tight text-zinc-100"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          {ch.title}
        </h3>
      </header>

      {ch.intro && <p className="text-zinc-300 text-sm leading-relaxed">{ch.intro}</p>}

      {ch.steps && (
        <ol className="flex flex-col gap-2">
          {ch.steps.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-mono text-[10px] text-zinc-500 mt-1 w-6 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-zinc-300 text-sm leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      )}

      {ch.tip && <Callout kind="tip">{ch.tip}</Callout>}
      {ch.warn && <Callout kind="warn">{ch.warn}</Callout>}

      {ch.images && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {ch.images.map((img, i) => (
            <figure
              key={i}
              className="bg-[#0E0E14] border border-[#1E1E28] p-2 flex flex-col gap-2"
            >
              <img
                src={asset(img.src)}
                alt={img.caption}
                className="w-full h-auto"
                loading="lazy"
                data-testid={`help-img-${ch.id}-${i}`}
              />
              <figcaption className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-mono px-2 pb-1">
                {img.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {ch.faqs && (
        <div className="flex flex-col gap-4">
          {ch.faqs.map((f, i) => (
            <div key={i} className="border-l-2 border-[#1E1E28] pl-4">
              <p className="text-zinc-100 font-medium text-sm">{f.q}</p>
              <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Callout({ kind, children }) {
  const map = {
    tip: { color: "border-emerald-500/60 bg-emerald-500/5", text: "text-emerald-400", label: "Consiglio" },
    warn: { color: "border-amber-500/60 bg-amber-500/5", text: "text-amber-400", label: "Attenzione" },
  };
  const m = map[kind] || map.tip;
  return (
    <div className={`border-l-2 ${m.color} pl-4 py-2`}>
      <p className={`text-[10px] tracking-[0.3em] uppercase font-mono font-bold ${m.text} mb-1`}>
        {m.label}
      </p>
      <p className="text-zinc-300 text-sm leading-relaxed">{children}</p>
    </div>
  );
}
