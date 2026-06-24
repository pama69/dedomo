"""
Ross 1000 integration - regionally configurable.

Different Italian regions implement Ross 1000 differently:
- Some have REST APIs, some SOAP, some only CSV upload.
- This module provides a configurable HTTP client + standard CSV generator.

Each property in Settings stores:
  - endpoint_url: optional, if region has a working API
  - format: "rest_json" | "soap_xml" | "csv_manual"
  - extra config (region code, struttura code, etc.)

For Abruzzo and other regions without specs available, the default fallback
is CSV generation (downloadable) for manual upload to the regional portal.
"""

import csv
import io
from datetime import datetime
from typing import List, Dict, Any, Optional
import requests


def build_movimenti_csv(guests: List[Dict[str, Any]], struttura_code: str = "") -> str:
    """Generate a standard ISTAT movimenti CSV.
    Columns commonly expected: data_arrivo, data_partenza, cittadinanza,
    sesso, eta, paese_residenza, tipo_alloggiato, struttura_code.
    """
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(
        [
            "codice_struttura",
            "data_arrivo",
            "data_partenza",
            "cognome",
            "nome",
            "sesso",
            "data_nascita",
            "comune_nascita",
            "stato_nascita",
            "cittadinanza",
            "tipo_documento",
            "numero_documento",
            "stato_rilascio_documento",
            "stato_residenza",
            "comune_residenza",
        ]
    )
    for g in guests:
        writer.writerow(
            [
                struttura_code,
                g.get("data_arrivo", ""),
                g.get("data_partenza", ""),
                g.get("cognome", ""),
                g.get("nome", ""),
                g.get("sesso", ""),
                g.get("data_nascita", ""),
                g.get("comune_nascita", ""),
                g.get("stato_nascita", ""),
                g.get("cittadinanza", ""),
                g.get("tipo_documento", ""),
                g.get("numero_documento", ""),
                g.get("stato_rilascio_documento", ""),
                g.get("stato_residenza", ""),
                g.get("comune_residenza", ""),
            ]
        )
    return output.getvalue()


def submit_to_endpoint(
    endpoint_url: str,
    username: str,
    password: str,
    format_type: str,
    payload: Dict[str, Any],
    extra_headers: Optional[Dict[str, str]] = None,
    test_mode: bool = False,
) -> Dict[str, Any]:
    """Submit movimenti to the configured regional endpoint.

    In test_mode, returns success without actually calling the endpoint.
    """
    if test_mode:
        return {
            "success": True,
            "test_mode": True,
            "message": "[TEST MODE] Simulazione invio Ross 1000 - nessuna trasmissione reale effettuata.",
            "would_send": payload,
        }

    if not endpoint_url:
        return {
            "success": False,
            "message": "Endpoint Ross 1000 non configurato. Configura URL in Impostazioni o usa download CSV manuale.",
        }

    try:
        headers = {"Content-Type": "application/json"}
        if extra_headers:
            headers.update(extra_headers)

        if format_type == "rest_json":
            r = requests.post(
                endpoint_url,
                json=payload,
                auth=(username, password),
                headers=headers,
                timeout=30,
            )
        elif format_type == "soap_xml":
            r = requests.post(
                endpoint_url,
                data=payload.get("xml", ""),
                auth=(username, password),
                headers={"Content-Type": "text/xml; charset=utf-8"},
                timeout=30,
            )
        else:
            return {
                "success": False,
                "message": f"Formato '{format_type}' non supportato per invio diretto. Usa CSV manuale.",
            }

        return {
            "success": r.status_code in (200, 201, 202),
            "status_code": r.status_code,
            "response_text": r.text[:2000],
        }
    except Exception as e:
        return {"success": False, "message": f"Errore invio Ross 1000: {str(e)}"}
