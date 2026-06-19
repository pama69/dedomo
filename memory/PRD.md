# PRD — Dedomo / Ospitalo

> **Ultimo aggiornamento:** 2026-06-19

## Problema originale
Tool web per host di case vacanza italiane: comunicazione obbligatoria ospiti a **Alloggiati Web** (Polizia di Stato, SOAP), **Ross 1000 / Turismo 5** (Regione, SOAP), generazione **Imposta di Soggiorno** PDF, sincronizzazione **iCal** (Booking/Airbnb/Vrbo), **Super Admin** panel, OCR documenti via **GPT-4o-mini Vision** (Emergent LLM Key).

## User persona
Host che gestisce **più unità immobiliari** (anche di proprietari diversi), accede con Google, configura credenziali separate per ogni struttura, fa check-in rapidi multipli.

## Stack tecnologico
- **Backend**: FastAPI + Motor + MongoDB, APScheduler, Zeep (SOAP), ReportLab, icalendar, PyMuPDF, Stripe SDK
- **Frontend**: React 19 + TailwindCSS + react-router-dom v7
- **Auth**: Emergent Google OAuth (managed) — cookie httpOnly + Authorization Bearer
- **OCR**: GPT-4o-mini Vision via Emergent Universal LLM Key (`emergentintegrations`)
- **Pagamenti**: Stripe Checkout (subscription mode, EUR, Tax Rate manuale IVA 22%)

## Architettura
```
/app/
├── backend/
│   ├── server.py (FastAPI main: auth, checkins, SOAP, admin, calendar, scheduler)
│   ├── routes_billing.py (Stripe Checkout/Portal/Webhook)
│   └── services/
│       ├── alloggiati_web.py · ross1000.py · turismo5.py
│       ├── ocr_service.py · pdf_service.py · locazione_pdf.py
│       ├── calendar_service.py · retry_service.py
│       └── billing.py (Stripe wrapper)
└── frontend/src/pages/
    ├── Login.jsx · Dashboard.jsx · Checkin.jsx (wizard 5 step)
    ├── Settings.jsx · Archive.jsx · OwnerArchive.jsx · Owners.jsx
    ├── Calendar.jsx · Admin.jsx · Help.jsx
    ├── Pricing.jsx · BillingSuccess.jsx
    └── components/PaywallModal.jsx · PrivacyModal.jsx · Layout.jsx
```

## Funzionalità implementate
- [x] Login Google (Emergent Auth) + IP rate-limit registrazione + admin whitelist
- [x] CRUD strutture multi-proprietà, modalità TEST/PROD per struttura
- [x] Wizard check-in con OCR (compressione client-side + GPT-4o-mini Vision)
- [x] Alloggiati Web SOAP + Ricevuta PDF + cache Luoghi
- [x] Turismo 5 / Ross 1000 SOAP v2 (Abruzzo) + retry automatico
- [x] Imposta di Soggiorno: calcolo + ricevuta PDF brandizzata
- [x] Ricevute di Locazione PDF + numerazione auto per CF + marca da bollo €2
- [x] Layout ricevute Imposta e Locazione **allineato**: `[Stampa] [Prepara PDF] [Invia] [Elimina]` — 2026-06-19 ✅
- [x] iCal sync (Booking/Airbnb/Vrbo) import + export Personal + prenotazioni manuali
- [x] iCal export: HEAD method supportato (compatibile Airbnb/Booking/Vrbo) — 2026-06-16
- [x] Super Admin (`/admin`): metriche, lista utenti, disabilita/abilita + **toggle Illimitato** — 2026-06-17
- [x] Background scheduler: PDF fetch, iCal refresh, retry errori transient
- [x] **Stripe Subscription**: piani annuali (1ª €19.99, 2ª-10ª €9.99) + IVA 22% + Customer Portal + webhook firmato — 2026-06-17
- [x] **Quota gating**: 5 invii PROD gratuiti, paywall modal su HTTP 402 — 2026-06-17
- [x] **Superuser pama69@gmail.com** auto-flagged `unlimited` — 2026-06-17
- [x] **Privacy Consent GDPR**: checkbox obbligatorio in Step 4 check-in, modale con informativa completa, timestamp salvato in DB (server + client) — 2026-06-19
- [x] **Turismo 5 XML fix**: aggiunti `cognome/nome` e default `tipoturismo/mezzotrasporto` — 2026-06-10

## Backlog

### P1
- [ ] Refactor `server.py` (3500+ righe) in `/app/backend/routes/`
- [ ] Refactor `Checkin.jsx` (1200+ righe) in sotto-componenti per step
- [ ] Configurare custom domain `www.dedomo.it` su Ionos (in corso)

### P2
- [ ] Notifiche email (Resend) su esito invio + reminder rinnovo abbonamento
- [ ] Dashboard analytics admin (MRR/churn/proprietà attive)
- [ ] Stripe Tax automatico (sostituire Tax Rate manuale 22%)
- [ ] Import ospiti CSV/Excel
- [ ] Landing Page Builder per ogni proprietà (sottodominio + CNAME)

### P3
- [ ] PWA installabile mobile-first
- [ ] Multi-utente con ruoli (operatore/admin)
- [ ] Storno/correzione schedine già inviate

## Test credentials
Vedi `/app/memory/test_credentials.md`. L'app NON gestisce password — Google OAuth via Emergent.

## Note critiche per agent
- **NIENTE `window.confirm()`**: usare modal inline custom (sandbox iframe lo blocca)
- **NIENTE download blob: diretti**: usare `data:` URL o XHR fetch
- **Modelli Pydantic SEMPRE a livello modulo**, mai dentro closure (Pydantic 2.13 + FastAPI rompe il forwarding)
- **Stripe key LIVE in produzione**: cambi richiedono ricreazione di Product/Price/TaxRate (clear `app_config.stripe_resources`)
- **iCal endpoint deve supportare HEAD** (Airbnb/Booking/Vrbo lo richiedono)
- **Privacy consent obbligatorio** per `/api/checkin/submit` — validato prima di property lookup
