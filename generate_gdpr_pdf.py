"""Genera GDPR_Dedomo.pdf — schema adempimenti GDPR dell'applicazione Dedomo."""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
import datetime

OUT = "GDPR_Dedomo.pdf"
FONT_DIR = "C:/Windows/Fonts/"

GREEN  = (60, 100, 58)
DARK   = (20, 20, 20)
GREY   = (100, 100, 100)
LGREY  = (235, 238, 235)
RED    = (155, 35, 35)
AMBER  = (155, 105, 15)
WHITE  = (255, 255, 255)
BLACK  = (0, 0, 0)
BLUE   = (30, 70, 150)


class PDF(FPDF):
    def setup_fonts(self):
        self.add_font("dv",  "",  FONT_DIR + "DejaVuSans.ttf")
        self.add_font("dv",  "B", FONT_DIR + "DejaVuSans-Bold.ttf")
        self.add_font("dv",  "I", FONT_DIR + "DejaVuSans-Oblique.ttf")

    def header(self):
        self.set_fill_color(*GREEN)
        self.rect(0, 0, 210, 14, "F")
        self.set_text_color(*WHITE)
        self.set_font("dv", "B", 9)
        self.set_xy(8, 3)
        self.cell(0, 8, "DEDOMO — Adempimenti GDPR", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font("dv", "", 7)
        self.set_text_color(*GREY)
        self.cell(0, 6, f"Generato il {datetime.date.today().strftime('%d/%m/%Y')} — uso interno — pag. {self.page_no()}", align="C")

    def section_title(self, txt):
        self.set_fill_color(*GREEN)
        self.set_text_color(*WHITE)
        self.set_font("dv", "B", 10)
        self.cell(0, 7, f"  {txt}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
        self.set_text_color(*BLACK)
        self.ln(2)

    def sub_title(self, txt):
        self.set_font("dv", "B", 9)
        self.set_text_color(*GREEN)
        self.cell(0, 6, txt, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)

    def body(self, txt, indent=4):
        self.set_font("dv", "", 8.5)
        self.set_text_color(*DARK)
        self.set_left_margin(10 + indent)
        self.multi_cell(0, 5, txt)
        self.set_left_margin(10)
        self.ln(1)

    def bullet(self, items, indent=6):
        self.set_font("dv", "", 8.5)
        self.set_text_color(*DARK)
        for item in items:
            self.set_left_margin(10 + indent)
            self.set_x(10 + indent)
            y0 = self.get_y()
            self.set_fill_color(*GREEN)
            self.ellipse(10 + indent - 3, y0 + 1.8, 1.5, 1.5, "F")
            self.multi_cell(0, 5, item)
        self.set_left_margin(10)
        self.ln(1)

    def two_col_row(self, left, right, shade=False):
        self.set_font("dv", "", 8.5)
        if shade:
            self.set_fill_color(*LGREY)
        col_w = 88
        gap = 4
        y = self.get_y()
        self.set_xy(10, y)
        self.multi_cell(col_w, 5.5, left, border=0, fill=shade)
        h_left = self.get_y() - y
        self.set_xy(10 + col_w + gap, y)
        self.multi_cell(col_w, 5.5, right, border=0, fill=shade)
        h_right = self.get_y() - y
        self.set_y(y + max(h_left, h_right))
        self.ln(0.5)

    def two_col_header(self, left, right):
        self.set_fill_color(*GREEN)
        self.set_text_color(*WHITE)
        self.set_font("dv", "B", 8.5)
        col_w = 88
        gap = 4
        self.set_x(10)
        self.cell(col_w, 6, left, fill=True)
        self.set_x(10 + col_w + gap)
        self.cell(col_w, 6, right, new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
        self.set_text_color(*BLACK)
        self.ln(0.5)

    def check(self, label, done=True):
        mark = "✓" if done else "✗"
        color = GREEN if done else RED
        self.set_font("dv", "B", 9)
        self.set_text_color(*color)
        self.set_x(12)
        self.cell(6, 5.5, mark)
        self.set_font("dv", "", 8.5)
        self.set_text_color(*DARK)
        self.multi_cell(0, 5.5, label)
        self.ln(0.3)


# ─── Build PDF ────────────────────────────────────────────────────────
pdf = PDF()
pdf.setup_fonts()
pdf.set_margins(10, 18, 10)
pdf.set_auto_page_break(True, margin=18)
pdf.add_page()

# ═══ COVER ════════════════════════════════════════════════════════════
pdf.set_font("dv", "B", 24)
pdf.set_text_color(*GREEN)
pdf.set_y(30)
pdf.cell(0, 12, "DEDOMO", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("dv", "B", 13)
pdf.set_text_color(*DARK)
pdf.cell(0, 8, "Adempimenti GDPR — Schema procedurale", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(3)
pdf.set_font("dv", "", 9)
pdf.set_text_color(*GREY)
pdf.cell(0, 6, f"Versione 1.0  ·  {datetime.date.today().strftime('%d/%m/%Y')}  ·  Uso interno", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(10)

# Box intro
pdf.set_draw_color(*GREEN)
pdf.set_line_width(0.4)
pdf.set_fill_color(*LGREY)
intro_y = pdf.get_y()
pdf.rect(10, intro_y, 190, 40, "DF")
pdf.set_xy(14, intro_y + 4)
pdf.set_font("dv", "B", 9)
pdf.set_text_color(*GREEN)
pdf.cell(0, 5, "Contesto applicativo", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_x(14)
pdf.set_font("dv", "", 8.5)
pdf.set_text_color(*DARK)
pdf.multi_cell(182, 5,
    "Dedomo è un SaaS B2B per gestori di strutture ricettive (case vacanza, B&B) in Italia. "
    "Tratta dati personali degli ospiti esclusivamente per adempiere agli obblighi di legge "
    "in materia di pubblica sicurezza: invio schedine alla Polizia di Stato (Alloggiati Web), "
    "movimentazioni regionali (Ross 1000) e calcolo imposta di soggiorno. "
    "Il gestore della struttura è il Titolare del trattamento; Dedomo agisce come "
    "Responsabile del trattamento (art. 28 GDPR).")
pdf.set_y(intro_y + 44)

# Legenda colori
pdf.set_font("dv", "B", 8)
pdf.set_text_color(*DARK)
pdf.cell(0, 5, "Legenda colori nelle sezioni:", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(1)
legend = [("BASE GIURIDICA", GREEN), ("MISURA TECNICA", BLUE), ("PENDENTE", RED), ("AUTOMAZIONE", AMBER)]
pdf.set_x(10)
for lbl, col in legend:
    pdf.set_font("dv", "B", 7.5)
    pdf.set_fill_color(*col)
    pdf.set_text_color(*WHITE)
    w = pdf.get_string_width(lbl) + 6
    pdf.cell(w, 6, lbl, fill=True)
    pdf.cell(4, 6, "")
pdf.ln(8)

# ═══ 1. SOGGETTI ═════════════════════════════════════════════════════
pdf.section_title("1. Soggetti coinvolti nel trattamento")
pdf.two_col_header("Soggetto", "Ruolo GDPR / Note")
rows = [
    ("Gestore struttura ricettiva\n(cliente Dedomo)", "Titolare del trattamento — decide finalità e mezzi"),
    ("Ospite della struttura", "Interessato — i cui dati personali vengono raccolti"),
    ("Dedomo SaaS\n(pama69@gmail.com)", "Responsabile del trattamento (art. 28) — deve firmare DPA con ogni gestore"),
    ("Polizia di Stato — Alloggiati Web", "Destinatario istituzionale — obbligo art. 109 TULPS"),
    ("Regione — Ross 1000 / Turismo 5", "Destinatario istituzionale — obbligo D.Lgs. 79/2011"),
    ("Comune — Imposta di Soggiorno", "Destinatario istituzionale — obbligo comunale"),
    ("MongoDB Atlas (AWS Frankfurt)", "Sub-responsabile — storage dati in UE"),
    ("Railway (hosting app)", "Sub-responsabile — esecuzione codice, EU region"),
    ("Resend (email)", "Sub-responsabile — email transazionali"),
    ("OpenAI (OCR documenti)", "Sub-responsabile — analisi immagine documento; richiede DPA"),
    ("Stripe (pagamenti)", "Titolare autonomo per dati billing — no dati ospiti"),
]
for i, (l, r) in enumerate(rows):
    pdf.two_col_row(l, r, shade=(i % 2 == 0))
pdf.ln(4)

# ═══ 2. CATEGORIE DATI ═══════════════════════════════════════════════
pdf.section_title("2. Categorie di dati trattati")
pdf.two_col_header("Categoria / Campo", "Finalità / Destinatario")
rows2 = [
    ("Cognome, Nome", "Alloggiati Web, Ross 1000"),
    ("Sesso", "Alloggiati Web"),
    ("Data di nascita", "Alloggiati Web, Ross 1000"),
    ("Luogo / Comune di nascita", "Alloggiati Web"),
    ("Stato / Paese di nascita", "Alloggiati Web"),
    ("Cittadinanza / Nazionalità", "Alloggiati Web"),
    ("Tipo documento (CI, Passaporto, Patente...)", "Alloggiati Web"),
    ("Numero documento", "Alloggiati Web, Ross 1000"),
    ("Stato rilascio documento", "Alloggiati Web"),
    ("Email ospite (facoltativa)", "Email benvenuto + pagina ospite — legittimo interesse"),
    ("Immagine documento (OCR)", "Elaborata da OpenAI, NON conservata — solo campi estratti"),
    ("Data arrivo / partenza", "Alloggiati Web, Ross 1000, Imposta Soggiorno"),
    ("Email gestore / dati account", "Gestione account Dedomo — base: contratto art. 6(1)(b)"),
    ("Dati pagamento (Stripe)", "Fatturazione abbonamento — gestiti da Stripe, non da Dedomo"),
]
for i, (l, r) in enumerate(rows2):
    pdf.two_col_row(l, r, shade=(i % 2 == 0))
pdf.ln(4)

# ═══ 3. BASI GIURIDICHE ══════════════════════════════════════════════
pdf.section_title("3. Basi giuridiche del trattamento (art. 6 GDPR)")

pdf.sub_title("3.1  Dati degli ospiti — Obbligo legale [art. 6(1)(c)]")
pdf.body(
    "Il trattamento è necessario per adempiere un obbligo legale cui è soggetto il Titolare.\n\n"
    "Norme di riferimento:\n"
    "  •  Art. 109 T.U.L.P.S. (R.D. 773/1931) — comunicazione PS entro 24h dall'arrivo\n"
    "  •  D.Lgs. 286/1998 art. 7 — dichiarazione obbligatoria per cittadini stranieri\n"
    "  •  D.Lgs. 79/2011 (Codice del Turismo) — statistiche regionali Ross 1000\n"
    "  •  Delibere comunali — imposta di soggiorno\n\n"
    "NOTA: il consenso dell'ospite NON è la base giuridica. La checkbox nel form ospite\n"
    "vale come presa d'atto dell'informativa, NON come consenso al senso dell'art. 7 GDPR."
)

pdf.sub_title("3.2  Dati account gestore — Contratto [art. 6(1)(b)]")
pdf.body("Esecuzione del contratto SaaS tra Dedomo e il gestore della struttura.")

pdf.sub_title("3.3  Email ospite facoltativa — Legittimo interesse [art. 6(1)(f)]")
pdf.body(
    "Il gestore ha interesse legittimo a comunicare informazioni pre-soggiorno all'ospite.\n"
    "L'ospite non è obbligato a fornire l'email; in assenza, nessuna email viene inviata."
)
pdf.ln(2)

# ═══ 4. FLUSSO DATI ══════════════════════════════════════════════════
pdf.section_title("4. Flusso dati — Ciclo di vita del dato ospite")

steps = [
    ("1", "RACCOLTA",
     "L'host crea un check-in in app (Checkin.jsx) oppure invia link remoto all'ospite "
     "(RemoteCheckin.jsx). Il form ospite raccoglie dati anagrafici e documento. "
     "Trasmissione via HTTPS."),
    ("2", "OCR (opzionale)",
     "L'ospite fotografa il documento. L'immagine viene elaborata da OpenAI Vision server-side. "
     "OpenAI restituisce i campi estratti; l'immagine NON viene mai conservata da Dedomo."),
    ("3", "VALIDAZIONE HOST (solo remoto)",
     "Per il check-in remoto: l'host rivede i dati inviati dall'ospite in Archive "
     "e deve autorizzarli esplicitamente. Nessun invio automatico senza autorizzazione."),
    ("4", "INVIO AI PORTALI",
     "Alloggiati Web (SOAP/HTTPS) — schedine Polizia di Stato.\n"
     "Ross 1000 (SOAP/CSV) — movimentazioni regionali.\n"
     "APScheduler: invio automatico alle 23:59 (ora italiana) del giorno di arrivo."),
    ("5", "ARCHIVIAZIONE",
     "Dati in MongoDB Atlas (AWS Frankfurt, EU). Accessibili solo all'host autenticato. "
     "Conservazione: 3 anni dalla data di invio."),
    ("6", "ANONIMIZZAZIONE (automatica)",
     "Job APScheduler — 1° del mese, ore 03:00:\n"
     "  •  Checkins >3 anni: cognome/nome/data_nascita/luogo_nascita/numero_documento → '[anonimizzato]'\n"
     "  •  Remote_checkins completati/falliti >3 anni → eliminati\n"
     "Base: art. 5(1)(e) GDPR — limitazione della conservazione."),
    ("7", "CANCELLAZIONE ACCOUNT",
     "L'host richiede cancellazione da Settings → Zona pericolosa (doppia conferma).\n"
     "Vengono eliminati: strutture, checkins, remote_checkins, sessioni, token ospite, abbonamento.\n"
     "Payment_transactions: anonimizzate (email → [deleted]) per obbligo fiscale (10 anni)."),
]

for num, title, desc in steps:
    pdf.set_fill_color(*GREEN)
    pdf.set_text_color(*WHITE)
    pdf.set_font("dv", "B", 8)
    y = pdf.get_y()
    pdf.set_x(10)
    pdf.cell(6, 6, num, fill=True, align="C")
    pdf.set_text_color(*GREEN)
    pdf.set_font("dv", "B", 8.5)
    pdf.cell(0, 6, f"  {title}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_left_margin(18)
    pdf.set_x(18)
    pdf.set_font("dv", "", 8.5)
    pdf.set_text_color(*DARK)
    pdf.multi_cell(0, 5, desc)
    pdf.set_left_margin(10)
    pdf.ln(2)

pdf.ln(2)

# ═══ 5. DIRITTI INTERESSATI ══════════════════════════════════════════
pdf.section_title("5. Diritti degli interessati (artt. 15–22 GDPR)")
pdf.two_col_header("Diritto", "Come viene gestito in Dedomo")
rights = [
    ("Art. 15 — Accesso",
     "L'ospite si rivolge al gestore (Titolare). Il gestore vede tutti i dati in Archive."),
    ("Art. 16 — Rettifica",
     "Il gestore modifica i dati prima dell'invio ai portali. Dopo l'invio: contatto diretto con Alloggiati Web."),
    ("Art. 17 — Cancellazione",
     "Limitato dall'art. 6(1)(c): l'obbligo legale prevale sui dati già inviati alla PS. Anonimizzazione dopo 3 anni."),
    ("Art. 18 — Limitazione",
     "Gestita manualmente dal gestore tramite supporto Dedomo."),
    ("Art. 20 — Portabilità",
     "Dati esportabili in JSON via API o su richiesta al supporto."),
    ("Art. 21 — Opposizione",
     "Non applicabile: base giuridica è obbligo legale, non legittimo interesse."),
    ("Art. 77 — Reclamo al Garante",
     "L'interessato può rivolgersi al Garante Privacy italiano (garanteprivacy.it)."),
]
for i, (l, r) in enumerate(rights):
    pdf.two_col_row(l, r, shade=(i % 2 == 0))
pdf.ln(4)

# ═══ 6. MISURE TECNICHE ══════════════════════════════════════════════
pdf.section_title("6. Misure tecniche di sicurezza implementate")

pdf.sub_title("Trasmissione sicura")
pdf.bullet([
    "HTTPS obbligatorio su tutto il traffico (Railway gestisce TLS con Let's Encrypt)",
    "CORS: origini esplicite allowlist (dedomo.up.railway.app, dedomo.it) — no wildcard *",
    "Security headers: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy",
])

pdf.sub_title("Autenticazione e sessioni")
pdf.bullet([
    "Password hashate con bcrypt (passlib) — nessuna password conservata in chiaro",
    "Cookie sessione: HttpOnly, Secure, SameSite=None — durata 30 giorni",
    "Email di verifica al primo login; reset password via link monouso con scadenza",
    "Blacklist ~300 domini email usa-e-getta bloccati alla registrazione",
])

pdf.sub_title("Rate limiting (anti-brute-force, anti-abuso)")
pdf.bullet([
    "Login / registrazione / reset password: max 10 richieste/minuto per IP",
    "OCR backend (OpenAI): max 5 richieste/minuto per IP",
    "Submit remoto ospite: max 20 richieste/minuto per IP",
    "Implementazione: sliding window in-memory con asyncio.Lock, zero dipendenze esterne",
])

pdf.sub_title("Database e storage")
pdf.bullet([
    "MongoDB Atlas su AWS Frankfurt (UE) — i dati non escono dall'Unione Europea",
    "Accesso Atlas con URI dedicato + autenticazione utente/password",
    "Indici su tutte le chiavi di ricerca (user_id, token, email...) — no full table scan",
    "Query tramite dizionari BSON (Motor) — impossibile SQL/NoSQL injection da input utente",
])

pdf.sub_title("Token ospite (remote check-in)")
pdf.bullet([
    "Token UUID4 monouso generato per ogni link remoto — non indovinabile",
    "Scadenza configurabile; inviato solo all'indirizzo email indicato dall'host",
    "Il link non espone dati personali dell'ospite prima del submit",
    "Endpoint pubblico OCR: validato con lo stesso token del link remoto",
])
pdf.ln(2)

# ═══ 7. JOB AUTOMATICI ═══════════════════════════════════════════════
pdf.section_title("7. Job automatici rilevanti per il GDPR (APScheduler)")
pdf.two_col_header("Job / Frequenza", "Azione / Riferimento GDPR")
jobs = [
    ("_gdpr_anonymize_old_data\n1° del mese — ore 03:00 (Europe/Rome)",
     "Anonimizza campi anagrafici in checkins >3 anni.\n"
     "Elimina remote_checkins completati/falliti >3 anni.\n"
     "Art. 5(1)(e) — limitazione della conservazione."),
    ("_process_scheduled_remote_checkins\nOgni 2 minuti",
     "Invia schedine ospiti autorizzati dall'host alle 23:59 del giorno di arrivo. "
     "Optimistic locking anti-double-send. Nessuna trasmissione senza autorizzazione host."),
    ("fetch_alloggiati_receipts\nOgni ora",
     "Recupera ricevuta PDF da Alloggiati Web dopo invio. Nessun dato personale aggiuntivo."),
    ("retry_failed_submissions\nOgni 15 minuti",
     "Riprova invii falliti (max 400 tentativi = ~14 giorni). "
     "Dopo esaurimento: record conservato ma non processato."),
]
for i, (l, r) in enumerate(jobs):
    pdf.two_col_row(l, r, shade=(i % 2 == 0))
pdf.ln(4)

# ═══ 8. INFORMATIVA INTERESSATI ══════════════════════════════════════
pdf.section_title("8. Informativa agli interessati (art. 13 GDPR)")
pdf.body("Punti di contatto dove l'ospite riceve l'informativa:")
pdf.bullet([
    "Form check-in remoto (RemoteCheckin.jsx): box espandibile 'Informativa sul trattamento dei "
    "dati personali' — base giuridica art. 6(1)(c), finalità, retention 3 anni, diritti, link /privacy. "
    "Disponibile in 4 lingue: italiano, inglese, tedesco, francese.",
    "Checkbox di presa d'atto: l'ospite deve confermare prima di poter inviare i dati. "
    "Senza spunta il pulsante 'Invia' resta disabilitato.",
    "Pagina /privacy: policy pubblica accessibile da qualsiasi dispositivo, linkata dall'informativa.",
])
pdf.body(
    "NOTA: il gestore (Titolare) deve integrare l'informativa con i propri dati di contatto, "
    "la sede, e il riferimento al proprio DPO (se nominato). Dedomo fornisce solo la struttura tecnica."
)
pdf.ln(2)

# ═══ 9. TERZE PARTI ══════════════════════════════════════════════════
pdf.section_title("9. Terze parti e trasferimenti dati")
pdf.two_col_header("Fornitore / Ruolo", "Sede / Garanzie GDPR / Note")
tp = [
    ("MongoDB Atlas\nstorage dati principali",
     "AWS Frankfurt (EU-WEST-1) — dati in UE.\nDPA disponibile su mongodb.com/legal/dpa"),
    ("Railway\nhosting applicazione",
     "Provider US — Standard Contractual Clauses UE.\nNessun dato ospite processato fuori UE."),
    ("Resend\nemail transazionali",
     "Provider US — SCCs.\nContiene solo: link check-in remoto, email benvenuto.\nNessuna schedina PS."),
    ("OpenAI\nOCR documenti identità",
     "Provider US — SCCs.\nRiceve immagine del documento; risponde con testo estratto.\nRichiede DPA: openai.com/policies/data-processing-addendum"),
    ("Stripe\npagamenti abbonamento",
     "Provider US — Titolare autonomo per dati billing.\nNon riceve dati personali degli ospiti."),
    ("Polizia di Stato / Alloggiati Web",
     "IT — Autorità pubblica.\nDestinatario istituzionale obbligatorio. Nessun DPA richiesto."),
    ("Regioni / Comuni\nRoss 1000, Imposta Soggiorno",
     "IT — Autorità pubblica.\nDestinatario istituzionale obbligatorio. Nessun DPA richiesto."),
]
for i, (l, r) in enumerate(tp):
    pdf.two_col_row(l, r, shade=(i % 2 == 0))
pdf.ln(4)

# ═══ 10. CHECKLIST ═══════════════════════════════════════════════════
pdf.section_title("10. Checklist adempimenti — stato attuale")

pdf.sub_title("Implementati tecnicamente")
done = [
    "Informativa art. 13 nel form ospite (4 lingue, box espandibile)",
    "Base giuridica art. 6(1)(c) documentata e comunicata all'interessato",
    "Trasmissione sicura: HTTPS + security headers + CORS ristretto",
    "Autenticazione robusta: bcrypt, sessioni sicure, reset monouso",
    "Rate limiting su endpoint critici (auth 10/min, OCR 5/min, remoto 20/min)",
    "Anonimizzazione automatica dopo 3 anni (APScheduler, 1° del mese ore 03:00)",
    "Cancellazione account completa (art. 17) con doppia conferma in UI",
    "Immagini documento OCR mai conservate — solo campi estratti",
    "Storage dati in UE (MongoDB Atlas, AWS Frankfurt)",
    "Payment_transactions: anonimizzate (non cancellate) alla chiusura account per obbligo fiscale",
]
for d in done:
    pdf.check(d, True)

pdf.ln(3)
pdf.sub_title("Adempimenti formali pendenti (richiedono azione umana)")
pending = [
    "Registro dei trattamenti (art. 30 GDPR) — obbligatorio per trattamento non occasionale. "
    "Da redigere con consulente/avvocato privacy.",
    "Contratto DPA (art. 28) tipo da proporre a ogni gestore-cliente Dedomo che usa la piattaforma.",
    "DPA con OpenAI — obbligatorio per trattamento dati personali (immagini documenti) via API.",
    "Nomina DPO (Data Protection Officer) — valutare se obbligatorio in base alla scala operativa.",
    "DPIA (art. 35) — consigliata per trattamento sistematico di dati da documenti identità.",
    "Cookie policy e banner consenso — necessari se si usano cookie di profilazione o analytics.",
    "Rigenerazione password MongoDB Atlas — password precedente esposta in sessione di chat.",
    "Migrazione DNS dedomo.it → Railway — webhook Stripe e servizi live devono puntare a Railway.",
    "Pagina /privacy — aggiornare con dati di contatto del Titolare e data ultima revisione.",
    "Procedura di notifica violazioni (art. 33) — notifica al Garante entro 72h dalla scoperta.",
]
for p in pending:
    pdf.check(p, False)

pdf.ln(4)

# ═══ 11. RETENTION POLICY ════════════════════════════════════════════
pdf.section_title("11. Retention policy — riepilogo")
pdf.two_col_header("Tipologia dato", "Conservazione / Azione allo scadere")
ret = [
    ("Schedine ospiti (checkins)",
     "3 anni dalla data invio → anonimizzazione automatica campi anagrafici (job mensile)"),
    ("Remote check-in completati/falliti",
     "3 anni → eliminazione automatica (job mensile)"),
    ("Sessioni utente",
     "30 giorni → scadenza automatica; eliminate alla cancellazione account"),
    ("Token email (reset/verifica)",
     "24 ore → scadenza; eliminati alla cancellazione account"),
    ("Token ospite (guest_tokens)",
     "Validi fino alla cancellazione account del gestore"),
    ("Dati account gestore",
     "Fino alla cancellazione account → DELETE /auth/account elimina tutto"),
    ("Transazioni pagamento",
     "Non eliminabili (obbligo fiscale 10 anni) → anonimizzate alla cancellazione account"),
    ("Immagini documento (OCR)",
     "MAI conservate — solo i campi estratti vengono salvati nel checkin"),
    ("Cache guest page",
     "Meteo 3h · eventi 24h · mercati 7g · attrazioni 48h → rigenerazione automatica"),
]
for i, (l, r) in enumerate(ret):
    pdf.two_col_row(l, r, shade=(i % 2 == 0))
pdf.ln(4)

# ═══ 12. RIFERIMENTI ═════════════════════════════════════════════════
pdf.section_title("12. Riferimenti normativi")
pdf.bullet([
    "Regolamento (UE) 2016/679 (GDPR) — eur-lex.europa.eu",
    "Garante Privacy italiano — garanteprivacy.it",
    "Art. 109 T.U.L.P.S. (R.D. 773/1931) — obbligo comunicazione arrivi alla PS",
    "D.Lgs. 286/1998 art. 7 — testo unico immigrazione",
    "D.Lgs. 79/2011 — Codice del Turismo (Ross 1000 / Turismo 5)",
    "Dedomo — responsabile tecnico: pama69@gmail.com",
])

pdf.output(OUT)
print(f"PDF generato: {OUT}")
