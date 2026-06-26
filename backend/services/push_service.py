import os
import json
import base64
import logging

logger = logging.getLogger(__name__)

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "noreply@dedomo.it")

_raw_priv = os.getenv("VAPID_PRIVATE_KEY", "")


def _decode_private_key() -> str:
    """Ritorna la chiave privata in formato PEM.

    Su Railway la chiave è stata salvata come base64-urlsafe del PEM.
    Se invece è già un PEM (contiene BEGIN), la usa direttamente.
    """
    if not _raw_priv:
        return ""
    # Caso 1: è già un PEM (multilinea o con \n letterali)
    if "BEGIN" in _raw_priv and "PRIVATE KEY" in _raw_priv:
        return _raw_priv.replace("\\n", "\n")
    # Caso 2: è base64 del PEM
    try:
        padding = "=" * ((4 - len(_raw_priv) % 4) % 4)
        decoded = base64.urlsafe_b64decode(_raw_priv + padding)
        text = decoded.decode("utf-8", errors="replace")
        if "BEGIN" in text and "PRIVATE KEY" in text:
            return text
    except Exception:
        pass
    return _raw_priv


VAPID_PRIVATE_KEY_PEM = _decode_private_key()


_VAPID_OBJ = None
_VAPID_ERR = None


def _get_vapid():
    """Costruisce (una sola volta) un oggetto Vapid dal PEM. Ritorna (vapid, error)."""
    global _VAPID_OBJ, _VAPID_ERR
    if _VAPID_OBJ is not None or _VAPID_ERR is not None:
        return _VAPID_OBJ, _VAPID_ERR
    try:
        from py_vapid import Vapid02
        _VAPID_OBJ = Vapid02.from_pem(VAPID_PRIVATE_KEY_PEM.encode("utf-8"))
    except Exception as e:
        _VAPID_ERR = f"Vapid.from_pem fallito: {type(e).__name__}: {e}"
    return _VAPID_OBJ, _VAPID_ERR


async def send_push(db, user_id: str, title: str, body: str, url: str = "/archive"):
    """Invia una notifica Web Push. Ritorna (ok: bool, error: str|None)."""
    if not VAPID_PRIVATE_KEY_PEM or not VAPID_PUBLIC_KEY:
        return False, "VAPID keys non configurate sul server"

    vapid, verr = _get_vapid()
    if verr:
        return False, verr

    sub_doc = await db.push_subscriptions.find_one({"user_id": user_id})
    if not sub_doc:
        return False, "Nessuna subscription salvata per questo utente"

    subscription = sub_doc["subscription"]
    try:
        from pywebpush import webpush
        webpush(
            subscription_info=subscription,
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=vapid,
            vapid_claims={"sub": f"mailto:{VAPID_CLAIMS_EMAIL}"},
        )
        logger.info(f"[PUSH] Notifica inviata a user {user_id}: {title}")
        return True, None
    except Exception as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status in (404, 410):
            await db.push_subscriptions.delete_one({"user_id": user_id})
            logger.info(f"[PUSH] Subscription scaduta rimossa per user {user_id}")
            return False, f"Subscription scaduta ({status}) — riattiva le notifiche"
        body_txt = ""
        try:
            body_txt = getattr(getattr(e, "response", None), "text", "") or ""
        except Exception:
            pass
        msg = f"{type(e).__name__}: {e}" + (f" | {body_txt[:200]}" if body_txt else "")
        logger.error(f"[PUSH] Errore invio a user {user_id}: {msg}")
        return False, msg
