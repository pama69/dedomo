# CLAUDE.md — Dedomo

> Letto automaticamente da Claude Code all'avvio. Aggiornare a fine sessione.

---

## 📌 Sessione corrente — 2026-06-27

**Tema:** Billing — gestione 3DS upgrade, fix splash conferma, raccolta P.IVA checkout, pagina Termini.

**Stato:** pushato su `main` — 3 commit in questo branch.

**🆕 Fatto in questa sessione:**

### Stripe — 3D Secure upgrade in-app
- **Backend** (`routes_billing.py`): catch `stripe.error.CardError` con `code == "authentication_required"` → HTTP 402
- **Frontend** (`Pricing.jsx`): intercetta status 402, mostra messaggio e auto-redirect al Customer Portal dopo 1.5s; fallback con istruzioni manuali se la chiamata portal fallisce

### Fix splash conferma upgrade ("- proprietà")
- Aggiunto stato `upgradedQty` in `Pricing.jsx`: calcolato come `currentPaid + num` prima dell'API call, aggiornato con il valore reale dopo il refresh quota
- Elimina race condition tra `setUpgraded(true)` e `setQuota(r.data)` (React non batchava i due setState in catene async separate)

### Checkout — raccolta Partita IVA cliente
- `billing.py`: aggiunto `tax_id_collection={"enabled": True}` alla sessione Stripe Checkout
- Il cliente può inserire P.IVA (o CF) opzionale; compare sulla ricevuta Stripe

### Pagina Termini di utilizzo
- Creato `frontend/src/pages/Terms.jsx` — 11 articoli in italiano (descrizione servizio, abbonamento, pagamenti, limitazione responsabilità, foro Pescara)
- Route `/terms` aggiunta in `App.js`
- URL Stripe: `https://www.dedomo.it/terms`

**🔎 Configurazioni Stripe manuali da fare (Paolo):**
- Settings → Billing → Subscriptions and emails → **Attiva 3D Secure** (toggle OFF → ON)
- Settings → Billing → Subscriptions and emails → **Stato abbonamento**: abbassare da 15 giorni a 1 giorno
- Settings → Attività → Dati dell'account → cambiare nome visualizzato da "Paolo Manni" a "Dedomo"
- Settings → Attività → Dati fiscali → inserire Partita IVA
- In test mode le email **non arrivano** (comportamento Stripe by design) — verificare in live mode
- Raccolta P.IVA in checkout: già attiva dopo il push odierno

**🔎 Azioni manuali pendenti (Paolo):**
- Rigenerare password MongoDB Atlas (esposta in chat mesi fa)
- Spostare DNS `dedomo.it` → Railway (ora su IONOS→Emergent)
- Dopo test: sostituire chiavi Stripe test con live in Railway

**Cronologia dettagliata:** vedi `## Archivio sessioni` in fondo.

---

## Progetto

**Dedomo** — SaaS per affitti brevi in Italia: automatizza adempimenti burocratici (polizia, tassa soggiorno, ricevute) e comunicazione ospiti.

**Owner:** Paolo Manni (non-technical, Windows + VS Code)
**Repo:** `github.com/pama69/dedomo`
**Hosting:** Railway (`dedomo.up.railway.app`)
**Deploy:** auto da GitHub push su `main` — **chiedere sempre conferma a Paolo prima di `git push`**

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + Motor (async MongoDB) |
| Database | MongoDB Atlas (cluster0.vs5uc3c.mongodb.net, AWS Frankfurt) |
| Frontend | React 19 + CRA5 + TailwindCSS + shadcn/ui |
| Scheduler | APScheduler |
| OCR | OpenAI GPT-4o-mini Vision — **server-side** (`services/ocr_service.py`) |
| Email | Resend API (`RESEND_API_KEY` + `GUEST_EMAIL_FROM`) |
| Pagamenti | Stripe |
| Hosting | Railway |

---

## Env vars Railway (nessun valore qui)

