import stripe
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# Price IDs — set these in your Stripe Dashboard and add as Render env vars.
# NOTE: 'ultimate' is intentionally excluded — it uses custom per-account pricing
# set by an admin and a dynamic Stripe Price is created at checkout time.
STRIPE_PRICES = {
    "basic": os.getenv("STRIPE_PRICE_BASIC", "price_basic_monthly"),
    "plus": os.getenv("STRIPE_PRICE_PLUS", "price_plus_monthly"),
    "pro": os.getenv("STRIPE_PRICE_PRO", "price_pro_monthly"),
    "private_basic": os.getenv("STRIPE_PRICE_PRIVATE_BASIC", "price_private_basic_monthly"),
    "private_plus": os.getenv("STRIPE_PRICE_PRIVATE_PLUS", "price_private_plus_monthly"),
    "private_pro": os.getenv("STRIPE_PRICE_PRIVATE_PRO", "price_private_pro_monthly"),
}

# Trial days per tier — 0 means no trial by default.
# Sales reps can set per-customer trials via the admin sales tools.
TIER_TRIAL_DAYS = {
    "basic": 0,
    "plus": 0,
    "pro": 0,
    "private_basic": 0,
    "private_plus": 0,
    "private_pro": 0,
}


class StripeService:
    """Handle all Stripe payment operations"""
    
    @staticmethod
    def create_customer(email: str, name: str, user_id: int) -> str:
        """Create a Stripe customer"""
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={
                    "user_id": user_id
                }
            )
            logger.info(f"Created Stripe customer: {customer.id}")
            return customer.id
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create customer: {e}")
            raise Exception(f"Failed to create customer: {str(e)}")
    
    @staticmethod
    def create_subscription(
        customer_id: str,
        price_id: str,
        trial_days: int = 0,
        coupon_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a subscription for a customer"""
        try:
            params = {
                "customer": customer_id,
                "items": [{"price": price_id}],
                "payment_behavior": "default_incomplete",
                "payment_settings": {
                    "save_default_payment_method": "on_subscription"
                },
                "expand": ["latest_invoice.payment_intent"],
            }
            
            # Add trial period if specified
            if trial_days > 0:
                params["trial_period_days"] = trial_days
            
            # Add coupon if provided
            if coupon_id:
                params["coupon"] = coupon_id
            
            subscription = stripe.Subscription.create(**params)
            
            return {
                "subscription_id": subscription.id,
                "client_secret": subscription.latest_invoice.payment_intent.client_secret,
                "status": subscription.status
            }
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create subscription: {e}")
            raise Exception(f"Failed to create subscription: {str(e)}")
    
    @staticmethod
    def update_subscription(
        subscription_id: str,
        new_price_id: str,
        proration_behavior: str = "always_invoice"
    ) -> Dict[str, Any]:
        """Update a subscription (upgrade/downgrade)"""
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            
            updated_subscription = stripe.Subscription.modify(
                subscription_id,
                items=[{
                    "id": subscription['items']['data'][0].id,
                    "price": new_price_id,
                }],
                proration_behavior=proration_behavior
            )
            
            return {
                "subscription_id": updated_subscription.id,
                "status": updated_subscription.status,
                "current_period_end": updated_subscription.current_period_end
            }
        except stripe.error.StripeError as e:
            logger.error(f"Failed to update subscription: {e}")
            raise Exception(f"Failed to update subscription: {str(e)}")
    
    @staticmethod
    def cancel_subscription(
        subscription_id: str,
        cancel_at_period_end: bool = True
    ) -> Dict[str, Any]:
        """Cancel a subscription"""
        try:
            if cancel_at_period_end:
                subscription = stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True
                )
            else:
                subscription = stripe.Subscription.delete(subscription_id)
            
            return {
                "subscription_id": subscription.id,
                "status": subscription.status,
                "cancel_at": subscription.cancel_at if hasattr(subscription, 'cancel_at') else None
            }
        except stripe.error.StripeError as e:
            logger.error(f"Failed to cancel subscription: {e}")
            raise Exception(f"Failed to cancel subscription: {str(e)}")
    
    @staticmethod
    def create_billing_portal_session(customer_id: str, return_url: str) -> str:
        """Create a billing portal session for customer to manage subscription"""
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url
            )
            return session.url
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create billing portal: {e}")
            raise Exception(f"Failed to create billing portal: {str(e)}")
    
    @staticmethod
    def create_checkout_session(
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        trial_days: int = 0
    ) -> str:
        """Create a checkout session"""
        try:
            params = {
                "customer": customer_id,
                "mode": "subscription",
                "line_items": [{
                    "price": price_id,
                    "quantity": 1
                }],
                "success_url": success_url,
                "cancel_url": cancel_url,
            }
            
            if trial_days > 0:
                params["subscription_data"] = {
                    "trial_period_days": trial_days
                }
            
            session = stripe.checkout.Session.create(**params)
            return session.url
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create checkout session: {e}")
            raise Exception(f"Failed to create checkout session: {str(e)}")
    
    @staticmethod
    def create_coupon(
        percent_off: Optional[int] = None,
        amount_off: Optional[int] = None,
        duration: str = "once",
        duration_in_months: Optional[int] = None,
        name: Optional[str] = None
    ) -> str:
        """Create a coupon for discounts"""
        try:
            params = {"duration": duration}
            
            if percent_off:
                params["percent_off"] = percent_off
            elif amount_off:
                params["amount_off"] = amount_off
                params["currency"] = "usd"
            
            if duration == "repeating" and duration_in_months:
                params["duration_in_months"] = duration_in_months
            
            if name:
                params["name"] = name
            
            coupon = stripe.Coupon.create(**params)
            return coupon.id
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create coupon: {e}")
            raise Exception(f"Failed to create coupon: {str(e)}")
    
    @staticmethod
    def retrieve_subscription(subscription_id: str) -> Dict[str, Any]:
        """Get subscription details"""
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            return {
                "id": subscription.id,
                "status": subscription.status,
                "current_period_start": subscription.current_period_start,
                "current_period_end": subscription.current_period_end,
                "cancel_at_period_end": subscription.cancel_at_period_end,
                "canceled_at": subscription.canceled_at,
                "trial_end": subscription.trial_end,
                "plan": subscription.items.data[0].price.id
            }
        except stripe.error.StripeError as e:
            logger.error(f"Failed to retrieve subscription: {e}")
            raise Exception(f"Failed to retrieve subscription: {str(e)}")
    
    @staticmethod
    def list_invoices(customer_id: str, limit: int = 10) -> list:
        """Get customer invoices"""
        try:
            invoices = stripe.Invoice.list(
                customer=customer_id,
                limit=limit
            )
            return [
                {
                    "id": inv.id,
                    "amount_due": inv.amount_due / 100,  # Convert cents to dollars
                    "amount_paid": inv.amount_paid / 100,
                    "currency": inv.currency,
                    "status": inv.status,
                    "created": inv.created,
                    "invoice_pdf": inv.invoice_pdf,
                    "hosted_invoice_url": inv.hosted_invoice_url
                }
                for inv in invoices.data
            ]
        except stripe.error.StripeError as e:
            logger.error(f"Failed to list invoices: {e}")
            raise Exception(f"Failed to list invoices: {str(e)}")
    
    @staticmethod
    def create_payment_intent(
        amount: int,  # in cents
        currency: str = "usd",
        customer_id: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a one-time payment intent"""
        try:
            params = {
                "amount": amount,
                "currency": currency,
                "automatic_payment_methods": {"enabled": True}
            }
            
            if customer_id:
                params["customer"] = customer_id
            
            if description:
                params["description"] = description
            
            intent = stripe.PaymentIntent.create(**params)
            
            return {
                "payment_intent_id": intent.id,
                "client_secret": intent.client_secret,
                "status": intent.status
            }
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create payment intent: {e}")
            raise Exception(f"Failed to create payment intent: {str(e)}")
    
    @staticmethod
    def refund_payment(
        payment_intent_id: str,
        amount: Optional[int] = None,  # in cents, None for full refund
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Refund a payment"""
        try:
            params = {"payment_intent": payment_intent_id}
            
            if amount:
                params["amount"] = amount
            
            if reason:
                params["reason"] = reason
            
            refund = stripe.Refund.create(**params)
            
            return {
                "refund_id": refund.id,
                "amount": refund.amount / 100,
                "status": refund.status
            }
        except stripe.error.StripeError as e:
            logger.error(f"Failed to refund payment: {e}")
            raise Exception(f"Failed to refund payment: {str(e)}")
    
    @staticmethod
    def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
        """Verify Stripe webhook signature"""
        try:
            stripe.Webhook.construct_event(payload, signature, secret)
            return True
        except ValueError:
            # Invalid payload
            logger.error("Invalid webhook payload")
            return False
        except stripe.error.SignatureVerificationError:
            # Invalid signature
            logger.error("Invalid webhook signature")
            return False
    
    @staticmethod
    def handle_subscription_schedule(
        subscription_id: str,
        phases: list
    ) -> str:
        """Create a subscription schedule for future changes"""
        try:
            schedule = stripe.SubscriptionSchedule.create(
                from_subscription=subscription_id,
                phases=phases
            )
            return schedule.id
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create subscription schedule: {e}")
            raise Exception(f"Failed to create subscription schedule: {str(e)}")

    @staticmethod
    def create_custom_price(amount: int, currency: str, product_name: str, interval: str = "month") -> Any:
        # Create a price directly (Stripe will create a product implicitly if product_data is used)
        try:
            price = stripe.Price.create(
                unit_amount=amount,
                currency=currency,
                recurring={"interval": interval},
                product_data={"name": product_name},
            )
            return price
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create custom price: {e}")
            raise Exception(f"Failed to create custom price: {str(e)}")



# Singleton instance
stripe_service = StripeService()
