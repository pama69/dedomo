"""
Alloggiati Web SOAP integration.
Web service: https://alloggiatiweb.poliziadistato.it/service/service.asmx

Operations used:
  - GenerateToken(Utente, Password, WsKey) -> token + expiration
  - Authentication_Test(Utente, token)
  - Test(Utente, token, ElencoSchedine) -> validates without sending
  - Send(Utente, token, ElencoSchedine) -> definitive submission
  - Ricevuta(Utente, token, Data) -> PDF bytes (base64)

Each "schedina" is a fixed-width text line (168 chars) per guest.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import zeep
from zeep import Client
from zeep.transports import Transport
import requests

WSDL_URL = "https://alloggiatiweb.poliziadistato.it/service/service.asmx?wsdl"

# Tipo Alloggiato codes
TIPO_OSPITE_SINGOLO = "16"
TIPO_CAPO_FAMIGLIA = "17"
TIPO_FAMILIARE = "18"
TIPO_CAPO_GRUPPO = "19"
TIPO_MEMBRO_GRUPPO = "20"

# Tipo Documento codes per official tabella Tipi_Documento
TIPO_DOC_MAP = {
    "CARTA_IDENTITA": "IDENT",
    "CARTA_IDENTITA_ELETT": "IDELE",
    "PASSAPORTO": "PASOR",
    "PATENTE": "PATEN",
    "PATENTE_GUIDA": "PATEN",
    # Allow passing codes directly
    "IDENT": "IDENT",
    "IDELE": "IDELE",
    "PASOR": "PASOR",
    "PATEN": "PATEN",
}


def _pad(value: str, length: int) -> str:
    """Pad right with spaces, truncate if too long."""
    if value is None:
        value = ""
    value = str(value).upper()
    return value[:length].ljust(length, " ")


def _pad_num(value: str, length: int) -> str:
    """Pad left with zeros for numeric fields."""
    if value is None:
        value = ""
    return str(value).zfill(length)[:length]


def build_schedina(
    tipo_alloggiato: str,
    data_arrivo: str,  # YYYY-MM-DD
    giorni_permanenza: int,
    cognome: str,
    nome: str,
    sesso: str,  # accepts "M"/"F" or "1"/"2"
    data_nascita: str,  # YYYY-MM-DD
    codice_comune_nascita: str = "",  # 9 chars (only for Italy)
    sigla_provincia_nascita: str = "",  # 2 chars (only for Italy)
    codice_stato_nascita: str = "",  # 9 chars
    codice_stato_cittadinanza: str = "",  # 9 chars
    tipo_documento: str = "",  # 5 chars - only for capofamiglia/singolo/capogruppo
    numero_documento: str = "",  # 20 chars
    codice_stato_rilascio_doc: str = "",  # 9 chars (or 9-char comune code)
    id_appartamento_file_unico: str = "",  # 6 chars - ONLY for FileUnico (TABELLA 2)
) -> str:
    """Build a single fixed-width schedina line.

    Standard tracciato (TABELLA 1): 168 chars.
      pos  1-2:   Tipo Alloggiato (numerico, es. 16/17/18/19/20)
      pos  3-12:  Data Arrivo (gg/mm/aaaa)
      pos 13-14:  Giorni Permanenza (max 30)
      pos 15-64:  Cognome (50)
      pos 65-94:  Nome (30)
      pos    95:  Sesso (1=M, 2=F) -- NOT M/F
      pos 96-105: Data Nascita (gg/mm/aaaa)
      pos 106-114: Comune Nascita (9, codice ISTAT, solo IT)
      pos 115-116: Sigla Provincia Nascita (2, solo IT)
      pos 117-125: Stato Nascita (9, codice tabella stati)
      pos 126-134: Cittadinanza (9)
      pos 135-139: Tipo Documento (5, codice)
      pos 140-159: Numero Documento (20)
      pos 160-168: Luogo Rilascio Documento (9, codice stato OR comune)

    FileUnico tracciato (TABELLA 2): 168 + 6 chars (IdAppartamento appended).
    """

    def _fmt_date(d):
        if not d:
            return " " * 10
        try:
            dt = datetime.fromisoformat(d)
            return dt.strftime("%d/%m/%Y")
        except Exception:
            return " " * 10

    # Map sesso M/F -> 1/2 if user passed letters
    sesso_code = str(sesso).strip().upper()
    if sesso_code == "M":
        sesso_code = "1"
    elif sesso_code == "F":
        sesso_code = "2"

    line = ""
    line += _pad(tipo_alloggiato, 2)              # 1-2
    line += _fmt_date(data_arrivo)                # 3-12
    line += _pad_num(str(giorni_permanenza), 2)   # 13-14
    line += _pad(cognome, 50)                     # 15-64
    line += _pad(nome, 30)                        # 65-94
    line += _pad(sesso_code, 1)                   # 95
    line += _fmt_date(data_nascita)               # 96-105
    line += _pad(codice_comune_nascita or " ", 9) # 106-114
    line += _pad(sigla_provincia_nascita or " ", 2)  # 115-116
    line += _pad(codice_stato_nascita, 9)         # 117-125
    line += _pad(codice_stato_cittadinanza, 9)    # 126-134
    line += _pad(tipo_documento, 5)               # 135-139
    line += _pad(numero_documento, 20)            # 140-159
    line += _pad(codice_stato_rilascio_doc, 9)    # 160-168

    line = line.ljust(168, " ")[:168]

    # Append IdAppartamento for FileUnico format
    if id_appartamento_file_unico:
        id_str = str(id_appartamento_file_unico).strip().zfill(6)[:6]
        line += id_str

    return line


def _get_client() -> Client:
    transport = Transport(timeout=30, operation_timeout=30)
    return Client(WSDL_URL, transport=transport)


def generate_token(utente: str, password: str, ws_key: str) -> Dict[str, Any]:
    """Returns dict: {success, token, expires, message}"""
    try:
        client = _get_client()
        resp = client.service.GenerateToken(
            Utente=utente, Password=password, WsKey=ws_key
        )
        # Zeep returns a multi-field response:
        #   GenerateTokenResult: TokenInfo (issued, expires, token)
        #   result: EsitoOperazioneServizio (esito, ErroreCod, ErroreDes, ErroreDettaglio)
        result = zeep.helpers.serialize_object(resp)
        outcome = result.get("result") or {}
        token_info = result.get("GenerateTokenResult") or {}

        if outcome.get("esito"):
            return {
                "success": True,
                "token": token_info.get("token"),
                "issued": str(token_info.get("issued")),
                "expires": str(token_info.get("expires")),
                "raw": result,
            }

        # Build a useful error message
        err_des = outcome.get("ErroreDes") or ""
        err_det = outcome.get("ErroreDettaglio") or ""
        err_cod = outcome.get("ErroreCod")
        msg_parts = []
        if err_cod is not None:
            msg_parts.append(f"Cod.{err_cod}")
        if err_des:
            msg_parts.append(err_des)
        if err_det and err_det != err_des:
            msg_parts.append(err_det)
        message = " · ".join(msg_parts) or "Autenticazione fallita (esito false)"
        return {"success": False, "message": message, "raw": result}
    except Exception as e:
        return {"success": False, "message": f"Errore connessione: {str(e)}"}


def test_schedine(
    utente: str,
    token: str,
    schedine: List[str],
    tipo_account: str = "standard",
    id_appartamento: int = 0,
) -> Dict[str, Any]:
    """Validate schedine without submitting.

    tipo_account:
      - "standard": hotels, B&B (uses Test)
      - "appartamenti": apartment managers (uses GestioneAppartamenti_Test, requires id_appartamento)
      - "appartamenti_file_unico": apartment managers, single-file mode
    """
    try:
        client = _get_client()
        if tipo_account == "appartamenti":
            resp = client.service.GestioneAppartamenti_Test(
                Utente=utente,
                token=token,
                ElencoSchedine={"string": schedine},
                IdAppartamento=id_appartamento,
            )
            outcome_key = "GestioneAppartamenti_TestResult"
        elif tipo_account == "appartamenti_file_unico":
            resp = client.service.GestioneAppartamenti_FileUnico_Test(
                Utente=utente,
                token=token,
                ElencoSchedine={"string": schedine},
            )
            outcome_key = "GestioneAppartamenti_FileUnico_TestResult"
        else:
            resp = client.service.Test(
                Utente=utente, token=token, ElencoSchedine={"string": schedine}
            )
            outcome_key = "TestResult"

        result = zeep.helpers.serialize_object(resp)
        outcome = result.get(outcome_key) or {}
        details = result.get("result") or {}

        success = bool(outcome.get("esito"))
        err_des = outcome.get("ErroreDes") or ""
        err_det = outcome.get("ErroreDettaglio") or ""
        err_cod = outcome.get("ErroreCod")
        msg_parts = []
        if err_cod is not None and err_cod != 0:
            msg_parts.append(f"Cod.{err_cod}")
        if err_des:
            msg_parts.append(err_des)
        if err_det and err_det != err_des:
            msg_parts.append(err_det)
        message = " · ".join(msg_parts) if not success else "Validazione OK"

        return {
            "success": success,
            "message": message,
            "details": details,
            "raw": result,
        }
    except Exception as e:
        return {"success": False, "message": f"Errore Test: {str(e)}"}


def send_schedine(
    utente: str,
    token: str,
    schedine: List[str],
    tipo_account: str = "standard",
    id_appartamento: int = 0,
) -> Dict[str, Any]:
    """Send schedine for real - selects the proper method based on account type."""
    try:
        client = _get_client()
        if tipo_account == "appartamenti":
            resp = client.service.GestioneAppartamenti_Send(
                Utente=utente,
                token=token,
                ElencoSchedine={"string": schedine},
                IdAppartamento=id_appartamento,
            )
            outcome_key = "GestioneAppartamenti_SendResult"
        elif tipo_account == "appartamenti_file_unico":
            resp = client.service.GestioneAppartamenti_FileUnico_Send(
                Utente=utente,
                token=token,
                ElencoSchedine={"string": schedine},
            )
            outcome_key = "GestioneAppartamenti_FileUnico_SendResult"
        else:
            resp = client.service.Send(
                Utente=utente, token=token, ElencoSchedine={"string": schedine}
            )
            outcome_key = "SendResult"

        result = zeep.helpers.serialize_object(resp)
        outcome = result.get(outcome_key) or {}
        details = result.get("result") or {}

        # The envelope `esito` is True if the SOAP call succeeded, but individual
        # schedine may still have been rejected. The real success requires:
        #   - envelope OK (esito=True)
        #   - SchedineValide > 0 (at least one accepted)
        envelope_ok = bool(outcome.get("esito"))
        schedine_valide = details.get("SchedineValide", 0) if isinstance(details, dict) else 0
        total_schedine = len(schedine)
        success = envelope_ok and schedine_valide == total_schedine

        # Collect per-schedina errors from EsitoOperazioneServizio list
        per_schedina_errors = []
        dettaglio = details.get("Dettaglio") if isinstance(details, dict) else None
        if isinstance(dettaglio, dict):
            esiti = dettaglio.get("EsitoOperazioneServizio") or []
            if not isinstance(esiti, list):
                esiti = [esiti]
            for i, ex in enumerate(esiti):
                if isinstance(ex, dict) and not ex.get("esito"):
                    per_schedina_errors.append(
                        f"#{i+1}: Cod.{ex.get('ErroreCod')} {ex.get('ErroreDes','')} — {ex.get('ErroreDettaglio','')}".strip()
                    )

        err_des = outcome.get("ErroreDes") or ""
        err_det = outcome.get("ErroreDettaglio") or ""
        err_cod = outcome.get("ErroreCod")
        msg_parts = []
        if err_cod is not None and err_cod != 0:
            msg_parts.append(f"Cod.{err_cod}")
        if err_des:
            msg_parts.append(err_des)
        if err_det and err_det != err_des:
            msg_parts.append(err_det)
        # Add the per-schedina rejections to the user-facing message
        if per_schedina_errors:
            msg_parts.append(
                f"{total_schedine - schedine_valide}/{total_schedine} schedine rifiutate"
            )
            msg_parts.extend(per_schedina_errors[:3])  # show first 3
        elif not envelope_ok:
            pass
        else:
            # envelope OK
            if schedine_valide == total_schedine:
                msg_parts = [f"Invio OK ({schedine_valide}/{total_schedine})"]
            else:
                msg_parts.append(f"Schedine valide: {schedine_valide}/{total_schedine}")

        message = " · ".join(msg_parts) if msg_parts else ("Invio OK" if success else "Errore sconosciuto")

        return {
            "success": success,
            "message": message,
            "schedine_valide": schedine_valide,
            "schedine_inviate": total_schedine,
            "per_schedina_errors": per_schedina_errors,
            "details": details,
            "raw": result,
        }
    except Exception as e:
        return {"success": False, "message": f"Errore Send: {str(e)}"}


def lista_appartamenti(utente: str, token: str) -> Dict[str, Any]:
    """Get the list of apartments registered for this account.

    Uses the Tabella method with tipo='ListaAppartamenti'.
    Returns a parsed list of dicts: [{id, descrizione, comune, prov, indirizzo, proprietario}].
    """
    try:
        client = _get_client()
        resp = client.service.Tabella(
            Utente=utente, token=token, tipo="ListaAppartamenti"
        )
        result = zeep.helpers.serialize_object(resp)
        outcome = result.get("TabellaResult") or {}
        csv_data = result.get("CSV") or ""

        if not outcome.get("esito"):
            err_des = outcome.get("ErroreDes") or "Errore"
            err_det = outcome.get("ErroreDettaglio") or ""
            err_cod = outcome.get("ErroreCod")
            msg = f"Cod.{err_cod} · {err_des} · {err_det}".strip(" ·")
            return {"success": False, "message": msg, "raw": result}

        # Parse CSV: IDAPP;Descrizione;COMUNE;PROV;Indirizzo;Proprietario
        rows = []
        lines = csv_data.strip().splitlines()
        for line in lines[1:]:  # skip header
            parts = [p.strip() for p in line.split(";")]
            if len(parts) >= 6 and parts[0].strip():
                rows.append({
                    "id": int(parts[0]) if parts[0].isdigit() else parts[0],
                    "descrizione": parts[1],
                    "comune": parts[2],
                    "prov": parts[3],
                    "indirizzo": parts[4],
                    "proprietario": parts[5],
                })
        return {
            "success": True,
            "appartamenti": rows,
            "csv_raw": csv_data,
        }
    except Exception as e:
        return {"success": False, "message": f"Errore: {str(e)}"}


def aggiungi_appartamento(
    utente: str,
    token: str,
    descrizione: str,
    comune_codice: str,
    indirizzo: str,
    proprietario: str,
) -> Dict[str, Any]:
    """Add a new apartment to the account.
    Returns success/message. The new IdAppartamento must be fetched via
    lista_appartamenti() after a successful add.
    """
    try:
        client = _get_client()
        resp = client.service.GestioneAppartamenti_AggiungiAppartamento(
            Utente=utente,
            token=token,
            Descrizione=str(descrizione),
            ComuneCodice=str(comune_codice),
            Indirizzo=str(indirizzo),
            Proprietario=str(proprietario),
        )
        result = zeep.helpers.serialize_object(resp)
        # The response could be either a dict with the named result, OR just the
        # EsitoOperazioneServizio directly. Handle both.
        if isinstance(result, dict):
            outcome = result.get("GestioneAppartamenti_AggiungiAppartamentoResult") or result
        else:
            outcome = {}
        success = bool(outcome.get("esito")) if isinstance(outcome, dict) else False
        err_cod = outcome.get("ErroreCod") if isinstance(outcome, dict) else None
        err_des = (outcome.get("ErroreDes") if isinstance(outcome, dict) else "") or ""
        err_det = (outcome.get("ErroreDettaglio") if isinstance(outcome, dict) else "") or ""
        if not success:
            msg = " · ".join([p for p in [f"Cod.{err_cod}" if err_cod else "", err_des, err_det] if p])
            return {"success": False, "message": msg or "Errore aggiunta", "raw": result}
        return {"success": True, "message": "Appartamento aggiunto", "raw": result}
    except Exception as e:
        return {"success": False, "message": f"Errore: {str(e)}"}


def cerca_comuni(utente: str, token: str, query: str) -> Dict[str, Any]:
    """Search ISTAT municipality codes by partial name.
    Uses Tabella(tipo='Luoghi') and filters locally.

    The 'Luoghi' table contains both Italian municipalities and foreign countries
    in a CSV with columns: Codice;Descrizione;...
    """
    try:
        rows = _get_luoghi_cached(utente, token)
        if rows is None:
            return {"success": False, "message": "Errore caricamento tabella Luoghi"}

        # Normalize query: strip parens, punctuation
        import re as _re
        q_raw = (query or "").strip()
        q_clean = _re.sub(r"\([^)]*\)", "", q_raw)
        q_clean = _re.sub(r"[^\w\s]", " ", q_clean)
        q_tokens = [t for t in q_clean.upper().split() if len(t) > 1]

        results = []
        for row in rows:
            if q_tokens and not all(t in row["_upper"] for t in q_tokens):
                continue
            results.append({
                "codice": row["codice"],
                "nome": row["nome"],
                "provincia": row["provincia"],
            })
            if len(results) >= 50:
                break
        return {"success": True, "results": results}
    except Exception as e:
        return {"success": False, "message": f"Errore: {str(e)}"}


# ============================================================
# IN-MEMORY CACHE for the 'Luoghi' table (Italian comuni + countries)
# TTL: 24h. The reference table changes rarely.
# Shared globally — all users hit the same parsed list.
# ============================================================
import time as _time
_LUOGHI_CACHE = {"rows": None, "fetched_at": 0}
_LUOGHI_TTL_SEC = 60 * 60 * 24  # 24h


def _get_luoghi_cached(utente: str, token: str):
    """Return parsed Luoghi rows from cache, fetching from SOAP if expired.
    Each row: {codice, nome, provincia, _upper}."""
    now = _time.time()
    if (_LUOGHI_CACHE["rows"] is not None
            and (now - _LUOGHI_CACHE["fetched_at"]) < _LUOGHI_TTL_SEC):
        return _LUOGHI_CACHE["rows"]

    client = _get_client()
    resp = client.service.Tabella(Utente=utente, token=token, tipo="Luoghi")
    result = zeep.helpers.serialize_object(resp)
    outcome = result.get("TabellaResult") or {}
    csv_data = result.get("CSV") or ""
    if not outcome.get("esito"):
        return None

    rows = []
    for line in csv_data.splitlines():
        parts = [p.strip() for p in line.split(";")]
        if len(parts) < 2:
            continue
        codice = parts[0]
        descrizione = parts[1]
        if not codice or codice.upper() == "CODICE":
            continue
        provincia = parts[2] if len(parts) > 2 else ""
        rows.append({
            "codice": codice,
            "nome": descrizione,
            "provincia": provincia,
            "_upper": descrizione.upper(),
        })
    _LUOGHI_CACHE["rows"] = rows
    _LUOGHI_CACHE["fetched_at"] = now
    return rows


def cerca_comuni_fast(utente: str, token: str, query: str, limit: int = 15) -> Dict[str, Any]:
    """Fast autocomplete search for Italian municipalities only.
    Uses the cached 'Luoghi' table. Italian comuni have codes NOT starting with '1'
    (Italian ISTAT codes start with the region prefix, e.g. '058091' = Roma).
    """
    try:
        rows = _get_luoghi_cached(utente, token)
        if rows is None:
            return {"success": False, "message": "Errore caricamento tabella"}

        q = (query or "").strip().upper()
        if not q:
            return {"success": True, "results": []}

        # Strip parens like "(RM)" and punctuation
        import re as _re
        q = _re.sub(r"\([^)]*\)", "", q).strip()
        q = _re.sub(r"[^\w\s]", " ", q).strip()
        if not q:
            return {"success": True, "results": []}

        matches = []
        for row in rows:
            codice = row["codice"]
            # Italian comuni: code starts with "0" or single digit followed by 5 digits
            # In practice: NOT starting with "1" (those are foreign countries)
            if codice.startswith("1"):
                continue
            if q not in row["_upper"]:
                continue
            matches.append(row)

        def _score(r):
            name = r["_upper"]
            if name == q:
                return 0
            if name.startswith(q):
                return 1
            return 2
        matches.sort(key=lambda r: (_score(r), r["nome"]))

        return {
            "success": True,
            "results": [
                {"codice": r["codice"], "nome": r["nome"], "provincia": r["provincia"]}
                for r in matches[:limit]
            ],
            "total": len(matches),
        }
    except Exception as e:
        return {"success": False, "message": f"Errore: {str(e)}"}


def cerca_paesi(utente: str, token: str, query: str, limit: int = 20) -> Dict[str, Any]:
    """Fast autocomplete search for foreign countries.

    Foreign country codes in 'Luoghi' typically start with '1000001' (e.g.
    100000100 = ITALIA, 100000113 = ALBANIA, 100000200 = STATI UNITI etc.).
    Italian comuni codes start with other digits (e.g. '058091' = Rome).
    """
    try:
        rows = _get_luoghi_cached(utente, token)
        if rows is None:
            return {"success": False, "message": "Errore caricamento tabella"}

        q = (query or "").strip().upper()
        if not q:
            return {"success": True, "results": []}

        # Translate ISO3 to Italian name if provided as 3-letter code
        if len(q) == 3 and q.isalpha():
            translated = ISO3_TO_ITALIAN_NAME.get(q)
            if translated:
                q = translated

        # Filter: country codes start with "1000" (foreign states convention in
        # Alloggiati Web Luoghi table). Italian comuni codes don't start with "1".
        matches = []
        for row in rows:
            codice = row["codice"]
            if not codice.startswith("1"):
                continue
            if q not in row["_upper"]:
                continue
            matches.append(row)

        # Rank: exact match first, then startswith, then contains
        def _score(r):
            name = r["_upper"]
            if name == q:
                return 0
            if name.startswith(q):
                return 1
            return 2
        matches.sort(key=lambda r: (_score(r), r["nome"]))

        return {
            "success": True,
            "results": [
                {"codice": r["codice"], "nome": r["nome"]}
                for r in matches[:limit]
            ],
            "total": len(matches),
        }
    except Exception as e:
        return {"success": False, "message": f"Errore: {str(e)}"}


# ISO3 -> Italian country name mapping for foreign state lookup
# Used as fallback when OCR only returns ISO3 code
ISO3_TO_ITALIAN_NAME = {
    "ITA": "ITALIA",
    "FRA": "FRANCIA", "DEU": "GERMANIA", "ESP": "SPAGNA", "PRT": "PORTOGALLO",
    "GBR": "REGNO UNITO", "IRL": "IRLANDA", "NLD": "PAESI BASSI", "BEL": "BELGIO",
    "LUX": "LUSSEMBURGO", "AUT": "AUSTRIA", "CHE": "SVIZZERA", "DNK": "DANIMARCA",
    "NOR": "NORVEGIA", "SWE": "SVEZIA", "FIN": "FINLANDIA", "ISL": "ISLANDA",
    "POL": "POLONIA", "CZE": "REPUBBLICA CECA", "SVK": "SLOVACCHIA",
    "HUN": "UNGHERIA", "ROU": "ROMANIA", "BGR": "BULGARIA", "GRC": "GRECIA",
    "ALB": "ALBANIA", "MKD": "MACEDONIA DEL NORD", "SRB": "SERBIA",
    "HRV": "CROAZIA", "SVN": "SLOVENIA", "BIH": "BOSNIA ED ERZEGOVINA",
    "MNE": "MONTENEGRO", "MDA": "MOLDAVIA", "UKR": "UCRAINA", "BLR": "BIELORUSSIA",
    "RUS": "RUSSIA", "LTU": "LITUANIA", "LVA": "LETTONIA", "EST": "ESTONIA",
    "TUR": "TURCHIA", "CYP": "CIPRO", "MLT": "MALTA",
    "USA": "STATI UNITI D'AMERICA", "CAN": "CANADA", "MEX": "MESSICO",
    "BRA": "BRASILE", "ARG": "ARGENTINA", "CHL": "CILE", "COL": "COLOMBIA",
    "PER": "PERU'", "VEN": "VENEZUELA", "URY": "URUGUAY", "ECU": "ECUADOR",
    "CHN": "CINA", "JPN": "GIAPPONE", "KOR": "COREA DEL SUD", "IND": "INDIA",
    "PAK": "PAKISTAN", "BGD": "BANGLADESH", "LKA": "SRI LANKA", "PHL": "FILIPPINE",
    "IDN": "INDONESIA", "MYS": "MALAYSIA", "THA": "THAILANDIA", "VNM": "VIETNAM",
    "SGP": "SINGAPORE", "AUS": "AUSTRALIA", "NZL": "NUOVA ZELANDA",
    "EGY": "EGITTO", "MAR": "MAROCCO", "TUN": "TUNISIA", "DZA": "ALGERIA",
    "LBY": "LIBIA", "SEN": "SENEGAL", "NGA": "NIGERIA", "GHA": "GHANA",
    "CIV": "COSTA D'AVORIO", "KEN": "KENYA", "ETH": "ETIOPIA", "ZAF": "SUDAFRICA",
    "ZAR": "REPUBBLICA DEMOCRATICA DEL CONGO", "COD": "REPUBBLICA DEMOCRATICA DEL CONGO",
    "ISR": "ISRAELE", "JOR": "GIORDANIA", "LBN": "LIBANO", "SYR": "SIRIA",
    "IRQ": "IRAQ", "IRN": "IRAN", "SAU": "ARABIA SAUDITA", "ARE": "EMIRATI ARABI UNITI",
    "QAT": "QATAR", "KWT": "KUWAIT", "AFG": "AFGHANISTAN",
}


def cerca_stato(utente: str, token: str, paese: str) -> Dict[str, Any]:
    """Search a foreign country in the 'Luoghi' table and return its 9-digit code.

    `paese` can be either:
      - Italian country name (e.g. "ALBANIA", "STATI UNITI D'AMERICA")
      - ISO3 code (e.g. "ALB", "USA") — will be mapped via ISO3_TO_ITALIAN_NAME

    Returns: {"success": bool, "codice": "9-digit code" or None, "nome": ..., "candidates": [...]}
    """
    if not paese:
        return {"success": False, "message": "Paese vuoto"}

    raw = paese.strip().upper()
    # If looks like ISO3, translate
    if len(raw) == 3 and raw.isalpha():
        translated = ISO3_TO_ITALIAN_NAME.get(raw)
        if translated:
            raw = translated

    # Foreign countries in the 'Luoghi' table have codes starting with prefixes
    # different from Italian comuni (Italian comuni: 9-digit ISTAT starting with 1xxxxxxxx).
    # Italy itself is 100000100. All other countries are listed by Italian name.
    r = cerca_comuni(utente, token, raw)
    if not r.get("success"):
        return {"success": False, "message": r.get("message", "Errore tabella")}

    candidates = r.get("results", [])
    if not candidates:
        return {"success": True, "codice": None, "candidates": []}

    # Best match: exact name (case-insensitive)
    best = next((x for x in candidates if x["nome"].upper() == raw), None)
    if not best:
        # Try without diacritics or apostrophes
        import re as _re
        def _norm(s: str) -> str:
            return _re.sub(r"[^A-Z0-9 ]", "", s.upper())
        best = next((x for x in candidates if _norm(x["nome"]) == _norm(raw)), None)
    if not best:
        best = candidates[0]

    return {
        "success": True,
        "codice": best["codice"],
        "nome": best["nome"],
        "candidates": candidates[:10],
    }


def authentication_test(utente: str, token: str) -> Dict[str, Any]:
    try:
        client = _get_client()
        resp = client.service.Authentication_Test(Utente=utente, token=token)
        result = zeep.helpers.serialize_object(resp)
        # Returns EsitoOperazioneServizio
        if isinstance(result, dict):
            outcome = result.get("Authentication_TestResult") or result
        else:
            outcome = {}
        return {
            "success": bool(outcome.get("esito")),
            "raw": result,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


def get_ricevuta_pdf(utente: str, token: str, data: str) -> Dict[str, Any]:
    """Get PDF receipt for a given date (YYYY-MM-DD).

    Response shape:
      RicevutaResult: EsitoOperazioneServizio
      PDF: base64 string
    """
    try:
        client = _get_client()
        dt = datetime.fromisoformat(data)
        data_str = dt.strftime("%d/%m/%Y")
        resp = client.service.Ricevuta(Utente=utente, token=token, Data=data_str)
        result = zeep.helpers.serialize_object(resp)
        # The SOAP service returns the PDF inside an envelope. The schema may
        # nest the result differently ("Ricevuta", "RicevutaResponse", "PDF", etc.)
        # Try multiple known shapes.
        outcome = result.get("RicevutaResult") or result.get("EsitoOperazioneServizio") or {}
        pdf_b64 = (
            result.get("PDF")
            or result.get("pdf")
            or result.get("Pdf")
            or (result.get("body") or {}).get("PDF") if isinstance(result.get("body"), dict) else None
        )
        # Last resort: scan all values for a long base64-looking string
        if not pdf_b64:
            import re as _re
            for v in result.values() if isinstance(result, dict) else []:
                if isinstance(v, str) and len(v) > 100 and _re.match(r"^[A-Za-z0-9+/=]+$", v[:60]):
                    pdf_b64 = v
                    break

        return {
            "success": bool(outcome.get("esito")) and bool(pdf_b64),
            "esito": outcome.get("esito"),
            "errore_cod": outcome.get("ErroreCod"),
            "errore_des": outcome.get("ErroreDes"),
            "pdf_base64": pdf_b64,
            "raw": result,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}
