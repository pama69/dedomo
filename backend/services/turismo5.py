"""
Turismo 5 / Ross 1000 integration via SOAP web service (checkinV2).

Operation: inviaMovimentazione (HTTP POST + Basic Auth)
Namespace: http://checkin.ws.service.turismo5.gies.it/

Each region has its own endpoint, but the XML structure is identical
(version 3 of the unified Turismo 5 spec).
"""

import requests
from datetime import datetime
from typing import List, Dict, Any
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.sax.saxutils import escape

# Pre-defined regional endpoints from the official Turismo 5 v3 spec
REGIONAL_ENDPOINTS = {
    "Abruzzo": "https://app.regione.abruzzo.it/Turismo5/ws/checkinV2",
    "Basilicata": "https://sist-aptbasilicata.turitweb.it/ws/checkinV1",
    "Calabria": "https://sirdat.regione.calabria.it/ws/checkinV2",
    "Emilia-Romagna": "https://datiturismo.regione.emilia-romagna.it/ws/checkinV2",
    "Lazio": "https://lazioturismo.ross1000.it/ws/checkinV2",
    "Liguria": "https://turismows.regione.liguria.it/ws/checkinV2",
    "Lombardia": "https://www.flussituristici.servizirl.it/Turismo5/app/ws/checkinV2",
    "Marche": "https://istrice-ross1000.turismo.marche.it/ws/checkinV2",
    "Molise": "https://moliseturismo.ross1000.it/ws/checkinV2",
    "Piemonte": "https://piemontedatiturismo.regione.piemonte.it/ws/checkinV2",
    "Sardegna": "https://sardegnaturismo.ross1000.it/ws/checkinV2",
    "Toscana": "https://toscanaturismo.ross1000.it/turismo5-web/ws/checkinV2",
    "Veneto": "https://flussituristici.regione.veneto.it/ws/checkinV2",
}

# Italy country code for citizen/state fields (9-digit ISTAT)
ITALIA_CODE = "100000100"


def _fmt_date(iso_date: str) -> str:
    """YYYY-MM-DD -> aaaammgg"""
    if not iso_date:
        return ""
    dt = datetime.fromisoformat(iso_date)
    return dt.strftime("%Y%m%d")


