# PRD — Dedomo

> **MVP completato in data:** 2026-01-30

## Problema originale
> "Sei in grado di scambiare dati con i portali alloggiati web e Ross 1000 per la comunicazione dei dati di ospiti nelle case vacanza?"

## Obiettivo
Tool web (non gestionale completo) per host di case vacanza italiane per inviare le comunicazioni obbligatorie degli ospiti a:
1. **Alloggiati Web** (Polizia di Stato) — SOAP web service
2. **Ross 1000** (Regione, partendo da Abruzzo, architettura universale)
3. **Imposta di Soggiorno** comunale (calcolo + ricevuta PDF)

## User persona
Host singolo che gestisce **più unità immobiliari** (anche di persone diverse), accede con il proprio Google, configura credenziali separate per ogni struttura, e compie check-in rapidi multipli.

## Stack tecnologico
- **Backend**: FastAPI + Motor + MongoDB
- **Frontend**: React 19 + TailwindCSS + react-router-dom v7
- **Auth**: Emergent Google OAuth (managed)
- **OCR**: GPT-5.2 Vision via Emergent Universal LLM Key (`emergentintegrations`)
- **SOAP client**: `zeep` (per Alloggiati Web)
- **PDF**: `reportlab` (per ricevute imposta di soggiorno)

## Architettura

### Backend (`/app/backend/`)
- `server.py` — FastAPI principale con tutti gli endpoint
- `services/alloggiati_web.py` — SOAP client + builder schedine 168-char fixed-width
- `services/ross1000.py` — CSV generator + HTTP submitter configurabile
- `services/imposta_soggiorno.py` — calcolo imposta con esenzioni per età
- `services/ocr_service.py` — vision OCR con prompt italiano + supporto MRZ
- `services/pdf_service.py` — ricevuta PDF brandizzata

### Frontend (`/app/frontend/src/`)
- `pages/Login.jsx` — landing con login Google
- `pages/AuthCallback.jsx` — gestione redirect OAuth
- `pages/Dashboard.jsx` — pulsante CHECK IN gigante + riepilogo strutture + ultimi invii
- `pages/Checkin.jsx` — wizard 5 step: date → proprietà → OCR/ospiti → riepilogo → esito
- `pages/Settings.jsx` — CRUD strutture con tutte le credenziali
- `pages/Archive.jsx` — storico permanente con download PDF/CSV
- `components/Layout.jsx` — wrapper con header + bottom nav
- `components/BottomNav.jsx` — navigazione persistente in basso (no icone)

## Design system
Vedi `/app/design_guidelines.json`.
- Tema **scuro minimale** (background `#05050A`, surface `#0E0E14`)
- Tipografia: **Cabinet Grotesk** (headings) + **Geist** (body) + **Geist Mono** (dati/credenziali)
- **NO icone, NO immagini, NO emoji** ovunque
- Bottom nav fisso sempre visibile
- Bottoni rettangolari (border-radius: 0), uppercase tracking-widest
- Status indicators in stile console: `[ OK ]`, `[ ERR ]`, `[ SKIP ]`, `[ TEST ]`, `[ PROD ]`

## Funzionalità implementate (MVP)
- [x] Login Google (Emergent Auth) — cookie httpOnly secure samesite=none
- [x] CRUD strutture multi-proprietà con credenziali separate per portale
- [x] Toggle modalità TEST/PROD per proprietà (indipendente)
- [x] Wizard check-in 5 step con OCR documento (GPT-5.2 + MRZ)
- [x] Invio Alloggiati Web (SOAP): GenerateToken + Test/Send + Ricevuta PDF
- [x] Ross 1000: CSV manuale (default) + REST JSON + SOAP XML configurabili
- [x] Imposta di Soggiorno: calcolo con esenzioni età + max notti + PDF ricevuta
- [x] Archivio permanente con download PDF/CSV anche a mesi/anni di distanza
- [x] Linguaggio italiano completo
- [x] Testato: **22/22 test backend passati al 100%**

## Test coverage (iteration_1.json)
22 test pytest coprono: health, auth, properties CRUD, OCR (live), check-in submission a 3 portali, esenzione minori, archive, PDF download, CSV download, logout.

## Backlog / Prossimi step

### P1 (alta priorità)
- [ ] Verificare invio reale con credenziali Alloggiati Web dell'utente (TEST mode prima)
- [ ] Documentazione tecnica Ross 1000 Abruzzo da utente: se REST/SOAP, configurare endpoint preciso
- [ ] Endpoint comunale per imposta di soggiorno (specifico per Comune dell'utente)
- [ ] Codici comuni nascita ISTAT (lookup tabella per `codice_comune_nascita`)
- [ ] Codici stato ISO3 (lookup paesi)

### P2 (media priorità)
- [ ] Mappare errori OCR a 4xx invece di 500 (testing agent feedback)
- [ ] Logout via Bearer token (parità con `get_current_user`)
- [ ] POST proprietà → status 201 invece di 200
- [ ] Calcolo età con `dateutil.relativedelta` per anni bisestili
- [ ] Splittare `server.py` in routers/ quando supera ~700 righe

### P3 (nice-to-have / futuro)
- [ ] Import ospiti da CSV/Excel
- [ ] Notifiche email su esito invio
- [ ] Dashboard analytics (occupazione, fatturato imposta, statistiche)
- [ ] Multi-utente con ruoli (admin/operatore per gestire più team)
- [ ] Mobile-first PWA installabile
- [ ] Storno/correzione schedine già inviate
