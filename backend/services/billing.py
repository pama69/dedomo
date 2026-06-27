"""
Stripe billing service for Dedomo/Ospitalo.

Pricing model:
- 1st property: €19.99/year
- 2nd-10th property: €9.99/year each
- Max 10 paid properties
- Italian VAT (22%) added on top (configurable via TAX_PERCENT)

Free tier:
- TRIAL_SUBMISSIONS (default 5) PROD check-in submissions, no card needed

Test environment:
- Uses sk_test_emergent which routes via the Emergent Stripe proxy
- Stripe Tax (automatic) is not available on the shared key, so we add a
  manual TaxRate (22% IVA non-inclusive) and attach it to checkout line items.
"""
from __future__ import annotations
import os
import logging
from typing import Optional, Dict, Any

import stripe

logger = logging.getLogger(__name__)

# ----- ENV (read lazily; load_dotenv happens in server.py at startup) -----
def _env_float(name: str, default: str) -> float:
    return float(os.environ.get(name, default))


def _env_int(name: str, default: str) -> int:
    return int(os.environ.get(name, default))


TAX_PERCENT = 22.0  # default; overridden by _refresh_env() at startup
TRIAL_SUBMISSIONS = 5
MAX_PAID_PROPERTIES = 10
PRICE_FIRST_EUR = 19.99
PRICE_EXTRA_EUR = 9.99


def _refresh_env():
    """Re-read env vars (call after load_dotenv)."""
    global TAX_PERCENT, TRIAL_SUBMISSIONS, MAX_PAID_PROPERTIES
    global PRICE_FIRST_EUR, PRICE_EXTRA_EUR
    TAX_PERCENT = _env_float("TAX_PERCENT", "22")
    TRIAL_SUBMISSIONS = _env_int("TRIAL_SUBMISSIONS", "5")
    MAX_PAID_PROPERTIES = _env_int("MAX_PAID_PROPERTIES", "10")
    PRICE_FIRST_EUR = _env_float("PRICE_FIRST_EUR", "19.99")
    PRICE_EXTRA_EUR = _env_float("PRICE_EXTRA_EUR", "9.99")


def _config_key() -> str:
    """Separate cache key for test vs live mode."""
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    return "stripe_resources_test" if key.startswith("sk_test") else "stripe_resources_live"


def _init_stripe():
    """Initialise the stripe SDK. Idempotent. Re-reads env each call."""
    api_key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not api_key:
        raise RuntimeError("STRIPE_SECRET_KEY missing in env")
    stripe.api_key = api_key
    stripe.api_base = "https://api.stripe.com"
    _refresh_env()


async def ensure_stripe_resources(db) -> Dict[str, str]:
    """Idempotently create Product + tiered annual Price + Tax Rate.
    Stores the IDs in db.app_config so we reuse them across restarts.
    Returns {"product_id", "price_id", "tax_rate_id"}.
    """
    _init_stripe()
    config_key = _config_key()
    cfg = await db.app_config.find_one({"_id": config_key}) or {}
    needed = ["product_id", "price_id", "tax_rate_id"]
    if all(cfg.get(k) for k in needed):
        return {k: cfg[k] for k in needed}

    product_id = cfg.get("product_id")
    if not product_id:
        prod = stripe.Product.create(
            name="Dedomo - Abbonamento annuale",
            description="Gestione invii Alloggiati + ROSS 1000 + Imposta Soggiorno",
        )
        product_id = prod.id

    price_id = cfg.get("price_id")
    if not price_id:
        price = stripe.Price.create(
            currency="eur",
            product=product_id,
            recurring={"interval": "year"},
            billing_scheme="tiered",
            tiers_mode="graduated",
            tiers=[
                {"up_to": 1, "unit_amount": int(round(PRICE_FIRST_EUR * 100))},
                {"up_to": "inf", "unit_amount": int(round(PRICE_EXTRA_EUR * 100))},
            ],
        )
        price_id = price.id

    tax_rate_id = cfg.get("tax_rate_id")
    if not tax_rate_id:
        tr = stripe.TaxRate.create(
            display_name="IVA",
            description=f"Italian VAT {TAX_PERCENT}%",
            percentage=TAX_PERCENT,
            inclusive=False,
            jurisdiction="IT",
            country="IT",
        )
        tax_rate_id = tr.id

    await db.app_config.update_one(
        {"_id": config_key},
        {"$set": {
            "product_id": product_id,
            "price_id": price_id,
            "tax_rate_id": tax_rate_id,
        }},
        upsert=True,
    )
    logger.info(f"[billing] resources ready product={product_id} price={price_id} tax={tax_rate_id}")
    return {"product_id": product_id, "price_id": price_id, "tax_rate_id": tax_rate_id}


