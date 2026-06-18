"""
Billing router — Stripe Checkout (subscription mode) for Dedomo.
Endpoints:
  POST  /api/billing/create-checkout-session
  GET   /api/billing/checkout-status/{session_id}
  POST  /api/billing/customer-portal
  GET   /api/billing/quota
  POST  /api/webhook/stripe        (best effort - polling is the primary path)
  POST  /api/admin/user/{user_id}/toggle-unlimited
"""
from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Body
from pydantic import BaseModel

from services import billing as billing_svc

logger = logging.getLogger(__name__)


# Pydantic models MUST be defined at module level (not inside a closure)
# otherwise FastAPI/Pydantic 2.13 can't resolve the ForwardRef and the request
# body gets interpreted as query parameters (returns 422 "field required").
class CheckoutBody(BaseModel):
    num_properties: int
    origin_url: str  # frontend window.location.origin


class PortalBody(BaseModel):
    return_url: str


def build_billing_router(db, get_current_user, get_admin_user) -> APIRouter:
    router = APIRouter()

    # --------------- CHECKOUT ---------------

    @router.post("/billing/create-checkout-session")
    async def create_checkout(
        body: CheckoutBody = Body(...),
        user=Depends(get_current_user),
    ):
        if body.num_properties < 1 or body.num_properties > billing_svc.MAX_PAID_PROPERTIES:
            raise HTTPException(400, f"num_properties deve essere tra 1 e {billing_svc.MAX_PAID_PROPERTIES}")
        if user.get("unlimited"):
            raise HTTPException(400, "Account illimitato: nessun pagamento richiesto")
        try:
            res = await billing_svc.create_checkout_session(
                db, user, body.num_properties, body.origin_url
            )
            return res
        except Exception as e:
            logger.exception("[billing] checkout creation failed")
            raise HTTPException(500, f"Errore checkout Stripe: {str(e)}")

    @router.get("/billing/checkout-status/{session_id}")
    async def checkout_status(session_id: str, user=Depends(get_current_user)):
        # Validate ownership
        tx = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["user_id"]})
        if not tx:
            raise HTTPException(404, "Sessione non trovata")
        try:
            res = await billing_svc.get_checkout_status(db, session_id)
            return res
        except Exception as e:
            logger.exception("[billing] checkout status failed")
            raise HTTPException(500, f"Errore verifica pagamento: {str(e)}")

    # --------------- CUSTOMER PORTAL ---------------
    @router.post("/billing/customer-portal")
    async def customer_portal(
        body: PortalBody = Body(...),
        user=Depends(get_current_user),
    ):
        try:
            url = await billing_svc.create_portal_session(db, user, body.return_url)
            return {"url": url}
        except Exception as e:
            logger.exception("[billing] portal session failed")
            raise HTTPException(500, f"Errore portale: {str(e)}")

    # --------------- QUOTA / STATE ---------------
    @router.get("/billing/quota")
    async def get_quota(user=Depends(get_current_user)):
        # If user has a sub but DB is stale (no webhook in test mode), refresh
        if not user.get("unlimited"):
            sub = await db.subscriptions.find_one({"user_id": user["user_id"]})
            if sub and sub.get("stripe_subscription_id"):
                try:
                    await billing_svc.sync_subscription_from_stripe(db, user["user_id"])
                except Exception:
                    pass
        return await billing_svc.get_user_quota(db, user)

    # --------------- ADMIN: TOGGLE UNLIMITED ---------------
    @router.post("/admin/user/{user_id}/toggle-unlimited")
    async def toggle_unlimited(user_id: str, admin=Depends(get_admin_user)):
        u = await db.users.find_one({"user_id": user_id})
        if not u:
            raise HTTPException(404, "Utente non trovato")
        new_val = not bool(u.get("unlimited", False))
        await db.users.update_one({"user_id": user_id}, {"$set": {"unlimited": new_val}})
        return {"ok": True, "unlimited": new_val}

    # --------------- WEBHOOK ---------------
    # When STRIPE_WEBHOOK_SECRET is set we verify the Stripe-Signature header.
    # Without a secret we fall back to parsing the JSON unverified (dev only).
    @router.post("/webhook/stripe")
    async def stripe_webhook(request: Request):
        import os
        import stripe as stripe_sdk
        try:
            payload = await request.body()
            sig = request.headers.get("Stripe-Signature", "")
            webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
            if webhook_secret:
                billing_svc._init_stripe()
                try:
                    event = stripe_sdk.Webhook.construct_event(
                        payload, sig, webhook_secret,
                    )
                except stripe_sdk.error.SignatureVerificationError as e:
                    logger.warning(f"[webhook] invalid signature: {e}")
                    raise HTTPException(400, "Invalid signature")
            else:
                import json
                try:
                    event = json.loads(payload.decode("utf-8"))
                except Exception:
                    return {"received": False}

            etype = event.get("type") if isinstance(event, dict) else event["type"]
            obj = (event.get("data") if isinstance(event, dict) else event["data"]).get("object") or {}

            if etype == "checkout.session.completed":
                sid = obj.get("id")
                if sid:
                    try:
                        await billing_svc.get_checkout_status(db, sid)
                    except Exception as e:
                        logger.exception(f"[webhook] checkout.session.completed processing failed: {e}")
            elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
                sub_id = obj.get("id")
                if sub_id:
                    sub = await db.subscriptions.find_one({"stripe_subscription_id": sub_id})
                    if sub:
                        await billing_svc.sync_subscription_from_stripe(db, sub["user_id"])
                    # If deleted: also flip status to canceled locally
                    if etype == "customer.subscription.deleted" and sub:
                        await db.subscriptions.update_one(
                            {"stripe_subscription_id": sub_id},
                            {"$set": {"status": "canceled", "updated_at": billing_svc._now_iso()}},
                        )
            elif etype == "invoice.payment_failed":
                # Mark the subscription past_due
                sub_id = obj.get("subscription")
                if sub_id:
                    await db.subscriptions.update_one(
                        {"stripe_subscription_id": sub_id},
                        {"$set": {"status": "past_due", "updated_at": billing_svc._now_iso()}},
                    )
            return {"received": True, "type": etype}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("[billing] webhook error")
            return {"received": False, "error": str(e)}

    return router
