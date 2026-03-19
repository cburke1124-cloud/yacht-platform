"""
SendGrid Inbound Parse webhook endpoint.

When a dealer hits Reply in their email client the message arrives at
  reply+{token}@mail.yachtversal.com
and SendGrid posts the parsed email to POST /api/email/inbound.

Setup (one-time, in SendGrid dashboard):
  1. Add `mail.yachtversal.com` as an authenticated sending domain.
  2. Configure an MX record:  mail.yachtversal.com → mx.sendgrid.net  (priority 10)
  3. Inbound Parse → Add Host & URL:
       Hostname : mail.yachtversal.com
       URL      : https://yacht-platform.onrender.com/api/email/inbound
       ☑ Check Spam / ☑ Send Raw (leave unchecked — use default parsed form)
"""
import os
import re
import logging

from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import get_db
from app.models.misc import Message, Notification
from app.models.user import User
from app.core.reply_token import decode_reply_token, generate_reply_token
from app.services.email_service import email_service

router = APIRouter()
logger = logging.getLogger(__name__)

REPLY_TO_DOMAIN = os.getenv("REPLY_TO_DOMAIN", "mail.yachtversal.com")

# --------------------------------------------------------------------------- #
#  Helpers                                                                     #
# --------------------------------------------------------------------------- #

def _extract_token(text: str) -> str | None:
    """Pull the base64url token out of  reply+TOKEN@domain  anywhere in text."""
    m = re.search(r"reply\+([A-Za-z0-9_\-]+)@", text or "")
    return m.group(1) if m else None


def _strip_quoted_reply(text: str) -> str:
    """
    Remove the quoted original message that email clients append.
    Handles Gmail, Outlook, Apple Mail, and generic `>` quoting.
    """
    patterns = [
        r"\nOn .{0,200}wrote:\s*\n",         # Gmail / Apple Mail
        r"\n-{3,}\s*Original Message\s*-{3,}",  # Outlook
        r"\nFrom:.*?Sent:.*?\n",              # Outlook plain
        r"\n_{5,}",                           # Outlook horizontal rule
        r"\n>[ \t].*",                        # Any quoted line
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL | re.IGNORECASE)
        if m:
            text = text[: m.start()]
    return text.strip()


# --------------------------------------------------------------------------- #
#  Webhook                                                                     #
# --------------------------------------------------------------------------- #

