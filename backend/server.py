"""
Ospitalo - Main FastAPI app.
Backend per invio dati ospiti case vacanza ai portali Alloggiati Web,
Ross 1000 e Imposta di Soggiorno comunale.
"""

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
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
from datetime import datetime, timezone, timedelta

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
from services.pdf_service import generate_tax_receipt


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Ospitalo API")
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
    }


@api_router.get("/auth/me")
async def auth_me(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user.get("name"),
        "picture": user.get("picture"),
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
    id_appartamento: int = 0  # required if tipo_account == "appartamenti"
    enabled: bool = True


class Ross1000Credentials(BaseModel):
    regione: str = "Abruzzo"
    utente: str = ""
    password: str = ""
    endpoint_url: str = ""  # auto-filled from REGIONAL_ENDPOINTS if blank
    format: str = "soap_v2"  # soap_v2 | csv_manual
    codice_struttura: str = ""
    nome_prodotto: str = "Ospitalo"
    n_camere: int = 1
    n_letti: int = 2
    enabled: bool = True


class ImpostaSoggiornoConfig(BaseModel):
    tariffa_per_notte: float = 0.0
    max_notti_tassabili: int = 7
    esenti_under_anni: int = 12
    endpoint_comune: str = ""
    enabled: bool = True


class PropertyCreate(BaseModel):
    nome: str
    indirizzo: str = ""
    comune: str = ""
    provincia: str = ""
    cap: str = ""
    cin: str = ""
    tipologia: str = "Casa Vacanza"
    mode: str = "TEST"  # TEST | PROD
    alloggiati: AlloggiatiCredentials = AlloggiatiCredentials()
    ross1000: Ross1000Credentials = Ross1000Credentials()
    imposta_soggiorno: ImpostaSoggiornoConfig = ImpostaSoggiornoConfig()


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
    """Search ISTAT municipalities by name (uses Alloggiati Web Tabella)."""
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

    # Send a minimal payload (no movimenti) just to test auth + endpoint
    resp = send_movimentazione(
        endpoint_url=endpoint_url,
        username=cfg["utente"],
        password=cfg["password"],
        codice_struttura=cfg["codice_struttura"],
        movimenti=[],
        prodotto=cfg.get("nome_prodotto", "Ospitalo"),
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
    """Quick credentials test: just GenerateToken + Authentication_Test.
    Returns detailed response for debugging.
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
    return {
        "success": auth["success"],
        "step": "Authentication_Test",
        "token_expires": tok.get("expires"),
        "message": "Credenziali valide" if auth["success"] else (auth.get("message") or "Auth test fallito"),
        "auth_raw": auth.get("raw"),
    }


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
    sesso: str  # M | F
    data_nascita: str  # YYYY-MM-DD
    luogo_nascita: str = ""
    stato_nascita: str = "ITA"
    cittadinanza: str = "ITA"
    tipo_documento: str = "CARTA_IDENTITA"
    numero_documento: str = ""
    stato_rilascio_documento: str = "ITA"
    codice_comune_nascita: str = ""  # only for italians


class CheckinSubmit(BaseModel):
    property_id: str
    data_arrivo: str  # YYYY-MM-DD
    data_partenza: str  # YYYY-MM-DD
    guests: List[GuestData]


def _guest_to_schedina(
    g: GuestData, tipo_alloggiato: str, data_arrivo: str, giorni: int
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
        stato_ril_field = g.stato_rilascio_documento

    return build_schedina(
        tipo_alloggiato=tipo_alloggiato,
        data_arrivo=data_arrivo,
        giorni_permanenza=giorni,
        cognome=g.cognome,
        nome=g.nome,
        sesso=g.sesso,
        data_nascita=g.data_nascita,
        codice_comune_nascita=g.codice_comune_nascita,
        codice_stato_nascita=g.stato_nascita,
        codice_stato_cittadinanza=g.cittadinanza,
        tipo_documento=tipo_doc_field,
        numero_documento=num_doc_field,
        codice_stato_rilascio_doc=stato_ril_field,
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

    arr = datetime.fromisoformat(body.data_arrivo)
    part = datetime.fromisoformat(body.data_partenza)
    giorni = max(1, (part - arr).days)
    test_mode = prop.get("mode", "TEST") == "TEST"

    results: Dict[str, Any] = {"test_mode": test_mode}

    # -------- ALLOGGIATI WEB --------
    alloggiati_cfg = prop.get("alloggiati", {})
    if alloggiati_cfg.get("enabled") and alloggiati_cfg.get("utente"):
        # Determine tipo_alloggiato
        n = len(body.guests)
        if n == 1:
            tipos = [TIPO_OSPITE_SINGOLO]
        else:
            # Capo famiglia + familiari (simpler default)
            tipos = [TIPO_CAPO_FAMIGLIA] + [TIPO_FAMILIARE] * (n - 1)

        schedine = [
            _guest_to_schedina(g, tipos[i], body.data_arrivo, giorni)
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
                    id_appartamento=int(alloggiati_cfg.get("id_appartamento", 0)),
                )
                resp["mode"] = "TEST (validazione, nessun invio reale)"
            else:
                resp = send_schedine(
                    alloggiati_cfg["utente"],
                    tok["token"],
                    schedine,
                    tipo_account=alloggiati_cfg.get("tipo_account", "standard"),
                    id_appartamento=int(alloggiati_cfg.get("id_appartamento", 0)),
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
                tipo_alloggiato = "18"  # familiare
                idcapo_field = idcapo

            arrivi_list.append({
                "idswh": f"{body.property_id[:8]}-{body.data_arrivo}-{i+1}",
                "tipoalloggiato": tipo_alloggiato,
                "idcapo": idcapo_field,
                "sesso": g.sesso,
                "cittadinanza": map_country_iso3_to_code(g.cittadinanza) or g.cittadinanza,
                "statoresidenza": map_country_iso3_to_code(g.cittadinanza) or g.cittadinanza,
                "luogoresidenza": g.codice_comune_nascita or "",
                "datanascita": g.data_nascita,
                "statonascita": map_country_iso3_to_code(g.stato_nascita) or g.stato_nascita,
                "comunenascita": g.codice_comune_nascita or "",
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
                prodotto=ross_cfg.get("nome_prodotto", "Ospitalo"),
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
    items = await db.checkins.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(1000)
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
    """Download official Alloggiati Web PDF receipt (only after PROD send)."""
    c = await db.checkins.find_one(
        {"checkin_id": checkin_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not c:
        raise HTTPException(404, "Check-in non trovato")
    if c.get("mode") == "TEST":
        raise HTTPException(
            400, "Ricevuta ufficiale disponibile solo per invii in modalità PRODUZIONE"
        )

    prop = await db.properties.find_one(
        {"property_id": c["property_id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    cfg = prop.get("alloggiati", {})
    tok = generate_token(cfg["utente"], cfg["password"], cfg["ws_key"])
    if not tok["success"]:
        raise HTTPException(401, tok.get("message", "Autenticazione fallita"))
    ric = get_ricevuta_pdf(cfg["utente"], tok["token"], c["data_arrivo"])
    if not ric.get("success") or not ric.get("pdf_base64"):
        raise HTTPException(404, "Ricevuta non disponibile dal portale")

    pdf_bytes = base64.b64decode(ric["pdf_base64"])
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="alloggiati_{checkin_id}.pdf"'
        },
    )


# ====================================================================

@api_router.get("/")
async def root():
    return {"app": "Ospitalo", "status": "ok"}


app.include_router(api_router)

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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
