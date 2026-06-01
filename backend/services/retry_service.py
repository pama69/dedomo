"""
Resilient retry service for portal submissions (Alloggiati Web + Turismo 5).

Classifies errors as transient (worth retrying) or definitive (user must fix data).
Maintains per-checkin retry state in MongoDB and schedules retries with exponential backoff.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

# Backoff schedule (less aggressive — portals rarely have multi-hour outages)
# Tentativi: 30min → 2h → 6h → 24h → 48h (5 tentativi totali, ~3.5 giorni)
BACKOFF_MINUTES = [30, 120, 360, 1440, 2880]
MAX_ATTEMPTS = len(BACKOFF_MINUTES)


# Definitive error patterns: do NOT retry these
# They indicate user-correctable problems (wrong data, bad credentials, validation).
DEFINITIVE_ERROR_PATTERNS = [
    # Auth failures
    "autenticazione",
    "credenziali",
    "token non valido",
    "utente non abilitato",
    "ws_key",
    "WSKEY",
    "WSKey",
    # Data validation (schedine rejected per-row)
    "schedina_campo_non_corretto",
    "tipo documento non valido",
    "codice errato",
    "campo obbligatorio",
    "codice non valido",
    "data non valida",
    "schedine rifiutate",
    "schedine valide:",  # "Schedine valide: 0/2" — wrong data
    # Codes that mean "definitive failure"
    "cod.10",  # auth error code
    "cod.11",
    "cod.12",  # SCHEDINA_CAMPO_NON_CORRETTO
    "cod.100",
    "cod.101",
    "cod.102",
    "cod.30",  # tipo file non valido
    "cod.51",  # ERRORE_RECUPERO_RICEVUTA (no receipt to fetch yet — handled separately)
]


# Transient error patterns: DO retry these
TRANSIENT_ERROR_PATTERNS = [
    "timeout",
    "timed out",
    "connection",
    "connessione",
    "reset",
    "refused",
    "dns",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "internal server error",
    " 5",  # 5xx HTTP
    "502",
    "503",
    "504",
    "521",
    "522",
    "523",
    "524",
    "fault",  # generic SOAP fault often = server-side issue
    "unable to read request",
]


def classify_error(message: str, success: bool = False) -> str:
    """Return 'transient', 'definitive', or 'success'.

    Args:
        message: The portal response message (lowercase comparison done internally).
        success: Whether the call ultimately succeeded.

    Decision rules:
        - success=True → 'success' (no retry needed)
        - matches DEFINITIVE pattern → 'definitive' (don't retry)
        - matches TRANSIENT pattern → 'transient' (do retry)
        - default (unknown error): 'transient' (be resilient — better to retry than miss)
    """
    if success:
        return "success"
    msg = (message or "").lower()
    if not msg:
        return "transient"

    for pat in DEFINITIVE_ERROR_PATTERNS:
        if pat.lower() in msg:
            return "definitive"
    for pat in TRANSIENT_ERROR_PATTERNS:
        if pat.lower() in msg:
            return "transient"
    return "transient"  # unknown → retry once at least


def build_retry_entry(
    portal: str,  # 'alloggiati' | 'turismo5'
    error_msg: str,
    attempt: int = 0,
) -> Optional[Dict[str, Any]]:
    """Build the next retry state entry. Returns None if max attempts reached
    or the error is not retryable."""
    if attempt >= MAX_ATTEMPTS:
        return {
            "portal": portal,
            "status": "exhausted",
            "attempts": attempt,
            "last_error": error_msg,
            "last_attempt": datetime.now(timezone.utc).isoformat(),
            "next_attempt": None,
        }
    delay_min = BACKOFF_MINUTES[attempt]
    next_at = datetime.now(timezone.utc) + timedelta(minutes=delay_min)
    return {
        "portal": portal,
        "status": "pending",
        "attempts": attempt + 1,
        "last_error": error_msg,
        "last_attempt": datetime.now(timezone.utc).isoformat(),
        "next_attempt": next_at.isoformat(),
    }


def is_due_for_retry(retry_entry: Dict[str, Any]) -> bool:
    """Check if a pending retry is due now."""
    if retry_entry.get("status") != "pending":
        return False
    nxt = retry_entry.get("next_attempt")
    if not nxt:
        return False
    try:
        next_dt = datetime.fromisoformat(nxt)
        return next_dt <= datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return False
