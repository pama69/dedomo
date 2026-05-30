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

# Tipo Documento codes (most common)
TIPO_DOC_MAP = {
    "CI": "IDENTITA",
    "CARTA_IDENTITA": "IDENTITA",
    "PASSAPORTO": "PASOR",
    "PATENTE": "PATEN",
    "PATENTE_GUIDA": "PATEN",
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
    sesso: str,
    data_nascita: str,  # YYYY-MM-DD
    codice_comune_nascita: str = "",  # 9 chars (only for Italy)
    codice_stato_nascita: str = "",  # 9 chars
    codice_stato_cittadinanza: str = "",  # 9 chars
    tipo_documento: str = "",  # 5 chars - only for singolo/capofam/capogruppo
    numero_documento: str = "",  # 20 chars
    codice_stato_rilascio_doc: str = "",  # 9 chars
) -> str:
    """Build a single 168-char fixed-width schedina line."""

    # Format dates DD/MM/YYYY -> 10 chars
    def _fmt_date(d):
        if not d:
            return " " * 10
        try:
            dt = datetime.fromisoformat(d)
            return dt.strftime("%d/%m/%Y")
        except Exception:
            return " " * 10

    line = ""
    line += _pad(tipo_alloggiato, 2)  # 1-2
    line += _fmt_date(data_arrivo)  # 3-12 (10 chars)
    line += _pad_num(str(giorni_permanenza), 2)  # 13-14
    line += _pad(cognome, 50)  # 15-64
    line += _pad(nome, 30)  # 65-94
    line += _pad(sesso, 1)  # 95
    line += _fmt_date(data_nascita)  # 96-105 (10 chars)
    line += _pad(codice_comune_nascita or " ", 9)  # 106-114
    line += _pad(codice_stato_nascita, 9)  # 115-123
    line += _pad(codice_stato_cittadinanza, 9)  # 124-132
    line += _pad(tipo_documento, 5)  # 133-137
    line += _pad(numero_documento, 20)  # 138-157
    line += _pad(codice_stato_rilascio_doc, 9)  # 158-166

    # Ensure exactly 168 chars (some specs include trailing 2 for CR/LF)
    return line.ljust(168, " ")[:168]


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
        message = " · ".join(msg_parts) if not success else "Invio OK"

        return {
            "success": success,
            "message": message,
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
            Descrizione={"string": [descrizione]},
            ComuneCodice=comune_codice,
            Indirizzo=indirizzo,
            Proprietario=proprietario,
        )
        result = zeep.helpers.serialize_object(resp)
        outcome = result.get("GestioneAppartamenti_AggiungiAppartamentoResult") or {}
        success = bool(outcome.get("esito"))
        err_cod = outcome.get("ErroreCod")
        err_des = outcome.get("ErroreDes") or ""
        err_det = outcome.get("ErroreDettaglio") or ""
        if not success:
            msg = " · ".join([p for p in [f"Cod.{err_cod}" if err_cod else "", err_des, err_det] if p])
            return {"success": False, "message": msg or "Errore", "raw": result}
        return {"success": True, "message": "Appartamento aggiunto", "raw": result}
    except Exception as e:
        return {"success": False, "message": f"Errore: {str(e)}"}


def cerca_comuni(utente: str, token: str, query: str) -> Dict[str, Any]:
    """Search ISTAT municipality codes by partial name.
    Uses Tabella(tipo='Comuni') and filters locally.
    """
    try:
        client = _get_client()
        resp = client.service.Tabella(
            Utente=utente, token=token, tipo="Comuni"
        )
        result = zeep.helpers.serialize_object(resp)
        outcome = result.get("TabellaResult") or {}
        csv_data = result.get("CSV") or ""
        if not outcome.get("esito"):
            return {
                "success": False,
                "message": outcome.get("ErroreDes") or "Errore",
            }

        q = (query or "").strip().upper()
        results = []
        for line in csv_data.splitlines()[1:]:
            parts = [p.strip() for p in line.split(";")]
            if len(parts) >= 2 and (not q or q in parts[1].upper()):
                results.append({
                    "codice": parts[0],
                    "nome": parts[1],
                    "provincia": parts[2] if len(parts) > 2 else "",
                })
                if len(results) >= 30:
                    break
        return {"success": True, "results": results}
    except Exception as e:
        return {"success": False, "message": f"Errore: {str(e)}"}


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
        outcome = result.get("RicevutaResult") or {}
        pdf_b64 = result.get("PDF")
        return {
            "success": bool(outcome.get("esito")) and bool(pdf_b64),
            "pdf_base64": pdf_b64,
            "raw": result,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}
