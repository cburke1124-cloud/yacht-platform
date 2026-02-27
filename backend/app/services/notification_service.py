from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
import logging

from app.services.email_service import email_service
from app.models.misc import Message, Notification
from app.models.user import User

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Unified notification service that sends:
    1. Email notifications
    2. Internal messages
    3. In-app notifications
    """
    
    def __init__(self):
        self.email_service = email_service
    
    async def send_notification(
        self,
        user_id: int,
        title: str,
        body: str,
        notification_type: str,
        db: Session,
        send_email: bool = True,
        send_internal_message: bool = True,
        send_in_app: bool = True,
        link: Optional[str] = None,
        email_html: Optional[str] = None,
        sender_id: Optional[int] = None,
        priority: str = "normal"
    ):
        """
        Send unified notification across all channels
        
        Args:
            user_id: Recipient user ID
            title: Notification title
            body: Notification body
            notification_type: Type (inquiry, message, payment, etc.)
            db: Database session
            send_email: Whether to send email
            send_internal_message: Whether to create internal message
            send_in_app: Whether to create in-app notification
            link: Optional link for notification
            email_html: Optional custom HTML for email
            sender_id: Optional sender ID for internal message
            priority: Message priority (low, normal, high, urgent)
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"User {user_id} not found")
            return
        
        # 1. Send Email
        if send_email:
            try:
                if email_html:
                    # Use custom HTML
                    self.email_service.send_email(user.email, title, email_html)
                else:
                    # Use default template
                    html = self._generate_default_email(title, body, link)
                    self.email_service.send_email(user.email, title, html)
            except Exception as e:
                logger.error(f"Failed to send email to {user.email}: {e}")
        
        # 2. Create Internal Message
        if send_internal_message:
            try:
                message = Message(
                    sender_id=sender_id or 1,  # System user ID = 1
                    recipient_id=user_id,
                    message_type="direct",
                    subject=title,
                    body=body,
                    priority=priority,
                    status="new"
                )
                db.add(message)
            except Exception as e:
                logger.error(f"Failed to create internal message: {e}")
        
        # 3. Create In-App Notification
        if send_in_app:
            try:
                notification = Notification(
                    user_id=user_id,
                    notification_type=notification_type,
                    title=title,
                    body=body,
                    link=link,
                    read=False
                )
                db.add(notification)
            except Exception as e:
                logger.error(f"Failed to create notification: {e}")
        
        try:
            db.commit()
        except Exception as e:
            logger.error(f"Failed to commit notifications: {e}")
            db.rollback()
    
    def _generate_default_email(self, title: str, body: str, link: Optional[str] = None) -> str:
        """Generate default email HTML"""
        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #2563eb, #1e40af); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">YachtVersal</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">{title}</h2>
                    <div style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">
                        {body}
                    </div>
                    
                    {f'''
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{link}" 
                           style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            View Details
                        </a>
                    </div>
                    ''' if link else ''}
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
    
    # ==================== INQUIRY NOTIFICATIONS ====================
    
    async def notify_new_inquiry(
        self,
        dealer_id: int,
        inquiry_id: int,
        sender_name: str,
        sender_email: str,
        listing_title: str,
        message: str,
        db: Session
    ):
        """Notify dealer about new inquiry"""
        title = f"New Inquiry: {listing_title}"
        body = f"""
You have received a new inquiry!

From: {sender_name} ({sender_email})
Listing: {listing_title}

Message:
{message}

Respond quickly to increase your chances of closing the deal!
        """
        
        email_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #10b981, #059669); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🎉 New Inquiry!</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">{listing_title}</h2>
                    
                    <div style="background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Contact Information</h3>
                        <p style="color: #4b5563; margin: 5px 0;">
                            <strong>Name:</strong> {sender_name}<br>
                            <strong>Email:</strong> {sender_email}
                        </p>
                    </div>
                    
                    <div style="background: white; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Message</h3>
                        <p style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">
                            {message}
                        </p>
                    </div>
                    
                    <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                        <p style="color: #1e40af; margin: 0; font-size: 14px;">
                            💡 <strong>Tip:</strong> Quick responses lead to higher conversion rates. 
                            Reply within 1 hour for best results!
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{email_service.base_url}/dashboard/inquiries/{inquiry_id}" 
                           style="background: #10b981; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                            View & Respond
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        await self.send_notification(
            user_id=dealer_id,
            title=title,
            body=body,
            notification_type="inquiry",
            db=db,
            link=f"/dashboard/inquiries/{inquiry_id}",
            email_html=email_html,
            priority="high"
        )
    
    # ==================== MESSAGE NOTIFICATIONS ====================
    
    async def notify_new_message(
        self,
        recipient_id: int,
        sender_id: int,
        sender_name: str,
        subject: str,
        message_body: str,
        message_id: int,
        db: Session
    ):
        """Notify user about new message"""
        title = f"New Message from {sender_name}"
        body = f"""
Subject: {subject}

{message_body[:200]}{'...' if len(message_body) > 200 else ''}
        """
        
        email_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #3b82f6, #2563eb); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">✉️ New Message</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">From</p>
                        <h2 style="color: #1f2937; margin: 0 0 10px 0;">{sender_name}</h2>
                        <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0;">Subject</p>
                        <h3 style="color: #4b5563; margin: 0;">{subject}</h3>
                    </div>
                    
                    <div style="background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px;">
                        <p style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">
                            {message_body}
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{email_service.base_url}/messages?id={message_id}" 
                           style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            Reply to Message
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        await self.send_notification(
            user_id=recipient_id,
            title=title,
            body=body,
            notification_type="message",
            db=db,
            sender_id=sender_id,
            link=f"/messages?id={message_id}",
            email_html=email_html
        )
    
    # ==================== PAYMENT NOTIFICATIONS ====================
    
    async def notify_payment_success(
        self,
        user_id: int,
        amount: float,
        description: str,
        db: Session
    ):
        """Notify user about successful payment"""
        title = "Payment Successful"
        body = f"""
Your payment of ${amount:.2f} has been processed successfully.

Description: {description}

Thank you for your business!
        """
        
        email_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #10b981, #059669); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">✅ Payment Successful</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="display: inline-block; background: white; border-radius: 50%; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <span style="font-size: 48px;">✓</span>
                        </div>
                    </div>
                    
                    <h2 style="color: #1f2937; text-align: center;">Payment Confirmed</h2>
                    
                    <div style="background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span style="color: #6b7280;">Amount:</span>
                            <span style="color: #1f2937; font-weight: bold; font-size: 20px;">${amount:.2f}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span style="color: #6b7280;">Description:</span>
                            <span style="color: #4b5563;">{description}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6b7280;">Date:</span>
                            <span style="color: #4b5563;">{datetime.utcnow().strftime('%B %d, %Y')}</span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{email_service.base_url}/dashboard/billing" 
                           style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            View Billing History
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        await self.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type="payment",
            db=db,
            link="/dashboard/billing",
            email_html=email_html
        )
    
    async def notify_payment_failed(
        self,
        user_id: int,
        amount: float,
        reason: str,
        db: Session
    ):
        """Notify user about failed payment"""
        title = "Payment Failed"
        body = f"""
Your payment of ${amount:.2f} could not be processed.

Reason: {reason}

Please update your payment method to continue your subscription.
        """
        
        email_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #ef4444, #dc2626); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">⚠️ Payment Failed</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Action Required</h2>
                    
                    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                        <p style="color: #7f1d1d; margin: 0;">
                            <strong>Payment Error:</strong> {reason}
                        </p>
                    </div>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        We were unable to process your payment of <strong>${amount:.2f}</strong>. 
                        Please update your payment method to avoid service interruption.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{email_service.base_url}/dashboard/billing" 
                           style="background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            Update Payment Method
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        await self.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type="payment",
            db=db,
            link="/dashboard/billing",
            email_html=email_html,
            priority="urgent"
        )
    
    # ==================== SUBSCRIPTION NOTIFICATIONS ====================
    
    async def notify_subscription_expiring(
        self,
        user_id: int,
        days_remaining: int,
        db: Session
    ):
        """Notify user subscription is expiring soon"""
        title = f"Subscription Expiring in {days_remaining} Days"
        body = f"""
Your YachtVersal subscription will expire in {days_remaining} days.

Renew now to continue enjoying all premium features without interruption.
        """
        
        await self.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type="subscription",
            db=db,
            link="/dashboard/billing",
            priority="high"
        )
    
    # ==================== PRICE DROP ALERTS ====================
    
    async def notify_price_drop(
        self,
        user_id: int,
        listing_id: int,
        listing_title: str,
        old_price: float,
        new_price: float,
        db: Session
    ):
        """Notify user about price drop on saved listing"""
        savings = old_price - new_price
        percentage = (savings / old_price) * 100
        
        title = f"Price Drop Alert: {listing_title}"
        body = f"""
Great news! The price has dropped on a yacht you're watching.

{listing_title}
Was: ${old_price:,.2f}
Now: ${new_price:,.2f}
You save: ${savings:,.2f} ({percentage:.1f}% off!)

Don't miss this opportunity!
        """
        
        await self.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type="price_alert",
            db=db,
            link=f"/listings/{listing_id}",
            priority="high"
        )
    
    # ==================== SEARCH ALERTS ====================
    
    async def notify_new_listing_match(
        self,
        user_id: int,
        listings: List[dict],
        search_name: str,
        db: Session
    ):
        """Notify user about new listings matching their search"""
        count = len(listings)
        title = f"{count} New Yacht{'s' if count > 1 else ''} Match Your Search"
        body = f"""
We found {count} new listing{'s' if count > 1 else ''} matching "{search_name}"!

Check them out before they're gone.
        """
        
        await self.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type="new_listing",
            db=db,
            link="/saved-searches"
        )


# Singleton instance
notification_service = NotificationService()