async def get_or_create_customer(db, user: Dict[str, Any]) -> str:
    """Get the Stripe Customer ID for a user, creating one if missing.
    The id is cached on the user document."""
    _init_stripe()
    cid = user.get("stripe_customer_id")
    if cid:
        return cid
    cust = stripe.Customer.create(
        email=user.get("email"),
        name=user.get("name") or user.get("email"),
        metadata={"user_id": user["user_id"]},
    )
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"stripe_customer_id": cust.id}},
    )
    return cust.id


def compute_price_eur(num_properties: int) -> Dict[str, float]:
    """Pure pricing calculation (no Stripe call). Returns dict with subtotal/tax/total."""
    num_properties = max(1, min(int(num_properties), MAX_PAID_PROPERTIES))
    if num_properties >= 1:
        subtotal = PRICE_FIRST_EUR + (num_properties - 1) * PRICE_EXTRA_EUR
    else:
        subtotal = 0.0
    tax = round(subtotal * TAX_PERCENT / 100, 2)
    total = round(subtotal + tax, 2)
    return {
        "num_properties": num_properties,
        "subtotal": round(subtotal, 2),
        "tax_percent": TAX_PERCENT,
        "tax": tax,
        "total": total,
        "currency": "EUR",
    }


async def create_checkout_session(
    db,
    user: Dict[str, Any],
    num_properties: int,
    origin_url: str,
) -> Dict[str, Any]:
    """Create a Stripe Checkout Session in subscription mode with the
    requested quantity, attaching the manual IVA tax rate to the line item.
    """
    _init_stripe()
    res = await ensure_stripe_resources(db)
    customer_id = await get_or_create_customer(db, user)
    quantity = max(1, min(int(num_properties), MAX_PAID_PROPERTIES))

    success_url = f"{origin_url.rstrip('/')}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url.rstrip('/')}/billing/pricing?cancelled=1"

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{
            "price": res["price_id"],
            "quantity": quantity,
            "tax_rates": [res["tax_rate_id"]],
        }],
        success_url=success_url,
        cancel_url=cancel_url,
        allow_promotion_codes=True,
        metadata={
            "user_id": user["user_id"],
            "num_properties": str(quantity),
        },
        subscription_data={
            "metadata": {
                "user_id": user["user_id"],
                "num_properties": str(quantity),
            },
        },
    )
    # Record transaction for audit / polling
    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "user_id": user["user_id"],
        "email": user.get("email"),
        "stripe_customer_id": customer_id,
        "num_properties": quantity,
        "amount_total_eur": compute_price_eur(quantity)["total"],
        "currency": "eur",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    })
    return {"url": session.url, "session_id": session.id}


async def get_checkout_status(db, session_id: str) -> Dict[str, Any]:
    """Look up status of a checkout session. Updates payment_transactions.
    If paid + subscription mode → activates / upserts the local subscription record.
    """
    _init_stripe()
    sess = stripe.checkout.Session.retrieve(session_id, expand=["subscription"])
    payment_status = sess.payment_status  # "paid" | "unpaid" | "no_payment_required"
    status = sess.status  # "open" | "complete" | "expired"

    tx = await db.payment_transactions.find_one({"session_id": session_id})
    already_processed = tx and tx.get("payment_status") == "paid"

    sub_obj = sess.subscription
    sub_id = sub_obj.id if sub_obj else None
    sub_status = sub_obj.status if sub_obj else None
    current_period_end = None
    quantity = None
    if sub_obj:
        try:
            current_period_end = sub_obj.current_period_end  # unix seconds
        except Exception:
            current_period_end = None
        try:
            quantity = sub_obj.items.data[0].quantity if sub_obj.items.data else None
        except Exception:
            quantity = None

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": status,
            "payment_status": payment_status,
            "stripe_subscription_id": sub_id,
            "updated_at": _now_iso(),
        }},
    )

    if payment_status == "paid" and not already_processed and tx:
        # Upsert subscription record
        qty = quantity or int(tx.get("num_properties", 1))
        await db.subscriptions.update_one(
            {"user_id": tx["user_id"]},
            {"$set": {
                "user_id": tx["user_id"],
                "stripe_customer_id": tx.get("stripe_customer_id"),
                "stripe_subscription_id": sub_id,
                "quantity": qty,  # paid_properties limit
                "status": sub_status or "active",
                "current_period_end": current_period_end,
                "updated_at": _now_iso(),
                "activated_at": _now_iso(),
            }},
            upsert=True,
        )
        logger.info(f"[billing] subscription activated user={tx['user_id']} qty={qty}")

    return {
        "session_id": session_id,
        "status": status,
        "payment_status": payment_status,
        "subscription_id": sub_id,
        "subscription_status": sub_status,
        "current_period_end": current_period_end,
        "quantity": quantity,
    }


