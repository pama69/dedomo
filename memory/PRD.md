# PRD — Dedomo / Ospitalo

> **Ultimo aggiornamento:** 2026-06-03

## Problema originale
Tool web per host di case vacanza italiane: comunicazione obbligatoria ospiti a **Alloggiati Web** (Polizia di Stato, SOAP), **Ross 1000 / Turismo 5** (Regione, SOAP), generazione **Imposta di Soggiorno** PDF, sincronizzazione **iCal** (Booking/Airbnb/Vrbo), **Super Admin** panel, OCR documenti via **GPT-4o-mini Vision** (Emergent LLM Key).

## User persona
Host che gestisce **più unità immobiliari** (anche di proprietari diversi), accede con Google, configura credenziali separate per ogni struttura, fa check-in rapidi multipli.

## Stack tecnologico
- **Backend**: FastAPI + Motor + MongoDB, APScheduler, Zeep (SOAP), ReportLab, icalendar, PyMuPDF
- **Frontend**: React 19 + TailwindCSS + react-router-dom v7
- **Auth**: Emergent Google OAuth (managed) — cookie httpOnly + Authorization Bearer
- **OCR**: GPT-4o-mini Vision via Emergent Universal LLM Key (`emergentintegrations`)
- **Image compression**: client-side max 1600px prima upload OCR

## Architettura
```
/app/
├── backend/
│   ├── server.py (FastAPI main: auth, checkins, SOAP routing, admin, calendar, scheduler)
│   └── services/
│       ├── alloggiati_web.py (SOAP client + cache Luoghi/Paesi)
│       ├── ross1000.py / turismo5.py (SOAP v2 XML)
│       ├── ocr_service.py (GPT-4o-mini Vision)
│       ├── pdf_service.py (ReportLab Imposta Soggiorno)
│       ├── calendar_service.py (iCal parsing/export)
│       └── retry_service.py (transient SOAP retry job)
└── frontend/src/pages/
    ├── Login.jsx · AuthCallback.jsx · Dashboard.jsx
    ├── Checkin.jsx (wizard 5 step + OCR)
    ├── Settings.jsx (credenziali per struttura)
    ├── Archive.jsx · OwnerArchive.jsx · Owners.jsx
    ├── Calendar.jsx (iCal multi-OTA)
    └── Admin.jsx (super-admin panel)
```

## Funzionalità implementate
- [x] Login Google (Emergent Auth)
- [x] CRUD strutture multi-proprietà, modalità TEST/PROD per struttura
- [x] Wizard check-in con OCR (compressione client-side + GPT-4o-mini)
- [x] Alloggiati Web SOAP: GenerateToken + Test/Send + Ricevuta PDF + cache Luoghi
- [x] Turismo 5 / Ross 1000 SOAP v2 (Abruzzo) + retry automatico
- [x] Imposta di Soggiorno: calcolo + ricevuta PDF brandizzata (proprietario, CF, breakdown esenti)
- [x] Mapping automatico ospite straniero (cittadinanza, stato nascita via Luoghi)
- [x] Autocomplete comuni / paesi fast da cache memoria
- [x] iCal sync (Booking/Airbnb/Vrbo) import + export Personal + prenotazioni manuali
- [x] Super Admin (`/admin`): metriche, lista utenti, disabilita/abilita inline
- [x] Background scheduler: PDF fetch, iCal refresh, retry errori transient
- [x] Niente `window.confirm()` / niente download `blob:` diretti (sandbox iframe)
- [x] **Hard block check-in se credenziali Alloggiati o Ross1000 mancanti** (frontend + backend) — 2026-06-03
- [x] **Manuale utente PDF** (13 pp, IT, tema scuro) — endpoint `/api/manual/download` + bottoni "Scarica Manuale" in Dashboard e Impostazioni — 2026-06-03

## Backlog

### P1
- [ ] Refactor `server.py` (2740 righe) in `/app/backend/routers/` (auth, properties, checkins, calendar, admin, alloggiati, turismo5)
- [ ] Refactor `Checkin.jsx` (1167 righe) in sotto-componenti per step
- [ ] Test end-to-end con credenziali reali Alloggiati + Turismo 5 in modalità PROD

### P2
- [ ] Notifiche email su esito invio (Resend)
- [ ] Dashboard analytics (occupazione, fatturato imposta)
- [ ] Storno/correzione schedine già inviate
- [ ] Import ospiti CSV/Excel

### P3
- [ ] PWA installabile mobile-first
- [ ] Multi-utente con ruoli (operatore/admin)

## Test credentials
Vedi `/app/memory/test_credentials.md`. L'app NON gestisce password — Google OAuth via Emergent.

## Note critiche per agent
- **NIENTE `window.confirm()`**: usare modal inline custom (sandbox iframe lo blocca)
- **NIENTE download blob: diretti**: usare `data:` URL o XHR fetch
- Admin protetto da whitelist email in `ADMIN_EMAILS` (.env)
- APScheduler attivo: PDF fetch, iCal sync, retry SOAP transient
- **Check-in bloccato senza credenziali**: frontend disabilita "CONTINUA →" allo step 2; backend `/api/checkin/submit` ritorna `400 missing_credentials`