@router.post("/api/email/inbound", include_in_schema=False)
async def email_inbound(request: Request, db: Session = Depends(get_db)):
    """
    Receive parsed email from SendGrid Inbound Parse and route the reply
    body into the platform as a new Message.
    """
    try:
        form = await request.form()
    except Exception:
        return {"ok": True}

    to_field   = form.get("to", "") or ""
    from_field = form.get("from", "") or ""
    headers    = form.get("headers", "") or ""
    text_body  = (form.get("text") or form.get("plain") or "").strip()
    html_body  = (form.get("html") or "").strip()

    logger.debug(f"Email inbound — to: {to_field}  from: {from_field}")

    # --- locate token -------------------------------------------------------
    token = (
        _extract_token(to_field)
        or _extract_token(headers)
        or _extract_token(from_field)
    )
    if not token:
        logger.warning("email_inbound: no reply+token found — discarding")
        return {"ok": True}

    decoded = decode_reply_token(token)
    if not decoded:
        logger.warning(f"email_inbound: invalid token {token!r} — discarding")
        return {"ok": True}

    message_id, reply_from_user_id = decoded

    parent = db.query(Message).filter(Message.id == message_id).first()
    if not parent:
        logger.warning(f"email_inbound: parent message {message_id} not found")
        return {"ok": True}

    # --- extract plain-text reply body -------------------------------------
    body = _strip_quoted_reply(text_body) if text_body else ""
    # fall back to stripped html if no plain text
    if not body and html_body:
        body = re.sub(r"<[^>]+>", " ", html_body)
        body = re.sub(r"\s+", " ", body).strip()
        body = _strip_quoted_reply(body)

    if not body:
        logger.info("email_inbound: empty body after stripping — discarding")
        return {"ok": True}

    # --- verify sender is a party to the conversation ----------------------
    sender = db.query(User).filter(User.id == reply_from_user_id).first()
    if not sender:
        return {"ok": True}

    if reply_from_user_id not in (parent.sender_id, parent.recipient_id):
        logger.warning("email_inbound: user not party to conversation")
        return {"ok": True}

    sender_name = f"{sender.first_name} {sender.last_name}"

    # -----------------------------------------------------------------------
    # CASE A: Inquiry reply — parent has no registered sender (anonymous buyer).
    # Email the buyer directly using external_sender_email and do NOT try to
    # create a user-to-user Message or Notification for a non-existent user.
    # -----------------------------------------------------------------------
    if parent.sender_id is None and parent.external_sender_email:
        parent.status = "replied"
        parent.replied_at = datetime.utcnow()
        db.commit()

        try:
            email_service.send_email(
                to_email=parent.external_sender_email,
                subject=f"Re: {parent.subject}",
                html_content=f"""
                <html>
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:linear-gradient(135deg,#10214F,#01BBDC);
                              padding:28px;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:22px;">
                      Reply from {sender_name}
                    </h1>
                  </div>
                  <div style="padding:30px;background:#f9fafb;">
                    <p style="color:#64748b;font-size:13px;margin-bottom:20px;">
                      You submitted an inquiry about <strong>{parent.subject.replace("Inquiry: ", "", 1)}</strong>.
                      Here is their response:
                    </p>
                    <div style="background:white;border-left:4px solid #01BBDC;
                                padding:20px;border-radius:4px;margin-bottom:24px;">
                      <p style="color:#334155;line-height:1.7;white-space:pre-wrap;
                                margin:0;">{body}</p>
                    </div>
                    <p style="color:#64748b;font-size:13px;">
                      You can reply to this email to continue the conversation.
                    </p>
                  </div>
                  <div style="background:#1e293b;padding:18px;text-align:center;
                              color:#94a3b8;font-size:12px;">
                    &#169; 2026 YachtVersal.
                  </div>
                </body>
                </html>
                """,
                reply_to=sender.email,
            )
            logger.info(
                f"email_inbound: forwarded broker reply to external buyer "
                f"{parent.external_sender_email} (message {parent.id})"
            )
        except Exception as exc:
            logger.error(f"email_inbound: failed to email external buyer: {exc}")

        return {"ok": True}

    # -----------------------------------------------------------------------
    # CASE B: Normal registered-user-to-user reply
    # -----------------------------------------------------------------------

    # --- create reply message -----------------------------------------------
    recipient_id = (
        parent.sender_id
        if parent.recipient_id == reply_from_user_id
        else parent.recipient_id
    )

    reply = Message(
        sender_id=reply_from_user_id,
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

    db.add(
        Notification(
            user_id=recipient_id,
            notification_type="message",
            title=f"Reply from {sender.first_name} {sender.last_name}",
            body=body[:160],
            link=f"/dashboard/messages/{parent.id}",
            read=False,
        )
    )
    db.commit()
    db.refresh(reply)

    # --- forward notification email to the recipient (keep chain alive) ----
    try:
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if recipient:
            new_token = generate_reply_token(reply.id, recipient_id)
            reply_to_addr = f"reply+{new_token}@{REPLY_TO_DOMAIN}"
            email_service.send_email(
                to_email=recipient.email,
                subject=f"Re: {parent.subject}",
                html_content=f"""
                <html>
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:linear-gradient(135deg,#10214F,#01BBDC);
                              padding:28px;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:22px;">
                      Reply from {sender_name}
                    </h1>
                  </div>
                  <div style="padding:30px;background:#f9fafb;">
                    <div style="background:white;border-left:4px solid #01BBDC;
                                padding:20px;border-radius:4px;margin-bottom:24px;">
                      <p style="color:#334155;line-height:1.7;white-space:pre-wrap;
                                margin:0;">{body}</p>
                    </div>
                    <p style="color:#64748b;font-size:13px;">
                      💬 <strong>Reply directly to this email</strong> to respond —
                      no login required.
                    </p>
                    <div style="text-align:center;margin-top:24px;">
                      <a href="{email_service.base_url}/dashboard/messages/{parent.id}"
                         style="background:#10214F;color:white;padding:12px 28px;
                                text-decoration:none;border-radius:6px;
                                display:inline-block;font-weight:bold;">
                        View Full Conversation
                      </a>
                    </div>
                  </div>
                  <div style="background:#1e293b;padding:18px;text-align:center;
                              color:#94a3b8;font-size:12px;">
                    © 2026 YachtVersal. You can reply to this email directly.
                  </div>
                </body>
                </html>
                """,
                reply_to=reply_to_addr,
            )
    except Exception as exc:
        logger.error(f"email_inbound: failed to forward notification: {exc}")

    logger.info(
        f"email_inbound: routed reply → message {reply.id} "
        f"(from user {reply_from_user_id} → user {recipient_id})"
    )
    return {"ok": True}
