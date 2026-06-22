# CLAUDE.md — Dedomo / Ospitalo

> Questo file viene letto automaticamente da Claude Code all'avvio di ogni sessione.
> Aggiornalo prima di chiudere ogni sessione con: "Aggiorna il CLAUDE.md con i progressi di oggi."

---

## Progetto

**Dedomo** (brand: **Ospitalo**) è un SaaS per la gestione automatizzata di affitti brevi in Italia.
Obiettivo principale: automatizzare gli adempimenti burocratici (registrazione polizia, tassa di soggiorno, ricevute) e la gestione operativa degli annunci.

**Owner:** Paolo (non-technical, lavora da Windows con VS Code)
**Repo GitHub:** `github.com/pama69/dedomo`
**Hosting:** Railway

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Backend | FastAPI + Motor (async MongoDB) |
| Scheduler | APScheduler (processo persistente — motivo per cui Vercel è escluso) |
| Database | MongoDB Atlas |
| Frontend | React 19 + TailwindCSS |
| Pagamenti | Stripe |
| OCR documenti | OpenAI GPT-4o-mini Vision |
| Calendario | iCal sync |
| Hosting | Railway |

---

## Servizi esterni e credenziali (non mettere valori reali qui)

- `OPENAI_API_KEY` — GPT-4o-mini Vision per OCR documenti ospiti
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — billing
- `MONGODB_URI` — Atlas connection string (cambio da env var, zero modifiche al codice)
- `RAILWAY_TOKEN` — deploy
- Credenziali **Alloggiati Web** (Questura) — per ogni struttura, rilasciate manualmente

---

## Funzionalità principali

### 1. Alloggiati Web (Polizia di Stato)
- Formato `.txt` a 168 caratteri per riga, posizioni fisse
- Nessuna API pubblica → accesso via browser automation / RPA
- Login con credenziali Questura (username + password per struttura)
- **Stato:** in sviluppo / da automatizzare completamente

### 2. Ross1000 / Turismo5 (Regione)
- Notifica presenze turistiche regionali
- **Stato:** da integrare

### 3. OCR documenti ospiti
- Foto documento → GPT-4o-mini Vision → estrazione dati strutturati
- Usato per pre-compilare la scheda Alloggiati

### 4. Stripe billing
- Abbonamenti SaaS per strutture
- Webhook per eventi pagamento

### 5. iCal sync
- Sincronizzazione calendari da Airbnb, Booking, ecc.

### 6. Ricevute (Villa Vittoria)
- Generazione PDF ricevute per soggiorni
- Due intestatari: **MANNI** (Paolo Manni) e **BASILE** (Anna M. Basile)
- Tassa di soggiorno: €1,50 × adulti × notti

---

## Bug noti / Fix pendenti

> Aggiorna questa sezione a ogni sessione

- [ ] **Rate limiting spoofabile** — il limite IP legge `X-Forwarded-For` che può essere falsificato dal client. Fix: usare l'IP reale dal proxy Railway.
- [ ] **CORS fragile** — configurazione da irrigidire in produzione.
- [ ] **`giorni_permanenza` troncato silenziosamente** — valori oltre soglia vengono tagliati senza errore.
- [ ] **Webhook Stripe senza verifica firma come fallback** — rimuovere il fallback non verificato.
- [ ] **Zeep SOAP re-instanziato per ogni chiamata** — spostare l'inizializzazione del client a livello di modulo.

---

## Feature in sviluppo

> Aggiorna questa sezione a ogni sessione

- [ ] **Dashboard monitoraggio costi API** — FastAPI router + APScheduler che fa polling periodico dei costi di Stripe, OpenAI, MongoDB Atlas, Railway → salva in `cost_snapshots` (MongoDB) → React dashboard protetta da auth.

---

## Comandi utili

```bash
# Avvio dev backend
uvicorn main:app --reload

# Avvio dev frontend
npm run dev

# Deploy su Railway
railway up
```

---

## Convenzioni di codice

- Python: async/await ovunque con Motor; no operazioni bloccanti nel thread principale
- Variabili d'ambiente: sempre da `.env` / Railway env vars, mai hardcoded
- MongoDB: collection `cost_snapshots` per i dati di monitoraggio costi
- React: componenti funzionali con hooks; no class components

---

## Contesto sessione corrente

> **Sostituisci questa sezione ogni volta che chiudi una sessione.**

Ultima sessione: _(data)_
Cosa abbiamo fatto: _(riepilogo)_
Prossimi passi: _(lista ordinata)_
Blocchi / domande aperte: _(eventuali problemi irrisolti)_
