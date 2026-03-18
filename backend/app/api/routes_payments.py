from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

import stripe

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.misc import Payment, Invoice
from app.services.stripe_service import stripe_service, STRIPE_PRICES, TIER_TRIAL_DAYS
from app.services.email_service import email_service

# Reverse map: Stripe price ID → tier key (used to restore tier on subscription reactivation)
STRIPE_PRICES_REVERSE: dict[str, str] = {v: k for k, v in STRIPE_PRICES.items()}
from app.services.notification_service import notification_service
from app.exceptions import ValidationException, ResourceNotFoundException, ExternalServiceException
from app.core.config import settings

import logging
logger = logging.getLogger(__name__)

router = APIRouter()

# Canonical plan definitions — single source of truth
DEALER_PLANS = [
    {
        "id": "basic",
        "name": "Basic",
        "price": 199,
        "interval": "month",
        "features": [
            "25 active listings",
            "Featured-listing eligibility",
            "Basic analytics dashboard",
            "Lead & inquiry management",
            "Email support",
        ],
    },
    {
        "id": "plus",
        "name": "Plus",
        "price": 299,
        "popular": True,
        "interval": "month",
        "features": [
            "75 active listings",
            "Priority featured placement",
            "Advanced analytics",
            "CRM integration",
            "Team management (up to 3)",
            "Phone & email support",
        ],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price": 499,
        "interval": "month",
        "features": [
            "Unlimited listings",
            "Priority featured placement",
            "Advanced analytics & API access",
            "Full CRM integration",
            "Unlimited team members",
            "Dedicated account manager",
            "Priority support",
        ],
    },
]

PRIVATE_SELLER_PLANS = [
    {
        "id": "private_basic",
        "name": "Basic",
        "price": 9,
        "interval": "month",
        "features": [
            "1 active listing",
            "Basic analytics",
            "Email support",
        ],
    },
    {
        "id": "private_plus",
        "name": "Plus",
        "price": 19,
        "popular": True,
        "interval": "month",
        "features": [
            "3 active listings",
            "Featured-listing eligibility",
            "Analytics dashboard",
            "Email support",
        ],
    },
    {
        "id": "private_pro",
        "name": "Pro",
        "price": 39,
        "interval": "month",
        "features": [
            "5 active listings",
            "Priority featured placement",
            "Advanced analytics",
            "Priority support",
        ],
    },
]


# ==================== CHECKOUT SESSION ====================

