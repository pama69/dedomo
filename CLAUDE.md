# CLAUDE.md — Dedomo

> Letto automaticamente da Claude Code all'avvio. Aggiornare a fine sessione.

---

## Progetto

**Dedomo** — SaaS per affitti brevi in Italia: automatizza adempimenti burocratici (polizia, tassa soggiorno, ricevute) e comunicazione ospiti.

**Owner:** Paolo Manni (non-technical, Windows + VS Code)
**Repo:** `github.com/pama69/dedomo`
**Hosting:** Railway (`vigilant-expression-production.up.railway.app`)
**Deploy:** auto da GitHub push su `main` — **chiedere sempre conferma a Paolo prima di `git push`**

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + Motor (async MongoDB) |
| Database | MongoDB Atlas (cluster0.vs5uc3c.mongodb.net, AWS Frankfurt) |
| Frontend | React 19 + CRA5 + TailwindCSS + shadcn/ui |
| Scheduler | APScheduler |
| OCR | OpenAI GPT-4o-mini Vision — **client-side** (browser → OpenAI diretto) |
| Email | Resend API (`RESEND_API_KEY` + `GUEST_EMAIL_FROM`) |
| Pagamenti | Stripe |
| Hosting | Railway |

---

## Env vars Railway (nessun valore qui)

- `MONGO_URL`, `DB_NAME` — Atlas connection
- `OPENAI_API_KEY` — guest page AI (backend: meteo, eventi, mercati, attrazioni)
- `REACT_APP_OPENAI_API_KEY` — OCR client-side (build-time, esposta al browser — accettato)
- `RESEND_API_KEY`, `GUEST_EMAIL_FROM` — email benvenuto ospiti
- `OPENWEATHERMAP_KEY` — meteo pagina ospite
- `PUBLIC_BACKEND_URL` — URL pubblico app (es. `https://vigilant-expression-production.up.railway.app`)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## Funzionalità implementate

### Alloggiati Web (Polizia)
- Invio SOAP schedine a 168 char posizioni fisse
- Modalità: `standard`, `appartamenti` (IdAppartamento per ogni invio), `appartamenti_file_unico`
- Per account `appartamenti`: IdAppartamento si sceglie a ogni check-in (Step 2 del flusso)
- `lista_appartamenti` usa `Tabella(tipo="ListaAppartamenti")` — può essere vuota se appartamenti creati dalla Questura (usare ID manuale)
- WsKey è base64 ~66-68 chars (NON un GUID da 36 chars)
- Tutti i campi credenziali in Settings sono `type="text"` (non password) per evitare autofill Chrome

### Ross 1000 / Turismo 5 (Regione)
- SOAP regionale, invio movimentazioni
- Formato CSV e SOAP v2

### Imposta di Soggiorno
- Calcolo locale + ricevuta PDF
- Ricevuta inviabile via email al cliente con link PDF pubblico (share_token)

### OCR documenti — CLIENT-SIDE
- `frontend/src/lib/ocr-client.js` — browser chiama `api.openai.com` direttamente con `fetch()`
- Bypassata limitazione Railway (blocca HTTP/2 outbound verso OpenAI)
- Chiave in `REACT_APP_OPENAI_API_KEY` (Railway Variables, build-time)
- Endpoint `/api/ocr/document` **rimosso** da server.py

### Calendario iCal
- Sync da Booking/Airbnb/VRBO tramite iCal URL
- URL iCal personale per ogni struttura

### Flusso Check-in (5 step)
- Step 3: campo email ospite (capofamiglia) opzionale
- Dopo submit: invia automaticamente email benvenuto via Resend se email presente
- Email include link alla pagina ospite personalizzata

### Pagina Ospite (`/guest/:token`)
- Route pubblica, no auth
- Token generato automaticamente dopo ogni check-in (save in `guest_tokens` collection)
- **Dati mostrati:**
  - Meteo locale (OpenWeatherMap) — cache 3h
  - "Cosa succede nei dintorni" — eventi/sagre 50km, solo futuri — cache 24h (refresh se tutti passati)
  - "Prodotti freschi dai contadini" — mercati 15km, posizione precisa (piazza/via specifica) — cache 7d
  - "I nostri suggerimenti per voi" — attrazioni 100km — cache 7d
