"""
Dedomo - Main FastAPI app.
Backend per invio dati ospiti case vacanza ai portali Alloggiati Web,
Ross 1000 e Imposta di Soggiorno comunale.
"""

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import base64
import uuid
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta, date

# Service imports
from services.ocr_service import extract_document_data
from services.alloggiati_web import (
    build_schedina,
    generate_token,
    test_schedine,
    send_schedine,
    get_ricevuta_pdf,
    authentication_test,
    lista_appartamenti,
    aggiungi_appartamento,
    cerca_comuni,
    cerca_comuni_fast,
    cerca_stato,
    cerca_paesi,
    ISO3_TO_ITALIAN_NAME,
    TIPO_OSPITE_SINGOLO,
    TIPO_CAPO_FAMIGLIA,
    TIPO_FAMILIARE,
    TIPO_CAPO_GRUPPO,
    TIPO_MEMBRO_GRUPPO,
    TIPO_DOC_MAP,
)
from services.ross1000 import build_movimenti_csv, submit_to_endpoint
from services.turismo5 import (
    REGIONAL_ENDPOINTS,
    send_movimentazione,
    map_country_iso3_to_code,
    ITALIA_CODE,
)
from services.imposta_soggiorno import calcola_imposta
from services.pdf_service import generate_tax_receipt, generate_comune_receipt
from services.retry_service import (
    classify_error,
    build_retry_entry,
    is_due_for_retry,
    MAX_ATTEMPTS,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Dedomo API")
api_router = APIRouter(prefix="/api")


# ====================================================================
# AUTH (Emergent Google OAuth)
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
# THIS BREAKS THE AUTH
# ====================================================================

EMERGENT_AUTH_SESSION_URL = (
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
)


async def get_current_user(request: Request) -> Dict[str, Any]:
    """Validate session via cookie first, then Authorization header fallback."""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Non autenticato")

    session = await db.user_sessions.find_one(
        {"session_token": token}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Sessione non valida")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sessione scaduta")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    if user.get("disabled"):
        raise HTTPException(status_code=403, detail="Account disabilitato")
    return user


ADMIN_EMAILS = set(
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
)


async def get_admin_user(user=Depends(get_current_user)) -> Dict[str, Any]:
    """Same as get_current_user but enforces that the user's email is in the
    ADMIN_EMAILS whitelist."""
    email = (user.get("email") or "").lower()
    if not ADMIN_EMAILS or email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Accesso amministratore richiesto")
    return user


class SessionRequest(BaseModel):
    session_id: str


@api_router.post("/auth/session")
async def auth_session(req: SessionRequest, response: Response):
    """Exchange Emergent session_id for our session_token."""
    try:
        r = requests.get(
            EMERGENT_AUTH_SESSION_URL,
            headers={"X-Session-ID": req.session_id},
            timeout=15,
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Sessione non valida")
        data = r.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Errore Auth: {str(e)}")

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing and existing.get("disabled"):
        raise HTTPException(status_code=403, detail="UTENTE DISABILITATO")
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": data.get("name"),
                "picture": data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {
        "user_id": user_id,
        "email": email,
        "name": data.get("name"),
        "picture": data.get("picture"),
        "is_admin": (email or "").lower() in ADMIN_EMAILS,
    }


@api_router.get("/auth/me")
async def auth_me(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user.get("name"),
        "picture": user.get("picture"),
        "is_admin": (user.get("email") or "").lower() in ADMIN_EMAILS,
    }


@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"success": True}


# ====================================================================
# PROPERTIES
# ====================================================================

class AlloggiatiCredentials(BaseModel):
    utente: str = ""
    password: str = ""
    ws_key: str = ""
    tipo_account: str = "standard"  # standard | appartamenti | appartamenti_file_unico
    id_appartamento: Optional[int] = None  # None = not set; 0 is a valid value
    enabled: bool = True


class Ross1000Credentials(BaseModel):
    regione: str = "Abruzzo"
    utente: str = ""
    password: str = ""
    endpoint_url: str = ""  # auto-filled from REGIONAL_ENDPOINTS if blank
    format: str = "soap_v2"  # soap_v2 | csv_manual
    codice_struttura: str = ""
    nome_prodotto: str = "Dedomo"
    n_camere: int = 1
    n_letti: int = 2
    enabled: bool = True


class ImpostaSoggiornoConfig(BaseModel):
    tariffa_per_notte: float = 0.0
    max_notti_tassabili: int = 7
    esenti_under_anni: int = 12
    endpoint_comune: str = ""
    enabled: bool = True


class CalendarConfig(BaseModel):
    """External iCal URLs to import bookings from."""
    booking_ical_url: str = ""
    airbnb_ical_url: str = ""
    vrbo_ical_url: str = ""
    # Color (hex) chosen by user for visualization on the calendar.
    color: str = "#10b981"  # default emerald
    # Token for the personal export URL (unguessable).
    export_token: str = Field(default_factory=lambda: uuid.uuid4().hex)


class PropertyCreate(BaseModel):
    nome: str
    indirizzo: str = ""
    comune: str = ""
    provincia: str = ""
    cap: str = ""
    cin: str = ""
    tipologia: str = "Casa Vacanza"
    proprietario: str = ""
    codice_fiscale: str = ""
    mode: str = "TEST"  # TEST | PROD
    alloggiati: AlloggiatiCredentials = AlloggiatiCredentials()
    ross1000: Ross1000Credentials = Ross1000Credentials()
    imposta_soggiorno: ImpostaSoggiornoConfig = ImpostaSoggiornoConfig()
    calendar: CalendarConfig = CalendarConfig()


class Property(PropertyCreate):
    model_config = ConfigDict(extra="ignore")
    property_id: str = Field(default_factory=lambda: f"prop_{uuid.uuid4().hex[:12]}")
    user_id: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@api_router.get("/properties")
async def list_properties(user=Depends(get_current_user)):
    props = await db.properties.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(1000)
    return props


@api_router.post("/properties")
async def create_property(body: PropertyCreate, user=Depends(get_current_user)):
    prop = Property(user_id=user["user_id"], **body.model_dump())
    await db.properties.insert_one(prop.model_dump())
    return prop.model_dump()


@api_router.get("/properties/{property_id}")
async def get_property(property_id: str, user=Depends(get_current_user)):
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Proprietà non trovata")
    return p


@api_router.put("/properties/{property_id}")
async def update_property(
    property_id: str, body: PropertyCreate, user=Depends(get_current_user)
):
    result = await db.properties.update_one(
        {"property_id": property_id, "user_id": user["user_id"]},
        {"$set": body.model_dump()},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Proprietà non trovata")
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return p


@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user=Depends(get_current_user)):
    result = await db.properties.delete_one(
        {"property_id": property_id, "user_id": user["user_id"]}
    )
    return {"success": result.deleted_count > 0}


@api_router.post("/properties/{property_id}/alloggiati/appartamenti")
async def list_alloggiati_apartments(
    property_id: str, user=Depends(get_current_user)
):
    """List the apartments registered on Alloggiati Web for this account.
    Used to let the user pick the correct IdAppartamento for the property.
    """
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Proprietà non trovata")
    cfg = p.get("alloggiati", {})
    if not cfg.get("utente") or not cfg.get("password") or not cfg.get("ws_key"):
        raise HTTPException(400, "Credenziali Alloggiati Web mancanti")

    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    if not tok["success"]:
        return {"success": False, "message": tok.get("message")}
    res = lista_appartamenti(cfg["utente"], tok["token"])
    return res


class NewAppartamento(BaseModel):
    descrizione: str
    comune_codice: str
    indirizzo: str
    proprietario: str


@api_router.post("/properties/{property_id}/alloggiati/appartamenti/nuovo")
async def add_alloggiati_apartment(
    property_id: str,
    body: NewAppartamento,
    user=Depends(get_current_user),
):
    """Create a new apartment on Alloggiati Web."""
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Proprietà non trovata")
    cfg = p.get("alloggiati", {})
    if not cfg.get("utente") or not cfg.get("password") or not cfg.get("ws_key"):
        raise HTTPException(400, "Credenziali Alloggiati Web mancanti")

    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    if not tok["success"]:
        return {"success": False, "message": tok.get("message")}
    res = aggiungi_appartamento(
        cfg["utente"],
        tok["token"],
        body.descrizione,
        body.comune_codice,
        body.indirizzo,
        body.proprietario,
    )
    if res.get("success"):
        # Refresh list to get the new IdAppartamento
        lst = lista_appartamenti(cfg["utente"], tok["token"])
        res["appartamenti"] = lst.get("appartamenti", [])
    return res


@api_router.get("/properties/{property_id}/alloggiati/comuni")
async def search_alloggiati_comuni(
    property_id: str, q: str = "", user=Depends(get_current_user)
):
    """Search ISTAT municipalities by name (uses Alloggiati Web tabella Luoghi)."""
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Proprietà non trovata")
    cfg = p.get("alloggiati", {})
    if not cfg.get("utente") or not cfg.get("password") or not cfg.get("ws_key"):
        raise HTTPException(400, "Credenziali Alloggiati Web mancanti")

    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    if not tok["success"]:
        return {"success": False, "message": tok.get("message")}
    return cerca_comuni(cfg["utente"], tok["token"], q)


@api_router.get("/properties/{property_id}/alloggiati/paesi")
async def search_alloggiati_paesi(
    property_id: str, q: str = "", user=Depends(get_current_user)
):
    """Fast autocomplete for foreign countries (uses cached 'Luoghi' table).
    Returns only foreign countries (no Italian comuni)."""
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Proprietà non trovata")
    cfg = p.get("alloggiati", {})
    if not cfg.get("utente") or not cfg.get("password") or not cfg.get("ws_key"):
        raise HTTPException(400, "Credenziali Alloggiati Web mancanti")

    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    if not tok["success"]:
        return {"success": False, "message": tok.get("message")}
    return cerca_paesi(cfg["utente"], tok["token"], q, limit=15)


@api_router.get("/properties/{property_id}/alloggiati/comuni-fast")
async def search_alloggiati_comuni_fast(
    property_id: str, q: str = "", user=Depends(get_current_user)
):
    """Fast autocomplete for Italian comuni (uses cached 'Luoghi' table)."""
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Proprietà non trovata")
    cfg = p.get("alloggiati", {})
    if not cfg.get("utente") or not cfg.get("password") or not cfg.get("ws_key"):
        raise HTTPException(400, "Credenziali Alloggiati Web mancanti")

    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    if not tok["success"]:
        return {"success": False, "message": tok.get("message")}
    return cerca_comuni_fast(cfg["utente"], tok["token"], q, limit=15)


class GuessLocationRequest(BaseModel):
    luogo_nascita: str = ""
    cittadinanza: str = ""
    stato_nascita: str = ""
    is_foreign: bool = False


@api_router.post("/properties/{property_id}/alloggiati/guess-codici")
async def guess_codici(
    property_id: str,
    body: GuessLocationRequest,
    user=Depends(get_current_user),
):
    """Resolve textual place/country names to ISTAT/Stati codes for a check-in form.

    For Italian guests: looks up `luogo_nascita` (city) in 'Luoghi' table → comune code.
    For foreign guests: looks up `stato_nascita` (country) in 'Luoghi' table → country code.
    """
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Proprietà non trovata")
    cfg = p.get("alloggiati", {})
    if not cfg.get("utente") or not cfg.get("password") or not cfg.get("ws_key"):
        raise HTTPException(400, "Credenziali Alloggiati Web mancanti")

    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    if not tok["success"]:
        return {"success": False, "message": tok.get("message")}

    out = {"success": True, "is_foreign": body.is_foreign}

    # FOREIGN guest: resolve country (state) code, skip comune
    if body.is_foreign:
        paese = body.stato_nascita or body.cittadinanza
        if paese:
            r = cerca_stato(cfg["utente"], tok["token"], paese)
            if r.get("success") and r.get("codice"):
                out["stato_match"] = {
                    "codice": r["codice"],
                    "nome": r["nome"],
                }
        # Also resolve cittadinanza separately if different
        if body.cittadinanza and body.cittadinanza != body.stato_nascita:
            r2 = cerca_stato(cfg["utente"], tok["token"], body.cittadinanza)
            if r2.get("success") and r2.get("codice"):
                out["cittadinanza_match"] = {
                    "codice": r2["codice"],
                    "nome": r2["nome"],
                }
        return out

    # ITALIAN guest: resolve comune by luogo_nascita (existing logic)
    if body.luogo_nascita:
        import re as _re
        cleaned = _re.sub(r"\([^)]*\)", "", body.luogo_nascita).strip()
        m = _re.search(r"\(([A-Za-z]{2})\)", body.luogo_nascita)
        hinted_prov = m.group(1).upper() if m else ""

        r = cerca_comuni(cfg["utente"], tok["token"], cleaned or body.luogo_nascita)
        if r.get("success") and r.get("results"):
            q = (cleaned or body.luogo_nascita).strip().upper()
            best = None
            if hinted_prov:
                best = next(
                    (x for x in r["results"]
                     if x["nome"].upper() == q and x["provincia"].upper() == hinted_prov),
                    None,
                )
            if not best:
                best = next((x for x in r["results"] if x["nome"].upper() == q), None)
            if not best:
                best = r["results"][0]
            out["comune_match"] = best

    iso_to_code = {"ITA": "100000100", "ITALIA": "100000100", "IT": "100000100"}
    if body.cittadinanza:
        out["cittadinanza_code"] = iso_to_code.get(
            body.cittadinanza.upper(), body.cittadinanza
        )
    if body.stato_nascita:
        out["stato_nascita_code"] = iso_to_code.get(
            body.stato_nascita.upper(), body.stato_nascita
        )
    return out


@api_router.post("/properties/{property_id}/turismo5/test")
async def test_turismo5_credentials(
    property_id: str, user=Depends(get_current_user)
):
    """Quick credentials test for Turismo 5 / Ross 1000.

    Sends an empty movimentazione (no movimenti) to validate endpoint reachability + Basic Auth.
    Returns detailed response for debugging.
    """
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Proprietà non trovata")
    cfg = p.get("ross1000", {})
    if not cfg.get("utente") or not cfg.get("password"):
        raise HTTPException(400, "Credenziali Turismo 5 mancanti")
    if not cfg.get("codice_struttura"):
        raise HTTPException(400, "Codice struttura mancante")

    regione = cfg.get("regione", "Abruzzo")
    endpoint_url = cfg.get("endpoint_url") or REGIONAL_ENDPOINTS.get(regione, "")
    if not endpoint_url:
        raise HTTPException(400, f"Endpoint per regione '{regione}' non configurato")

    # Send a movimentazione with realistic but harmless test data.
    # An empty movimenti=[] would let the server return 200 without validating auth/code.
    # A real-looking past-date movement with 0 occupancy forces the server to actually
    # validate credentials + struttura code without polluting historical data.
    test_movimento = [{
        "data": "1999-01-01",  # well in the past, won't be accepted as a real movement
        "struttura": {
            "apertura": "NO",
            "camereoccupate": 0,
            "cameredisponibili": int(cfg.get("n_camere", 1)),
            "lettidisponibili": int(cfg.get("n_letti", 1)),
        },
    }]
    resp = send_movimentazione(
        endpoint_url=endpoint_url,
        username=cfg["utente"],
        password=cfg["password"],
        codice_struttura=cfg["codice_struttura"],
        movimenti=test_movimento,
        prodotto=cfg.get("nome_prodotto", "Dedomo"),
        test_mode=False,
    )
    logger.info(f"[T5-TEST] response: status={resp.get('status_code')} ok={resp.get('success')}")
    return {
        "success": resp.get("success"),
        "endpoint": endpoint_url,
        "status_code": resp.get("status_code"),
        "message": resp.get("message"),
        "response_preview": (resp.get("response_text") or "")[:500],
    }


@api_router.get("/turismo5/regioni")
async def list_regioni():
    """Return the supported regions and their default endpoints."""
    return [
        {"regione": name, "endpoint": url}
        for name, url in REGIONAL_ENDPOINTS.items()
    ]


@api_router.post("/properties/{property_id}/alloggiati/test")
async def test_alloggiati_credentials(
    property_id: str, user=Depends(get_current_user)
):
    """Quick credentials test: GenerateToken + Authentication_Test.
    Also, if account is 'appartamenti' with an IdAppartamento set, runs a dry Test
    with the configured ID to verify it's valid.
    """
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Proprietà non trovata")
    cfg = p.get("alloggiati", {})
    if not cfg.get("utente") or not cfg.get("password") or not cfg.get("ws_key"):
        raise HTTPException(400, "Credenziali Alloggiati Web mancanti")

    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    logger.info(f"[AW-TEST] GenerateToken raw response: {tok.get('raw')}")
    if not tok["success"]:
        return {
            "success": False,
            "step": "GenerateToken",
            "message": tok.get("message"),
            "raw": tok.get("raw"),
        }

    auth = authentication_test(cfg["utente"], tok["token"])
    logger.info(f"[AW-TEST] Authentication_Test raw response: {auth.get('raw')}")
    if not auth["success"]:
        return {
            "success": False,
            "step": "Authentication_Test",
            "message": auth.get("message") or "Auth test fallito",
            "raw": auth.get("raw"),
        }

    response = {
        "success": True,
        "step": "Authentication_Test",
        "token_expires": tok.get("expires"),
        "message": "Credenziali valide",
    }

    # Run a dummy Test call to validate that the schedina format is accepted.
    # This is the BEST way to confirm the account category + tracciato.
    tipo_account = cfg.get("tipo_account", "standard")
    id_app_raw = cfg.get("id_appartamento")
    id_app = int(id_app_raw) if id_app_raw is not None else None
    id_app_set = id_app is not None  # 0 is valid; only None means "not set"

    # Build a dummy schedina with realistic Italian values
    dummy = build_schedina(
        tipo_alloggiato="16",
        data_arrivo="2099-12-31",
        giorni_permanenza=1,
        cognome="ROSSI",
        nome="MARIO",
        sesso="1",  # M
        data_nascita="1980-01-15",
        codice_comune_nascita="H501",  # Roma ISTAT code (placeholder)
        sigla_provincia_nascita="RM",
        codice_stato_nascita="100000100",  # ITA
        codice_stato_cittadinanza="100000100",
        tipo_documento="IDENT",
        numero_documento="AA0000000",
        codice_stato_rilascio_doc="100000100",
        id_appartamento_file_unico=str(id_app) if (tipo_account == "appartamenti_file_unico" and id_app_set) else "",
    )
    ts = test_schedine(
        cfg["utente"], tok["token"], [dummy],
        tipo_account=tipo_account,
        id_appartamento=id_app if id_app_set else 0,
    )
    logger.info(f"[AW-TEST] Test schedina raw: {ts.get('raw')}")
    response["test_schedina"] = {
        "tipo_account_used": tipo_account,
        "id_appartamento_used": id_app if id_app_set else None,
        "schedina_length": len(dummy),
        "valid": ts.get("success"),
        "message": ts.get("message"),
        "details": ts.get("details"),
    }
    if not ts.get("success"):
        response["success"] = False
        response["message"] = f"Schedina rifiutata: {ts.get('message')}"

    return response


# ====================================================================
# OCR
# ====================================================================

class OcrRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"


@api_router.post("/ocr/document")
async def ocr_document(req: OcrRequest, user=Depends(get_current_user)):
    """Extract guest data from a document photo."""
    result = await extract_document_data(req.image_base64, req.mime_type)
    if not result.get("success"):
        raise HTTPException(500, result.get("error", "OCR fallito"))
    return result["data"]


# ====================================================================
# CHECK-IN SUBMISSION
# ====================================================================

class GuestData(BaseModel):
    cognome: str
    nome: str
    sesso: str  # M | F (mapped to 1/2 internally)
    data_nascita: str  # YYYY-MM-DD
    luogo_nascita: str = ""
    stato_nascita: str = "100000100"  # ITA codice (9-digit) for italians, foreign code for foreigners
    cittadinanza: str = "100000100"
    tipo_documento: str = "IDENT"  # codice 5 char
    numero_documento: str = ""
    stato_rilascio_documento: str = "100000100"
    codice_comune_nascita: str = ""  # 9 chars ISTAT code (only italians, empty for foreigners)
    sigla_provincia_nascita: str = ""  # 2 chars (only italians, empty for foreigners)
    is_foreign: bool = False  # True if guest is foreign (cittadinanza ≠ ITA)
    paese_nome: str = ""  # Italian country name (for display/receipt, e.g. "ALBANIA")


class CheckinSubmit(BaseModel):
    property_id: str
    data_arrivo: str  # YYYY-MM-DD
    data_partenza: str  # YYYY-MM-DD
    guests: List[GuestData]


def _guest_to_schedina(
    g: GuestData, tipo_alloggiato: str, data_arrivo: str, giorni: int,
    id_appartamento_file_unico: str = "",
) -> str:
    tipo_doc = TIPO_DOC_MAP.get(g.tipo_documento, "IDENTITA")
    # Only capo/singolo have document fields; familiare/gruppo skip
    if tipo_alloggiato in (TIPO_FAMILIARE, TIPO_MEMBRO_GRUPPO):
        tipo_doc_field = ""
        num_doc_field = ""
        stato_ril_field = ""
    else:
        tipo_doc_field = tipo_doc
        num_doc_field = g.numero_documento
        # For foreigners: document released by their own country (= stato_nascita)
        stato_ril_field = g.stato_rilascio_documento or g.stato_nascita

    # For FOREIGN guests: clear comune/provincia, only stato_nascita is filled
    if g.is_foreign:
        codice_comune = ""
        sigla_prov = ""
    else:
        codice_comune = g.codice_comune_nascita
        sigla_prov = g.sigla_provincia_nascita

    return build_schedina(
        tipo_alloggiato=tipo_alloggiato,
        data_arrivo=data_arrivo,
        giorni_permanenza=giorni,
        cognome=g.cognome,
        nome=g.nome,
        sesso=g.sesso,
        data_nascita=g.data_nascita,
        codice_comune_nascita=codice_comune,
        sigla_provincia_nascita=sigla_prov,
        codice_stato_nascita=g.stato_nascita,
        codice_stato_cittadinanza=g.cittadinanza,
        tipo_documento=tipo_doc_field,
        numero_documento=num_doc_field,
        codice_stato_rilascio_doc=stato_ril_field,
        id_appartamento_file_unico=id_appartamento_file_unico,
    )


@api_router.post("/checkin/submit")
async def checkin_submit(body: CheckinSubmit, user=Depends(get_current_user)):
    """
    Submit guest check-in data to all portals (Alloggiati Web, Ross 1000, Imposta Soggiorno).
    Returns per-portal results.
    """
    prop = await db.properties.find_one(
        {"property_id": body.property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not prop:
        raise HTTPException(404, "Proprietà non trovata")

    # Guard: refuse check-in if external credentials are missing.
    # The frontend already blocks this at step 2; this is the backend safeguard.
    _aw = prop.get("alloggiati", {}) or {}
    _r1k = prop.get("ross1000", {}) or {}
    _missing = []
    if not (_aw.get("utente") and _aw.get("password") and _aw.get("ws_key")):
        _missing.append("Alloggiati Web (utente, password, WSKey)")
    if not (_r1k.get("utente") and _r1k.get("password") and _r1k.get("codice_struttura")):
        _missing.append("Ross 1000 / Turismo 5 (utente, password, codice struttura)")
    if _missing:
        raise HTTPException(
            400,
            {
                "error": "missing_credentials",
                "message": "Credenziali esterne mancanti per questa proprietà. Configurale in Impostazioni.",
                "missing": _missing,
            },
        )

    arr = datetime.fromisoformat(body.data_arrivo)
    part = datetime.fromisoformat(body.data_partenza)
    giorni = max(1, (part - arr).days)
    test_mode = prop.get("mode", "TEST") == "TEST"

    results: Dict[str, Any] = {"test_mode": test_mode}

    # -------- ALLOGGIATI WEB --------
    alloggiati_cfg = prop.get("alloggiati", {})
    if alloggiati_cfg.get("enabled") and alloggiati_cfg.get("utente"):
        tipo_account = alloggiati_cfg.get("tipo_account", "standard")
        id_app_raw = alloggiati_cfg.get("id_appartamento")
        id_app = int(id_app_raw) if id_app_raw is not None else None
        id_app_set = id_app is not None

        # Determine tipo_alloggiato
        n = len(body.guests)
        if n == 1:
            tipos = [TIPO_OSPITE_SINGOLO]
        else:
            tipos = [TIPO_CAPO_FAMIGLIA] + [TIPO_FAMILIARE] * (n - 1)

        # For FileUnico mode, append IdAppartamento to each schedina
        id_for_schedina = (
            str(id_app) if (tipo_account == "appartamenti_file_unico" and id_app_set) else ""
        )

        schedine = [
            _guest_to_schedina(g, tipos[i], body.data_arrivo, giorni, id_for_schedina)
            for i, g in enumerate(body.guests)
        ]

        tok = generate_token(
            alloggiati_cfg["utente"],
            alloggiati_cfg["password"],
            alloggiati_cfg["ws_key"],
        )
        if not tok["success"]:
            results["alloggiati_web"] = {
                "success": False,
                "message": tok.get("message", "Autenticazione fallita"),
                "schedine_preview": schedine,
            }
        else:
            if test_mode:
                resp = test_schedine(
                    alloggiati_cfg["utente"],
                    tok["token"],
                    schedine,
                    tipo_account=alloggiati_cfg.get("tipo_account", "standard"),
                    id_appartamento=id_app if id_app_set else 0,
                )
                resp["mode"] = "TEST (validazione, nessun invio reale)"
            else:
                resp = send_schedine(
                    alloggiati_cfg["utente"],
                    tok["token"],
                    schedine,
                    tipo_account=alloggiati_cfg.get("tipo_account", "standard"),
                    id_appartamento=id_app if id_app_set else 0,
                )
                resp["mode"] = "PROD (invio definitivo)"
            resp["schedine_preview"] = schedine
            results["alloggiati_web"] = resp
    else:
        results["alloggiati_web"] = {
            "success": False,
            "skipped": True,
            "message": "Alloggiati Web non configurato per questa proprietà.",
        }

    # -------- TURISMO 5 / ROSS 1000 (SOAP v2) --------
    ross_cfg = prop.get("ross1000", {})
    if ross_cfg.get("enabled"):
        regione = ross_cfg.get("regione", "Abruzzo")
        endpoint_url = ross_cfg.get("endpoint_url") or REGIONAL_ENDPOINTS.get(regione, "")
        codice_struttura = ross_cfg.get("codice_struttura", "")
        format_type = ross_cfg.get("format", "soap_v2")

        # Build arrivi list for the movimento on data_arrivo
        idcapo = f"{body.property_id[:8]}-{body.data_arrivo}"
        arrivi_list = []
        for i, g in enumerate(body.guests):
            if len(body.guests) == 1:
                tipo_alloggiato = "16"  # ospite singolo
                idcapo_field = ""
            elif i == 0:
                tipo_alloggiato = "17"  # capofamiglia
                idcapo_field = ""
            else:
                tipo_alloggiato = "19"  # familiare (codice Ross 1000 / Alloggiati Web)
                idcapo_field = idcapo

            arrivi_list.append({
                "idswh": f"{body.property_id[:8]}-{body.data_arrivo}-{i+1}",
                "tipoalloggiato": tipo_alloggiato,
                "idcapo": idcapo_field,
                "sesso": g.sesso,
                "cittadinanza": g.cittadinanza or ITALIA_CODE,
                "statoresidenza": g.cittadinanza or ITALIA_CODE,
                # luogoresidenza: only for italians (comune ISTAT), empty for foreigners
                "luogoresidenza": "" if g.is_foreign else (g.codice_comune_nascita or ""),
                "datanascita": g.data_nascita,
                "statonascita": g.stato_nascita or ITALIA_CODE,
                # comunenascita: only for italians (comune ISTAT), empty for foreigners
                "comunenascita": "" if g.is_foreign else (g.codice_comune_nascita or ""),
                "tipoturismo": "",
                "mezzotrasporto": "",
                "canaleprenotazione": "",
            })

        # Build partenze list for the movimento on data_partenza
        partenze_list = [
            {
                "idswh": f"{body.property_id[:8]}-{body.data_arrivo}-{i+1}",
                "tipoalloggiato": arrivi_list[i]["tipoalloggiato"],
                "arrivo": body.data_arrivo,
            }
            for i in range(len(body.guests))
        ]

        n_camere = int(ross_cfg.get("n_camere", 1))
        n_letti = int(ross_cfg.get("n_letti", 2))

        # Two movimenti: one for arrival day (with arrivi), one for departure day (with partenze)
        movimenti = [
            {
                "data": body.data_arrivo,
                "struttura": {
                    "apertura": "SI",
                    "camereoccupate": n_camere,
                    "cameredisponibili": n_camere,
                    "lettidisponibili": n_letti,
                },
                "arrivi": arrivi_list,
            },
            {
                "data": body.data_partenza,
                "struttura": {
                    "apertura": "SI",
                    "camereoccupate": 0,
                    "cameredisponibili": n_camere,
                    "lettidisponibili": n_letti,
                },
                "partenze": partenze_list,
            },
        ]

        if format_type == "soap_v2":
            t5_resp = send_movimentazione(
                endpoint_url=endpoint_url,
                username=ross_cfg.get("utente", ""),
                password=ross_cfg.get("password", ""),
                codice_struttura=codice_struttura,
                movimenti=movimenti,
                prodotto=ross_cfg.get("nome_prodotto", "Dedomo"),
                test_mode=test_mode,
            )
            t5_resp["mode"] = (
                "TEST (XML generato, nessun invio reale)"
                if test_mode
                else "PROD (invio SOAP completato)"
            )
            results["ross1000"] = t5_resp
        else:
            # csv_manual fallback (legacy)
            guest_dicts = [
                {
                    "data_arrivo": body.data_arrivo,
                    "data_partenza": body.data_partenza,
                    "cognome": g.cognome,
                    "nome": g.nome,
                    "sesso": g.sesso,
                    "data_nascita": g.data_nascita,
                    "comune_nascita": g.luogo_nascita,
                    "stato_nascita": g.stato_nascita,
                    "cittadinanza": g.cittadinanza,
                    "tipo_documento": g.tipo_documento,
                    "numero_documento": g.numero_documento,
                }
                for g in body.guests
            ]
            csv_data = build_movimenti_csv(guest_dicts, codice_struttura)
            results["ross1000"] = {
                "success": True,
                "mode": "CSV manuale generato (scarica e carica sul portale)",
                "csv_content": csv_data,
                "test_mode": test_mode,
            }
    else:
        results["ross1000"] = {
            "success": False,
            "skipped": True,
            "message": "Turismo 5 / Ross 1000 non abilitato.",
        }

    # -------- IMPOSTA DI SOGGIORNO --------
    is_cfg = prop.get("imposta_soggiorno", {})
    if is_cfg.get("enabled"):
        calc = calcola_imposta(
            guests=[g.model_dump() for g in body.guests],
            tariffa=float(is_cfg.get("tariffa_per_notte", 0)),
            max_notti=int(is_cfg.get("max_notti_tassabili", 7)),
            esenti_under=int(is_cfg.get("esenti_under_anni", 12)),
            data_arrivo=body.data_arrivo,
            data_partenza=body.data_partenza,
        )
        results["imposta_soggiorno"] = {
            "success": True,
            "calculation": calc,
            "mode": "TEST (calcolo locale, nessun invio)" if test_mode else "PROD (calcolo locale)",
        }
    else:
        results["imposta_soggiorno"] = {
            "success": False,
            "skipped": True,
            "message": "Imposta di soggiorno non configurata.",
        }

    # Save check-in record (archive)
    checkin_id = f"chk_{uuid.uuid4().hex[:12]}"
    record = {
        "checkin_id": checkin_id,
        "user_id": user["user_id"],
        "property_id": body.property_id,
        "property_name": prop.get("nome"),
        "property_comune": prop.get("comune"),
        "data_arrivo": body.data_arrivo,
        "data_partenza": body.data_partenza,
        "guests": [g.model_dump() for g in body.guests],
        "mode": prop.get("mode", "TEST"),
        "results": results,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.checkins.insert_one(record)

    # Classify results & schedule retries / notifications
    aw_res = results.get("alloggiati_web", {})
    if aw_res and not aw_res.get("skipped"):
        await _process_submit_result(
            checkin_id, user["user_id"], "alloggiati", "Alloggiati Web", aw_res
        )
    t5_res = results.get("ross1000", {})
    if t5_res and not t5_res.get("skipped"):
        await _process_submit_result(
            checkin_id, user["user_id"], "turismo5", "Turismo 5", t5_res
        )

    results["checkin_id"] = checkin_id
    return results


# ====================================================================
# ARCHIVE
# ====================================================================

@api_router.get("/checkins")
async def list_checkins(
    property_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    query = {"user_id": user["user_id"]}
    if property_id:
        query["property_id"] = property_id
    items = await db.checkins.find(
        query, {"_id": 0, "comune_receipts.pdf_base64": 0}
    ).sort("created_at", -1).to_list(1000)
    return items


@api_router.get("/checkins/{checkin_id}")
async def get_checkin(checkin_id: str, user=Depends(get_current_user)):
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    return c


@api_router.get("/checkins/{checkin_id}/receipt-pdf")
async def download_receipt_pdf(checkin_id: str, user=Depends(get_current_user)):
    """Generate and stream a PDF receipt for tourist tax."""
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")

    prop = await db.properties.find_one(
        {"property_id": c["property_id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    if not prop:
        raise HTTPException(404, "Proprietà non trovata")

    is_result = c.get("results", {}).get("imposta_soggiorno", {})
    calc = is_result.get("calculation")
    if not calc:
        raise HTTPException(400, "Nessun calcolo imposta di soggiorno per questo check-in")

    pdf_bytes = generate_tax_receipt(
        property_name=prop.get("nome", ""),
        property_address=f"{prop.get('indirizzo','')} - {prop.get('cap','')} {prop.get('provincia','')}",
        property_comune=prop.get("comune", ""),
        property_cin=prop.get("cin", ""),
        data_arrivo=c["data_arrivo"],
        data_partenza=c["data_partenza"],
        guests=c.get("guests", []),
        calculation=calc,
        receipt_number=checkin_id.upper(),
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ricevuta_{checkin_id}.pdf"'},
    )


@api_router.get("/manual/download")
async def download_manual(user=Depends(get_current_user)):
    """Download the user manual PDF (Italian). Auth required."""
    manual_path = ROOT_DIR / ".." / "static" / "manuale_dedomo.pdf"
    manual_path = manual_path.resolve()
    if not manual_path.exists():
        # Lazy regenerate if missing
        from services.manual_pdf import build as _build_manual
        try:
            _build_manual()
        except Exception as e:
            raise HTTPException(500, f"Manuale non disponibile: {e}")
    with open(manual_path, "rb") as f:
        data = f.read()
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="manuale_dedomo.pdf"'},
    )


@api_router.get("/manual/assets/{name}")
async def manual_asset(name: str, user=Depends(get_current_user)):
    """Serve a screenshot used by the online help page. Auth required."""
    # Sanitize: only allow .png files with safe characters
    import re
    if not re.fullmatch(r"[a-zA-Z0-9_\-]+\.png", name):
        raise HTTPException(400, "Nome non valido")
    asset_path = (ROOT_DIR / ".." / "manual_assets" / name).resolve()
    # Confine to manual_assets dir
    base = (ROOT_DIR / ".." / "manual_assets").resolve()
    try:
        asset_path.relative_to(base)
    except ValueError:
        raise HTTPException(400, "Percorso non valido")
    if not asset_path.exists():
        raise HTTPException(404, "Asset non trovato")
    with open(asset_path, "rb") as f:
        data = f.read()
    return StreamingResponse(
        io.BytesIO(data),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@api_router.get("/checkins/{checkin_id}/ross1000-csv")
async def download_ross1000_csv(checkin_id: str, user=Depends(get_current_user)):
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    csv_content = c.get("results", {}).get("ross1000", {}).get("csv_content", "")
    if not csv_content:
        raise HTTPException(404, "Nessun CSV Ross 1000 disponibile")
    return StreamingResponse(
        io.BytesIO(csv_content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="ross1000_{checkin_id}.csv"'},
    )


@api_router.get("/checkins/{checkin_id}/alloggiati-ricevuta")
async def download_alloggiati_ricevuta(
    checkin_id: str, user=Depends(get_current_user)
):
    """Download official Alloggiati Web PDF receipt.
    Serves from cache if available; otherwise fetches on-demand from the WS.
    """
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    if c.get("mode") == "TEST":
        raise HTTPException(
            400, "Ricevuta ufficiale disponibile solo per invii in modalità PRODUZIONE"
        )

    # Serve from cache if present
    cached = c.get("alloggiati_ricevuta_pdf")
    if cached:
        pdf_bytes = base64.b64decode(cached)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="alloggiati_{checkin_id}.pdf"'
            },
        )

    # Otherwise fetch from WS
    prop = await db.properties.find_one(
        {"property_id": c["property_id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    cfg = prop.get("alloggiati", {})
    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    if not tok["success"]:
        raise HTTPException(401, tok.get("message", "Autenticazione fallita"))
    send_date = c["created_at"][:10]
    ric = get_ricevuta_pdf(cfg["utente"], tok["token"], send_date)
    if not ric.get("success") or not ric.get("pdf_base64"):
        raise HTTPException(
            404,
            "Ricevuta non ancora disponibile dal portale. Le ricevute Alloggiati Web "
            "sono pubblicate dopo 24h dall'invio. Riprova più tardi.",
        )

    # Cache it
    await db.checkins.update_one(
        {"checkin_id": checkin_id},
        {
            "$set": {
                "alloggiati_ricevuta_pdf": ric["pdf_base64"],
                "alloggiati_ricevuta_downloaded_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    pdf_bytes = base64.b64decode(ric["pdf_base64"])
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="alloggiati_{checkin_id}.pdf"'
        },
    )


@api_router.post("/admin/refresh-receipts")
async def trigger_receipts_refresh(user=Depends(get_current_user)):
    """Manually trigger the receipts download job (useful for testing)."""
    await fetch_alloggiati_receipts()
    count = await db.checkins.count_documents({
        "user_id": user["user_id"],
        "alloggiati_ricevuta_pdf": {"$exists": True, "$ne": ""},
    })
    return {"success": True, "total_cached_receipts": count}


# ====================================================================

@api_router.get("/")
async def root():
    return {"app": "Dedomo", "status": "ok"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class BulkDeleteCheckinsBody(BaseModel):
    checkin_ids: List[str]


@api_router.post("/checkins/bulk-delete")
async def bulk_delete_test_checkins(body: BulkDeleteCheckinsBody, user=Depends(get_current_user)):
    """Bulk-delete TEST-mode check-ins that have BOTH Alloggiati Web and
    Turismo 5 / Ross1000 attempts recorded. PROD check-ins are never deleted."""
    if not body.checkin_ids:
        return {"deleted": 0, "skipped": []}
    cursor = db.checkins.find(
        {"user_id": user["user_id"], "checkin_id": {"$in": body.checkin_ids}},
        {"_id": 0, "checkin_id": 1, "mode": 1, "results": 1},
    )
    to_delete, skipped = [], []
    async for c in cursor:
        aw = (c.get("results") or {}).get("alloggiati_web") or {}
        t5 = (c.get("results") or {}).get("ross1000") or {}
        if c.get("mode") == "TEST" and aw and t5:
            to_delete.append(c["checkin_id"])
        else:
            skipped.append(c["checkin_id"])
    res = await db.checkins.delete_many(
        {"user_id": user["user_id"], "checkin_id": {"$in": to_delete}}
    )
    return {"deleted": res.deleted_count, "skipped": skipped}


class ComuneReceiptRequest(BaseModel):
    numero_ricevuta: str
    data_ricevuta: str  # YYYY-MM-DD
    ospite_index: int = 0  # default first guest, but user can pick
    comune_piva: str = ""
    comune_pec: str = ""


@api_router.post("/checkins/{checkin_id}/comune-receipt")
async def create_comune_receipt(
    checkin_id: str,
    body: ComuneReceiptRequest,
    user=Depends(get_current_user),
):
    """Generate a municipal tourist tax receipt PDF (per the user's template).
    Also archives the receipt entry in the checkin record.
    Returns the PDF as a streaming response.
    """
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    prop = await db.properties.find_one(
        {"property_id": c["property_id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    if not prop:
        raise HTTPException(404, "Proprietà non trovata")

    # Enforce: receipt number must be digits only
    import re as _re
    numero_clean = _re.sub(r"\D", "", body.numero_ricevuta or "")
    if not numero_clean:
        raise HTTPException(400, "Numero ricevuta non valido (solo cifre)")
    body.numero_ricevuta = numero_clean

    is_result = c.get("results", {}).get("imposta_soggiorno", {})
    calc = is_result.get("calculation")
    if not calc:
        # Fallback: recompute on-the-fly if property has imposta enabled
        # (covers check-ins made before the tax was configured for this property)
        is_cfg = prop.get("imposta_soggiorno", {}) or {}
        if is_cfg.get("enabled"):
            try:
                calc = calcola_imposta(
                    guests=c.get("guests", []),
                    tariffa=float(is_cfg.get("tariffa_per_notte", 0)),
                    max_notti=int(is_cfg.get("max_notti_tassabili", 7)),
                    esenti_under=int(is_cfg.get("esenti_under_anni", 12)),
                    data_arrivo=c["data_arrivo"],
                    data_partenza=c["data_partenza"],
                )
                # Persist for future use
                await db.checkins.update_one(
                    {"checkin_id": checkin_id, "user_id": user["user_id"]},
                    {"$set": {"results.imposta_soggiorno": {"success": True, "calculation": calc, "mode": "RECOMPUTED"}}},
                )
            except Exception:
                calc = None
    if not calc:
        raise HTTPException(400, "Nessun calcolo imposta di soggiorno per questo check-in. Abilita l'imposta nelle Impostazioni della proprietà.")

    guests = c.get("guests", [])
    idx = max(0, min(body.ospite_index, len(guests) - 1))
    g = guests[idx] if guests else {}
    ospite_nome = f"{g.get('cognome','')} {g.get('nome','')}".strip()
    # For foreign guests, residenza = country name (as per Italian municipal regulations
    # for tourist tax receipts). For Italian guests, residenza = city of birth.
    if g.get("is_foreign"):
        ospite_res = g.get("paese_nome") or g.get("luogo_nascita") or "—"
    else:
        ospite_res = g.get("luogo_nascita") or "—"

    breakdown = calc.get("breakdown", []) or []
    n_adulti_paganti = sum(1 for b in breakdown if not b.get("esente"))
    n_esenti = sum(1 for b in breakdown if b.get("esente"))
    if not breakdown and guests:
        n_adulti_paganti = len(guests)

    # ============================================================
    # Multi-month split: if stay spans more than one calendar month,
    # we generate one separate receipt per month containing paying
    # nights. Numbering starts at body.numero_ricevuta then +1, +2…
    # ============================================================
    from datetime import date as _date, timedelta as _timedelta
    arr = _date.fromisoformat(c["data_arrivo"])
    dep = _date.fromisoformat(c["data_partenza"])
    stay_nights = max(1, (dep - arr).days)
    max_notti = max(1, int((prop.get("imposta_soggiorno") or {}).get("max_notti_tassabili", 7)))
    paying_total = min(stay_nights, max_notti)

    # Build list of (year, month, date) for each PAYING night (in order from arrival)
    paying_dates = []
    cur = arr
    for _i in range(paying_total):
        paying_dates.append(cur)
        cur += _timedelta(days=1)

    # Group consecutive paying nights by (year, month), tracking the calendar range
    month_groups = []
    for d in paying_dates:
        ym = (d.year, d.month)
        if month_groups and month_groups[-1]["ym"] == ym:
            month_groups[-1]["nights"] += 1
            month_groups[-1]["end"] = d  # last paying night in this month
        else:
            month_groups.append({"ym": ym, "nights": 1, "start": d, "end": d})

    tariffa = float((prop.get("imposta_soggiorno") or {}).get("tariffa_per_notte", 0))

    base_num = int(body.numero_ricevuta)
    generated = []
    # All receipts use the START-OF-STAY date as emission date (user requirement).
    emission_date = c["data_arrivo"]
    for offset, mg in enumerate(month_groups):
        nights_in_month = mg["nights"]
        importo_slice = round(tariffa * n_adulti_paganti * nights_in_month, 2)
        pernottamenti_slice = n_adulti_paganti * nights_in_month
        numero_slice = str(base_num + offset)
        # Period shown on this receipt = the actual paying nights for this month.
        # "checkout" line = day AFTER the last paying night (so the period reads naturally).
        slice_start = mg["start"].isoformat()
        slice_end = (mg["end"] + _timedelta(days=1)).isoformat()

        pdf_slice = generate_comune_receipt(
            numero_ricevuta=numero_slice,
            data_ricevuta=emission_date,
            comune_nome=prop.get("comune", "—"),
            property_name=prop.get("nome", ""),
            property_address=f"{prop.get('indirizzo','')} {prop.get('cap','')}".strip(),
            property_comune=f"{prop.get('comune','')} ({prop.get('provincia','')})",
            proprietario=prop.get("proprietario", ""),
            codice_fiscale=prop.get("codice_fiscale", ""),
            ospite_nome_cognome=ospite_nome,
            ospite_residenza=ospite_res,
            importo=importo_slice,
            data_arrivo=slice_start,
            data_partenza=slice_end,
            pernottamenti=pernottamenti_slice,
            n_adulti=n_adulti_paganti,
            n_esenti=n_esenti,
            comune_piva=body.comune_piva,
            comune_pec=body.comune_pec,
        )

        import secrets as _secrets
        entry = {
            "numero": numero_slice,
            "data": emission_date,
            "ospite_index": idx,
            "ospite_nome": ospite_nome,
            "importo": importo_slice,
            "data_arrivo": slice_start,
            "data_partenza": slice_end,
            "month_year": f"{mg['ym'][0]}-{mg['ym'][1]:02d}",
            "notti_pagate": nights_in_month,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "pdf_base64": base64.b64encode(pdf_slice).decode(),
            "share_token": _secrets.token_urlsafe(24),
        }
        await db.checkins.update_one(
            {"checkin_id": checkin_id},
            {"$push": {"comune_receipts": entry}},
        )
        generated.append({"numero": numero_slice, "month": entry["month_year"], "notti": nights_in_month, "importo": importo_slice})

    # Get new indices after all pushes
    refreshed = await db.checkins.find_one(
        {"checkin_id": checkin_id}, {"_id": 0, "comune_receipts": 1}
    )
    total_now = len(refreshed.get("comune_receipts", []))

    return {
        "ok": True,
        "split": len(generated) > 1,
        "receipts": generated,
        "first_index": total_now - len(generated),
        "last_index": total_now - 1,
    }


@api_router.get("/checkins/{checkin_id}/comune-receipts")
async def list_comune_receipts(checkin_id: str, user=Depends(get_current_user)):
    """List archived municipal receipts for a checkin."""
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]},
        {"_id": 0, "comune_receipts": 1},
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    receipts = c.get("comune_receipts", []) or []
    # Backfill share_token for receipts that don't have one
    import secrets as _secrets
    dirty = False
    for r in receipts:
        if not r.get("share_token"):
            r["share_token"] = _secrets.token_urlsafe(24)
            dirty = True
    if dirty:
        await db.checkins.update_one(
            {"checkin_id": checkin_id, "user_id": user["user_id"]},
            {"$set": {"comune_receipts": receipts}},
        )
    return [{k: v for k, v in r.items() if k != "pdf_base64"} for r in receipts]


@api_router.get("/public/comune-receipt/{token}")
async def public_view_comune_receipt(token: str):
    """Public endpoint — anyone with the share_token can view the receipt PDF."""
    if not token or len(token) < 16:
        raise HTTPException(404, "Ricevuta non trovata")
    c = await db.checkins.find_one(
        {"comune_receipts.share_token": token},
        {"_id": 0, "comune_receipts": 1},
    )
    if not c:
        raise HTTPException(404, "Ricevuta non trovata")
    for r in c.get("comune_receipts", []):
        if r.get("share_token") == token:
            pdf_b64 = r.get("pdf_base64")
            if not pdf_b64:
                raise HTTPException(404, "PDF non disponibile")
            numero = r.get("numero", "ricevuta")
            safe = numero.replace("/", "_").replace(" ", "_")
            return StreamingResponse(
                io.BytesIO(base64.b64decode(pdf_b64)),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'inline; filename="ricevuta_imposta_{safe}.pdf"',
                    "Cache-Control": "private, max-age=3600",
                },
            )
    raise HTTPException(404, "Ricevuta non trovata")


@api_router.get("/checkins/{checkin_id}/comune-receipts/{index}")
async def download_comune_receipt(
    checkin_id: str, index: int, download: int = 0, user=Depends(get_current_user)
):
    """Download an archived municipal receipt PDF by index.
    ?download=1 forces attachment (Save As) instead of inline viewer."""
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    receipts = c.get("comune_receipts", [])
    if index < 0 or index >= len(receipts):
        raise HTTPException(404, "Ricevuta non trovata")
    pdf_b64 = receipts[index].get("pdf_base64")
    if not pdf_b64:
        raise HTTPException(404, "PDF non disponibile")
    numero = receipts[index].get("numero", "")
    disposition = "attachment" if download else "inline"
    return StreamingResponse(
        io.BytesIO(base64.b64decode(pdf_b64)),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="ricevuta_comune_{numero}.pdf"'
        },
    )


@api_router.delete("/checkins/{checkin_id}/comune-receipts/{index}")
async def delete_comune_receipt(
    checkin_id: str, index: int, user=Depends(get_current_user)
):
    """Delete a single municipal receipt by index."""
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    receipts = c.get("comune_receipts", [])
    if index < 0 or index >= len(receipts):
        raise HTTPException(404, "Ricevuta non trovata")
    # Remove the item at index
    new_receipts = receipts[:index] + receipts[index + 1:]
    await db.checkins.update_one(
        {"checkin_id": checkin_id},
        {"$set": {"comune_receipts": new_receipts}},
    )
    return {"ok": True, "remaining": len(new_receipts)}


@api_router.get("/properties/{property_id}/comune-receipts")
async def property_comune_receipts(
    property_id: str, user=Depends(get_current_user)
):
    """List all municipal receipts for a property across all check-ins."""
    cursor = db.checkins.find(
        {"property_id": property_id, "user_id": user["user_id"], "comune_receipts": {"$exists": True, "$ne": []}},
        {"_id": 0, "checkin_id": 1, "data_arrivo": 1, "data_partenza": 1, "comune_receipts": 1},
    )
    out = []
    async for c in cursor:
        for idx, r in enumerate(c.get("comune_receipts", [])):
            out.append({
                "checkin_id": c["checkin_id"],
                "index": idx,
                "data_arrivo": c["data_arrivo"],
                "data_partenza": c["data_partenza"],
                "numero": r.get("numero"),
                "data": r.get("data"),
                "ospite_nome": r.get("ospite_nome"),
                "importo": r.get("importo"),
                "generated_at": r.get("generated_at"),
            })
    # Sort by data desc
    out.sort(key=lambda x: x.get("data", ""), reverse=True)
    return out


# ====================================================================
# OWNERS / FISCAL CODE ARCHIVE
# ====================================================================

# ====================================================================
# LOCAZIONE RECEIPTS (rental receipts) — per CF proprietario
# ====================================================================

class OwnerBankInfoBody(BaseModel):
    codice_fiscale: str
    intestatario: str = ""
    iban: str = ""
    banca: str = ""
    swift: str = ""
    next_receipt_num: int = 1


@api_router.get("/owner-bank-info")
async def list_owner_bank_info(user=Depends(get_current_user)):
    """List all bank-info records owned by this user (one per CF)."""
    cursor = db.owner_bank_info.find({"user_id": user["user_id"]}, {"_id": 0})
    return await cursor.to_list(500)


@api_router.get("/owner-bank-info/{cf}")
async def get_owner_bank_info(cf: str, user=Depends(get_current_user)):
    cf = cf.upper().strip()
    doc = await db.owner_bank_info.find_one(
        {"user_id": user["user_id"], "codice_fiscale": cf}, {"_id": 0}
    )
    if not doc:
        return {
            "codice_fiscale": cf,
            "intestatario": "",
            "iban": "",
            "banca": "",
            "swift": "",
            "next_receipt_num": 1,
        }
    return doc


@api_router.put("/owner-bank-info/{cf}")
async def upsert_owner_bank_info(cf: str, body: OwnerBankInfoBody, user=Depends(get_current_user)):
    cf = cf.upper().strip()
    body.codice_fiscale = cf
    await db.owner_bank_info.update_one(
        {"user_id": user["user_id"], "codice_fiscale": cf},
        {"$set": {
            "user_id": user["user_id"],
            "codice_fiscale": cf,
            "intestatario": body.intestatario,
            "iban": body.iban.replace(" ", "").upper(),
            "banca": body.banca,
            "swift": body.swift.upper(),
            "next_receipt_num": max(1, int(body.next_receipt_num)),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


class LocazioneReceiptBody(BaseModel):
    importo_locazione: float
    numero_ricevuta: str = ""  # if empty, auto-incremented


@api_router.post("/checkins/{checkin_id}/locazione-receipts")
async def create_locazione_receipt(checkin_id: str, body: LocazioneReceiptBody, user=Depends(get_current_user)):
    """Generate a rental (locazione) receipt PDF + HTML for a checkin."""
    from services.locazione_pdf import render_pdf as loc_render_pdf, render_html as loc_render_html, compute_totals as loc_compute

    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    prop = await db.properties.find_one(
        {"property_id": c["property_id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    if not prop:
        raise HTTPException(404, "Proprietà non trovata")

    cf = (prop.get("codice_fiscale") or "").upper().strip()
    if not cf:
        raise HTTPException(400, "Codice fiscale proprietario mancante nelle impostazioni proprietà")

    # Get owner bank info
    bank = await db.owner_bank_info.find_one(
        {"user_id": user["user_id"], "codice_fiscale": cf}, {"_id": 0}
    ) or {"iban": "", "banca": "", "swift": "", "next_receipt_num": 1}
    if not bank.get("iban"):
        raise HTTPException(400, "IBAN proprietario non configurato. Vai in Impostazioni → Dati Bancari per il CF " + cf)

    # Capogruppo = first guest
    guests = c.get("guests", [])
    if not guests:
        raise HTTPException(400, "Nessun ospite registrato per questo check-in")
    g = guests[0]
    capogruppo_nome = f"{g.get('cognome','')} {g.get('nome','')}".strip()
    if g.get("is_foreign"):
        capogruppo_res = g.get("paese_nome") or g.get("luogo_nascita") or ""
    else:
        capogruppo_res = g.get("luogo_nascita") or ""

    # Imposta soggiorno from check-in calculation
    is_calc = (c.get("results", {}).get("imposta_soggiorno") or {}).get("calculation") or {}
    imposta = float(is_calc.get("totale_imposta", 0.0) or 0.0)

    # Number management
    next_num = int(bank.get("next_receipt_num", 1))
    if body.numero_ricevuta and body.numero_ricevuta.strip():
        numero = body.numero_ricevuta.strip()
    else:
        year = datetime.now(timezone.utc).year
        numero = f"RL-{year}/{next_num:03d}"

    totals = loc_compute(float(body.importo_locazione), imposta)
    today_iso = datetime.now(timezone.utc).date().isoformat()

    data = {
        "numero": numero,
        "data_emissione": today_iso,
        "proprietario_nome": prop.get("proprietario", "").strip(),
        "proprietario_indirizzo": f"{prop.get('indirizzo','')} {prop.get('cap','')} {prop.get('comune','')} ({prop.get('provincia','')})".strip(),
        "proprietario_cf": cf,
        "capogruppo_nome": capogruppo_nome,
        "capogruppo_residenza": capogruppo_res,
        "periodo_inizio": c["data_arrivo"],
        "periodo_fine": c["data_partenza"],
        "importo_locazione": totals["importo_locazione"],
        "imposta_soggiorno": totals["imposta_soggiorno"],
        "marca_bollo": totals["marca_bollo"],
        "totale": totals["totale"],
        "iban": bank.get("iban", ""),
        "banca": bank.get("banca", ""),
        "swift": bank.get("swift", ""),
        "luogo_emissione": prop.get("comune", ""),
    }
    pdf_bytes = loc_render_pdf(data)
    html_str = loc_render_html(data)

    import secrets as _secrets
    receipt_entry = {
        **data,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pdf_base64": base64.b64encode(pdf_bytes).decode(),
        "html": html_str,
        "share_token": _secrets.token_urlsafe(24),
    }
    result = await db.checkins.find_one_and_update(
        {"checkin_id": checkin_id},
        {"$push": {"locazione_receipts": receipt_entry}},
        return_document=True,
        projection={"_id": 0, "locazione_receipts": 1},
    )
    new_index = len(result.get("locazione_receipts", [])) - 1 if result else 0

    # If we auto-generated the number, increment next_receipt_num for that CF
    if not (body.numero_ricevuta and body.numero_ricevuta.strip()):
        await db.owner_bank_info.update_one(
            {"user_id": user["user_id"], "codice_fiscale": cf},
            {"$set": {"next_receipt_num": next_num + 1}},
            upsert=True,
        )

    return {"ok": True, "index": new_index, "numero": numero, "totale": totals["totale"]}


@api_router.get("/checkins/{checkin_id}/locazione-receipts")
async def list_locazione_receipts(checkin_id: str, user=Depends(get_current_user)):
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]},
        {"_id": 0, "locazione_receipts": 1},
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    receipts = c.get("locazione_receipts", []) or []
    # Backfill share_token for receipts that don't have one yet
    import secrets as _secrets
    dirty = False
    for r in receipts:
        if not r.get("share_token"):
            r["share_token"] = _secrets.token_urlsafe(24)
            dirty = True
    if dirty:
        await db.checkins.update_one(
            {"checkin_id": checkin_id, "user_id": user["user_id"]},
            {"$set": {"locazione_receipts": receipts}},
        )
    return [{k: v for k, v in r.items() if k not in ("pdf_base64", "html")} for r in receipts]


@api_router.get("/public/locazione/{token}")
async def public_view_locazione(token: str):
    """Public endpoint — anyone with the share_token can view the receipt PDF.
    Used in mailto: links sent to guests. No auth required.
    Token is random + cryptographic, 24 bytes → ~32 chars base64url."""
    if not token or len(token) < 16:
        raise HTTPException(404, "Ricevuta non trovata")
    c = await db.checkins.find_one(
        {"locazione_receipts.share_token": token},
        {"_id": 0, "locazione_receipts": 1},
    )
    if not c:
        raise HTTPException(404, "Ricevuta non trovata")
    for r in c.get("locazione_receipts", []):
        if r.get("share_token") == token:
            pdf_b64 = r.get("pdf_base64")
            if not pdf_b64:
                raise HTTPException(404, "PDF non disponibile")
            numero = r.get("numero", "RL")
            safe = numero.replace("/", "_").replace(" ", "_")
            return StreamingResponse(
                io.BytesIO(base64.b64decode(pdf_b64)),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'inline; filename="ricevuta_locazione_{safe}.pdf"',
                    "Cache-Control": "private, max-age=3600",
                },
            )
    raise HTTPException(404, "Ricevuta non trovata")


@api_router.get("/checkins/{checkin_id}/locazione-receipts/{index}")
async def download_locazione_receipt(
    checkin_id: str, index: int, download: int = 0, user=Depends(get_current_user)
):
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    receipts = c.get("locazione_receipts", [])
    if index < 0 or index >= len(receipts):
        raise HTTPException(404, "Ricevuta non trovata")
    pdf_b64 = receipts[index].get("pdf_base64")
    if not pdf_b64:
        raise HTTPException(404, "PDF non disponibile")
    numero = receipts[index].get("numero", "RL")
    disposition = "attachment" if download else "inline"
    safe = numero.replace("/", "_").replace(" ", "_")
    return StreamingResponse(
        io.BytesIO(base64.b64decode(pdf_b64)),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="ricevuta_locazione_{safe}.pdf"'},
    )


@api_router.get("/checkins/{checkin_id}/locazione-receipts/{index}/html", response_class=Response)
async def view_locazione_html(checkin_id: str, index: int, user=Depends(get_current_user)):
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    receipts = c.get("locazione_receipts", [])
    if index < 0 or index >= len(receipts):
        raise HTTPException(404, "Ricevuta non trovata")
    html_str = receipts[index].get("html")
    if not html_str:
        raise HTTPException(404, "HTML non disponibile")
    return Response(content=html_str, media_type="text/html")


@api_router.delete("/checkins/{checkin_id}/locazione-receipts/{index}")
async def delete_locazione_receipt(checkin_id: str, index: int, user=Depends(get_current_user)):
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    receipts = c.get("locazione_receipts", []) or []
    if index < 0 or index >= len(receipts):
        raise HTTPException(404, "Ricevuta non trovata")
    receipts.pop(index)
    await db.checkins.update_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]},
        {"$set": {"locazione_receipts": receipts}},
    )
    return {"ok": True}


@api_router.get("/owners/{cf}/comune-receipts/monthly-summary")
async def comune_receipts_monthly_summary(cf: str, user=Depends(get_current_user)):
    """Monthly aggregate of Imposta di Soggiorno receipts for a given owner CF.
    Only counts receipts whose parent checkin was submitted in PROD mode AND
    where the Alloggiati Web transmission succeeded.

    Returns array of {month_key, month_label, primo, ultimo, persone_paganti,
                      notti_totali, totale_imposta, receipts_count} sorted desc.
    """
    cf = cf.upper().strip()
    props = await db.properties.find(
        {"user_id": user["user_id"], "codice_fiscale": cf},
        {"_id": 0, "property_id": 1, "nome": 1},
    ).to_list(500)
    prop_ids = [p["property_id"] for p in props]
    if not prop_ids:
        return []

    cursor = db.checkins.find(
        {
            "user_id": user["user_id"],
            "property_id": {"$in": prop_ids},
            "mode": "PROD",
            "results.alloggiati_web.success": True,
            "comune_receipts": {"$exists": True, "$ne": []},
        },
        {
            "_id": 0,
            "checkin_id": 1,
            "data_arrivo": 1,
            "data_partenza": 1,
            "guests": 1,
            "results": 1,
            "comune_receipts": 1,
        },
    )

    months = {}  # key "YYYY-MM" → aggregator dict
    months_it = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
    ]
    async for c in cursor:
        calc = (c.get("results", {}).get("imposta_soggiorno") or {}).get("calculation") or {}
        breakdown = calc.get("breakdown", []) or []
        paying_guests = sum(1 for b in breakdown if not b.get("esente"))

        for r in c.get("comune_receipts", []) or []:
            # Date for monthly grouping: prefer the receipt's month_year if present
            # (set when stay spans multiple months → 1 receipt per month),
            # else fall back to "data" (data ricevuta), else generated_at.
            mkey = r.get("month_year")
            if not mkey:
                dstr = r.get("data") or r.get("generated_at", "")[:10]
                if not dstr or len(dstr) < 7:
                    continue
                mkey = dstr[:7]
            if len(mkey) < 7:
                continue
            if mkey not in months:
                y, m = mkey.split("-")
                months[mkey] = {
                    "month_key": mkey,
                    "month_label": f"{months_it[int(m) - 1]} {y}",
                    "receipts": [],
                    "persone_paganti": 0,
                    "notti_totali": 0,
                    "totale_imposta": 0.0,
                    "receipts_count": 0,
                }
            agg = months[mkey]
            agg["receipts"].append(r.get("numero", ""))
            agg["persone_paganti"] += paying_guests
            # Cumulative paying calendar nights for this month
            if "notti_pagate" in r:
                agg["notti_totali"] += int(r.get("notti_pagate", 0) or 0)
            else:
                # Old (whole-stay) receipts: sum from breakdown
                agg["notti_totali"] += sum(int(b.get("notti_tassabili", 0) or 0) for b in breakdown if not b.get("esente"))
            agg["totale_imposta"] += float(r.get("importo", 0) or 0)
            agg["receipts_count"] += 1

    # Finalize: compute primo/ultimo by NUMERIC ordering of receipt numbers
    def _num_key(s):
        digits = "".join(ch for ch in str(s) if ch.isdigit())
        return int(digits) if digits else 0

    result = []
    for mkey, agg in months.items():
        nums = sorted(agg.pop("receipts"), key=_num_key)
        agg["primo"] = nums[0] if nums else ""
        agg["ultimo"] = nums[-1] if nums else ""
        agg["totale_imposta"] = round(agg["totale_imposta"], 2)
        result.append(agg)

    result.sort(key=lambda x: x["month_key"], reverse=True)
    return result


@api_router.get("/owners/{cf}/locazione-receipts")
async def list_locazione_by_owner(cf: str, user=Depends(get_current_user)):
    """All locazione receipts across checkins for a given proprietario CF."""
    cf = cf.upper().strip()
    # Find properties owned by this CF
    props = await db.properties.find(
        {"user_id": user["user_id"], "codice_fiscale": cf}, {"_id": 0, "property_id": 1, "nome": 1}
    ).to_list(500)
    prop_ids = [p["property_id"] for p in props]
    prop_names = {p["property_id"]: p.get("nome", "") for p in props}
    if not prop_ids:
        return []
    cursor = db.checkins.find(
        {"user_id": user["user_id"], "property_id": {"$in": prop_ids},
         "locazione_receipts": {"$exists": True, "$ne": []}},
        {"_id": 0, "checkin_id": 1, "property_id": 1, "data_arrivo": 1, "data_partenza": 1, "locazione_receipts": 1},
    )
    out = []
    async for c in cursor:
        for idx, r in enumerate(c.get("locazione_receipts", [])):
            out.append({
                "checkin_id": c["checkin_id"],
                "property_id": c["property_id"],
                "property_name": prop_names.get(c["property_id"], ""),
                "index": idx,
                "data_arrivo": c["data_arrivo"],
                "data_partenza": c["data_partenza"],
                "numero": r.get("numero"),
                "data_emissione": r.get("data_emissione"),
                "capogruppo_nome": r.get("capogruppo_nome"),
                "importo_locazione": r.get("importo_locazione"),
                "imposta_soggiorno": r.get("imposta_soggiorno"),
                "marca_bollo": r.get("marca_bollo"),
                "totale": r.get("totale"),
                "generated_at": r.get("generated_at"),
            })
    out.sort(key=lambda x: x.get("data_emissione", ""), reverse=True)
    return out


# ====================================================================
# OWNERS endpoints (existing)
# ====================================================================

@api_router.get("/owners")
async def list_owners(user=Depends(get_current_user)):
    """List unique (proprietario, codice_fiscale) pairs from user's properties
    with stats on associated checkins."""
    props = await db.properties.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(1000)

    # Group properties by codice_fiscale (or proprietario if CF missing)
    groups: Dict[str, Dict[str, Any]] = {}
    for p in props:
        cf = (p.get("codice_fiscale") or "").upper().strip()
        nome = p.get("proprietario", "").strip()
        if not cf and not nome:
            continue
        key = cf or f"NOCF::{nome}"
        if key not in groups:
            groups[key] = {
                "codice_fiscale": cf,
                "proprietario": nome,
                "properties": [],
            }
        groups[key]["properties"].append({
            "property_id": p["property_id"],
            "nome": p.get("nome", ""),
            "comune": p.get("comune", ""),
        })

    # Count checkins/receipts per group
    out = []
    for key, g in groups.items():
        pids = [pp["property_id"] for pp in g["properties"]]
        checkins_n = await db.checkins.count_documents(
            {"user_id": user["user_id"], "property_id": {"$in": pids}}
        )
        receipts_pipeline = [
            {"$match": {"user_id": user["user_id"], "property_id": {"$in": pids}}},
            {"$project": {"n": {"$size": {"$ifNull": ["$comune_receipts", []]}}}},
            {"$group": {"_id": None, "tot": {"$sum": "$n"}}},
        ]
        rc = await db.checkins.aggregate(receipts_pipeline).to_list(1)
        receipts_n = rc[0]["tot"] if rc else 0
        out.append({
            **g,
            "id": key,
            "checkins_count": checkins_n,
            "receipts_count": receipts_n,
        })
    out.sort(key=lambda x: x["proprietario"] or x["codice_fiscale"] or "")
    return out


def _owner_property_ids(props_dict_list: List[dict]) -> List[str]:
    return [p["property_id"] for p in props_dict_list]


async def _get_owner_properties(user_id: str, owner_id: str) -> List[dict]:
    """Find all properties belonging to a given owner key (CF or NOCF::name)."""
    if owner_id.startswith("NOCF::"):
        name = owner_id[len("NOCF::"):]
        cursor = db.properties.find(
            {"user_id": user_id, "proprietario": name, "$or": [
                {"codice_fiscale": {"$exists": False}},
                {"codice_fiscale": ""},
            ]},
            {"_id": 0},
        )
    else:
        cursor = db.properties.find(
            {"user_id": user_id, "codice_fiscale": owner_id},
            {"_id": 0},
        )
    return await cursor.to_list(1000)


@api_router.get("/owners/{owner_id}/archive")
async def owner_archive(
    owner_id: str,
    date_from: Optional[str] = None,  # YYYY-MM-DD
    date_to: Optional[str] = None,    # YYYY-MM-DD
    user=Depends(get_current_user),
):
    """Return chronological archive (schedine + receipts) for an owner.
    Filter by data_arrivo range. Each entry includes capogruppo (first guest)
    name and minimal metadata."""
    props = await _get_owner_properties(user["user_id"], owner_id)
    if not props:
        raise HTTPException(404, "Proprietario non trovato")

    pids = [p["property_id"] for p in props]
    prop_map = {p["property_id"]: p for p in props}

    q: Dict[str, Any] = {"user_id": user["user_id"], "property_id": {"$in": pids}}
    if date_from:
        q.setdefault("data_arrivo", {})["$gte"] = date_from
    if date_to:
        q.setdefault("data_arrivo", {})["$lte"] = date_to

    checkins = await db.checkins.find(
        q, {"_id": 0, "comune_receipts.pdf_base64": 0, "alloggiati_ricevuta_pdf": 0}
    ).sort("data_arrivo", -1).to_list(1000)

    schedine = []
    ricevute = []
    for c in checkins:
        guests = c.get("guests", [])
        capo_nome = ""
        if guests:
            capo_nome = f"{guests[0].get('cognome','')} {guests[0].get('nome','')}".strip()
        prop = prop_map.get(c["property_id"], {})
        aw_ok = (c.get("results", {}).get("alloggiati_web", {}) or {}).get("success")
        # Schedine entry — one per checkin (the schedina list is sent as a batch)
        if aw_ok and c.get("mode") == "PROD":
            schedine.append({
                "checkin_id": c["checkin_id"],
                "data_arrivo": c.get("data_arrivo"),
                "data_partenza": c.get("data_partenza"),
                "capogruppo": capo_nome,
                "ospiti_count": len(guests),
                "property_name": prop.get("nome", ""),
                "property_id": c["property_id"],
                "pdf_available": True,
            })
        # Ricevute imposta soggiorno
        for idx, r in enumerate(c.get("comune_receipts", []) or []):
            ospite_nome = r.get("ospite_nome") or capo_nome
            ricevute.append({
                "checkin_id": c["checkin_id"],
                "receipt_index": idx,
                "numero": r.get("numero"),
                "data": r.get("data"),
                "importo": r.get("importo"),
                "ospite_nome": ospite_nome,
                "capogruppo": capo_nome,
                "property_name": prop.get("nome", ""),
                "property_id": c["property_id"],
                "data_arrivo": c.get("data_arrivo"),
            })

    return {
        "owner_id": owner_id,
        "schedine": schedine,
        "ricevute": ricevute,
        "properties": [{"property_id": p["property_id"], "nome": p.get("nome",""), "comune": p.get("comune","")} for p in props],
    }


@api_router.get("/owners/{owner_id}/archive/zip")
async def owner_archive_zip(
    owner_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    categoria: str = "all",  # all | schedine | ricevute
    user=Depends(get_current_user),
):
    """Download a ZIP archive of all PDFs (schedine Alloggiati + ricevute Comune)
    for an owner within an optional date range."""
    import zipfile as _zip
    props = await _get_owner_properties(user["user_id"], owner_id)
    if not props:
        raise HTTPException(404, "Proprietario non trovato")
    pids = [p["property_id"] for p in props]
    prop_map = {p["property_id"]: p for p in props}

    q: Dict[str, Any] = {"user_id": user["user_id"], "property_id": {"$in": pids}}
    if date_from:
        q.setdefault("data_arrivo", {})["$gte"] = date_from
    if date_to:
        q.setdefault("data_arrivo", {})["$lte"] = date_to

    checkins = await db.checkins.find(q, {"_id": 0}).sort("data_arrivo", 1).to_list(1000)

    buf = io.BytesIO()
    files_added = 0
    with _zip.ZipFile(buf, "w", _zip.ZIP_DEFLATED) as zf:
        for c in checkins:
            guests = c.get("guests", [])
            capo = ""
            if guests:
                capo = f"{guests[0].get('cognome','')}_{guests[0].get('nome','')}"
            prop = prop_map.get(c["property_id"], {})
            prop_name = (prop.get("nome", "") or "casa").replace(" ", "_")
            arrivo = c.get("data_arrivo", "")

            # Schedine Alloggiati Web PDF
            if categoria in ("all", "schedine") and c.get("alloggiati_ricevuta_pdf"):
                fname = f"schedine/{arrivo}_{prop_name}_{capo}_AW.pdf"
                zf.writestr(fname, base64.b64decode(c["alloggiati_ricevuta_pdf"]))
                files_added += 1

            # Ricevute Comune
            if categoria in ("all", "ricevute"):
                for idx, r in enumerate(c.get("comune_receipts", []) or []):
                    if not r.get("pdf_base64"):
                        continue
                    n_clean = (r.get("numero") or f"r{idx}").replace("/", "_")
                    fname = f"ricevute_imposta/{r.get('data','')}_{prop_name}_{capo}_N{n_clean}.pdf"
                    zf.writestr(fname, base64.b64decode(r["pdf_base64"]))
                    files_added += 1

    if files_added == 0:
        raise HTTPException(404, "Nessun documento disponibile nel periodo selezionato")

    buf.seek(0)
    safe_owner = (owner_id.replace("/", "_") or "owner")[:30]
    filename = f"archivio_{safe_owner}_{date_from or 'inizio'}_{date_to or 'oggi'}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)


# ====================================================================
# ADMIN PANEL
# ====================================================================

@api_router.get("/admin/overview")
async def admin_overview(admin=Depends(get_admin_user)):
    """Aggregate metrics across all users, properties, checkins."""
    from datetime import date as _date

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    quarter_ago = now - timedelta(days=90)

    total_users = await db.users.count_documents({})
    new_week = await db.users.count_documents({"created_at": {"$gte": week_ago.isoformat()}})
    total_props = await db.properties.count_documents({})

    total_checkins = await db.checkins.count_documents({})
    today_checkins = await db.checkins.count_documents({"created_at": {"$gte": today_start.isoformat()}})
    week_checkins = await db.checkins.count_documents({"created_at": {"$gte": week_ago.isoformat()}})
    month_checkins = await db.checkins.count_documents({"created_at": {"$gte": month_ago.isoformat()}})

    # Active users last 30d (made at least 1 checkin)
    pipeline = [
        {"$match": {"created_at": {"$gte": month_ago.isoformat()}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "n"},
    ]
    res = await db.checkins.aggregate(pipeline).to_list(1)
    active_users = res[0]["n"] if res else 0

    # Foreign vs italian guests (last 30d)
    pipeline = [
        {"$match": {"created_at": {"$gte": month_ago.isoformat()}}},
        {"$unwind": "$guests"},
        {"$group": {"_id": "$guests.is_foreign", "n": {"$sum": 1}}},
    ]
    res = await db.checkins.aggregate(pipeline).to_list(10)
    foreign_count = sum(r["n"] for r in res if r.get("_id"))
    italian_count = sum(r["n"] for r in res if not r.get("_id"))
    total_guests_30d = foreign_count + italian_count

    # Success rate Alloggiati Web & Turismo5 (last 30d, PROD only)
    aw_ok = await db.checkins.count_documents({
        "created_at": {"$gte": month_ago.isoformat()},
        "mode": "PROD",
        "results.alloggiati_web.success": True,
    })
    aw_total = await db.checkins.count_documents({
        "created_at": {"$gte": month_ago.isoformat()},
        "mode": "PROD",
        "results.alloggiati_web": {"$exists": True},
    })
    t5_ok = await db.checkins.count_documents({
        "created_at": {"$gte": month_ago.isoformat()},
        "mode": "PROD",
        "results.ross1000.success": True,
    })
    t5_total = await db.checkins.count_documents({
        "created_at": {"$gte": month_ago.isoformat()},
        "mode": "PROD",
        "results.ross1000": {"$exists": True},
    })

    # Total tourist tax collected (sum of all receipts importo)
    pipeline = [
        {"$unwind": "$comune_receipts"},
        {"$group": {"_id": None, "tot": {"$sum": "$comune_receipts.importo"}, "n": {"$sum": 1}}},
    ]
    res = await db.checkins.aggregate(pipeline).to_list(1)
    tax_total = res[0]["tot"] if res else 0
    tax_count = res[0]["n"] if res else 0

    # Daily checkin chart (last 90 days)
    pipeline = [
        {"$match": {"created_at": {"$gte": quarter_ago.isoformat()}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "n": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    daily = await db.checkins.aggregate(pipeline).to_list(100)
    daily_chart = [{"date": d["_id"], "checkins": d["n"]} for d in daily]

    # Daily signups (last 90 days)
    pipeline = [
        {"$match": {"created_at": {"$gte": quarter_ago.isoformat()}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "n": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    signups = await db.users.aggregate(pipeline).to_list(100)
    signups_chart = [{"date": s["_id"], "signups": s["n"]} for s in signups]

    # Retry queue snapshot
    pending_retries = await db.checkins.count_documents({
        "$or": [
            {"retry_state.alloggiati.status": "pending"},
            {"retry_state.turismo5.status": "pending"},
        ],
    })
    exhausted_retries = await db.checkins.count_documents({
        "$or": [
            {"retry_state.alloggiati.status": "exhausted"},
            {"retry_state.turismo5.status": "exhausted"},
        ],
    })

    return {
        "users": {
            "total": total_users,
            "new_this_week": new_week,
            "active_30d": active_users,
        },
        "properties": {
            "total": total_props,
        },
        "checkins": {
            "total": total_checkins,
            "today": today_checkins,
            "this_week": week_checkins,
            "this_month": month_checkins,
        },
        "guests_30d": {
            "italian": italian_count,
            "foreign": foreign_count,
            "total": total_guests_30d,
            "foreign_pct": round(foreign_count * 100 / total_guests_30d, 1) if total_guests_30d > 0 else 0,
        },
        "success_rate_30d": {
            "alloggiati_web": round(aw_ok * 100 / aw_total, 1) if aw_total > 0 else None,
            "alloggiati_web_ok": aw_ok,
            "alloggiati_web_total": aw_total,
            "turismo5": round(t5_ok * 100 / t5_total, 1) if t5_total > 0 else None,
            "turismo5_ok": t5_ok,
            "turismo5_total": t5_total,
        },
        "tourist_tax": {
            "total_eur": round(tax_total, 2),
            "receipts_count": tax_count,
        },
        "retries": {
            "pending": pending_retries,
            "exhausted": exhausted_retries,
        },
        "charts": {
            "daily_checkins_90d": daily_chart,
            "daily_signups_90d": signups_chart,
        },
    }


@api_router.get("/admin/users")
async def admin_list_users(
    search: Optional[str] = None,
    admin=Depends(get_admin_user),
):
    """List all users with stats (props count, checkins count, last activity)."""
    q: Dict[str, Any] = {}
    if search:
        q = {
            "$or": [
                {"email": {"$regex": search, "$options": "i"}},
                {"name": {"$regex": search, "$options": "i"}},
            ]
        }
    users = await db.users.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

    enriched = []
    for u in users:
        props_n = await db.properties.count_documents({"user_id": u["user_id"]})
        checkins_n = await db.checkins.count_documents({"user_id": u["user_id"]})
        # Last checkin date
        last_ck = await db.checkins.find_one(
            {"user_id": u["user_id"]},
            {"_id": 0, "created_at": 1},
            sort=[("created_at", -1)],
        )
        last_session = await db.user_sessions.find_one(
            {"user_id": u["user_id"]},
            {"_id": 0, "expires_at": 1, "created_at": 1},
            sort=[("expires_at", -1)],
        )
        enriched.append({
            "user_id": u["user_id"],
            "email": u.get("email"),
            "name": u.get("name"),
            "picture": u.get("picture"),
            "created_at": u.get("created_at"),
            "disabled": bool(u.get("disabled", False)),
            "properties_count": props_n,
            "checkins_count": checkins_n,
            "last_checkin_at": last_ck.get("created_at") if last_ck else None,
            "last_login_at": (last_session.get("created_at") or last_session.get("expires_at"))
                if last_session else None,
        })
    return {"users": enriched, "total": len(enriched)}


@api_router.get("/admin/user/{user_id}")
async def admin_user_detail(user_id: str, admin=Depends(get_admin_user)):
    """Detail view for a single user: properties + recent checkins + per-portal stats."""
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "Utente non trovato")
    props = await db.properties.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    recent_ck = await db.checkins.find(
        {"user_id": user_id},
        {"_id": 0, "checkin_id": 1, "data_arrivo": 1, "data_partenza": 1,
         "mode": 1, "guests": 1, "results.alloggiati_web.success": 1,
         "results.ross1000.success": 1, "created_at": 1, "property_id": 1},
    ).sort("created_at", -1).limit(20).to_list(20)
    # Strip guest detail for privacy — only counts and capogruppo
    for c in recent_ck:
        g = c.get("guests", [])
        c["guests_count"] = len(g)
        c["capogruppo"] = f"{g[0].get('cognome','')} {g[0].get('nome','')}".strip() if g else ""
        c.pop("guests", None)

    # Aggregate stats
    month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    ck_total = await db.checkins.count_documents({"user_id": user_id})
    ck_month = await db.checkins.count_documents({"user_id": user_id, "created_at": {"$gte": month_ago}})
    # Total receipts
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$unwind": "$comune_receipts"},
        {"$group": {"_id": None, "tot": {"$sum": "$comune_receipts.importo"}, "n": {"$sum": 1}}},
    ]
    rc = await db.checkins.aggregate(pipeline).to_list(1)
    tax_total = rc[0]["tot"] if rc else 0
    tax_count = rc[0]["n"] if rc else 0
    # Success rate AW
    aw_ok = await db.checkins.count_documents({
        "user_id": user_id, "mode": "PROD",
        "results.alloggiati_web.success": True,
    })
    aw_total = await db.checkins.count_documents({
        "user_id": user_id, "mode": "PROD",
        "results.alloggiati_web": {"$exists": True},
    })
    t5_ok = await db.checkins.count_documents({
        "user_id": user_id, "mode": "PROD",
        "results.ross1000.success": True,
    })
    t5_total = await db.checkins.count_documents({
        "user_id": user_id, "mode": "PROD",
        "results.ross1000": {"$exists": True},
    })
    # Foreign / italian guests
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$unwind": "$guests"},
        {"$group": {"_id": "$guests.is_foreign", "n": {"$sum": 1}}},
    ]
    res = await db.checkins.aggregate(pipeline).to_list(10)
    foreign = sum(r["n"] for r in res if r.get("_id"))
    italian = sum(r["n"] for r in res if not r.get("_id"))

    return {
        "user": {
            "user_id": u["user_id"],
            "email": u.get("email"),
            "name": u.get("name"),
            "picture": u.get("picture"),
            "created_at": u.get("created_at"),
            "disabled": bool(u.get("disabled", False)),
            "disabled_at": u.get("disabled_at"),
        },
        "stats": {
            "checkins_total": ck_total,
            "checkins_month": ck_month,
            "properties_count": len(props),
            "tax_total_eur": round(tax_total, 2),
            "tax_receipts_count": tax_count,
            "alloggiati_success_pct": round(aw_ok * 100 / aw_total, 1) if aw_total > 0 else None,
            "alloggiati_ok": aw_ok,
            "alloggiati_total": aw_total,
            "turismo5_success_pct": round(t5_ok * 100 / t5_total, 1) if t5_total > 0 else None,
            "turismo5_ok": t5_ok,
            "turismo5_total": t5_total,
            "guests_italian": italian,
            "guests_foreign": foreign,
        },
        "properties": props,
        "recent_checkins": recent_ck,
    }


@api_router.post("/admin/user/{user_id}/toggle-disabled")
async def admin_toggle_user_disabled(user_id: str, admin=Depends(get_admin_user)):
    """Toggle disabled state of a user. Disabled users can't log in or make calls."""
    if user_id == admin["user_id"]:
        raise HTTPException(400, "Non puoi disabilitare il tuo stesso account")
    u = await db.users.find_one({"user_id": user_id})
    if u is None:
        raise HTTPException(404, "Utente non trovato")
    new_state = not bool(u.get("disabled", False))
    update = {"disabled": new_state}
    if new_state:
        update["disabled_at"] = datetime.now(timezone.utc).isoformat()
        # Revoke all active sessions
        await db.user_sessions.delete_many({"user_id": user_id})
    else:
        update["disabled_at"] = None
    await db.users.update_one({"user_id": user_id}, {"$set": update})
    return {"ok": True, "disabled": new_state}


# ====================================================================
# CALENDAR  —  external iCal sync (in) + personal export (out) + manual bookings
# ====================================================================
from services.calendar_service import fetch_ical_events, build_personal_ical


class ManualBookingCreate(BaseModel):
    property_id: str
    start: str  # YYYY-MM-DD
    end: str    # YYYY-MM-DD
    notes: str = ""


class ManualBookingUpdate(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None
    notes: Optional[str] = None


@api_router.get("/calendar/events")
async def calendar_events(
    date_from: str,
    date_to: str,
    user=Depends(get_current_user),
):
    """Return all calendar events (external + manual + checkins) in [date_from, date_to].
    Each event: {property_id, source: 'B'|'A'|'V'|'P'|'C', start, end, summary, notes,
                 color, property_name, booking_id (if manual or external uid)}.
    """
    props = await db.properties.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(1000)

    events = []
    for p in props:
        pid = p["property_id"]
        cal_cfg = p.get("calendar", {}) or {}
        color = cal_cfg.get("color") or "#10b981"
        name = p.get("nome", "")

        # External feeds (from cache; refreshed by background job)
        cache = await db.ical_cache.find_one(
            {"property_id": pid}, {"_id": 0}
        )
        cache = cache or {}
        for src_letter, src_key in [("B", "booking"), ("A", "airbnb"), ("V", "vrbo")]:
            for ev in cache.get(src_key, []) or []:
                if ev["start"] <= date_to and ev["end"] >= date_from:
                    events.append({
                        "id": f"{pid}-{src_key}-{ev['uid']}",
                        "property_id": pid,
                        "property_name": name,
                        "source": src_letter,
                        "start": ev["start"],
                        "end": ev["end"],
                        "summary": ev.get("summary", ""),
                        "notes": ev.get("description", ""),
                        "color": color,
                        "editable": False,
                    })

    # Manual bookings (P) from db
    manual = await db.manual_bookings.find(
        {
            "user_id": user["user_id"],
            "start": {"$lte": date_to},
            "end": {"$gte": date_from},
        },
        {"_id": 0},
    ).to_list(1000)
    prop_map = {p["property_id"]: p for p in props}
    for m in manual:
        p = prop_map.get(m["property_id"], {})
        events.append({
            "id": f"manual-{m['booking_id']}",
            "booking_id": m["booking_id"],
            "property_id": m["property_id"],
            "property_name": p.get("nome", ""),
            "source": "P",
            "start": m["start"],
            "end": m["end"],
            "summary": "Prenotazione manuale",
            "notes": m.get("notes", ""),
            "color": (p.get("calendar") or {}).get("color", "#10b981"),
            "editable": True,
        })

    return {
        "events": events,
        "properties": [
            {
                "property_id": p["property_id"],
                "nome": p.get("nome", ""),
                "color": (p.get("calendar") or {}).get("color", "#10b981"),
            }
            for p in props
        ],
    }


@api_router.post("/calendar/manual")
async def create_manual_booking(
    body: ManualBookingCreate, user=Depends(get_current_user)
):
    # Verify the property belongs to the user
    p = await db.properties.find_one(
        {"property_id": body.property_id, "user_id": user["user_id"]}, {"_id": 0, "property_id": 1}
    )
    if not p:
        raise HTTPException(404, "Struttura non trovata")
    # Validate dates
    try:
        s = date.fromisoformat(body.start)
        e = date.fromisoformat(body.end)
        if e < s:
            raise HTTPException(400, "Data di fine prima della data di inizio")
    except ValueError:
        raise HTTPException(400, "Formato data non valido (YYYY-MM-DD)")

    record = {
        "booking_id": f"mbk_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "property_id": body.property_id,
        "start": body.start,
        "end": body.end,
        "notes": body.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.manual_bookings.insert_one(record)
    record.pop("_id", None)
    return record


@api_router.patch("/calendar/manual/{booking_id}")
async def update_manual_booking(
    booking_id: str, body: ManualBookingUpdate, user=Depends(get_current_user)
):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not update:
        return {"ok": True}
    if "start" in update or "end" in update:
        # Validate
        try:
            existing = await db.manual_bookings.find_one(
                {"booking_id": booking_id, "user_id": user["user_id"]}, {"_id": 0}
            )
            if not existing:
                raise HTTPException(404, "Prenotazione non trovata")
            s = date.fromisoformat(update.get("start", existing["start"]))
            e = date.fromisoformat(update.get("end", existing["end"]))
            if e < s:
                raise HTTPException(400, "Data di fine prima della data di inizio")
        except ValueError:
            raise HTTPException(400, "Formato data non valido")
    r = await db.manual_bookings.update_one(
        {"booking_id": booking_id, "user_id": user["user_id"]},
        {"$set": update},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Prenotazione non trovata")
    return {"ok": True}


@api_router.delete("/calendar/manual/{booking_id}")
async def delete_manual_booking(booking_id: str, user=Depends(get_current_user)):
    r = await db.manual_bookings.delete_one(
        {"booking_id": booking_id, "user_id": user["user_id"]}
    )
    if r.deleted_count == 0:
        raise HTTPException(404, "Prenotazione non trovata")
    return {"ok": True}


@api_router.get("/calendar/personal-url/{property_id}")
async def calendar_personal_url(property_id: str, user=Depends(get_current_user)):
    """Return the public iCal URL for this property's manual bookings."""
    p = await db.properties.find_one(
        {"property_id": property_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Struttura non trovata")
    cal_cfg = p.get("calendar") or {}
    token = cal_cfg.get("export_token")
    if not token:
        token = uuid.uuid4().hex
        await db.properties.update_one(
            {"property_id": property_id},
            {"$set": {"calendar.export_token": token}},
        )
    base = os.environ.get("PUBLIC_BACKEND_URL", "")
    path = f"/api/calendar/export/{property_id}/{token}.ics"
    return {
        "url": (base + path) if base else path,
        "path": path,
        "token": token,
    }


# Public (no auth) endpoint — protected by token in URL
@api_router.get("/calendar/export/{property_id}/{token}.ics")
async def calendar_export_ics(property_id: str, token: str):
    p = await db.properties.find_one(
        {"property_id": property_id}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Struttura non trovata")
    cfg = p.get("calendar") or {}
    if not cfg.get("export_token") or cfg["export_token"] != token:
        raise HTTPException(403, "Token non valido")
    bookings = await db.manual_bookings.find(
        {"property_id": property_id}, {"_id": 0}
    ).to_list(2000)
    ical_text = build_personal_ical(
        property_name=p.get("nome", "Dedomo"),
        bookings=bookings,
    )
    return Response(
        content=ical_text,
        media_type="text/calendar; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )


async def refresh_ical_caches():
    """Background job: refresh external iCal feeds every 4 hours."""
    props = await db.properties.find(
        {}, {"_id": 0, "property_id": 1, "calendar": 1}
    ).to_list(5000)

    n = 0
    for p in props:
        cal = p.get("calendar") or {}
        pid = p["property_id"]
        update = {"property_id": pid, "refreshed_at": datetime.now(timezone.utc).isoformat()}
        for key, url_key in [("booking", "booking_ical_url"), ("airbnb", "airbnb_ical_url"), ("vrbo", "vrbo_ical_url")]:
            url = cal.get(url_key) or ""
            update[key] = fetch_ical_events(url) if url else []
        await db.ical_cache.update_one(
            {"property_id": pid},
            {"$set": update},
            upsert=True,
        )
        n += 1
    if n:
        logger.info(f"[ical-cache] refreshed {n} properties")


@api_router.post("/calendar/refresh")
async def calendar_force_refresh(user=Depends(get_current_user)):
    """Force-refresh the iCal cache for all properties owned by the current user."""
    props = await db.properties.find(
        {"user_id": user["user_id"]}, {"_id": 0, "property_id": 1, "calendar": 1, "nome": 1}
    ).to_list(1000)

    refreshed = []
    total_events = 0
    for p in props:
        cal = p.get("calendar") or {}
        pid = p["property_id"]
        update = {"property_id": pid, "refreshed_at": datetime.now(timezone.utc).isoformat()}
        prop_events = 0
        for key, url_key in [("booking", "booking_ical_url"), ("airbnb", "airbnb_ical_url"), ("vrbo", "vrbo_ical_url")]:
            url = cal.get(url_key) or ""
            events = fetch_ical_events(url) if url else []
            update[key] = events
            prop_events += len(events)
        await db.ical_cache.update_one(
            {"property_id": pid},
            {"$set": update},
            upsert=True,
        )
        refreshed.append({"property_id": pid, "nome": p.get("nome", ""), "events": prop_events})
        total_events += prop_events
    return {
        "ok": True,
        "properties_refreshed": len(refreshed),
        "total_events": total_events,
        "details": refreshed,
    }


# ====================================================================
# RETRY & NOTIFICATIONS
# ====================================================================

async def _add_notification(
    user_id: str,
    level: str,  # 'info' | 'success' | 'warning' | 'error'
    title: str,
    body: str,
    checkin_id: Optional[str] = None,
    portal: Optional[str] = None,
) -> None:
    """Append a user-facing notification."""
    await db.notifications.insert_one({
        "notification_id": f"ntf_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "level": level,
        "title": title,
        "body": body,
        "checkin_id": checkin_id,
        "portal": portal,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _process_submit_result(
    checkin_id: str,
    user_id: str,
    portal: str,  # 'alloggiati' | 'turismo5'
    portal_label: str,  # 'Alloggiati Web' | 'Turismo 5'
    result: Dict[str, Any],
) -> None:
    """After a submit, classify result and schedule retry if transient.

    Updates retry_state.{portal} on the checkin doc and creates a notification
    when state changes meaningfully (transient failure, success after retry, exhausted).
    """
    msg = result.get("message", "")
    success = bool(result.get("success"))
    kind = classify_error(msg, success=success)

    # Load current retry state (if any)
    c = await db.checkins.find_one({"checkin_id": checkin_id}, {"_id": 0, "retry_state": 1})
    prev = (c.get("retry_state", {}) or {}).get(portal) or {}
    prev_attempts = int(prev.get("attempts", 0))
    was_pending = prev.get("status") == "pending"

    if kind == "success":
        if was_pending:
            await _add_notification(
                user_id, "success",
                f"{portal_label}: recuperato",
                f"Invio finalmente accettato dopo {prev_attempts} tentativi automatici.",
                checkin_id=checkin_id, portal=portal,
            )
        # Clear retry entry
        await db.checkins.update_one(
            {"checkin_id": checkin_id},
            {"$unset": {f"retry_state.{portal}": ""}},
        )
        return

    if kind == "definitive":
        # Definitive: never retry. Save final state, notify if first time.
        if not was_pending or prev.get("last_error") != msg:
            await _add_notification(
                user_id, "error",
                f"{portal_label}: invio rifiutato",
                f"Errore non recuperabile: {msg[:200]}. Modifica i dati e ripeti l'invio manualmente.",
                checkin_id=checkin_id, portal=portal,
            )
        await db.checkins.update_one(
            {"checkin_id": checkin_id},
            {"$set": {f"retry_state.{portal}": {
                "portal": portal,
                "status": "definitive",
                "attempts": prev_attempts + 1,
                "last_error": msg,
                "last_attempt": datetime.now(timezone.utc).isoformat(),
                "next_attempt": None,
            }}},
        )
        return

    # transient: build next retry entry
    entry = build_retry_entry(portal, msg, prev_attempts)
    if entry is None or entry.get("status") == "exhausted":
        # Should not happen with current build_retry_entry, but defensive
        await _add_notification(
            user_id, "error",
            f"{portal_label}: tentativi esauriti",
            f"Dopo {MAX_ATTEMPTS} tentativi automatici l'invio continua a fallire. Ultimo errore: {msg[:200]}",
            checkin_id=checkin_id, portal=portal,
        )
    else:
        if not was_pending:
            await _add_notification(
                user_id, "warning",
                f"{portal_label}: invio non riuscito",
                f"Errore temporaneo: {msg[:200]}. Riproveremo automaticamente.",
                checkin_id=checkin_id, portal=portal,
            )
    await db.checkins.update_one(
        {"checkin_id": checkin_id},
        {"$set": {f"retry_state.{portal}": entry}},
    )


# ----- Notifications API -----

@api_router.get("/notifications")
async def list_notifications(
    only_unread: bool = False, user=Depends(get_current_user)
):
    q: Dict[str, Any] = {"user_id": user["user_id"]}
    if only_unread:
        q["read"] = False
    items = await db.notifications.find(
        q, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    unread_count = await db.notifications.count_documents(
        {"user_id": user["user_id"], "read": False}
    )
    return {"items": items, "unread_count": unread_count}


@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str, user=Depends(get_current_user)
):
    r = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user["user_id"]},
        {"$set": {"read": True}},
    )
    return {"ok": r.modified_count > 0}


@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(user=Depends(get_current_user)):
    r = await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True, "marked": r.modified_count}


# ----- Manual retry trigger -----

@api_router.post("/checkins/{checkin_id}/retry/{portal}")
async def manual_retry(
    checkin_id: str, portal: str, user=Depends(get_current_user)
):
    """Force an immediate retry of a failed portal submission."""
    if portal not in ("alloggiati", "turismo5"):
        raise HTTPException(400, "Portal non valido (use 'alloggiati' or 'turismo5')")
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    await _retry_single_checkin(c, portal)
    return {"ok": True}


# ====================================================================
# BACKGROUND JOB: Retry failed submissions
# ====================================================================

async def _retry_single_checkin(c: Dict[str, Any], portal: str) -> None:
    """Retry a single (checkin, portal) pair: re-execute the submission."""
    user_id = c["user_id"]
    prop = await db.properties.find_one(
        {"property_id": c["property_id"], "user_id": user_id}, {"_id": 0}
    )
    if not prop:
        return

    if portal == "alloggiati":
        await _retry_alloggiati(c, prop)
    elif portal == "turismo5":
        await _retry_turismo5(c, prop)


async def _retry_alloggiati(c: Dict[str, Any], prop: Dict[str, Any]) -> None:
    """Reissue Alloggiati Web send_schedine."""
    cfg = prop.get("alloggiati", {})
    if not cfg.get("enabled") or not cfg.get("utente"):
        return

    # Rebuild schedine from stored guests
    guests = [GuestData(**g) for g in c.get("guests", [])]
    arr = datetime.fromisoformat(c["data_arrivo"])
    part = datetime.fromisoformat(c["data_partenza"])
    giorni = max(1, (part - arr).days)
    n = len(guests)
    tipos = [TIPO_OSPITE_SINGOLO] if n == 1 else [TIPO_CAPO_FAMIGLIA] + [TIPO_FAMILIARE] * (n - 1)

    tipo_account = cfg.get("tipo_account", "standard")
    id_app_raw = cfg.get("id_appartamento")
    id_app = int(id_app_raw) if id_app_raw is not None else None
    id_for_schedina = str(id_app) if (tipo_account == "appartamenti_file_unico" and id_app is not None) else ""
    schedine = [_guest_to_schedina(g, tipos[i], c["data_arrivo"], giorni, id_for_schedina) for i, g in enumerate(guests)]

    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    if not tok["success"]:
        result = {"success": False, "message": tok.get("message", "Auth fallita"), "schedine_preview": schedine}
    else:
        test_mode = c.get("mode") == "TEST"
        if test_mode:
            result = test_schedine(cfg["utente"], tok["token"], schedine, tipo_account=tipo_account, id_appartamento=id_app or 0)
        else:
            result = send_schedine(cfg["utente"], tok["token"], schedine, tipo_account=tipo_account, id_appartamento=id_app or 0)
        result["schedine_preview"] = schedine
        result["mode"] = "PROD (invio definitivo)" if not test_mode else "TEST (validazione, nessun invio reale)"

    await db.checkins.update_one(
        {"checkin_id": c["checkin_id"]},
        {"$set": {"results.alloggiati_web": result}},
    )
    await _process_submit_result(
        c["checkin_id"], c["user_id"], "alloggiati", "Alloggiati Web", result
    )


async def _retry_turismo5(c: Dict[str, Any], prop: Dict[str, Any]) -> None:
    """Reissue Turismo 5 movimentazione."""
    ross_cfg = prop.get("ross1000", {})
    if not ross_cfg.get("enabled"):
        return

    regione = ross_cfg.get("regione", "Abruzzo")
    endpoint_url = ross_cfg.get("endpoint_url") or REGIONAL_ENDPOINTS.get(regione, "")
    codice_struttura = ross_cfg.get("codice_struttura", "")
    test_mode = c.get("mode") == "TEST"
    guests = [GuestData(**g) for g in c.get("guests", [])]

    idcapo = f"{c['property_id'][:8]}-{c['data_arrivo']}"
    arrivi_list = []
    partenze_list = []
    for i, g in enumerate(guests):
        if len(guests) == 1:
            tipo_alloggiato = "16"
            idcapo_field = ""
        elif i == 0:
            tipo_alloggiato = "17"
            idcapo_field = ""
        else:
            tipo_alloggiato = "19"
            idcapo_field = idcapo
        item = {
            "idswh": f"{c['property_id'][:8]}-{c['data_arrivo']}-{i+1}",
            "tipoalloggiato": tipo_alloggiato,
            "idcapo": idcapo_field,
            "sesso": g.sesso,
            "cittadinanza": g.cittadinanza or ITALIA_CODE,
            "statoresidenza": g.cittadinanza or ITALIA_CODE,
            "luogoresidenza": "" if g.is_foreign else (g.codice_comune_nascita or ""),
            "datanascita": g.data_nascita,
            "statonascita": g.stato_nascita or ITALIA_CODE,
            "comunenascita": "" if g.is_foreign else (g.codice_comune_nascita or ""),
            "tipoturismo": "", "mezzotrasporto": "", "canaleprenotazione": "",
        }
        arrivi_list.append(item)
        partenze_list.append({"idswh": item["idswh"], "tipoalloggiato": tipo_alloggiato})

    n_camere = int(ross_cfg.get("n_camere", 1))
    n_letti = int(ross_cfg.get("n_letti", 2))
    movimenti = [
        {"data": c["data_arrivo"], "struttura": {"apertura": "SI", "camereoccupate": n_camere, "cameredisponibili": n_camere, "lettidisponibili": n_letti}, "arrivi": arrivi_list},
        {"data": c["data_partenza"], "struttura": {"apertura": "SI", "camereoccupate": 0, "cameredisponibili": n_camere, "lettidisponibili": n_letti}, "partenze": partenze_list},
    ]
    result = send_movimentazione(
        endpoint_url=endpoint_url,
        username=ross_cfg.get("utente", ""),
        password=ross_cfg.get("password", ""),
        codice_struttura=codice_struttura,
        movimenti=movimenti,
        prodotto=ross_cfg.get("nome_prodotto", "Dedomo"),
        test_mode=test_mode,
    )
    result["mode"] = "TEST" if test_mode else "PROD"

    await db.checkins.update_one(
        {"checkin_id": c["checkin_id"]},
        {"$set": {"results.ross1000": result}},
    )
    await _process_submit_result(
        c["checkin_id"], c["user_id"], "turismo5", "Turismo 5", result
    )


async def retry_failed_submissions():
    """Periodic job: find checkins with pending retries due now and re-attempt them."""
    now_iso = datetime.now(timezone.utc).isoformat()
    pending = await db.checkins.find(
        {
            "$or": [
                {"retry_state.alloggiati.status": "pending", "retry_state.alloggiati.next_attempt": {"$lte": now_iso}},
                {"retry_state.turismo5.status": "pending", "retry_state.turismo5.next_attempt": {"$lte": now_iso}},
            ]
        },
        {"_id": 0},
    ).to_list(200)

    if not pending:
        return
    logger.info(f"[retry-job] {len(pending)} retries dovuti")

    for c in pending:
        rs = c.get("retry_state", {}) or {}
        for portal in ("alloggiati", "turismo5"):
            entry = rs.get(portal) or {}
            if is_due_for_retry(entry):
                try:
                    await _retry_single_checkin(c, portal)
                except Exception as e:
                    logger.error(f"[retry-job] error retrying {c['checkin_id']}/{portal}: {e}")
                    # Schedule the next attempt even on exception
                    new_entry = build_retry_entry(portal, f"Eccezione: {str(e)[:200]}", int(entry.get("attempts", 0)))
                    if new_entry:
                        await db.checkins.update_one(
                            {"checkin_id": c["checkin_id"]},
                            {"$set": {f"retry_state.{portal}": new_entry}},
                        )


# ====================================================================
# BACKGROUND JOB: Auto-download Alloggiati Web receipts after 24h
# ====================================================================

scheduler: Optional[AsyncIOScheduler] = None


async def fetch_alloggiati_receipts():
    """Periodic job: for every PROD checkin older than 24h without a cached
    Alloggiati Web receipt, try to download it via Ricevuta API and store it.
    """
    # Polling window: try receipts from anywhere between 1h and 14d after creation.
    # Receipts are normally generated 24h after sending, but can sometimes appear earlier.
    # We poll hourly so the first few attempts before 24h are essentially free.
    cutoff_recent = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    cutoff_oldest = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    pending = await db.checkins.find(
        {
            "mode": "PROD",
            "results.alloggiati_web.success": True,
            # Skip checkins where all schedine were rejected (SchedineValide=0)
            "results.alloggiati_web.schedine_valide": {"$gt": 0},
            "alloggiati_ricevuta_pdf": {"$in": [None, ""]},
            "created_at": {"$lte": cutoff_recent, "$gte": cutoff_oldest},
            # Skip checkins we already tried 14+ times (likely no receipt will ever appear)
            "$or": [
                {"alloggiati_ricevuta_attempts": {"$exists": False}},
                {"alloggiati_ricevuta_attempts": {"$lt": 14}},
            ],
        },
        {"_id": 0},
    ).to_list(200)

    if not pending:
        return

    logger.info(f"[receipts-job] {len(pending)} check-in da processare")

    for c in pending:
        try:
            prop = await db.properties.find_one(
                {"property_id": c["property_id"], "user_id": c["user_id"]}, {"_id": 0}
            )
            if not prop:
                continue
            cfg = prop.get("alloggiati", {})
            if not (cfg.get("utente") and cfg.get("password") and cfg.get("ws_key")):
                continue

            tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
            if not tok.get("success"):
                logger.warning(f"[receipts-job] auth failed for {c['checkin_id']}")
                continue

            # Use the date when the schedina was actually sent (created_at)
            send_date = c["created_at"][:10]  # YYYY-MM-DD
            ric = get_ricevuta_pdf(cfg["utente"], tok["token"], send_date)
            if ric.get("success") and ric.get("pdf_base64"):
                await db.checkins.update_one(
                    {"checkin_id": c["checkin_id"]},
                    {
                        "$set": {
                            "alloggiati_ricevuta_pdf": ric["pdf_base64"],
                            "alloggiati_ricevuta_downloaded_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                )
                logger.info(f"[receipts-job] saved receipt for {c['checkin_id']}")
            else:
                raw = ric.get("raw") or {}
                outcome = raw.get("RicevutaResult") or {}
                logger.warning(
                    f"[receipts-job] no receipt for {c['checkin_id']} (date={send_date}): "
                    f"esito={outcome.get('esito')} ErroreCod={outcome.get('ErroreCod')} "
                    f"ErroreDes={outcome.get('ErroreDes')} has_pdf={bool(ric.get('pdf_base64'))}"
                )
                # Increment attempt counter so we eventually give up
                await db.checkins.update_one(
                    {"checkin_id": c["checkin_id"]},
                    {"$inc": {"alloggiati_ricevuta_attempts": 1}},
                )
        except Exception as e:
            logger.error(f"[receipts-job] error on {c.get('checkin_id')}: {e}")


async def daily_ross1000_zero_movement():
    """Daily at 23:59 (Europe/Rome): for every PROD property with ross1000 enabled
    that didn't transmit any check-in TODAY, send a "zero movement" payload."""
    from datetime import date as _date
    today = _date.today()
    today_iso = today.isoformat()

    cursor = db.properties.find(
        {"mode": "PROD", "ross1000.enabled": True},
        {"_id": 0, "property_id": 1, "user_id": 1, "nome": 1, "ross1000": 1},
    )
    async for p in cursor:
        try:
            # Check if any checkin for this property transmitted Ross1000 today
            already = await db.checkins.find_one(
                {
                    "property_id": p["property_id"],
                    "user_id": p["user_id"],
                    "mode": "PROD",
                    "results.ross1000.success": True,
                    "$or": [
                        {"results.ross1000.submitted_at": {"$regex": f"^{today_iso}"}},
                        {"data_arrivo": today_iso},
                    ],
                },
                {"_id": 0, "checkin_id": 1},
            )
            if already:
                continue

            # Skip if a zero-movement was already sent today
            existing = await db.ross1000_zero_movements.find_one(
                {"property_id": p["property_id"], "date": today_iso}
            )
            if existing:
                continue

            r1k_cfg = p.get("ross1000") or {}
            payload = {
                "rentals": [p.get("nome", "")],
                "arrival_guest_count": 0,
                "departure_guest_count": 0,
                "result": {
                    "arrivi": None,
                    "partenze": None,
                    "prenotazioni": None,
                    "retifiche": None,
                },
            }

            try:
                from services.ross1000 import submit_to_endpoint as _ross_submit
                result = _ross_submit(
                    endpoint_url=r1k_cfg.get("endpoint_url", ""),
                    username=r1k_cfg.get("utente", ""),
                    password=r1k_cfg.get("password", ""),
                    format_type=r1k_cfg.get("format_type", "rest_json"),
                    payload=payload,
                    test_mode=False,
                )
            except Exception as e:
                result = {"success": False, "message": f"Errore client: {e}"}

            await db.ross1000_zero_movements.insert_one(
                {
                    "property_id": p["property_id"],
                    "user_id": p["user_id"],
                    "date": today_iso,
                    "payload": payload,
                    "result": result,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            logger.info(
                f"[ross1000-zero] property={p.get('nome')} success={result.get('success')}"
            )
        except Exception as e:
            logger.error(f"[ross1000-zero] error on property {p.get('property_id')}: {e}")


@app.on_event("startup")
async def startup_scheduler():
    global scheduler
    scheduler = AsyncIOScheduler(timezone="Europe/Rome")
    # Run every hour, plus once at startup after 60s
    scheduler.add_job(fetch_alloggiati_receipts, "interval", hours=1, id="aw_receipts")
    scheduler.add_job(
        fetch_alloggiati_receipts, "date",
        run_date=datetime.now(timezone.utc) + timedelta(seconds=60),
        id="aw_receipts_initial",
    )
    # Retry failed submissions every 15 minutes (picks up due retries within 15min granularity)
    scheduler.add_job(retry_failed_submissions, "interval", minutes=15, id="retry_failed")
    scheduler.add_job(
        retry_failed_submissions, "date",
        run_date=datetime.now(timezone.utc) + timedelta(seconds=30),
        id="retry_failed_initial",
    )
    # Refresh external iCal feeds every 4 hours
    scheduler.add_job(refresh_ical_caches, "interval", hours=4, id="ical_refresh")
    scheduler.add_job(
        refresh_ical_caches, "date",
        run_date=datetime.now(timezone.utc) + timedelta(seconds=45),
        id="ical_refresh_initial",
    )
    # Daily at 23:59 Europe/Rome — send Ross1000 zero-movement for inactive properties
    scheduler.add_job(
        daily_ross1000_zero_movement,
        "cron", hour=23, minute=59,
        id="ross1000_zero_daily",
    )
    scheduler.start()
    logger.info("[scheduler] started")


# Include all routes AFTER they are all defined
app.include_router(api_router)