- `MONGO_URL`, `DB_NAME` — Atlas connection
- `OPENAI_API_KEY` — guest page AI (backend: meteo, eventi, mercati, attrazioni) + OCR backend
- `RESEND_API_KEY`, `GUEST_EMAIL_FROM` — email benvenuto ospiti
- `OPENWEATHERMAP_KEY` — meteo pagina ospite
- `PUBLIC_BACKEND_URL` — URL pubblico app (es. `https://dedomo.up.railway.app`)
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

### OCR documenti — BACKEND
- `services/ocr_service.py` — chiama OpenAI Vision server-side con `OPENAI_API_KEY`
- `POST /api/ocr` — endpoint autenticato (flusso check-in normale in `Checkin.jsx`)
- `POST /api/public/remote-checkin/{token}/ocr` — endpoint pubblico (form ospite remoto, validato via token)
- `frontend/src/lib/ocr-client.js`: `extractDocumentClient()` → `/api/ocr`; `extractDocumentPublic(token,...)` → endpoint pubblico
- `REACT_APP_OPENAI_API_KEY` non è più necessaria — OCR è interamente server-side

### Remote Check-in
- Flow: host crea → ospite riceve email → compila form → host rivede → autorizza → invio 23:59 ora italiana
- `remote_checkins` collection MongoDB: `status` enum `sent/submitted/authorized/sending/done/failed`
- `POST /remote-checkins` — crea, invia email con link token
- `POST /api/public/remote-checkin/{token}/submit` — ospite invia dati (pubblico)
- `POST /remote-checkins/{id}/authorize` — host autorizza; schedula invio alle 23:59 del `data_arrivo`
- `POST /remote-checkins/{id}/cancel-schedule` — reverte a `submitted`
- APScheduler job ogni 2 min: `_process_scheduled_remote_checkins()` con optimistic locking
- `components/NewRemoteCheckinModal.jsx` — modal condiviso tra Dashboard e Archive
- `pages/RemoteCheckin.jsx` — form pubblico ospite con OCR, autocomplete comuni/paesi, date GG/MM/AAAA
- Notifica push all'host al submit ospite (`send_push()`)

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
- **Dati mostrati (nell'ordine):**
  - **🏡 La tua casa** — manuale della struttura (vedi sezione dedicata sotto)
  - Meteo locale (OpenWeatherMap) — cache 3h
  - "Cosa succede nei dintorni" — eventi/sagre 50km, solo futuri — cache 24h (refresh se tutti passati)
  - "Prodotti freschi dai contadini" — mercati 15km, posizione precisa (piazza/via specifica) — cache 7d
  - "I nostri suggerimenti per voi" — attrazioni 100km — cache **48h** (rotazione durante il soggiorno)
- **Attrazioni — immagini:** Wikipedia REST API + search fallback (tollera titoli imprecisi GPT) + User-Agent `Dedomo/1.0` (Railway veniva bloccato con 403 senza UA descrittivo). **Fallback Unsplash** (`UNSPLASH_ACCESS_KEY`) per luoghi senza pagina Wiki. Cache rigenerata se URL non sono né `wikimedia.org` né `images.unsplash.com`. Link Google Maps (no Wikipedia link)

### Manuale Casa (`/settings/properties/:id/manual`)
- Sezioni strutturate: Wi-Fi, check-in, check-out, raccolta rifiuti, parcheggio, emergenze
- Sezioni libere personalizzate con emoji picker (20 icone), titolo, testo, riordinabili
- Mostrato nella guest page con QR code Wi-Fi (lib `qrcode.react`), bottone "Copia password"
- Traduzione automatica GPT-4o-mini in en/de/fr, cache per hash sha1 dei testi traducibili (`house_manual.translations[hash][lang]`). Cambio contenuto → hash cambia → cache stale → rigenerazione on-demand
- Campi vuoti nascosti automaticamente
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
  guest_page.py         — meteo, eventi, mercati, attrazioni, token, email Resend, manuale casa
                          fetch_wikimedia_image() — REST API + search fallback + UA Dedomo
                          fetch_unsplash_image() — fallback per luoghi senza pagina Wiki
                          fetch_markets() — 15km, posizione precisa
                          fetch_attractions() — Wiki + Unsplash + Google Maps, enrich parallelo
                          translate_manual() — GPT-4o-mini en/de/fr con cache per hash
  services/
    alloggiati_web.py   — SOAP Alloggiati Web
    ross1000.py         — CSV/SOAP regionale
    imposta_soggiorno.py
    pdf_service.py      — generazione PDF ricevute
    ocr_service.py      — OCR server-side: chiamato da /api/ocr e /api/public/remote-checkin/{token}/ocr
    billing.py

frontend/src/
  App.js               — Router + ErrorBoundary + route /guest/:token
  lib/
    api.js             — axios instance baseURL /api
    ocr-client.js      — OCR client-side: fetch() → api.openai.com diretto
  pages/
    Landing.jsx        — route "/" pubblica; anonimi → /landing.html, loggati → /dashboard
    Privacy.jsx        — pagina privacy pubblica (linkata da landing) — URL: /privacy
    Terms.jsx          — pagina termini di utilizzo pubblica — URL: /terms
    Checkin.jsx        — flusso 5 step; OCR client-side, guestWarnings() valida campi sospetti
    Settings.jsx       — strutture/credenziali; pulsante "Manuale" per ogni proprietà
    HouseManual.jsx    — pagina manuale casa per ospite (Wi-Fi, check-in/out, custom)
    GuestPage.jsx      — pagina pubblica ospite (design vacanze, i18n 4 lingue, sezione casa)
    Archive.jsx        — "Archivio invii generale"; mesi collassati di default; pulsante verde recupera ricevute; sezione remote collassata
    Dashboard.jsx      — hero check-in, remote check-in, SystemStatus (health check reale), SystemEventLog (ultimi 10 eventi)
    RemoteCheckin.jsx  — form pubblico ospite: OCR, autocomplete comuni/paesi, date GG/MM/AAAA
  components/
    NewRemoteCheckinModal.jsx — modal condiviso Dashboard+Archive per creare remote check-in
  public/
    landing.html       — landing pubblica autocontenuta (immagini base64, font CDN, 214KB)
```

---

## Gotcha tecnici da ricordare

- **Chrome autofill**: SOLO `type="text"` funziona per impedirlo (type="password" viene sovrascritto indipendentemente da readOnly, autoComplete, random name)
- **Railway outbound HTTP/2**: `httpx` HTTP/1.1 funziona (SOAP, Resend, OpenWeatherMap, OpenAI SDK). OCR è ora backend — nessun problema perché `openai` Python SDK usa HTTP/1.1
- **REACT_APP_***: devono essere in Railway Variables al momento del build (non in `.env.local` locale). `REACT_APP_OPENAI_API_KEY` non è più necessaria (OCR spostato a backend)
- **OPENAI_BASE_URL**: se impostata (legacy Emergent), sovrascrive la base_url del client — forzare sempre `base_url="https://api.openai.com/v1"` in AsyncOpenAI()
- **Guest page cache**: è per `checkin_id` — nuovi check-in ottengono dati freschi con i prompt aggiornati; quelli vecchi vedono cache fino a scadenza (48h attrazioni, 7d mercati, 24h eventi, 3h meteo)
- **Wikimedia images**: chiamate parallele con `asyncio.gather` — 6 immagini in ~1-2s totali. **REST API summary** prima, search API come fallback per titoli imprecisi
- **Wikipedia 403 da Railway**: Wikimedia banna IP cloud senza User-Agent descrittivo — usare `Dedomo/1.0 (https://dedomo.it; pama69@gmail.com) python-httpx`
- **Manuale casa — translations cache**: chiave = sha1 dei *soli testi traducibili* (Wi-Fi pwd/orari/email non li invalidano). Cambio testo → hash diverso → ritraduzione automatica al prossimo render in lingua non-it
- **Aggiungere dipendenze frontend**: il progetto usa Yarn (vedi `packageManager` in package.json e `yarn.lock`). Conflitto peer `date-fns@4` vs `react-day-picker@8.10.1` pre-esistente blocca `npm install`; usare `npm install <pkg> --legacy-peer-deps` solo per aggiornare `yarn.lock` (e poi rimuovere `package-lock.json` se generato). Railway build usa Yarn

---

## Bug noti / pendenti

- [ ] **Password MongoDB Atlas** — esposta in chat mesi fa; rigenerare manualmente su Atlas
- [ ] **DNS dedomo.it** — punta ancora a Emergent (IONOS); da spostare su Railway
- [ ] **Auth Emergent** — ancora attiva; sostituire con OTP email via Resend + `input-otp.jsx` già presente
- [ ] **Migrazione dati** — da MongoDB Emergent ad Atlas proprio (Atlas è quasi vuoto)
- [ ] **Meteo guest page** — non sempre appare se `comune`/`provincia` non compilati sulla struttura in Settings
- [ ] **GDPR formale** — policy di retention implementata tecnicam.; manca DPO/avvocato per redazione registro trattamenti e riscontro formale art. 30

## Sicurezza implementata

- ✅ **Rate limiting** — `_RateLimiter` sliding window in-memory: auth 10/min, OCR 5/min, public 20/min
- ✅ **Security headers** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- ✅ **CORS** — origini esplicite (`dedomo.up.railway.app`, `dedomo.it`); override via `CORS_ORIGINS` env
- ✅ **MongoDB indexes** — checkins, properties, remote_checkins, users, guest_tokens, subscriptions
- ✅ **Zeep singleton** — client SOAP creato una volta sola (risparmia download WSDL)
- ✅ **Webhook Stripe** — firma obbligatoria (`STRIPE_WEBHOOK_SECRET`), rimosso fallback non verificato
- ✅ **Stripe Emergent proxy** — rimosso, usa sempre `api.stripe.com`
- ✅ **GDPR — informativa remoto** — box espandibile it/en/de/fr con base art. 6(1)(c) nel form ospite
- ✅ **GDPR — cancellazione account** — `DELETE /auth/account` elimina tutte le collections; anonimizza payment_transactions
- ✅ **GDPR — retention 3 anni** — job APScheduler mensile (1° del mese 03:00) anonimizza checkins e pulisce remote_checkins >3 anni
- ✅ **Settings — Zona pericolosa** — cancellazione account con doppia conferma

---

## Workflow git (regola fissa)

Dopo ogni modifica: `git commit` immediato, poi chiedere a Paolo "pusha?". Il push va eseguito **solo su ok esplicito di Paolo**.

---

## Archivio sessioni

> Cronologia dettagliata delle sessioni passate. Per lo stato corrente del progetto vedi il blocco "📌 Sessione corrente" in cima al file.

### Sessione 2026-06-24

**Fatto:**
- OCR spostato client-side (`ocr-client.js`) — risolto CONNECTION ERROR Railway
- Campo email ospite aggiunto in Checkin.jsx Step 3 (capofamiglia)
- Email benvenuto automatica dopo check-in via Resend — funzionante
- Archivio: link "Pagina personale ospite" sotto ogni capofamiglia con copia link
- Guest page: animazione caricamento, immagini Wikimedia, link Google Maps attrazioni, mercati 15km posizione precisa, titoli caldi 4 lingue, eventi solo futuri

### Sessione 2026-06-25 (mattina)

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
- ~~Manuale casa digitale con QR code~~ ✅ implementato 2026-06-25
- Coordinamento pulizie
- AI risposta recensioni
- Generatore contratto locazione breve
- Anteprima live del manuale casa (modal con rendering uguale a guest page + selettore lingua per testare traduzioni GPT prima che le veda un ospite)
- Storico modifiche manuale casa (versioning per dispute con ospiti / ripristino in caso di errore)
- Test connessione Ross 1000 in Settings (analogo al test Alloggiati esistente)

---

### Sessione 2026-06-25 (pomeriggio)

**Fix guest page — immagini attrazioni:**
- `fetch_wikimedia_image` riscritta: prima REST API summary, poi search API come fallback (tollera titoli imprecisi di GPT, redirect, varianti)
- Aggiunto User-Agent `Dedomo/1.0 (pama69@gmail.com)` alle chiamate Wikipedia — Railway senza UA descrittivo veniva bloccato con **403 Forbidden** da Wikimedia (ban IP cloud)
- Invalidazione cache `has_legacy_image`: se le attrazioni in cache hanno URL non-Wikimedia/Unsplash (URL allucinati da GPT in 404), la cache viene rigenerata immediatamente ignorando il TTL
- TTL attrazioni: da 168h → **48h**, così l'ospite vede suggerimenti diversi durante il soggiorno
- **Fallback Unsplash** quando Wikipedia non ha foto (cantine, tour gastronomici): `fetch_unsplash_image` con env `UNSPLASH_ACCESS_KEY` (50 req/h gratis). Cache valida sia per `wikimedia.org` che per `images.unsplash.com`

**Ross 1000 / Turismo 5 — campi documento obbligatori:**
- Aggiunti al payload SOAP arrivoBean (mancavano!): `tipodocumento`, `numerodocumento`, `statodocumento` (codice ISTAT 9 cifre da `stato_rilascio_documento`)
- CSV fallback: colonna `stato_rilascio_documento` aggiunta, `stato_residenza` ora prende `cittadinanza` (era sempre vuota)

**Landing page pubblica ripristinata** (da repo separata `dedomo-emergent` creata via Emergent per evitare sovrascritture):
- `public/landing.html` autocontenuta (214KB, immagini base64, font da CDN)
- `pages/Landing.jsx` → redirect a `landing.html` per anonimi, `/dashboard` per loggati
- `pages/Privacy.jsx` (linkata dalla landing)
- Route `/` ora mostra Landing (era `Navigate to /dashboard`), route `/privacy` aggiunta

**Validazione OCR campi sospetti** (`Checkin.jsx`):
- `guestWarnings(g)` evidenzia in giallo (non blocca): cognome/nome/numero documento mancanti, data nascita futura o oltre 120 anni, numero documento <4 char
- Bordo ambra + label `⚠ <motivo>` sotto il campo

**Sicurezza minore:**
- Rimosso `console.log` che stampava prefix `REACT_APP_OPENAI_API_KEY` nel browser

**🔑 Manuale Casa (feature grossa):**
- **Backend** (`server.py` + `guest_page.py`):
  - Nuovi modelli Pydantic: `HouseManual`, `WifiInfo`, `CheckinTimes`, `CheckoutTimes`, `SimpleTextSection`, `CustomSection`
  - Aggiunto `house_manual` come campo di `PropertyCreate` (default vuoto, retro-compatibile)
  - Endpoint dedicato `PUT /api/properties/{id}/manual` (salva solo il manuale, azzera cache traduzioni)
  - `translate_manual()`: GPT-4o-mini per en/de/fr, cache in `properties.house_manual.translations[<sha1(testi)>][lang]`. Italiano → ritorno diretto. Se OpenAI fail → fallback all'italiano (non rompe pagina ospite)
  - `_manual_content_hash()` su hashlib.sha1: cambia solo se i testi traducibili cambiano (Wi-Fi pwd non lo invalida)
  - `/api/guest/{token}` ora include `house_manual` già tradotto
- **Frontend Settings** (`Settings.jsx`):
  - Pulsante **"Manuale"** accanto a "Modifica" per ogni proprietà → naviga a `/settings/properties/:id/manual`
- **Pagina dedicata** (`pages/HouseManual.jsx`, ~360 righe):
  - 6 sezioni strutturate: Wi-Fi (SSID+password), check-in (from/to/note), check-out (by/note), rifiuti, parcheggio, emergenze
  - Sezioni custom riordinabili (↑/↓), emoji picker da 20 icone, titolo max 30 char, textarea max 500 char con counter
  - Save bar sticky in fondo con timestamp "✓ Salvato hh:mm:ss"
- **Frontend GuestPage** (`GuestPage.jsx`):
  - Nuova sezione **🏡 La tua casa** PRIMA del meteo (è la cosa più utile)
  - `WifiCard`: SSID+password monospace, bottone "Copia password" con feedback "Copiato!", **QR code WPA** (`qrcode.react@4.2.0`) — l'iPhone si collega scansionandolo
  - `InfoCard`: una per ogni sezione compilata (vuote nascoste). `whiteSpace: "pre-wrap"` per rispettare a-capo dell'utente
  - i18n: titoli sezione tradotti in it/en/de/fr direttamente nel client; contenuto tradotto via GPT lato server
- **Dipendenza nuova**: `qrcode.react@4.2.0` (peer-deps Yarn ok, conflitto npm `date-fns` pre-esistente → risolto con `--legacy-peer-deps` solo per generare yarn.lock; package-lock.json rimosso dal commit)
- Test logica hash superato (3 casi limite)

**🔧 Workflow:**
- Confermato che il push su GitHub usa già OAuth Railway → niente più token PAT richiesti. Aggiornata memoria `dedomo-credentials.md`
- Memoria sessione: aggiunta regola "alla fine di ogni conversazione, proporre un miglioramento relativo al tema trattato"

**🌐 Env vars Railway aggiunte:**
- `UNSPLASH_ACCESS_KEY` (fallback immagini attrazioni) — confermata da Paolo

**Commit della giornata (da 7256ae2):**
1. `34a8966` fix: immagini attrazioni Wikipedia + OCR client-side
2. `597960e` fix: campi documento obbligatori Ross 1000
3. `f254537` fix: User-Agent Wikipedia (risolve 403)
4. `d99d47d` feat: TTL attrazioni ridotto a 48h
5. `bd49481` feat: ripristino landing + pagina privacy
6. `45ef208` fix: rigenera cache URL legacy non-Wikimedia
7. `c2a432e` feat: fallback immagini Unsplash
8. `bcf2bc4` chore: rimosso console.log API key OCR
9. `8b41607` feat: validazione campi OCR sospetti
10. `aa588f4` feat: manuale casa (Wi-Fi+QR, check-in/out, custom, traduzioni GPT)

**Verifiche residue richieste da Paolo:**
- Test Ross 1000 alla prima check-in in produzione (verificare che `tipodocumento`/`numerodocumento`/`statodocumento` arrivino bene a Turismo 5 Abruzzo)
- Anteprima landing già verificata via preview_start (rendering ok, link `/login` e `/privacy` puntano a route esistenti)

---

### Sessione 2026-06-26

**Archivio — scheda ospite:**
- Commit `7889443`: ogni ospite del check-in mostra data nascita (`n. gg/mm/aaaa`) e nazionalità in una riga sotto nome/cognome/documento. Layout a `div` separati per guest (prima era un unico `<span>` comma-separated)

**Guest page — Wikimedia + Google Maps + UX:**
- Immagini attrazioni: `fetch_wikimedia_image()` — REST API summary + search fallback, User-Agent `Dedomo/1.0`, cache invalida se URL non sono `wikimedia.org`/`images.unsplash.com`
- Link attrazioni: `maps_url` (Google Maps) invece di Wikipedia
- Loading: spinner SVG + emoji pulsante + pallini rimbalzanti
- Mercati: 15km, posizione precisa, link Google Maps
- i18n: "Scopri di più" tradotto in 4 lingue, titoli sezioni caldi (eventi/mercati/attrazioni)

**Email Resend (debug):**
- 401 causato da API key con whitespace invisibile incollata in Railway — risolto rigenerando la key
- Aggiunto logging `[RESEND]` dettagliato in `send_welcome_email` (status, corpo errore, ID ricevuta)

**Numerazione progressiva ricevute (`Archive.jsx`):**
- Commit `dba2012`: due helper puri `nextComuneNum` / `nextLocazioneNum` calcolano max+1 da `items` già caricati (zero API call extra)
- `nextLocazioneNum`: parsa formato `RL-YYYY/NNN`, filtra per anno corrente via year in formato o `data_emissione`
- `GenerateReceiptButton`: `onClick` setta `numero = String(suggestedNumero)` prima di aprire il form; hint "◎ suggerito" sotto il campo
- `GenerateLocazioneButton`: toggle `autoNumero` rimane; quando si deseleziona e campo è vuoto, pre-riempie con `suggestedNumero`; hint mostrato

**Commit della sessione (prima parte):**
1. `7889443` feat: archivio ospiti - data nascita e nazionalità nella scheda dettaglio
2. `dba2012` feat(archive): numerazione progressiva ricevute IS e Locazione

**Seconda parte sessione — Remote Check-in:**
- **OCR spostato a backend**: `services/ocr_service.py` già esisteva con OpenAI Vision; aggiunto `POST /api/ocr` (autenticato) e `POST /api/public/remote-checkin/{token}/ocr` (pubblico). `REACT_APP_OPENAI_API_KEY` non serve più
- **Dashboard**: bottone rosso-ombreggiato "Check-in Remoto" sotto il pulsantone principale → apre `NewRemoteCheckinModal` direttamente
- **`NewRemoteCheckinModal`**: estratto in `frontend/src/components/NewRemoteCheckinModal.jsx` (condiviso tra Dashboard e Archive). `useEffect` per settare `propertyId` quando `properties` carica (fix bottone disabilitato)
- **Invio programmato 23:59**: `authorize_remote_checkin` calcola 23:59 Europe/Rome il giorno di arrivo (ZoneInfo), salva `scheduled_for`; APScheduler job ogni 2 min esegue i dovuti
- **Annulla schedule**: `POST /remote-checkins/{id}/cancel-schedule` → reverte a `submitted`; bottone "ANNULLA" nel box rosso in Archive
- **Push notification**: `send_push()` all'host quando ospite compila il form
- **Date di nascita GG/MM/AAAA**: componente `DateDMY` (tre input numerici) in `RemoteCheckin.jsx` — sostituisce `type="date"`
- **Email invito**: ridisegnata con header verde scuro gradient, saluto italiano caldo, istruzioni chiare, nota procedura manuale, multilingue
- **OCR blink**: "Analisi del documento in corso…" rosso + `animate-ocr-blink` durante scansione
- **Autocomplete fix**: debounce 200ms, indicatore ambra lampeggiante, "Nessun risultato — prova un'altra grafia"
- **Auto-risoluzione ISTAT** dopo OCR estero: query `/paesi?q=<nome>` immediata, `isValid()` accetta anche solo `paese_nome` senza codice ISTAT
- Commit remoto: `dbeb6b5` — pushato

**Verifiche residue:**
- Test Ross 1000 al primo check-in PROD
- Se rinomina Railway "vigilant-expression": aggiornare `PUBLIC_BACKEND_URL` in Railway Variables

---

### Sessione 2026-06-27

**Tema:** Billing — 3DS, fix splash upgrade, P.IVA checkout, Termini di utilizzo.

**Commit:**
1. `c3864c0` Fix: gestione 3DS upgrade e quantità corretta nella splash di conferma
2. `2dbe8e8` Checkout: abilita raccolta Partita IVA/codice fiscale cliente
3. `18baff1` Aggiungi pagina Termini di utilizzo a /terms

**Stripe SDK — Gotcha:**
- `StripeObject` eredita da `dict` → `stripe_sub.items` restituisce `dict.items()` (builtin), NON gli items dell'abbonamento. Usare sempre `stripe_sub["items"]` (accesso dict-style)
- `updated_sub.current_period_end` lancia `AttributeError("current_period_end")` se la chiave non esiste nella response. Usare sempre `.get()` per tutti gli attributi Stripe
- `proration_behavior="always_invoice"` crea E addebita immediatamente la fattura pro-rata (vs `create_prorations` che la accoda al prossimo rinnovo annuale)
- `payment_behavior="error_if_incomplete"` blocca l'upgrade se il pagamento fallisce (no upgrade gratuiti)
- In test mode Stripe **non manda email** a nessun indirizzo — comportamento by design, verificare solo in live mode

**Configurazioni Stripe da completare (Paolo):**
- Attivare toggle 3D Secure (Settings → Billing → Subscriptions and emails)
- Ridurre retry da 15 giorni a 1 giorno (stessa pagina → Stato abbonamento)
- Cambiare nome visualizzato da "Paolo Manni" a "Dedomo" (Settings → Attività)
- Inserire Partita IVA (Settings → Attività → Dati fiscali)
- URL privacy: `https://www.dedomo.it/privacy` ✅
- URL termini: `https://www.dedomo.it/terms` ✅