async def upgrade_subscription(db, user: Dict[str, Any], add_properties: int) -> Dict[str, Any]:
    """Increase the quantity of an existing active subscription by add_properties.
    Stripe calculates the prorated charge for the remaining period and bills immediately.
    """
    _init_stripe()
    sub = await db.subscriptions.find_one({"user_id": user["user_id"]})
    if not sub or not sub.get("stripe_subscription_id"):
        raise ValueError("Nessun abbonamento attivo trovato")

    stripe_sub = stripe.Subscription.retrieve(sub["stripe_subscription_id"])
    if stripe_sub.status not in ("active", "trialing"):
        raise ValueError(f"Abbonamento non modificabile: stato {stripe_sub.status}")

    if not stripe_sub.items or not stripe_sub.items.data:
        raise ValueError("Nessun item trovato nell'abbonamento Stripe")

    item = stripe_sub.items.data[0]
    current_qty = item.quantity or 1
    new_qty = current_qty + add_properties

    if new_qty > MAX_PAID_PROPERTIES:
        raise ValueError(f"Limite massimo {MAX_PAID_PROPERTIES} proprietà raggiunto")

    updated_sub = stripe.Subscription.modify(
        sub["stripe_subscription_id"],
        items=[{"id": item.id, "quantity": new_qty}],
        proration_behavior="create_prorations",
    )

    await db.subscriptions.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "quantity": new_qty,
            "status": updated_sub.status,
            "current_period_end": updated_sub.current_period_end,
            "updated_at": _now_iso(),
        }},
    )
    logger.info(f"[billing] upgrade user={user['user_id']} qty {current_qty}→{new_qty}")
    return {"ok": True, "new_quantity": new_qty, "status": updated_sub.status}


async def create_portal_session(db, user: Dict[str, Any], return_url: str) -> str:
    """Open the Stripe customer portal so the user can manage their sub."""
    _init_stripe()
    customer_id = await get_or_create_customer(db, user)
    portal = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return portal.url


async def sync_subscription_from_stripe(db, user_id: str) -> Optional[Dict[str, Any]]:
    """Refresh the user's subscription record from Stripe (in case webhook missed).
    Returns the latest local subscription doc."""
    sub = await db.subscriptions.find_one({"user_id": user_id})
    if not sub or not sub.get("stripe_subscription_id"):
        return sub
    _init_stripe()
    try:
        s = stripe.Subscription.retrieve(sub["stripe_subscription_id"])
    except Exception as e:
        logger.warning(f"[billing] sync failed for {user_id}: {e}")
        return sub
    qty = None
    try:
        qty = s.items.data[0].quantity if s.items.data else None
    except Exception:
        pass
    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": s.status,
            "current_period_end": s.current_period_end,
            "quantity": qty or sub.get("quantity"),
            "updated_at": _now_iso(),
        }},
    )
    return await db.subscriptions.find_one({"user_id": user_id})


# ----------------------- quota helpers --------------------------

async def get_user_quota(db, user: Dict[str, Any]) -> Dict[str, Any]:
    """Return everything the frontend needs to render the paywall/quota UI."""
    user_id = user["user_id"]
    if user.get("unlimited"):
        return {
            "unlimited": True,
            "trial_used": 0,
            "trial_limit": TRIAL_SUBMISSIONS,
            "paid_properties": None,  # null = unlimited
            "properties_used": await db.properties.count_documents({"user_id": user_id}),
            "subscription": None,
            "can_submit": True,
            "can_add_property": True,
            "tax_percent": TAX_PERCENT,
            "max_paid_properties": MAX_PAID_PROPERTIES,
        }
    sub = await db.subscriptions.find_one({"user_id": user_id})
    sub_active = bool(sub and sub.get("status") in ("active", "trialing", "past_due"))
    paid_qty = sub.get("quantity") if sub_active else 0

    prod_count = await db.checkins.count_documents({"user_id": user_id, "mode": "PROD"})
    props_used = await db.properties.count_documents({"user_id": user_id})

    if sub_active:
        can_submit = True
        can_add_property = props_used < paid_qty
    else:
        can_submit = prod_count < TRIAL_SUBMISSIONS
        # Without subscription we let them create properties but can_submit will gate usage
        can_add_property = True

    return {
        "unlimited": False,
        "trial_used": prod_count,
        "trial_limit": TRIAL_SUBMISSIONS,
        "paid_properties": paid_qty,
        "properties_used": props_used,
        "subscription": _serialize_sub(sub) if sub else None,
        "can_submit": can_submit,
        "can_add_property": can_add_property,
        "tax_percent": TAX_PERCENT,
        "max_paid_properties": MAX_PAID_PROPERTIES,
        "price_first_eur": PRICE_FIRST_EUR,
        "price_extra_eur": PRICE_EXTRA_EUR,
    }


def _serialize_sub(sub: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "status": sub.get("status"),
        "quantity": sub.get("quantity"),
        "current_period_end": sub.get("current_period_end"),
        "stripe_subscription_id": sub.get("stripe_subscription_id"),
    }


def _now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