@router.post("/payments/create-checkout-session")
async def create_checkout_session(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Checkout Session for new registrations.
    The frontend redirects the browser to the returned checkout_url.
    After payment Stripe redirects to success_url / cancel_url.
    """
    subscription_tier = (data.get("subscription_tier") or "").lower().strip()
    user_type = (data.get("user_type") or "").lower().strip()
    success_url = data.get("success_url")
    cancel_url = data.get("cancel_url")

    if not subscription_tier:
        raise ValidationException("subscription_tier is required")
    if not success_url or not cancel_url:
        raise ValidationException("success_url and cancel_url are required")

    # Map tier name — private sellers use private_* prefix
    tier_key = subscription_tier
    if user_type == "private" and not tier_key.startswith("private_"):
        tier_key = f"private_{tier_key}"

    # Ultimate tier uses variable pricing negotiated by sales
    if tier_key == "ultimate":
        if not current_user.custom_subscription_price or current_user.custom_subscription_price <= 0:
            raise ValidationException(
                "Ultimate plan pricing must be arranged with our sales team. "
                "Please contact support to complete your registration."
            )
        try:
            custom_price = stripe.Price.create(
                unit_amount=int(current_user.custom_subscription_price * 100),
                currency="usd",
                recurring={"interval": "month"},
                product_data={
                    "name": f"Ultimate Plan — {current_user.company_name or current_user.email}"
                },
            )
            price_id = custom_price.id
        except stripe.error.StripeError as e:
            logger.error("Custom price creation failed: %s", e)
            raise ExternalServiceException(f"Stripe error: {e}")
        trial_days = 0
    else:
        price_id = STRIPE_PRICES.get(tier_key)
        if not price_id:
            raise ValidationException(f"No Stripe price configured for tier: {tier_key}")
        trial_days = TIER_TRIAL_DAYS.get(tier_key, 0)

    # Get or create Stripe customer
    if not current_user.stripe_customer_id:
        try:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
                metadata={"user_id": str(current_user.id), "user_type": user_type},
            )
            current_user.stripe_customer_id = customer.id
            db.commit()
        except stripe.error.StripeError as e:
            logger.error("Stripe customer creation failed: %s", e)
            raise ExternalServiceException(f"Stripe error: {e}")

    # Build Checkout Session params
    session_params: dict = {
        "customer": current_user.stripe_customer_id,
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {
            "user_id": str(current_user.id),
            "subscription_tier": tier_key,
        },
    }

    if trial_days > 0:
        session_params["subscription_data"] = {"trial_period_days": trial_days}

    try:
        session = stripe.checkout.Session.create(**session_params)
    except stripe.error.StripeError as e:
        logger.error("Stripe checkout session creation failed: %s", e)
        raise ExternalServiceException(f"Stripe error: {e}")

    logger.info(
        "Created checkout session %s for user %s (tier=%s)",
        session.id,
        current_user.id,
        tier_key,
    )

    return {"checkout_url": session.url, "session_id": session.id}


# ==================== PLAN DISCOVERY ====================

@router.get("/payments/plans")
async def get_plans(
    current_user: User = Depends(get_current_user),
):
    """Return available plans with prices (respects per-user custom pricing)."""
    user_type = (current_user.user_type or "").lower()

    plans = list(PRIVATE_SELLER_PLANS) if user_type == "private" else list(DEALER_PLANS)

    # If admin set a custom price for this user, override displayed price
    if current_user.custom_subscription_price is not None and current_user.custom_subscription_price >= 0:
        for plan in plans:
            plan = dict(plan)  # shallow copy
        # Custom price applies to whatever tier they subscribe to;
        # show it on their current tier or the next tier up
        plans = [dict(p) for p in plans]
        for p in plans:
            if p["id"] == (current_user.subscription_tier or "").lower():
                p["price"] = current_user.custom_subscription_price
                p["custom_price"] = True

    return {
        "plans": plans,
        "current_tier": current_user.subscription_tier or "free",
        "custom_subscription_price": current_user.custom_subscription_price,
    }


# ==================== SUBSCRIPTION MANAGEMENT ====================

@router.post("/payments/create-subscription")
async def create_subscription(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new subscription for user"""
    tier = data.get("tier")  # basic, premium, ultimate
    
    if tier not in ["basic", "premium", "ultimate"]:
        raise ValidationException("Invalid subscription tier")
    
    # Get or create Stripe customer
    if not current_user.stripe_customer_id:
        customer_id = stripe_service.create_customer(
            email=current_user.email,
            name=f"{current_user.first_name} {current_user.last_name}",
            user_id=current_user.id
        )
        current_user.stripe_customer_id = customer_id
        db.commit()
    else:
        customer_id = current_user.stripe_customer_id
    
    # Get price ID for tier
    price_id = None
    
    # Priority: Custom price > Ultimate tier > Standard tier config
    if current_user.custom_subscription_price is not None and current_user.custom_subscription_price >= 0:
        try:
             price_name = f"{tier.title()} Plan"
             if tier == "ultimate":
                 price_name = f"Ultimate Plan Link - {current_user.company_name or current_user.email}"
             else:
                 price_name = f"{tier.title()} Plan (Special Offer)"

             price = stripe_service.create_custom_price(
                 amount=int(current_user.custom_subscription_price * 100),
                 currency="usd",
                 product_name=price_name
             )
             price_id = price.id
        except Exception as e:
             raise ValidationException(f"Failed to create custom price: {str(e)}")
    
    # Fallback to standard pricing
    if not price_id:
        if tier == "ultimate":
             raise ValidationException("Custom price not set for Ultimate tier. Contact support.")
        price_id = STRIPE_PRICES.get(tier)
        
    if not price_id:
        raise ValidationException(f"Price not configured for tier: {tier}")
    
    # Check for promotional offer
    trial_days = 0
    coupon_id = None
    
    from app.models.api_keys import PromotionalOffer
    offer = db.query(PromotionalOffer).filter(
        PromotionalOffer.dealer_id == current_user.id,
        PromotionalOffer.active == True,
        PromotionalOffer.applied == False,
        PromotionalOffer.start_date <= datetime.utcnow(),
        PromotionalOffer.end_date >= datetime.utcnow()
    ).first()
    
    if offer:
        if offer.trial_days:
            trial_days = offer.trial_days
        
        # Create Stripe coupon if discount
        if offer.discount_value:
            coupon_id = stripe_service.create_coupon(
                percent_off=int(offer.discount_value) if offer.discount_type == "percentage" else None,
                amount_off=int(offer.discount_value * 100) if offer.discount_type == "fixed" else None,
                duration="once",
                name=f"Promo for {current_user.email}"
            )
            offer.stripe_coupon_id = coupon_id
        
        # Mark offer as applied
        offer.applied = True
        offer.applied_at = datetime.utcnow()
        db.commit()
    
    # Create subscription
    result = stripe_service.create_subscription(
        customer_id=customer_id,
        price_id=price_id,
        trial_days=trial_days,
        coupon_id=coupon_id
    )
    
    # Update user
    current_user.subscription_tier = tier
    current_user.stripe_subscription_id = result["subscription_id"]
    
    if trial_days > 0:
        current_user.trial_active = True
        from datetime import timedelta
        current_user.trial_end_date = datetime.utcnow() + timedelta(days=trial_days)
    
    db.commit()
    
    # Send confirmation email
    background_tasks.add_task(
        send_subscription_confirmation,
        current_user.email,
        tier,
        trial_days
    )
    
    return {
        "success": True,
        "client_secret": result["client_secret"],
        "subscription_id": result["subscription_id"],
        "trial_days": trial_days
    }


@router.post("/payments/update-subscription")
async def update_subscription(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upgrade or downgrade subscription"""
    new_tier = data.get("tier")
    
    if not current_user.stripe_subscription_id:
        raise ValidationException("No active subscription found")
    
    if new_tier not in ["basic", "premium", "ultimate"]:
        raise ValidationException("Invalid subscription tier")
    
    # Get new price ID
    new_price_id = None
    
    # If switching to Ultimate, require custom price
    if new_tier == "ultimate":
        if not current_user.custom_subscription_price or current_user.custom_subscription_price <= 0:
             raise ValidationException("Custom price not set. Please contact sales to upgrade to Ultimate.")
        
        price = stripe_service.create_custom_price(
             amount=int(current_user.custom_subscription_price * 100),
             currency="usd",
             product_name=f"Ultimate Plan Link - {current_user.company_name}"
        )
        new_price_id = price.id
        
    # If staying on same tier (e.g. reactivating or changing period?), check for custom price
    elif new_tier == current_user.subscription_tier and current_user.custom_subscription_price and current_user.custom_subscription_price > 0:
        price = stripe_service.create_custom_price(
             amount=int(current_user.custom_subscription_price * 100),
             currency="usd",
             product_name=f"{new_tier.title()} Plan (Special Offer)"
        )
        new_price_id = price.id
        
    else:
        # Switching tiers (non-Ultimate) -> Use standard price (lose custom deal)
        new_price_id = STRIPE_PRICES.get(new_tier)
    
    # Update subscription
    result = stripe_service.update_subscription(
        subscription_id=current_user.stripe_subscription_id,
        new_price_id=new_price_id,
        proration_behavior="always_invoice"
    )
    
    # Update user
    current_user.subscription_tier = new_tier
    db.commit()
    
    # Send notification
    background_tasks.add_task(
        send_subscription_updated_email,
        current_user.email,
        new_tier
    )
    
    return {
        "success": True,
        "message": f"Subscription updated to {new_tier}",
        "status": result["status"]
    }


@router.post("/payments/cancel-subscription")
async def cancel_subscription(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel subscription"""
    if not current_user.stripe_subscription_id:
        raise ValidationException("No active subscription found")
    
    cancel_immediately = data.get("cancel_immediately", False)
    
    result = stripe_service.cancel_subscription(
        subscription_id=current_user.stripe_subscription_id,
        cancel_at_period_end=not cancel_immediately
    )
    
    if cancel_immediately:
        current_user.subscription_tier = "free"
        current_user.stripe_subscription_id = None
    
    db.commit()
    
    # Send notification
    background_tasks.add_task(
        send_subscription_cancelled_email,
        current_user.email,
        cancel_immediately
    )
    
    return {
        "success": True,
        "message": "Subscription cancelled",
        "cancel_at": result.get("cancel_at")
    }


@router.get("/payments/billing-portal")
async def get_billing_portal(
    current_user: User = Depends(get_current_user)
):
    """Get Stripe billing portal URL"""
    if not current_user.stripe_customer_id:
        raise ValidationException("No Stripe customer found")
    
    portal_url = stripe_service.create_billing_portal_session(
        customer_id=current_user.stripe_customer_id,
        return_url=f"{settings.BASE_URL}/dashboard/billing"
    )
    
    return {"url": portal_url}


@router.get("/payments/subscription")
async def get_subscription_details(
    current_user: User = Depends(get_current_user)
):
    """Get current subscription details"""
    if not current_user.stripe_subscription_id:
        return {
            "active": False,
            "tier": current_user.subscription_tier,
            "trial_active": current_user.trial_active
        }
    
    details = stripe_service.retrieve_subscription(
        current_user.stripe_subscription_id
    )
    
    return {
        "active": True,
        "tier": current_user.subscription_tier,
        "status": details["status"],
        "current_period_end": details["current_period_end"],
        "cancel_at_period_end": details["cancel_at_period_end"],
        "trial_end": details.get("trial_end"),
        "trial_active": current_user.trial_active
    }


# ==================== INVOICES ====================

@router.get("/payments/invoices")
async def get_invoices(
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    """Get user's invoices"""
    if not current_user.stripe_customer_id:
        return []
    
    invoices = stripe_service.list_invoices(
        customer_id=current_user.stripe_customer_id,
        limit=limit
    )
    
    return invoices


# ==================== ONE-TIME PAYMENTS ====================

@router.post("/payments/featured-listing")
async def pay_for_featured_listing(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process payment for featured listing"""
    listing_id = data.get("listing_id")
    plan = data.get("plan")  # 7day, 30day, 90day
    
    # Pricing for featured listings
    prices = {
        "7day": 49.99,
        "30day": 149.99,
        "90day": 349.99
    }
    
    if plan not in prices:
        raise ValidationException("Invalid featured listing plan")
    
    amount = int(prices[plan] * 100)  # Convert to cents
    
    # Create payment intent
    result = stripe_service.create_payment_intent(
        amount=amount,
        currency="usd",
        customer_id=current_user.stripe_customer_id,
        description=f"Featured listing - {plan}"
    )
    
    # Create payment record
    payment = Payment(
        user_id=current_user.id,
        stripe_payment_intent_id=result["payment_intent_id"],
        amount=prices[plan],
        currency="usd",
        status="pending",
        payment_type="featured_listing",
        related_id=listing_id,
        description=f"Featured listing - {plan}",
        payment_metadata={"plan": plan, "listing_id": listing_id}
    )
    
    db.add(payment)
    db.commit()
    
    return {
        "success": True,
        "client_secret": result["client_secret"],
        "amount": prices[plan]
    }


# ==================== WEBHOOK HANDLER ====================

@router.post("/payments/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle Stripe webhooks"""
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET
    
    # Verify webhook signature
    if not stripe_service.verify_webhook_signature(payload, signature, webhook_secret):
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    import json
    event = json.loads(payload)
    event_type = event["type"]
    
    logger.info(f"Received Stripe webhook: {event_type}")
    
    # Handle different event types
    if event_type == "checkout.session.completed":
        obj = event["data"]["object"]
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")
        metadata = obj.get("metadata", {})
        user_id = metadata.get("user_id")
        tier = metadata.get("subscription_tier")

        user = None
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
        if not user and customer_id:
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

        if user:
            user.stripe_subscription_id = subscription_id
            if tier:
                user.subscription_tier = tier
            if subscription_id:
                try:
                    sub = stripe.Subscription.retrieve(subscription_id)
                    if sub.status == "trialing" and sub.trial_end:
                        user.trial_active = True
                        user.trial_end_date = datetime.utcfromtimestamp(sub.trial_end)
                except stripe.error.StripeError:
                    pass
            db.commit()
            logger.info("checkout.session.completed → user %s subscribed (tier=%s)", user.id, tier)

    elif event_type == "payment_intent.succeeded":
        await handle_payment_succeeded(event["data"]["object"], db, background_tasks)
    
    elif event_type == "payment_intent.payment_failed":
        await handle_payment_failed(event["data"]["object"], db, background_tasks)
    
    elif event_type == "customer.subscription.created":
        await handle_subscription_created(event["data"]["object"], db, background_tasks)
    
    elif event_type == "customer.subscription.updated":
        await handle_subscription_updated(event["data"]["object"], db, background_tasks)
    
    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(event["data"]["object"], db, background_tasks)
    
    elif event_type == "invoice.paid":
        await handle_invoice_paid(event["data"]["object"], db, background_tasks)
    
    elif event_type == "invoice.payment_failed":
        await handle_invoice_failed(event["data"]["object"], db, background_tasks)
    
    return {"success": True}


# ==================== WEBHOOK HANDLERS ====================

async def handle_payment_succeeded(payment_intent, db: Session, background_tasks: BackgroundTasks):
    """Handle successful payment"""
    payment_intent_id = payment_intent["id"]
    
    # Update payment record
    payment = db.query(Payment).filter(
        Payment.stripe_payment_intent_id == payment_intent_id
    ).first()
    
    if payment:
        payment.status = "succeeded"
        payment.stripe_charge_id = payment_intent.get("latest_charge")
        
        # If featured listing payment, activate the feature
        if payment.payment_type == "featured_listing":
            from app.models.listing import Listing, FeaturedListing
            from datetime import timedelta
            
            listing_id = payment.payment_metadata.get("listing_id")
            plan = payment.payment_metadata.get("plan")
            
            # Duration mapping
            duration_map = {"7day": 7, "30day": 30, "90day": 90}
            days = duration_map.get(plan, 7)
            
            # Update listing
            listing = db.query(Listing).filter(Listing.id == listing_id).first()
            if listing:
                listing.featured = True
                listing.featured_until = datetime.utcnow() + timedelta(days=days)
                listing.featured_plan = plan
                
                # Create featured listing record
                featured = FeaturedListing(
                    listing_id=listing_id,
                    user_id=payment.user_id,
                    plan=plan,
                    price_paid=payment.amount,
                    started_at=datetime.utcnow(),
                    expires_at=listing.featured_until,
                    stripe_payment_id=payment_intent_id,
                    active=True
                )
                db.add(featured)
        
        db.commit()
        
        # Send confirmation email
        user = db.query(User).filter(User.id == payment.user_id).first()
        if user:
            background_tasks.add_task(
                send_payment_success_email,
                user.email,
                payment.amount,
                payment.description
            )


async def handle_payment_failed(payment_intent, db: Session, background_tasks: BackgroundTasks):
    """Handle failed payment"""
    payment_intent_id = payment_intent["id"]
    
    payment = db.query(Payment).filter(
        Payment.stripe_payment_intent_id == payment_intent_id
    ).first()
    
    if payment:
        payment.status = "failed"
        payment.failure_code = payment_intent.get("last_payment_error", {}).get("code")
        payment.failure_message = payment_intent.get("last_payment_error", {}).get("message")
        db.commit()
        
        # Send failure notification
        user = db.query(User).filter(User.id == payment.user_id).first()
        if user:
            background_tasks.add_task(
                send_payment_failed_email,
                user.email,
                payment.failure_message
            )


async def handle_subscription_created(subscription, db: Session, background_tasks: BackgroundTasks):
    """Handle new subscription"""
    customer_id = subscription["customer"]
    subscription_id = subscription["id"]

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.stripe_subscription_id = subscription_id
        db.commit()

        # Only send welcome/verification if not already verified
        if not user.email_verified:
            # Find or create verification token
            from app.models.dealer import EmailVerification
            verification = db.query(EmailVerification).filter(EmailVerification.user_id == user.id, EmailVerification.verified == False).first()
            if not verification:
                import secrets
                from datetime import datetime, timedelta
                token = secrets.token_urlsafe(32)
                expires_at = datetime.utcnow() + timedelta(hours=24)
                verification = EmailVerification(user_id=user.id, token=token, expires_at=expires_at)
                db.add(verification)
                db.commit()
            else:
                token = verification.token

            user_name = f"{user.first_name} {user.last_name}" if user.first_name else None
            background_tasks.add_task(
                email_service.send_verification_email,
                user.email,
                token,
                user_name
            )

        # Always send welcome email after payment
        user_name = f"{user.first_name} {user.last_name}" if user.first_name else None
        background_tasks.add_task(
            email_service.send_welcome_email,
            user.email,
            user_name
        )


async def handle_subscription_updated(subscription, db: Session, background_tasks: BackgroundTasks):
    """Handle subscription update"""
    subscription_id = subscription["id"]
    status = subscription["status"]

    user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()
    if not user:
        return

    if status in ("past_due", "unpaid", "incomplete_expired"):
        # Payment has lapsed — revoke listing access until invoice clears
        user.subscription_tier = "free"
        db.commit()
        logger.warning("Subscription %s is %s — downgraded user %s to free tier", subscription_id, status, user.id)
        background_tasks.add_task(send_invoice_failed_email, user.email, 0)

    elif status == "canceled":
        # Explicit cancellation — also handled by subscription.deleted but belt-and-suspenders
        user.subscription_tier = "free"
        user.stripe_subscription_id = None
        db.commit()
        logger.info("Subscription %s canceled — downgraded user %s to free tier", subscription_id, user.id)
        background_tasks.add_task(send_subscription_cancelled_email, user.email, immediately=False)

    elif status == "active":
        # Trial ended (converted to paid) or subscription reactivated after lapse
        if subscription.get("trial_end"):
            user.trial_active = False
            user.trial_converted = True
        # Restore tier if we previously downgraded to free (payment lapsed then resumed)
        if (user.subscription_tier or "").lower() == "free":
            try:
                price_id = subscription["items"]["data"][0]["price"]["id"]
                restored_tier = STRIPE_PRICES_REVERSE.get(price_id)
                if restored_tier:
                    user.subscription_tier = restored_tier
                    logger.info("Subscription %s reactivated — restored user %s to tier %s", subscription_id, user.id, restored_tier)
            except (KeyError, IndexError):
                pass
        db.commit()


async def handle_subscription_deleted(subscription, db: Session, background_tasks: BackgroundTasks):
    """Handle subscription cancellation"""
    subscription_id = subscription["id"]
    
    user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()
    if user:
        user.subscription_tier = "free"
        user.stripe_subscription_id = None
        db.commit()
        
        # Send cancellation confirmation
        background_tasks.add_task(
            send_subscription_cancelled_email,
            user.email,
            immediately=True
        )


async def handle_invoice_paid(invoice, db: Session, background_tasks: BackgroundTasks):
    """Handle paid invoice"""
    customer_id = invoice["customer"]
    
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        # Send receipt
        background_tasks.add_task(
            send_invoice_receipt_email,
            user.email,
            invoice["hosted_invoice_url"]
        )


async def handle_invoice_failed(invoice, db: Session, background_tasks: BackgroundTasks):
    """Handle failed invoice payment"""
    customer_id = invoice["customer"]
    
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        # Send payment failure notice
        background_tasks.add_task(
            send_invoice_failed_email,
            user.email,
            invoice["amount_due"] / 100
        )


# ==================== EMAIL NOTIFICATIONS ====================

async def send_subscription_confirmation(email: str, tier: str, trial_days: int):
    """Send subscription confirmation email"""
    # Implementation in next artifact
    pass

async def send_subscription_updated_email(email: str, tier: str):
    """Send subscription update email"""
    pass

async def send_subscription_cancelled_email(email: str, immediately: bool):
    """Send cancellation confirmation"""
    pass

async def send_payment_success_email(email: str, amount: float, description: str):
    """Send payment success email"""
    pass

async def send_payment_failed_email(email: str, reason: str):
    """Send payment failure email"""
    pass

async def send_invoice_receipt_email(email: str, invoice_url: str):
    """Send invoice receipt"""
    pass

async def send_invoice_failed_email(email: str, amount: float):
    """Send failed invoice notification"""
    pass
