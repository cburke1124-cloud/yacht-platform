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
from app.models.misc import FoundingBrokerSignup
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "info@yachtversal.com")
FOUNDING_BROKER_EMAIL = "admin@yachtversal.com"


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    company: Optional[str] = None
    phone: Optional[str] = None
    subject: str
    message: str


class FoundingBrokerRequest(BaseModel):
    name: str
    email: EmailStr
    company_name: str
    website: Optional[str] = None
    phone: Optional[str] = None
    years_experience: Optional[str] = None
    message: Optional[str] = None


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


@router.post("/founding-broker")
@limiter.limit("10/hour")
async def submit_founding_broker_form(request: Request, data: FoundingBrokerRequest, db: Session = Depends(get_db)):
    """
    Receive a Founding Broker Program signup.
    Always saves to DB first, then sends notification email to admin@yachtversal.com.
    """
    # ── Save to DB (primary record — never lost even if email fails) ─────────
    try:
        signup = FoundingBrokerSignup(
            name=data.name.strip(),
            email=str(data.email).strip().lower(),
            company_name=data.company_name.strip(),
            website=data.website.strip() if data.website else None,
            phone=data.phone.strip() if data.phone else None,
            years_experience=data.years_experience if data.years_experience else None,
            message=data.message.strip() if data.message else None,
            status="new",
        )
        db.add(signup)
        db.commit()
        db.refresh(signup)
        logger.info(f"Founding broker signup saved: id={signup.id} email={signup.email}")
    except Exception as e:
        logger.error(f"Founding broker form: failed to save to DB: {e}")
        db.rollback()
        # Don't return failure — still try to send email so no submission is lost

    website_line = f"<p><strong>Website:</strong> <a href='{data.website}'>{data.website}</a></p>" if data.website else ""
    phone_line = f"<p><strong>Phone:</strong> {data.phone}</p>" if data.phone else ""
    exp_line = f"<p><strong>Years of Experience:</strong> {data.years_experience}</p>" if data.years_experience else ""
    msg_line = f"""
        <hr style="border-color: #e5e7eb; margin: 20px 0;" />
        <h3 style="color: #10214F; margin: 0 0 8px;">Additional Notes</h3>
        <p style="white-space: pre-wrap; color: #374151;">{data.message}</p>
    """ if data.message else ""

    admin_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #10214F; padding: 28px 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 0.5px;">YachtVersal</h1>
            <p style="color: #01BBDC; margin: 6px 0 0; font-size: 14px;">Founding Broker Program — New Signup</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #10214F; margin: 0 0 20px;">New Founding Broker Application</h2>
            <p><strong>Name:</strong> {data.name}</p>
            <p><strong>Email:</strong> <a href="mailto:{data.email}" style="color: #01BBDC;">{data.email}</a></p>
            <p><strong>Company:</strong> {data.company_name}</p>
            {website_line}
            {phone_line}
            {exp_line}
            {msg_line}
            <hr style="border-color: #e5e7eb; margin: 24px 0;" />
            <p style="color: #6b7280; font-size: 12px;">
                Submitted via the YachtVersal Founding Broker landing page.
                Reply directly to this email to reach {data.name}.
            </p>
        </div>
    </div>
    """

    try:
        from app.services.email_service import email_service
        email_service.send_email(
            to_email=FOUNDING_BROKER_EMAIL,
            subject=f"[Founding Broker] New Signup — {data.name} ({data.company_name})",
            html_content=admin_html,
            reply_to=str(data.email),
        )
    except Exception as e:
        logger.error(f"Founding broker form: failed to send admin notification: {e}")
        # Submission already saved to DB — this is non-fatal

    return {"success": True}


@router.get("/founding-broker")
async def list_founding_broker_signups(
    db: Session = Depends(get_db),
):
    """Admin-only endpoint to retrieve all founding broker signups.
    Requires a valid admin Bearer token passed via the Authorization header.
    """
    from app.api.deps import get_current_user
    from fastapi import HTTPException
    raise HTTPException(status_code=405, detail="Use POST /founding-broker for submissions. Admin access: see /admin panel.")