def build_movimentazione_xml(
    codice_struttura: str,
    movimenti: List[Dict[str, Any]],
    prodotto: str = "Ospitalo",
) -> str:
    """Build the SOAP envelope XML for inviaMovimentazione.

    movimenti = list of {
      "data": "YYYY-MM-DD",
      "struttura": {apertura, camereoccupate, cameredisponibili, lettidisponibili},
      "arrivi": [...],
      "partenze": [...],
      "prenotazioni": [...],
    }
    """
    soap_ns = "http://schemas.xmlsoap.org/soap/envelope/"
    ns2 = "http://checkin.ws.service.turismo5.gies.it/"

    envelope = Element(f"{{{soap_ns}}}Envelope")
    envelope.set("xmlns:S", soap_ns)
    body = SubElement(envelope, f"{{{soap_ns}}}Body")
    invia = SubElement(body, f"{{{ns2}}}inviaMovimentazione")
    invia.set("xmlns:ns2", ns2)

    mvz = SubElement(invia, "movimentazione")
    SubElement(mvz, "codice").text = codice_struttura
    SubElement(mvz, "prodotto").text = prodotto

    for m in movimenti:
        mov = SubElement(mvz, "movimento")
        SubElement(mov, "data").text = _fmt_date(m["data"])

        s = m.get("struttura", {})
        struttura = SubElement(mov, "struttura")
        SubElement(struttura, "apertura").text = s.get("apertura", "SI")
        SubElement(struttura, "camereoccupate").text = str(s.get("camereoccupate", 0))
        SubElement(struttura, "cameredisponibili").text = str(s.get("cameredisponibili", 0))
        SubElement(struttura, "lettidisponibili").text = str(s.get("lettidisponibili", 0))

        arrivi = m.get("arrivi", [])
        if arrivi:
            arrivi_el = SubElement(mov, "arrivi")
            for a in arrivi:
                ae = SubElement(arrivi_el, "arrivo")
                SubElement(ae, "idswh").text = str(a.get("idswh", ""))
                SubElement(ae, "tipoalloggiato").text = str(a.get("tipoalloggiato", "16"))
                SubElement(ae, "idcapo").text = str(a.get("idcapo", ""))
                SubElement(ae, "sesso").text = a.get("sesso", "")
                SubElement(ae, "cittadinanza").text = a.get("cittadinanza", "")
                SubElement(ae, "statoresidenza").text = a.get("statoresidenza", "")
                SubElement(ae, "luogoresidenza").text = a.get("luogoresidenza", "")
                SubElement(ae, "datanascita").text = _fmt_date(a.get("datanascita", ""))
                SubElement(ae, "statonascita").text = a.get("statonascita", "")
                SubElement(ae, "comunenascita").text = a.get("comunenascita", "")
                SubElement(ae, "tipoturismo").text = a.get("tipoturismo", "")
                SubElement(ae, "mezzotrasporto").text = a.get("mezzotrasporto", "")
                SubElement(ae, "canaleprenotazione").text = a.get("canaleprenotazione", "")

        partenze = m.get("partenze", [])
        if partenze:
            partenze_el = SubElement(mov, "partenze")
            for p in partenze:
                pe = SubElement(partenze_el, "partenza")
                SubElement(pe, "idswh").text = str(p.get("idswh", ""))
                SubElement(pe, "tipoalloggiato").text = str(p.get("tipoalloggiato", "16"))
                SubElement(pe, "arrivo").text = _fmt_date(p.get("arrivo", ""))

    xml_str = tostring(envelope, encoding="utf-8", xml_declaration=False).decode("utf-8")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_str


def send_movimentazione(
    endpoint_url: str,
    username: str,
    password: str,
    codice_struttura: str,
    movimenti: List[Dict[str, Any]],
    prodotto: str = "Ospitalo",
    test_mode: bool = False,
) -> Dict[str, Any]:
    """Send via SOAP POST with Basic Auth.

    In test_mode returns the would-be-sent XML without actually calling.
    """
    xml = build_movimentazione_xml(codice_struttura, movimenti, prodotto)

    if test_mode:
        return {
            "success": True,
            "test_mode": True,
            "message": "[TEST MODE] XML generato, nessun invio effettuato.",
            "xml_preview": xml,
        }

    if not endpoint_url:
        return {
            "success": False,
            "message": "Endpoint Turismo 5 / Ross 1000 mancante (regione non riconosciuta?).",
        }

    # Strip ?wsdl if present
    target_url = endpoint_url.split("?")[0]

    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "",
    }
    try:
        r = requests.post(
            target_url,
            data=xml.encode("utf-8"),
            headers=headers,
            auth=(username, password),
            timeout=30,
        )
        ok = r.status_code == 200 and "Fault" not in r.text and "fault" not in r.text
        return {
            "success": ok,
            "status_code": r.status_code,
            "response_text": r.text[:4000],
            "xml_preview": xml,
            "message": (
                "Invio completato"
                if ok
                else f"HTTP {r.status_code} - {r.text[:300]}"
            ),
        }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "message": f"Errore connessione: {str(e)}",
            "xml_preview": xml,
        }


def map_country_iso3_to_code(iso3: str) -> str:
    """Very minimal mapping. Italy = 100000100.
    For other countries, the actual 9-digit code must be obtained from the
    official table (`tabella_stati.csv` from Turismo 5 docs).
    Returns empty if unknown so the user knows to fill it.
    """
    if not iso3:
        return ""
    if iso3.upper() in ("ITA", "ITALIA", "IT"):
        return ITALIA_CODE
    return ""  # unknown: user must supply 9-digit code manually
