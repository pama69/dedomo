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
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from services import billing as billing_svc

logger = logging.getLogger(__name__)


def build_billing_router(db, get_current_user, get_admin_user) -> APIRouter:
    router = APIRouter()

    # --------------- CHECKOUT ---------------
    class CheckoutBody(BaseModel):
        num_properties: int
        origin_url: str  # frontend window.location.origin

    @router.post("/billing/create-checkout-session")
    async def create_checkout(body: CheckoutBody, user=Depends(get_current_user)):
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
    class PortalBody(BaseModel):
        return_url: str

    @router.post("/billing/customer-portal")
    async def customer_portal(body: PortalBody, user=Depends(get_current_user)):
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

    # --------------- WEBHOOK (best effort) ---------------
    # The Emergent test proxy may not deliver webhooks. Polling is the primary
    # mechanism. This endpoint is exposed for production deployments with real
    # Stripe keys where webhook events can be configured.
    @router.post("/webhook/stripe")
    async def stripe_webhook(request: Request):
        try:
            payload = await request.body()
            sig = request.headers.get("Stripe-Signature", "")
            # Without configured webhook secret we don't verify the signature.
            import json
            try:
                event = json.loads(payload.decode("utf-8"))
            except Exception:
                return {"received": False}
            etype = event.get("type")
            obj = (event.get("data") or {}).get("object") or {}

            if etype == "checkout.session.completed":
                sid = obj.get("id")
                if sid:
                    try:
                        await billing_svc.get_checkout_status(db, sid)
                    except Exception:
                        pass
            elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
                sub_id = obj.get("id")
                if sub_id:
                    sub = await db.subscriptions.find_one({"stripe_subscription_id": sub_id})
                    if sub:
                        await billing_svc.sync_subscription_from_stripe(db, sub["user_id"])
            return {"received": True, "type": etype}
        except Exception as e:
            logger.exception("[billing] webhook error")
            return {"received": False, "error": str(e)}

    return router
