import os
import json
import base64
import logging

logger = logging.getLogger(__name__)

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "noreply@dedomo.it")

_raw_priv = os.getenv("VAPID_PRIVATE_KEY", "")


def _decode_private_key() -> str:
    if not _raw_priv:
        return ""
    try:
        padding = "=" * ((4 - len(_raw_priv) % 4) % 4)
        decoded = base64.urlsafe_b64decode(_raw_priv + padding)
        text = decoded.decode("utf-8", errors="replace")
        if "BEGIN EC PRIVATE KEY" in text or "BEGIN PRIVATE KEY" in text:
            return text
    except Exception:
        pass
    return _raw_priv


VAPID_PRIVATE_KEY_PEM = _decode_private_key()


async def send_push(db, user_id: str, title: str, body: str, url: str = "/archive") -> bool:
    """Send a Web Push notification to a subscribed user. Returns True on success."""
    if not VAPID_PRIVATE_KEY_PEM or not VAPID_PUBLIC_KEY:
        logger.debug("[PUSH] VAPID keys non configurate — notifica non inviata")
        return False

    sub_doc = await db.push_subscriptions.find_one({"user_id": user_id})
    if not sub_doc:
        return False

    subscription = sub_doc["subscription"]
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info=subscription,
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE_KEY_PEM,
            vapid_claims={"sub": f"mailto:{VAPID_CLAIMS_EMAIL}"},
        )
        logger.info(f"[PUSH] Notifica inviata a user {user_id}: {title}")
        return True
    except Exception as e:
        # 410 Gone = subscription scaduta o revocata → rimuovi
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status == 410:
            await db.push_subscriptions.delete_one({"user_id": user_id})
            logger.info(f"[PUSH] Subscription scaduta rimossa per user {user_id}")
        else:
            logger.error(f"[PUSH] Errore invio a user {user_id}: {e}")
        return False