- **Attrazioni:** immagini da Wikimedia Commons API (parallele, affidabili), link Google Maps, NO Wikipedia come link
- **Mercati:** location precisa → link Google Maps su piazza specifica
- **Loading:** animazione spinner SVG + foglia 🌿 pulsante + 3 pallini verdi rimbalzanti
- **i18n:** it/en/de/fr (rilevato da `paese_nome` ospite Alloggiati)
- **Design:** tema vacanza crema/salvia/beige, CSS animations, Card hover
- AI search: `gpt-4o-mini` con `web_search_preview` (su Railway backend — NON client-side)
- `base_url="https://api.openai.com/v1"` forzato in `guest_page.py` (override OPENAI_BASE_URL)

### Email benvenuto ospite
- Endpoint: `POST /checkins/{id}/send-welcome`
- Provider: Resend (`https://api.resend.com/emails`)
- Log dettagliato: `[RESEND] Invio a ...`, `[RESEND] OK id=...`, `[RESEND] ERRORE ...`
- Multilingue (it/en/de/fr)

### Archivio Invii
- Raggruppato per struttura + mese
- Sotto ogni capofamiglia: link "🔗 Pagina personale ospite" con pulsante "Copia link"
- Link fetcha/crea token via `POST /checkins/{id}/guest-token`
- Bulk delete check-in TEST
- Download PDF ricevute (Alloggiati, Imposta Soggiorno, Locazione)

### Auth
- Emergent Google OAuth ancora attiva (da sostituire con OTP email)
- `input-otp.jsx` shadcn già presente ma non collegato

### Billing
- Stripe subscription
- Trial: 10 invii PROD gratuiti
- Paywall 402 se quota superata

---

## Struttura file chiave

```
backend/
  server.py             — FastAPI, tutti gli endpoint API
  guest_page.py         — meteo, eventi, mercati, attrazioni, token, email Resend
                          fetch_wikimedia_image() — immagini attrazioni da Wikimedia
                          fetch_markets() — 15km, posizione precisa
                          fetch_attractions() — no Wikipedia, enrich parallelo con Wikimedia+Maps
  services/
    alloggiati_web.py   — SOAP Alloggiati Web
    ross1000.py         — CSV/SOAP regionale
    imposta_soggiorno.py
    pdf_service.py      — generazione PDF ricevute
    ocr_service.py      — (mantenuto ma non usato dall'API — OCR è client-side)
    billing.py

frontend/src/
  App.js               — Router + ErrorBoundary + route /guest/:token
  lib/
    api.js             — axios instance baseURL /api
    ocr-client.js      — OCR client-side: fetch() → api.openai.com diretto
  pages/
    Checkin.jsx        — flusso 5 step; Step 3: email ospite; Step 5: link guest page
    Settings.jsx       — strutture/credenziali; tutti i campi type="text" (no autofill)
    GuestPage.jsx      — pagina pubblica ospite (design vacanze, i18n 4 lingue)
    Archive.jsx        — storico check-in + GuestPageLink component
    Dashboard.jsx
```

---

## Gotcha tecnici da ricordare

- **Chrome autofill**: SOLO `type="text"` funziona per impedirlo (type="password" viene sovrascritto indipendentemente da readOnly, autoComplete, random name)
- **Railway outbound**: blocca HTTP/2 verso `api.openai.com` — OCR deve restare client-side; `httpx` HTTP/1.1 funziona (SOAP, Resend, OpenWeatherMap)
- **REACT_APP_***: devono essere in Railway Variables al momento del build (non in `.env.local` locale)
- **OPENAI_BASE_URL**: se impostata (legacy Emergent), sovrascrive la base_url del client — forzare sempre `base_url="https://api.openai.com/v1"` in AsyncOpenAI()
- **Guest page cache**: è per `checkin_id` — nuovi check-in ottengono dati freschi con i prompt aggiornati; quelli vecchi vedono cache fino a scadenza (7d attrazioni/mercati, 24h eventi)
- **Wikimedia images**: chiamate parallele con `asyncio.gather` — 6 immagini in ~1-2s totali

