"""
Twilio SMS reply webhook.

When a dealer replies to a YachtVersal SMS notification, Twilio POSTs to
POST /api/sms/inbound.  We look up the SmsConversation for that phone
number and create a platform reply message.

Setup (one-time, in Twilio console):
  1. Buy a phone number (or use an existing one).
  2. Under the number's Messaging settings, set:
       "A message comes in" → Webhook → POST
       URL: https://yacht-platform.onrender.com/api/sms/inbound
  3. Set env vars:
       TWILIO_ACCOUNT_SID   = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
       TWILIO_AUTH_TOKEN    = your_auth_token
       TWILIO_PHONE_NUMBER  = +1XXXXXXXXXX
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Request, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.misc import Message, Notification, SmsConversation
from app.models.user import User
from app.services.sms_service import normalize_phone

router = APIRouter()
logger = logging.getLogger(__name__)

_EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'


@router.post("/api/sms/inbound", include_in_schema=False)
async def sms_inbound(request: Request, db: Session = Depends(get_db)):
    """
    Receive a dealer SMS reply from Twilio and post it as a platform message.
    Always returns empty TwiML so Twilio doesn't auto-send a response.
    """
    try:
        form = await request.form()
    except Exception:
        return Response(content=_EMPTY_TWIML, media_type="text/xml")

    from_number = normalize_phone(form.get("From", "") or "")
    body = (form.get("Body") or "").strip()

    logger.debug(f"SMS inbound — from: {from_number}  body: {body[:60]!r}")

    if not from_number or not body:
        return Response(content=_EMPTY_TWIML, media_type="text/xml")

    # --- find conversation --------------------------------------------------
    convo = (
        db.query(SmsConversation)
        .filter(SmsConversation.dealer_phone == from_number)
        .order_by(SmsConversation.updated_at.desc())
        .first()
    )
    if not convo:
        logger.info(f"sms_inbound: no conversation for {from_number} — discarding")
        return Response(content=_EMPTY_TWIML, media_type="text/xml")

    parent = db.query(Message).filter(Message.id == convo.message_id).first()
    if not parent:
        return Response(content=_EMPTY_TWIML, media_type="text/xml")

    dealer = db.query(User).filter(User.id == convo.dealer_user_id).first()

    # Who receives this reply?
    if dealer:
        recipient_id = (
            parent.sender_id
            if parent.recipient_id == dealer.id
            else parent.recipient_id
        )
    else:
        recipient_id = parent.sender_id

    # --- create reply in platform -------------------------------------------
    reply = Message(
        sender_id=convo.dealer_user_id,
        recipient_id=recipient_id,
        parent_message_id=parent.id,
        listing_id=parent.listing_id,
        subject=f"Re: {parent.subject}",
        body=body,
        message_type=parent.message_type,
        ticket_number=parent.ticket_number,
        priority=parent.priority,
        category=parent.category,
        status="new",
    )
    db.add(reply)
    parent.status = "replied"
    parent.replied_at = datetime.utcnow()

    # Keep conversation pointer at latest message for easy future lookups
    convo.message_id = reply.id

    dealer_name = (
        f"{dealer.first_name} {dealer.last_name}" if dealer else "Your dealer"
    )
    db.add(
        Notification(
            user_id=recipient_id,
            notification_type="message",
            title=f"Reply from {dealer_name}",
            body=body[:160],
            link=f"/dashboard/messages/{parent.id}",
            read=False,
        )
    )
    db.commit()
    db.refresh(reply)

    # --- email the reply recipient (buyer / other party) -------------------
    try:
        from app.services.email_service import email_service
        from app.core.reply_token import generate_reply_token
        import os

        recipient = db.query(User).filter(User.id == recipient_id).first()
        if recipient:
            new_token = generate_reply_token(reply.id, recipient_id)
            reply_to_addr = f"reply+{new_token}@{os.getenv('REPLY_TO_DOMAIN', 'mail.yachtversal.com')}"
            email_service.send_email(
                to_email=recipient.email,
                subject=f"Re: {parent.subject}",
                html_content=f"""
                <html>
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:linear-gradient(135deg,#10214F,#01BBDC);
                              padding:28px;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:22px;">
                      Reply from {dealer_name}
                    </h1>
                  </div>
                  <div style="padding:30px;background:#f9fafb;">
                    <div style="background:white;border-left:4px solid #01BBDC;
                                padding:20px;border-radius:4px;margin-bottom:24px;">
                      <p style="color:#334155;line-height:1.7;white-space:pre-wrap;
                                margin:0;">{body}</p>
                    </div>
                    <p style="color:#64748b;font-size:13px;">
                      💬 <strong>Reply to this email</strong> to continue the
                      conversation — or view it on the platform.
                    </p>
                    <div style="text-align:center;margin-top:24px;">
                      <a href="{email_service.base_url}/dashboard/messages/{parent.id}"
                         style="background:#10214F;color:white;padding:12px 28px;
                                text-decoration:none;border-radius:6px;
                                display:inline-block;font-weight:bold;">
                        View Conversation
                      </a>
                    </div>
                  </div>
                  <div style="background:#1e293b;padding:18px;text-align:center;
                              color:#94a3b8;font-size:12px;">
                    © 2026 YachtVersal
                  </div>
                </body>
                </html>
                """,
                reply_to=reply_to_addr,
            )
    except Exception as exc:
        logger.error(f"sms_inbound: failed to email recipient: {exc}")

    logger.info(
        f"sms_inbound: routed reply → message {reply.id} "
        f"(from dealer {convo.dealer_user_id} → user {recipient_id})"
    )
    return Response(content=_EMPTY_TWIML, media_type="text/xml")
