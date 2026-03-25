"""
Contact form endpoint — public, rate-limited.

POST /contact
  - Saves the submission as an admin message (support_ticket) in the DB
  - Sends a notification email to the site contact address
  - Sends a confirmation email to the submitter
"""

from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional
import os
import logging

from app.core.limiter import limiter
from app.db.session import get_db
from app.models.misc import Message, Notification
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "info@yachtversal.com")


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    company: Optional[str] = None
    phone: Optional[str] = None
    subject: str
    message: str


@router.post("/contact")
@limiter.limit("5/hour")
async def submit_contact_form(request: Request, data: ContactRequest, db: Session = Depends(get_db)):
    """
    Receive a contact form submission.
    Saves to admin message inbox, sends internal notification, and confirmation to sender.
    """
    if not data.name.strip() or not data.message.strip():
        return {"success": False, "message": "Name and message are required."}

    # ── Save to admin message inbox ──────────────────────────────────────────
    company_info = f"\nCompany: {data.company}" if data.company else ""
    phone_info = f"\nPhone: {data.phone}" if data.phone else ""
    message_body = (
        f"From: {data.name} <{data.email}>{company_info}{phone_info}\n\n"
        f"{data.message}"
    )

    admins = db.query(User).filter(User.user_type == "admin").all()
    primary_admin = admins[0] if admins else None

    if primary_admin:
        try:
            ticket = Message(
                sender_id=None,
                recipient_id=primary_admin.id,
                message_type="contact_form",
                subject=f"[Contact] {data.subject} — {data.name}",
                body=message_body,
                category="general",
                status="new",
                visible_to_dealer=False,
            )
            db.add(ticket)
            db.flush()
            ticket.ticket_number = f"CTF-{ticket.id}"

            # Notify every admin
            for admin in admins:
                db.add(Notification(
                    user_id=admin.id,
                    notification_type="support",
                    title=f"New contact form message from {data.name}",
                    body=data.subject,
                    link="/admin",
                    read=False,
                ))
            db.commit()
        except Exception as e:
            logger.error(f"Contact form: failed to save admin message: {e}")
            db.rollback()

    # Build internal notification email
    company_line = f"<p><strong>Company:</strong> {data.company}</p>" if data.company else ""
    phone_line = f"<p><strong>Phone:</strong> {data.phone}</p>" if data.phone else ""

    internal_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #10214F;">New Contact Form Submission</h2>
        <hr style="border-color: #01BBDC;" />
        <p><strong>From:</strong> {data.name}</p>
        <p><strong>Email:</strong> {data.email}</p>
        {company_line}
        {phone_line}
        <p><strong>Subject:</strong> {data.subject}</p>
        <hr style="border-color: #e5e7eb;" />
        <h3 style="color: #10214F;">Message</h3>
        <p style="white-space: pre-wrap;">{data.message}</p>
        <hr style="border-color: #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
            Submitted via the YachtVersal contact form.
            Reply directly to this email to respond to {data.name}.
        </p>
    </div>
    """

    # Send to the site team
    try:
        from app.services.email_service import email_service
        email_service.send_email(
            to_email=CONTACT_EMAIL,
            subject=f"[Contact Form] {data.subject} — {data.name}",
            html_content=internal_html,
            reply_to=str(data.email),
        )
    except Exception as e:
        logger.error(f"Contact form: failed to send internal notification: {e}")
        # Don't fail the request — still send confirmation and return success

    # Confirmation email to sender
    confirmation_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #10214F; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">YachtVersal</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #10214F;">Thanks for reaching out, {data.name.split()[0]}!</h2>
            <p style="color: #374151;">
                We've received your message and will get back to you within 1–2 business days.
            </p>
            <div style="background: #f9fafb; border-left: 4px solid #01BBDC; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Your message:</strong></p>
                <p style="margin: 8px 0 0; color: #374151; white-space: pre-wrap; font-size: 14px;">{data.message[:500]}{"..." if len(data.message) > 500 else ""}</p>
            </div>
            <p style="color: #374151;">
                In the meantime, feel free to browse our latest listings or reach us directly at
                <a href="mailto:{CONTACT_EMAIL}" style="color: #01BBDC;">{CONTACT_EMAIL}</a>.
            </p>
            <a href="https://yachtversal.com/listings"
               style="display: inline-block; background: #01BBDC; color: white; padding: 12px 28px;
                      border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px;">
                Browse Listings
            </a>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; padding: 16px;">
            © 2025 YachtVersal. All rights reserved.
        </p>
    </div>
    """

    try:
        from app.services.email_service import email_service
        email_service.send_email(
            to_email=str(data.email),
            subject="We received your message — YachtVersal",
            html_content=confirmation_html,
        )
    except Exception as e:
        logger.warning(f"Contact form: failed to send confirmation email: {e}")

    return {"success": True, "message": "Your message has been sent. We'll be in touch soon!"}
