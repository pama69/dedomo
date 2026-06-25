"""Generate the Dedomo user manual PDF.

Dark theme coherent with the app. Organized by menu sections.
Output: /app/static/manuale_dedomo.pdf
"""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ASSETS = Path("/app/manual_assets")
OUT = Path("/app/static/manuale_dedomo.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)

# Palette (coherent with app design_guidelines)
BG = HexColor("#05050A")
SURFACE = HexColor("#0E0E14")
BORDER = HexColor("#1E1E28")
TEXT = HexColor("#F5F5F7")
MUTED = HexColor("#71717A")
ACCENT = HexColor("#E5E5E5")
AMBER = HexColor("#F59E0B")
EMERALD = HexColor("#10B981")

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 18 * mm
MARGIN_BOTTOM = 16 * mm


def draw_bg(c):
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def draw_footer(c, page_num, total=None):
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(MARGIN_X, 10 * mm, "DEDOMO  ·  MANUALE D'USO  ·  v1.0")
    label = f"PAG. {page_num:02d}"
    if total:
        label = f"PAG. {page_num:02d} / {total:02d}"
    c.drawRightString(PAGE_W - MARGIN_X, 10 * mm, label)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.4)
    c.line(MARGIN_X, 13 * mm, PAGE_W - MARGIN_X, 13 * mm)


def draw_header(c, eyebrow, title):
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(MARGIN_X, PAGE_H - 14 * mm, eyebrow.upper())
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(MARGIN_X, PAGE_H - 22 * mm, title)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.4)
    c.line(MARGIN_X, PAGE_H - 26 * mm, PAGE_W - MARGIN_X, PAGE_H - 26 * mm)


def draw_paragraph(c, text, x, y, width, font="Helvetica", size=9.5, leading=13, color=TEXT):
    """Simple paragraph word-wrap. Returns final y."""
    c.setFillColor(color)
    c.setFont(font, size)
    words = text.split()
    line = ""
    for w in words:
        test = (line + " " + w).strip()
        if c.stringWidth(test, font, size) > width:
            c.drawString(x, y, line)
            y -= leading
            line = w
        else:
            line = test
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_steps(c, steps, x, y, width):
    """Numbered steps with hanging indent."""
    c.setFont("Helvetica", 9.5)
    for i, s in enumerate(steps, 1):
        num = f"{i:02d}"
        c.setFillColor(MUTED)
        c.setFont("Courier-Bold", 8)
        c.drawString(x, y, num)
        c.setFillColor(TEXT)
        c.setFont("Helvetica", 9.5)
        # word-wrap step text from x+12mm
        text_x = x + 10 * mm
        text_w = width - 10 * mm
        words = s.split()
        line = ""
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, "Helvetica", 9.5) > text_w:
                c.drawString(text_x, y, line)
                y -= 12
                line = w
            else:
                line = test
        if line:
            c.drawString(text_x, y, line)
            y -= 12
        y -= 3
    return y


def draw_callout(c, kind, text, x, y, width):
    """Colored info box. kind: 'tip' | 'warn' | 'note'."""
    color_map = {
        "tip": EMERALD,
        "warn": AMBER,
        "note": MUTED,
    }
    label_map = {
        "tip": "CONSIGLIO",
        "warn": "ATTENZIONE",
        "note": "NOTA",
    }
    col = color_map.get(kind, MUTED)
    label = label_map.get(kind, "NOTA")

    # Measure text height first
    c.setFont("Helvetica", 9)
    words = text.split()
    lines = []
    line = ""
    tw = width - 8 * mm
    for w in words:
        test = (line + " " + w).strip()
        if c.stringWidth(test, "Helvetica", 9) > tw:
            lines.append(line)
            line = w
        else:
            line = test
    if line:
        lines.append(line)
    box_h = 6 * mm + len(lines) * 11 + 4 * mm

    # Draw box
    c.setFillColor(SURFACE)
    c.setStrokeColor(col)
    c.setLineWidth(0.6)
    c.rect(x, y - box_h, width, box_h, fill=1, stroke=1)
    # Left accent bar
    c.setFillColor(col)
    c.rect(x, y - box_h, 1.2 * mm, box_h, fill=1, stroke=0)
    # Label
    c.setFillColor(col)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(x + 4 * mm, y - 5 * mm, label)
    # Text
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)
    ty = y - 10 * mm
    for ln in lines:
        c.drawString(x + 4 * mm, ty, ln)
        ty -= 11
    return y - box_h - 4 * mm


