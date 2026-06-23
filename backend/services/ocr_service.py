"""
OCR service - extracts guest data from photos of Italian/foreign ID documents.
Uses gpt-4o-mini vision via OpenAI API. Handles MRZ codes natively.
gpt-4o-mini is ~5x cheaper than gpt-5.2 with comparable accuracy on documents.
"""

import os
import json
import base64
import re
import logging
from typing import Dict, Any
from openai import AsyncOpenAI
import openai

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """Sei un esperto OCR specializzato in documenti italiani ed esteri: Carta d'Identità (CIE/CIE elettronica/cartacea), Passaporto, Patente di Guida.

Devi estrarre i dati anagrafici dal documento. Se è presente una zona MRZ (Machine Readable Zone), usala come fonte primaria perché è più affidabile.

Restituisci ESCLUSIVAMENTE un JSON valido (no markdown, no testo extra) con questi campi:
{
  "tipo_documento": "CARTA_IDENTITA" | "PASSAPORTO" | "PATENTE",
  "numero_documento": "string",
  "cognome": "string maiuscolo",
  "nome": "string maiuscolo",
  "sesso": "M" | "F",
  "data_nascita": "YYYY-MM-DD",
  "luogo_nascita": "string (città/comune di nascita scritto come appare sul documento)",
  "stato_nascita_nome": "string (NOME DEL PAESE IN ITALIANO MAIUSCOLO, es. ITALIA, ALBANIA, GERMANIA, STATI UNITI, REGNO UNITO, FRANCIA, ROMANIA)",
  "stato_nascita_iso3": "string codice ISO3 (es. ITA, FRA, USA, ALB, DEU, ROU, GBR)",
  "cittadinanza_nome": "string (NOME PAESE IN ITALIANO MAIUSCOLO)",
  "cittadinanza_iso3": "string codice ISO3",
  "data_scadenza": "YYYY-MM-DD",
  "stato_rilascio_documento_iso3": "string codice ISO3",
  "is_foreign": true | false,
  "mrz_detected": true | false,
  "confidence": "alta" | "media" | "bassa"
}

REGOLE:
- Date sempre nel formato YYYY-MM-DD.
- Cognome e nome sempre in MAIUSCOLO senza accenti.
- Se un campo non è leggibile, metti stringa vuota "".
- Se la qualità dell'immagine è scarsa, imposta confidence="bassa".
- `is_foreign` = true SE la cittadinanza non è italiana (stato_nascita_iso3 e cittadinanza_iso3 ≠ ITA). Per passaporti stranieri il paese di cittadinanza è quello che ha emesso il documento.
- `stato_nascita_nome` e `cittadinanza_nome` devono essere il NOME ITALIANO DEL PAESE (NON in inglese, NON sigla). Esempi: "ALBANIA", "FRANCIA", "GERMANIA", "STATI UNITI", "REGNO UNITO", "ROMANIA", "ITALIA".
- Per passaporti italiani: tutti i campi paese = ITALIA / ITA, is_foreign=false.
- Riconosci MRZ a 2 o 3 righe (TD1, TD2, TD3) e estrai i dati da lì se disponibili. Nel MRZ il codice paese è 3 lettere.
"""


async def extract_document_data(image_base64: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """Send image to vision model and return structured data."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY non configurata"}

    if "," in image_base64 and image_base64.startswith("data:"):
        image_base64 = image_base64.split(",", 1)[1]

    client = AsyncOpenAI(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Estrai i dati anagrafici da questo documento e restituisci SOLO il JSON richiesto."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_base64}",
                                "detail": "high",
                            },
                        },
                    ],
                },
            ],
            max_tokens=1000,
            temperature=0,
        )

        text = response.choices[0].message.content.strip()
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            text = match.group(0)

        data = json.loads(text)
        return {"success": True, "data": data}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Risposta non valida: {str(e)}", "raw": text if 'text' in dir() else ""}
    except openai.AuthenticationError as e:
        logger.error(f"OCR AuthenticationError: {e}")
        return {"success": False, "error": f"API key non valida: {str(e)}"}
    except openai.RateLimitError as e:
        logger.error(f"OCR RateLimitError: {e}")
        return {"success": False, "error": f"Rate limit OpenAI — credito esaurito o tier troppo basso: {str(e)}"}
    except openai.APIStatusError as e:
        logger.error(f"OCR APIStatusError status={e.status_code}: {e.message}")
        return {"success": False, "error": f"OpenAI errore {e.status_code}: {e.message}"}
    except openai.APIConnectionError as e:
        logger.error(f"OCR APIConnectionError: {e}")
        return {"success": False, "error": f"Connessione OpenAI fallita: {str(e)}"}
    except Exception as e:
        logger.error(f"OCR Exception {type(e).__name__}: {e}")
        return {"success": False, "error": f"Errore OCR [{type(e).__name__}]: {str(e)}"}