---

## Bug noti / pendenti

- [ ] **Rate limiting spoofabile** — `X-Forwarded-For` falsificabile; usare IP reale Railway
- [ ] **CORS fragile** — irrigidire in produzione
- [ ] **Zeep SOAP ri-istanziato per ogni chiamata** — spostare a livello modulo
- [ ] **Webhook Stripe senza verifica firma come fallback** — rimuovere
- [ ] **Auth Emergent** — ancora attiva; sostituire con OTP email via Resend + `input-otp.jsx` già presente
- [ ] **Migrazione dati** — da MongoDB Emergent ad Atlas proprio (Atlas è quasi vuoto)
- [ ] **Password MongoDB Atlas** — `ItHqVhgqwYWcgQkE` esposta in chat; rigenerare
- [ ] **DNS dedomo.it** — punta ancora a Emergent (IONOS); da spostare su Railway
- [ ] **Railway service name** — rinominare da "vigilant-expression" a "dedomo"
- [ ] **Meteo guest page** — non sempre appare se `comune`/`provincia` non compilati sulla struttura in Settings

---

## Workflow git (regola fissa)

Dopo ogni modifica: `git commit` immediato, poi chiedere a Paolo "pusha?". Il push va eseguito **solo su ok esplicito di Paolo**.

---

## Sessione 2026-06-24

**Fatto:**
- OCR spostato client-side (`ocr-client.js`) — risolto CONNECTION ERROR Railway
- Campo email ospite aggiunto in Checkin.jsx Step 3 (capofamiglia)
- Email benvenuto automatica dopo check-in via Resend — funzionante
- Archivio: link "Pagina personale ospite" sotto ogni capofamiglia con copia link
- Guest page: animazione caricamento, immagini Wikimedia, link Google Maps attrazioni, mercati 15km posizione precisa, titoli caldi 4 lingue, eventi solo futuri

## Sessione 2026-06-25

**Fatto:**
- Risolto deploy Railway fallito: commit `ca6ffa4` aveva corrotto Login.jsx, Register.jsx, ResetPassword.jsx (troncati) e server.py (null bytes)
- File JSX riscritti completi con EyeIcon + PasswordInput (toggle mostra/nascondi password)
- server.py ripulito dai null bytes
- Lock file git (`HEAD.lock`, `index.lock`) rimossi — causavano blocco su `git commit`
- Push completato: commit `9dfeac6` su main → Railway ha fatto redeploy ✅
- Auth: mantenuto solo email + password (rimossa idea OTP — scocciatura inutile)
- Sessioni 30 giorni già implementate — nessun login frequente
- Anti-abuse: blocco domini email usa-e-getta (~300 domini) in registrazione
- Help.jsx: rimossi riferimenti a Google OAuth
- Fix ricevute Alloggiati Web (portato da Emergent):
  - Polling parte da 24h dopo l'invio (non 1h)
  - Soglia retry: da `< 14` a `< 400` (14 giorni × 24 poll)
  - `/admin/refresh-receipts` usa `force_all=True` → bypassa counter e finestra 24h
  - Logica timezone Italy/UTC per `send_date` (DST inline, fallback UTC se date diverse)
- Stripe verificato: webhook `memorable-celebration` punta a `dedomo.it` (attivo, 0% errori)
  - ⚠️ DNS `dedomo.it` ancora su Emergent → webhook va a Emergent, non Railway

**Prossimi passi prioritari:**
1. **Stripe webhook** — aggiornare URL a Railway + Signing Secret in Railway Variables (vedi memory)
2. **Migrare dati** da MongoDB Emergent ad Atlas (Atlas quasi vuoto)
3. **Rigenerare password MongoDB Atlas** — quella attuale è stata esposta in chat
4. **DNS `dedomo.it`** → Railway (da IONOS)
5. **Rename Railway service** da "vigilant-expression" a "dedomo"

**Idee feature future:**
- Check soddisfazione ospite 24h dopo check-out
- Manuale casa digitale con QR code
- Coordinamento pulizie
- AI risposta recensioni
- Generatore contratto locazione breve
