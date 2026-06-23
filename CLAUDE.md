# CLAUDE.md — Dedomo

> Letto automaticamente da Claude Code all'avvio. Aggiornare a fine sessione.

---

## Progetto

**Dedomo** — SaaS per affitti brevi in Italia: automatizza adempimenti burocratici (polizia, tassa soggiorno, ricevute) e comunicazione ospiti.

**Owner:** Paolo Manni (non-technical, Windows + VS Code)
**Repo:** `github.com/pama69/dedomo`
**Hosting:** Railway (`vigilant-expression-production.up.railway.app`)
**Deploy:** auto da GitHub push su `main`

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + Motor (async MongoDB) |
| Database | MongoDB Atlas (proprio, non Emergent) |
| Frontend | React 19 + TailwindCSS |
| Scheduler | APScheduler |
| OCR | OpenAI GPT-4o-mini Vision |
| Email | Resend API (dominio `dedomo.it` già verificato) |
| Pagamenti | Stripe |
| Hosting | Railway |

---

## Env vars Railway (nessun valore qui)

- `MONGO_URL`, `DB_NAME` — Atlas connection
- `OPENAI_API_KEY` — OCR + guest page AI
- `RESEND_API_KEY`, `GUEST_EMAIL_FROM` — email ospiti
- `OPENWEATHERMAP_KEY` — meteo pagina ospite
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## Funzionalità implementate

### Alloggiati Web (Polizia)
- Invio SOAP schedine a 168 char posizioni fisse
- Modalità: `standard`, `appartamenti` (IdAppartamento per ogni invio), `appartamenti_file_unico`
- Per account `appartamenti`: IdAppartamento si sceglie a ogni check-in (Step 2 del flusso)
- `lista_appartamenti` usa `Tabella(tipo="ListaAppartamenti")` — può essere vuota se appartamenti creati dalla Questura (usare ID manuale in quel caso)
- WsKey è base64 ~66-68 chars (NON un GUID da 36 chars)
- Campi credenziali in Settings hanno `readOnly`+`onFocus` anti-autofill Chrome

### Ross 1000 / Turismo 5 (Regione)
- SOAP regionale, invio movimentazioni
- Formato CSV e SOAP v2

### Imposta di Soggiorno
- Calcolo locale + ricevuta PDF
- Endpoint comune configurabile per struttura

### OCR documenti
- Foto → GPT-4o-mini Vision → dati strutturati pre-compilati
- Compressione immagine lato client (max 1600px, 78% quality)

### Calendario iCal
- Sync da Booking/Airbnb/VRBO tramite iCal URL
- URL iCal personale per ogni struttura

### Pagina Ospite (Progetto 2)
- Route pubblica `/guest/:token` — no auth richiesta
- Token generato automaticamente in background dopo ogni check-in
- Mostra: meteo locale (OpenWeatherMap), eventi/sagre 50km, mercatini 30km, attrazioni 100km
- AI search tramite GPT-4o-mini `web_search_preview`
- Cache MongoDB: meteo 3h, eventi 24h, mercatini/attrazioni 7d
- Design vacanze: crema/salvia/beige, CSS animations
- i18n: it/en/de/fr (rilevato da `paese_nome` ospite)
- Email benvenuto tramite Resend

### Auth
- Emergent Google OAuth ancora attiva (da sostituire con OTP email)
- `public/index.html` ripulito da script Emergent (era la causa della pagina bianca su Railway)
- ErrorBoundary in `App.js` mostra errori JS invece di pagina bianca

### Billing
- Stripe subscription
- Trial: 10 invii PROD gratuiti
- Paywall a 402 se quota superata

---

## Struttura file chiave

```
backend/
  server.py          — FastAPI, tutti gli endpoint API
  guest_page.py      — logica pagina ospite (weather, events, token, email)
  services/
    alloggiati_web.py  — SOAP Alloggiati Web (generate_token, send_schedine, lista_appartamenti)
    ross1000.py        — CSV/SOAP regionale
    turismo5.py        — SOAP regionale alternativo
    imposta_soggiorno.py
    pdf_service.py     — generazione PDF ricevute
    ocr_service.py
    billing.py
frontend/src/
  App.js             — Router + ErrorBoundary + route /guest/:token
  pages/
    Checkin.jsx       — flusso 5 step check-in (Step 2: selezione appartamento se multi-apt)
    Settings.jsx      — gestione strutture/credenziali
    GuestPage.jsx     — pagina pubblica ospite (design vacanze)
    Archive.jsx       — storico check-in
    Dashboard.jsx
  lib/api.js         — axios instance con baseURL /api
```

---

## Bug noti / pendenti

- [ ] **Rate limiting spoofabile** — `X-Forwarded-For` falsificabile; usare IP reale Railway
- [ ] **CORS fragile** — irrigidire in produzione
- [ ] **Zeep SOAP ri-istanziato per ogni chiamata** — spostare a livello modulo
- [ ] **Webhook Stripe senza verifica firma come fallback** — rimuovere fallback non verificato
- [ ] **Auth Emergent** — ancora attiva; sostituire con OTP email via Resend + `input-otp.jsx` già presente
- [ ] **Migrazione dati** — da MongoDB Emergent a Atlas proprio (non ancora fatto)
- [ ] **Password MongoDB Atlas** — `ItHqVhgqwYWcgQkE` esposta in chat precedente; rigenerare
- [ ] **DNS dedomo.it** — punta ancora a Emergent (IONOS); da spostare su Railway quando stabile
- [ ] **Railway service name** — rinominare da "vigilant-expression" a "dedomo"
- [ ] **Email benvenuto** — manca campo email ospite nel flusso check-in; da aggiungere

---

## Sessione corrente — 2026-06-23

**Fatto:**
- Fix pagina bianca post-login (rimosso script `emergent-main.js` da `index.html`)
- Fix iCal URL in Settings (rimane in edit mode dopo primo salvataggio)
- Implementato Progetto 2 completo (pagina ospite: meteo, eventi, mercatini, attrazioni)
- Fix selezione appartamento multi-ID in check-in Step 2
- Fix campi credenziali non si aggiornano (autofill Chrome → `readOnly`+`onFocus`)
- Fix lista appartamenti mostra errore reale invece di "lista vuota" quando token fallisce
- WsKey ora visibile in chiaro (era type=password, browser la riscriveva)
- Debug WsKey nel test credenziali (first8/last8, has_plus, has_equals)

**Prossimi passi:**
1. Testare pagina ospite end-to-end (`/guest/{token}` dopo check-in)
2. Aggiungere campo email ospite al flusso check-in per invio email benvenuto
3. Sostituire auth Emergent con OTP email (Resend + `input-otp.jsx`)
4. Migrare dati da MongoDB Emergent ad Atlas
5. Rigenerare password MongoDB Atlas (esposta)