def draw_screenshot(c, img_path, x, y, max_w, max_h, caption=None):
    """Draw image preserving aspect ratio, top-anchored at y."""
    img = ImageReader(str(img_path))
    iw, ih = img.getSize()
    ratio = min(max_w / iw, max_h / ih)
    w = iw * ratio
    h = ih * ratio
    # Frame
    c.setFillColor(SURFACE)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.rect(x - 1, y - h - 1, w + 2, h + 2, fill=0, stroke=1)
    c.drawImage(img, x, y - h, width=w, height=h, mask="auto")
    if caption:
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Oblique", 8)
        c.drawString(x, y - h - 4 * mm, f"Fig. — {caption}")
        return y - h - 8 * mm
    return y - h - 3 * mm


# ============ BUILD PDF ============
def build(total_pages=15):
    c = canvas.Canvas(str(OUT), pagesize=A4)
    c.setTitle("Dedomo — Manuale d'uso")
    c.setAuthor("Dedomo")
    c.setSubject("Manuale utente per la comunicazione ospiti case vacanza")

    page = 0
    content_w = PAGE_W - 2 * MARGIN_X

    # ------- COVER -------
    page += 1
    draw_bg(c)
    # Decorative big brand
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 64)
    c.drawString(MARGIN_X, PAGE_H - 95 * mm, "DEDOMO")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(MARGIN_X, PAGE_H - 103 * mm, "COMUNICAZIONE OSPITI  ·  CASE VACANZA  ·  ITALIA")
    # Title block
    c.setStrokeColor(BORDER)
    c.line(MARGIN_X, PAGE_H - 115 * mm, MARGIN_X + 70 * mm, PAGE_H - 115 * mm)
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(MARGIN_X, PAGE_H - 130 * mm, "Manuale d'uso")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 11)
    c.drawString(MARGIN_X, PAGE_H - 140 * mm, "Setup e utilizzo passo-passo")

    # Bottom band with portali
    band_y = 40 * mm
    c.setFillColor(SURFACE)
    c.rect(0, band_y - 8 * mm, PAGE_W, 28 * mm, fill=1, stroke=0)
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN_X, band_y + 12 * mm, "INTEGRAZIONI")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    items = ["Alloggiati Web (Polizia di Stato)",
             "Ross 1000 / Turismo 5 (Regione)",
             "Imposta di Soggiorno (PDF)",
             "iCal Booking / Airbnb / Vrbo"]
    yy = band_y + 6 * mm
    for it in items:
        c.drawString(MARGIN_X, yy, f"· {it}")
        yy -= 4.5 * mm
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawRightString(PAGE_W - MARGIN_X, 10 * mm, "v1.0  ·  Italiano")
    c.showPage()

    # ------- INDEX -------
    page += 1
    draw_bg(c)
    draw_header(c, f"PAG. {page:02d}  ·  Indice", "Indice")
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 10.5)
    toc = [
        ("01", "Primo accesso", "Login Google"),
        ("02", "Dashboard", "Pulsante CHECK-IN e riepilogo strutture"),
        ("03", "Impostazioni", "Creazione e configurazione strutture"),
        ("04", "Check-in", "Wizard 5 step con OCR documenti"),
        ("05", "Calendario", "iCal Booking / Airbnb / Vrbo"),
        ("06", "Archivio", "Storico invii e ricevute"),
        ("07", "Modalità TEST / PROD", "Verifica prima di inviare davvero"),
        ("08", "FAQ ed errori comuni", "Cosa fare quando qualcosa non torna"),
    ]
    y = PAGE_H - 45 * mm
    for n, title, sub in toc:
        c.setFillColor(MUTED)
        c.setFont("Courier-Bold", 9)
        c.drawString(MARGIN_X, y, n)
        c.setFillColor(TEXT)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(MARGIN_X + 12 * mm, y, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 9)
        c.drawString(MARGIN_X + 60 * mm, y, sub)
        # dotted line
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.3)
        c.setDash(1, 2)
        c.line(MARGIN_X + 12 * mm, y - 2 * mm, PAGE_W - MARGIN_X, y - 2 * mm)
        c.setDash()
        y -= 11 * mm

    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 01 LOGIN -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 01", "Primo accesso")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "Dedomo si autentica esclusivamente tramite Google. Non gestisce password proprie: questo significa zero account da ricordare e massima sicurezza.",
        MARGIN_X, y, content_w)
    y -= 3 * mm
    y = draw_steps(c, [
        "Apri il link dell'applicazione nel browser (Chrome o Safari consigliati).",
        "Premi il pulsante ACCEDI CON GOOGLE.",
        "Seleziona l'account Google che vuoi usare. Al primo accesso Google chiederà i permessi di base (nome, email).",
        "Verrai reindirizzato in automatico alla Dashboard.",
    ], MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_callout(c, "tip",
        "Usa sempre lo stesso account Google: tutte le tue strutture, credenziali e archivio sono legate a quell'identità.",
        MARGIN_X, y, content_w)
    # Screenshot
    img_h = 90 * mm
    draw_screenshot(c, ASSETS / "01_login.png", MARGIN_X, y, content_w, img_h,
                    caption="Schermata di accesso. Un solo pulsante: accedi con Google.")
    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 02 DASHBOARD -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 02", "Dashboard")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "La Dashboard è il punto di partenza dopo il login. In alto trovi il pulsante gigante CHECK-IN, sotto il riepilogo delle strutture e l'elenco degli ultimi invii effettuati ai portali.",
        MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_steps(c, [
        "Premi CHECK-IN per avviare un nuovo invio ospiti (capitolo 04).",
        "Nella sezione RIEPILOGO STRUTTURE vedi tutte le strutture configurate, con comune e modalità (TEST/PROD).",
        "ULTIMI INVII mostra le ultime comunicazioni con esito per ogni portale.",
        "In basso trovi la barra di navigazione persistente: CHECK-IN, CALENDARIO, ARCHIVIO, IMPOSTAZIONI.",
    ], MARGIN_X, y, content_w)
    y -= 2 * mm
    draw_screenshot(c, ASSETS / "02_dashboard.png", MARGIN_X, y, content_w, 95 * mm,
                    caption="Dashboard: CHECK-IN sopra, riepilogo strutture al centro.")
    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 03 IMPOSTAZIONI (1/2: anagrafica + Alloggiati) -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 03  ·  Parte 1/2", "Impostazioni — Struttura e Alloggiati")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "Prima di poter effettuare check-in devi configurare almeno una struttura con le credenziali dei portali. Apri IMPOSTAZIONI dalla barra in basso.",
        MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_steps(c, [
        "Premi + NUOVA STRUTTURA per creare la prima struttura.",
        "Compila Dati Struttura: Nome, Indirizzo, Comune, Provincia, CAP, CIN.",
        "Compila Proprietario e Codice Fiscale (usati nell'intestazione delle ricevute Imposta di Soggiorno).",
        "Imposta Modalità TEST finché non sei sicuro (vedi cap. 07).",
        "Nella sezione Alloggiati Web inserisci Utente, Password e WSKey (rilasciati dalla Questura).",
        "Attiva il toggle Abilita Alloggiati Web.",
    ], MARGIN_X, y, content_w)
    y -= 2 * mm
    draw_screenshot(c, ASSETS / "04_settings_property_top.png", MARGIN_X, y, content_w, 80 * mm,
                    caption="Dati struttura: nome, indirizzo, proprietario, CIN, modalità.")
    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 03 (2/2: Ross1000 + Imposta soggiorno + iCal) -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 03  ·  Parte 2/2", "Impostazioni — Ross 1000, Imposta, iCal")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "Continua a scorrere la pagina di modifica struttura per configurare gli altri portali e le sincronizzazioni iCal.",
        MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_steps(c, [
        "Sezione Turismo 5 / Ross 1000: inserisci Utente, Password, Codice Struttura e seleziona Regione. Attiva il toggle.",
        "Sezione Imposta di Soggiorno: imposta tariffa per notte, max notti tassabili ed esenzioni per età.",
        "Sezione Calendari: incolla gli URL iCal di Booking, Airbnb e Vrbo per la sincronizzazione automatica.",
        "Premi SALVA in fondo alla pagina. Le credenziali vengono cifrate nel database.",
    ], MARGIN_X, y, content_w)
    y -= 2 * mm
    # Two screenshots side by side
    half_w = (content_w - 4 * mm) / 2
    draw_screenshot(c, ASSETS / "04c_settings_ross1000.png", MARGIN_X, y, half_w, 70 * mm,
                    caption="Sezione Ross 1000 / Turismo 5.")
    draw_screenshot(c, ASSETS / "04d_settings_imposta.png", MARGIN_X + half_w + 4 * mm, y, half_w, 70 * mm,
                    caption="Sezione Imposta di Soggiorno.")
    y -= 78 * mm
    y = draw_callout(c, "warn",
        "Senza le credenziali Alloggiati Web E Ross 1000 / Turismo 5 il pulsante CONTINUA del check-in resta disabilitato. È una protezione: non si può inviare senza essere abilitati.",
        MARGIN_X, y, content_w)
    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 04 CHECK-IN (1/2) -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 04  ·  Parte 1/2", "Check-in — Date e Struttura")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "Il check-in è un wizard a 5 step. Inizia premendo CHECK-IN dalla Dashboard.",
        MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_steps(c, [
        "STEP 1 — Date: la data di arrivo è preimpostata a oggi. Modificala se serve e imposta la data di partenza.",
        "Premi CONTINUA →.",
        "STEP 2 — Struttura: seleziona la struttura per cui stai facendo il check-in. Se mancano credenziali appare il banner CREDENZIALI INCOMPLETE con link diretto alle Impostazioni.",
        "Premi CONTINUA →.",
    ], MARGIN_X, y, content_w)
    y -= 1 * mm
    half_w = (content_w - 4 * mm) / 2
    draw_screenshot(c, ASSETS / "05_checkin_step1.png", MARGIN_X, y, half_w, 75 * mm,
                    caption="Step 1: scegli le date.")
    draw_screenshot(c, ASSETS / "06_checkin_step2.png", MARGIN_X + half_w + 4 * mm, y, half_w, 75 * mm,
                    caption="Step 2: scegli la struttura.")
    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 04 CHECK-IN (2/2) -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 04  ·  Parte 2/2", "Check-in — OCR documenti e Invio")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "Allo step 3 inserisci i dati di ciascun ospite. Puoi compilare a mano oppure usare l'OCR: scatta una foto al documento e l'AI compila i campi.",
        MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_steps(c, [
        "STEP 3 — Premi SCATTA FOTO (smartphone) o CARICA FILE (jpg/png) del documento di identità.",
        "L'AI estrae Cognome, Nome, Sesso, Data nascita, Luogo nascita, Cittadinanza, Documento. Controlla sempre i dati prima di proseguire.",
        "Se l'ospite è straniero spunta OSPITE STRANIERO: i campi cambiano per cittadinanza e Stato di nascita (codici recuperati dalla tabella Luoghi).",
        "Premi + AGGIUNGI per inserire familiari. Il primo è capofamiglia, gli altri vengono collegati.",
        "STEP 4 — Riepilogo: controlla tutto e premi INVIA.",
        "STEP 5 — Esito per ogni portale: [OK] verde se andato a buon fine, [ERR] rosso con messaggio. Errori transient vengono ritentati automaticamente.",
    ], MARGIN_X, y, content_w)
    y -= 1 * mm
    draw_screenshot(c, ASSETS / "07_checkin_step3_ocr.png", MARGIN_X, y, content_w, 80 * mm,
                    caption="Step 3: foto documento + dati ospite.")
    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 05 CALENDARIO -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 05", "Calendario")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "Il Calendario unifica tutte le prenotazioni: Booking, Airbnb, Vrbo (importate via iCal) e quelle aggiunte manualmente. Tienilo come strumento di overview per evitare overbooking.",
        MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_steps(c, [
        "Apri CALENDARIO dalla barra in basso.",
        "Le prenotazioni delle OTA appaiono con un colore per portale.",
        "Premi + NUOVA PRENOTAZIONE per inserire manualmente una prenotazione diretta.",
        "Il sistema aggiorna automaticamente le fonti iCal in background.",
        "Esporta il calendario PERSONAL come iCal per sincronizzarlo con la tua agenda (Google / Apple Calendar).",
    ], MARGIN_X, y, content_w)
    y -= 2 * mm
    draw_screenshot(c, ASSETS / "08_calendar.png", MARGIN_X, y, content_w, 95 * mm,
                    caption="Calendario unificato multi-OTA.")
    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 06 ARCHIVIO -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 06", "Archivio")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "Tutti i check-in restano in Archivio in modo permanente. Da qui puoi scaricare ricevute Alloggiati Web, ricevute Imposta di Soggiorno (PDF) e CSV Ross 1000 anche a distanza di anni.",
        MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_steps(c, [
        "Apri ARCHIVIO dalla barra in basso.",
        "Filtra per struttura, periodo o esito.",
        "Premi su un check-in per vedere il dettaglio.",
        "Scarica i PDF (ricevuta Alloggiati, ricevuta Imposta) e i CSV (Ross 1000).",
    ], MARGIN_X, y, content_w)
    y -= 2 * mm
    draw_screenshot(c, ASSETS / "09_archive.png", MARGIN_X, y, content_w, 90 * mm,
                    caption="Archivio permanente con esito per ogni portale.")
    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 07 TEST/PROD + Tips -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 07", "Modalità TEST / PROD")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "Ogni struttura ha una sua modalità indipendente. TEST è la modalità di default: nessun invio reale ai portali, solo validazione. PROD invia davvero.",
        MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_steps(c, [
        "In Impostazioni → Modifica struttura, sezione Dati Struttura, trovi il toggle MODALITÀ — [TEST] / [PROD].",
        "Tieni una struttura in TEST finché non hai validato almeno un check-in completo senza errori.",
        "Passa a PROD solo quando sei sicuro: gli invii in PROD non possono essere annullati dal pannello.",
    ], MARGIN_X, y, content_w)
    y -= 2 * mm
    y = draw_callout(c, "tip",
        "Suggerimento: la prima settimana lascia tutto in TEST. Fai un check-in finto con un tuo documento e controlla che lo stato finale sia [OK] su Alloggiati e Ross 1000. Solo allora passa in PROD.",
        MARGIN_X, y, content_w)
    y = draw_callout(c, "warn",
        "In PROD, eventuali correzioni a schedine già inviate devono essere fatte direttamente sui portali ufficiali (Alloggiati Web e Ross 1000). Lo storno non è automatizzato.",
        MARGIN_X, y, content_w)
    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- CHAPTER 08 FAQ -------
    page += 1
    draw_bg(c)
    draw_header(c, "Capitolo 08", "FAQ ed errori comuni")
    y = PAGE_H - 35 * mm

    faqs = [
        ("Il pulsante CONTINUA è disabilitato",
         "Mancano credenziali Alloggiati Web o Ross 1000 per quella struttura. Vai in Impostazioni → Modifica struttura e completa le sezioni dedicate."),
        ("L'OCR non riconosce il documento",
         "Verifica che la foto sia nitida, ben illuminata e senza riflessi. Per le carte d'identità con MRZ inquadra anche la parte posteriore. In ultima istanza puoi sempre compilare a mano."),
        ("Errore [ERR] su Alloggiati Web — autenticazione fallita",
         "Controlla Utente, Password e WSKey nelle Impostazioni della struttura. La WSKey è quella rilasciata dalla Questura, non la password normale del portale."),
        ("Errore transitorio (timeout, 5xx)",
         "Niente panico: il sistema riprova automaticamente in background. Controlla lo stato dall'Archivio."),
        ("Non vedo le prenotazioni di Booking nel calendario",
         "Verifica che l'URL iCal incollato in Impostazioni sia quello giusto (deve finire con .ics) e che la struttura sul portale di Booking abbia almeno una prenotazione futura."),
        ("Voglio cambiare l'intestazione delle ricevute Imposta di Soggiorno",
         "Impostazioni → Modifica struttura → Dati Struttura → Proprietario e Codice Fiscale. Le prossime ricevute generate useranno i nuovi dati."),
    ]
    for q, a in faqs:
        c.setFillColor(TEXT)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(MARGIN_X, y, f"› {q}")
        y -= 12
        y = draw_paragraph(c, a, MARGIN_X + 4 * mm, y, content_w - 4 * mm,
                          font="Helvetica", size=9, leading=11.5, color=MUTED)
        y -= 4 * mm

    draw_footer(c, page, total_pages)
    c.showPage()

    # ------- LAST PAGE — Closing -------
    page += 1
    draw_bg(c)
    draw_header(c, "Riepilogo", "In sintesi")
    y = PAGE_H - 35 * mm
    y = draw_paragraph(c,
        "Hai completato il manuale. In poche schermate Dedomo ti permette di gestire tutte le comunicazioni obbligatorie per la tua casa vacanza:",
        MARGIN_X, y, content_w)
    y -= 2 * mm
    bullets = [
        "Alloggiati Web — invio schedine alla Polizia di Stato",
        "Ross 1000 / Turismo 5 — flusso turistico statistico regionale",
        "Imposta di Soggiorno — calcolo ed emissione ricevute PDF",
        "iCal multi-OTA — calendario unificato Booking / Airbnb / Vrbo",
        "Archivio permanente — ricevute scaricabili a distanza di anni",
    ]
    c.setFont("Helvetica", 10)
    for b in bullets:
        c.setFillColor(MUTED)
        c.drawString(MARGIN_X, y, "·")
        c.setFillColor(TEXT)
        c.drawString(MARGIN_X + 5 * mm, y, b)
        y -= 14
    y -= 4 * mm
    y = draw_callout(c, "tip",
        "Consiglio finale: salva questo manuale sul tuo dispositivo. È sempre disponibile dal pulsante 'Scarica Manuale' nella Dashboard e in Impostazioni.",
        MARGIN_X, y, content_w)
    # Branded footer
    c.setFillColor(BORDER)
    c.rect(MARGIN_X, 30 * mm, content_w, 0.4 * mm, fill=1, stroke=0)
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(MARGIN_X, 18 * mm, "DEDOMO")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawRightString(PAGE_W - MARGIN_X, 20 * mm, "Manuale d'uso v1.0  ·  Italiano")
    draw_footer(c, page, total_pages)
    c.showPage()

    c.save()
    return page  # actual page count


if __name__ == "__main__":
    final = build()
    import os
    print(f"OK — {final} pages, {os.path.getsize(OUT)//1024} KB → {OUT}")
