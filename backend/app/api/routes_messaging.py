import os
from fastapi import APIRouter, Depends, Query, UploadFile, File
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional
import secrets

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.misc import Message, Notification
from app.exceptions import (
    ResourceNotFoundException,
    AuthorizationException,
    ValidationException,
)
from app.services.email_service import email_service
from app.services.sms_service import sms_service
from app.services.media_storage import store_media_bytes
from app.core.reply_token import generate_reply_token
from app.models.user import UserPreferences

REPLY_TO_DOMAIN = os.getenv("REPLY_TO_DOMAIN", "mail.yachtversal.com")


def _prefs_allow(
    db: Session,
    user_id: int,
    message_type: str,
) -> dict:
    """
    Return a dict of channel flags for the given user and message_type.
    Defaults to all-True if the user has no saved preferences.

    message_type "inquiry"  checks the _inquiry columns.
    Everything else checks the _message columns.
    """
    prefs = (
        db.query(UserPreferences)
        .filter(UserPreferences.user_id == user_id)
        .first()
    )
    is_inquiry = message_type == "inquiry"
    return {
        "email": getattr(prefs, "email_new_inquiry" if is_inquiry else "email_new_message", True),
        "app":   getattr(prefs, "app_new_inquiry"   if is_inquiry else "app_new_message",   True),
        "sms":   getattr(prefs, "sms_new_inquiry"   if is_inquiry else "sms_new_message",   True),
    }

router = APIRouter()

# ─── Fast count endpoint for real-time badge polling ─────────────────────────

@router.get("/notifications/count")
def get_notification_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lightweight endpoint for navbar badge polling (called every 30s)."""
    # Bell counts only system/billing notifications — message threads have their own badge
    notifications = db.query(func.count(Notification.id)).filter(
        Notification.user_id == current_user.id,
        Notification.read == False,  # noqa: E712
        ~Notification.notification_type.in_(["message", "inquiry"]),
    ).scalar() or 0

    messages = db.query(func.count(Message.id)).filter(
        Message.recipient_id == current_user.id,
        Message.status == "new",
    ).scalar() or 0

    return {"notifications": notifications, "messages": messages}


# ─── Attachment upload ────────────────────────────────────────────────────────

_ATTACHMENT_ALLOWED = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024  # 10 MB

@router.post("/messages/upload-attachment")
async def upload_message_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an image or PDF to attach to a message/reply. Returns {url, filename, content_type, size}."""
    content = await file.read()
    if len(content) > _ATTACHMENT_MAX_BYTES:
        raise ValidationException("Attachment too large. Maximum 10 MB.")
    if file.content_type not in _ATTACHMENT_ALLOWED:
        raise ValidationException("Only JPEG, PNG, WebP images and PDFs are allowed.")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = f"msg-attachments/{timestamp}_{(file.filename or 'file').replace(' ', '_')}"
    url = store_media_bytes(safe_name, content, file.content_type)
    return {
        "url": url,
        "filename": file.filename or "file",
        "content_type": file.content_type,
        "size": len(content),
    }


# ─── Messages ─────────────────────────────────────────────────────────────────

@router.get("/messages")
def get_messages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    message_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    visibility_filter = (
        (Message.sender_id == current_user.id) | (Message.recipient_id == current_user.id)
    )

    # Dealers also see inquiry messages addressed to any of their team members
    if current_user.user_type == "dealer":
        team_ids = [
            row.id
            for row in db.query(User.id)
            .filter(User.parent_dealer_id == current_user.id, User.active == True)
            .all()
        ]
        if team_ids:
            visibility_filter = visibility_filter | (
                (Message.recipient_id.in_(team_ids)) & (Message.visible_to_dealer == True)
            )

    query = db.query(Message).filter(visibility_filter)
    # Only show root messages (thread starters) — replies are loaded via GET /messages/{id}
    query = query.filter(Message.parent_message_id == None)  # noqa: E711
    if message_type:
        query = query.filter(Message.message_type == message_type)
    if status:
        query = query.filter(Message.status == status)
    messages = query.order_by(Message.created_at.desc()).all()
    return [
        {
            "id": m.id,
            "subject": m.subject,
            "body": m.body,
            "message_type": m.message_type,
            "ticket_number": m.ticket_number,
            "priority": m.priority,
            "category": m.category,
            "status": m.status,
            "listing_id": m.listing_id,
            "sender_id": m.sender_id,
            "recipient_id": m.recipient_id,
            "sender_name": (
                f"{m.sender.first_name} {m.sender.last_name}".strip()
                if m.sender
                else m.external_sender_email or "Unknown"
            ),
            "sender_email": m.sender.email if m.sender else m.external_sender_email,
            "external_sender_email": m.external_sender_email,
            "created_at": m.created_at.isoformat(),
            "attachments": m.attachments or [],
        }
        for m in messages
    ]


@router.get("/messages/{message_id}")
def get_message_detail(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise ResourceNotFoundException("Message", message_id)
    if (
        message.sender_id != current_user.id
        and message.recipient_id != current_user.id
        and current_user.user_type != "admin"
    ):
        raise AuthorizationException("Not authorized to view this message")

    if message.recipient_id == current_user.id and message.status == "new":
        message.status = "read"
        message.read_at = datetime.utcnow()
        db.commit()

    replies = (
        db.query(Message)
        .filter(Message.parent_message_id == message_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return {
        "message": {
            "id": message.id,
            "subject": message.subject,
            "body": message.body,
            "message_type": message.message_type,
            "ticket_number": message.ticket_number,
            "priority": message.priority,
            "category": message.category,
            "status": message.status,
            "listing_id": message.listing_id,
            "sender_id": message.sender_id,
            "recipient_id": message.recipient_id,
            "sender_name": (
                f"{message.sender.first_name} {message.sender.last_name}".strip()
                if message.sender
                else message.external_sender_email or "Unknown"
            ),
            "sender_email": message.sender.email if message.sender else message.external_sender_email,
            "external_sender_email": message.external_sender_email,
            "created_at": message.created_at.isoformat(),
            "attachments": message.attachments or [],
        },
        "replies": [
            {
                "id": r.id,
                "body": r.body,
                "sender_name": f"{r.sender.first_name} {r.sender.last_name}"
                if r.sender
                else "Unknown",
                "created_at": r.created_at.isoformat(),
                "attachments": r.attachments or [],
            }
            for r in replies
        ],
    }


@router.post("/messages")
def create_message(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a direct message, inquiry, or support ticket.

    For inquiry messages tied to a listing pass:
      { subject, body, message_type: 'inquiry', listing_id, recipient_id }

    recipient_id resolution order:
      1. Explicitly passed recipient_id
      2. listing.assigned_salesman_id (if set)
      3. listing.user_id (listing owner / dealer)
      4. First admin (for support_ticket type)
    """
    for field in ("subject", "body", "message_type"):
        if field not in data:
            raise ValidationException(f"Missing required field: {field}")

    ticket_number = None
    if data["message_type"] == "support_ticket":
        ticket_number = f"TICKET-{secrets.token_hex(4).upper()}"

    recipient_id = data.get("recipient_id")
    listing_id = data.get("listing_id")

    # Auto-resolve recipient from listing
    if not recipient_id and listing_id:
        from app.models.listing import Listing
        listing = db.query(Listing).filter(Listing.id == listing_id).first()
        if listing:
            recipient_id = listing.assigned_salesman_id or listing.user_id

    # Fall back to admin for support tickets
    if not recipient_id and data["message_type"] == "support_ticket":
        admin = db.query(User).filter(User.user_type == "admin").first()
        if admin:
            recipient_id = admin.id

    message = Message(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        listing_id=listing_id,  # ✅ now saved
        subject=data["subject"],
        body=data["body"],
        message_type=data["message_type"],
        ticket_number=ticket_number,
        priority=data.get("priority", "normal"),
        category=data.get("category", "general"),
        status="new",
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # Notify recipient
    if recipient_id:
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if recipient:
            sender_name = f"{current_user.first_name} {current_user.last_name}"
            allow = _prefs_allow(db, recipient_id, data["message_type"])

            # --- Email with Reply-To token -----------------------------------
            if allow["email"]:
                try:
                    token = generate_reply_token(message.id, recipient_id)
                    reply_to_addr = f"reply+{token}@{REPLY_TO_DOMAIN}"
                    email_service.send_email(
                        to_email=recipient.email,
                        subject=f"New Message: {data['subject']}",
                        html_content=f"""
                    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                      <div style="background:linear-gradient(135deg,#10214F,#01BBDC);padding:30px;text-align:center;">
                        <h1 style="color:white;margin:0;">New Message from {sender_name}</h1>
                      </div>
                      <div style="padding:30px;background:#f9fafb;">
                        <h2 style="color:#10214F;">{data['subject']}</h2>
                        <div style="background:white;border-left:4px solid #01BBDC;padding:20px;margin:20px 0;">
                          <p style="white-space:pre-wrap;color:#334155;">{data['body']}</p>
                        </div>
                        <p style="color:#64748b;font-size:13px;">
                          Reply directly to this email to respond - no login required.
                        </p>
                        <div style="text-align:center;margin-top:20px;">
                          <a href="{email_service.base_url}/dashboard/messages"
                             style="background:#10214F;color:white;padding:12px 28px;text-decoration:none;
                                    border-radius:6px;display:inline-block;font-weight:bold;">
                            View Conversation
                          </a>
                        </div>
                      </div>
                      <div style="background:#1e293b;padding:18px;text-align:center;color:#94a3b8;font-size:12px;">
                        2026 YachtVersal. Reply to this email to respond directly.
                      </div>
                    </body></html>
                    """,
                        reply_to=reply_to_addr,
                    )
                except Exception:
                    pass

            # --- In-app notification -----------------------------------------
            if allow["app"]:
                try:
                    db.add(
                        Notification(
                            user_id=recipient_id,
                            notification_type="message",
                            title=f"New message: {data['subject']}",
                            body=data["body"][:160],
                            link="/dashboard/messages",
                            read=False,
                        )
                    )
                    db.commit()
                except Exception:
                    pass

            # --- SMS notification (if recipient has a phone number) ----------
            if allow["sms"] and recipient.phone and sms_service.is_configured():
                try:
                    preview = data["body"][:120]
                    sms_body = (
                        f"YachtVersal: New message from {sender_name}\n"
                        f"{preview}{'...' if len(data['body']) > 120 else ''}\n"
                        f"Reply to this SMS to respond directly."
                    )
                    sent = sms_service.send_sms(recipient.phone, sms_body)
                    if sent:
                        sms_service.track_conversation(
                            dealer_user_id=recipient_id,
                            dealer_phone=recipient.phone,
                            message_id=message.id,
                            db=db,
                        )
                except Exception:
                    pass

    return {"success": True, "message_id": message.id, "ticket_number": ticket_number}


@router.post("/messages/{message_id}/reply")
def reply_to_message(
    message_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    parent = db.query(Message).filter(Message.id == message_id).first()
    if not parent:
        raise ResourceNotFoundException("Message", message_id)
    if (
        parent.sender_id != current_user.id
        and parent.recipient_id != current_user.id
        and current_user.user_type != "admin"
    ):
        raise AuthorizationException("Not authorized")
    body = data.get("body") or ""
    attachments = data.get("attachments") or []
    if not body and not attachments:
        raise ValidationException("Reply body or attachment is required")

    recipient_id = (
        parent.sender_id
        if current_user.id == parent.recipient_id
        else parent.recipient_id
    )

    reply = Message(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        parent_message_id=message_id,
        listing_id=parent.listing_id,
        subject=f"Re: {parent.subject}",
        body=body,
        message_type=parent.message_type,
        priority=parent.priority,
        category=parent.category,
        status="new",
        attachments=data.get("attachments") or None,
    )
    db.add(reply)
    parent.status = "replied"
    parent.replied_at = datetime.utcnow()
    db.commit()
    db.refresh(reply)

    if recipient_id:
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if recipient:
            sender_name = f"{current_user.first_name} {current_user.last_name}"
            allow = _prefs_allow(db, recipient_id, parent.message_type)

            # --- Email with chained Reply-To ---------------------------------
            if allow["email"]:
                try:
                    token = generate_reply_token(reply.id, recipient_id)
                    reply_to_addr = f"reply+{token}@{REPLY_TO_DOMAIN}"
                    email_service.send_email(
                        to_email=recipient.email,
                        subject=f"Re: {parent.subject}",
                        html_content=f"""
                    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                      <div style="background:linear-gradient(135deg,#10214F,#01BBDC);padding:28px;text-align:center;">
                        <h1 style="color:white;margin:0;font-size:22px;">Reply from {sender_name}</h1>
                      </div>
                      <div style="padding:30px;background:#f9fafb;">
                        <div style="background:white;border-left:4px solid #01BBDC;padding:20px;border-radius:4px;margin-bottom:20px;">
                          <p style="white-space:pre-wrap;color:#334155;margin:0;">{data['body']}</p>
                        </div>
                        <p style="color:#64748b;font-size:13px;">
                          Reply directly to this email to respond - no login required.
                        </p>
                        <div style="text-align:center;margin-top:20px;">
                          <a href="{email_service.base_url}/dashboard/messages"
                             style="background:#10214F;color:white;padding:12px 28px;
                                    text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
                            View Conversation
                          </a>
                        </div>
                      </div>
                      <div style="background:#1e293b;padding:18px;text-align:center;color:#94a3b8;font-size:12px;">
                        2026 YachtVersal. Reply to this email to respond directly.
                      </div>
                    </body></html>
                    """,
                        reply_to=reply_to_addr,
                    )
                except Exception:
                    pass

            # --- In-app notification -----------------------------------------
            if allow["app"]:
                try:
                    db.add(
                        Notification(
                            user_id=recipient_id,
                            notification_type="message",
                            title=f"Reply from {sender_name}: {parent.subject}",
                            body=data["body"][:160],
                            link="/dashboard/messages",
                            read=False,
                        )
                    )
                    db.commit()
                except Exception:
                    pass

            # --- SMS reply notification --------------------------------------
            if allow["sms"] and recipient.phone and sms_service.is_configured():
                try:
                    preview = data["body"][:120]
                    sms_body = (
                        f"YachtVersal: Reply from {sender_name}\n"
                        f"{preview}{'...' if len(data['body']) > 120 else ''}\n"
                        f"Reply to this SMS to respond directly."
                    )
                    sent = sms_service.send_sms(recipient.phone, sms_body)
                    if sent:
                        sms_service.track_conversation(
                            dealer_user_id=recipient_id,
                            dealer_phone=recipient.phone,
                            message_id=reply.id,
                            db=db,
                        )
                except Exception:
                    pass

    # --- Email to external buyer (no registered recipient) -------------------
    elif parent.external_sender_email:
        try:
            ext_sender_name = f"{current_user.first_name} {current_user.last_name}"
            # Token points back to this reply so buyer can continue the thread
            token = generate_reply_token(reply.id, current_user.id)
            reply_to_addr = f"reply+{token}@{REPLY_TO_DOMAIN}"
            email_service.send_email(
                to_email=parent.external_sender_email,
                subject=f"Re: {parent.subject}",
                html_content=f"""
            <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:linear-gradient(135deg,#10214F,#01BBDC);padding:28px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:22px;">Reply from {ext_sender_name}</h1>
              </div>
              <div style="padding:30px;background:#f9fafb;">
                <div style="background:white;border-left:4px solid #01BBDC;padding:20px;border-radius:4px;margin-bottom:20px;">
                  <p style="white-space:pre-wrap;color:#334155;margin:0;">{data['body']}</p>
                </div>
                <p style="color:#64748b;font-size:13px;">
                  Reply directly to this email to respond &#8212; no login required.
                </p>
              </div>
              <div style="background:#1e293b;padding:18px;text-align:center;color:#94a3b8;font-size:12px;">
                2026 YachtVersal. Reply to this email to respond directly.
              </div>
            </body></html>
            """,
                reply_to=reply_to_addr,
            )
        except Exception:
            pass

    return {"success": True, "reply_id": reply.id}


@router.put("/messages/{message_id}/status")
def update_message_status(
    message_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise ResourceNotFoundException("Message", message_id)
    if (
        message.sender_id != current_user.id
        and message.recipient_id != current_user.id
        and current_user.user_type != "admin"
    ):
        raise AuthorizationException("Not authorized")
    if "status" not in data:
        raise ValidationException("Status is required")
    message.status = data["status"]
    db.commit()
    return {"success": True}


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise ResourceNotFoundException("Message", message_id)
    if message.sender_id != current_user.id and current_user.user_type != "admin":
        raise AuthorizationException("Only sender can delete messages")
    db.delete(message)
    db.commit()
    return {"success": True}


# ─── Notifications ────────────────────────────────────────────────────────────

@router.get("/notifications")
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    unread_only: bool = False,
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.read == False)  # noqa: E712
    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()
    return [
        {
            "id": n.id,
            "notification_type": n.notification_type,
            "title": n.title,
            "body": n.body,
            "link": n.link,
            "read": n.read,
            "read_at": n.read_at.isoformat() if n.read_at else None,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notification:
        raise ResourceNotFoundException("Notification", notification_id)
    notification.read = True
    notification.read_at = datetime.utcnow()
    db.commit()
    return {"success": True}


@router.post("/notifications/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False,  # noqa: E712
    ).update({"read": True, "read_at": datetime.utcnow()})
    db.commit()
    return {"success": True}


@router.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notification:
        raise ResourceNotFoundException("Notification", notification_id)
    db.delete(notification)
    db.commit()
    return {"success": True}


# ─── Support Tickets (from Help Center) ──────────────────────────────────────

_VALID_CATEGORIES = {"general", "technical", "billing", "listings", "account"}
_VALID_PRIORITIES = {"low", "normal", "high", "urgent"}


class SupportTicketIn(BaseModel):
    subject: str
    category: str = "general"
    priority: str = "normal"
    body: str


@router.post("/messages/support-ticket")
def create_support_ticket(
    data: SupportTicketIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a support ticket from the Help Center. Creates a support_ticket message
    and sends an in-app notification to every admin account."""
    subject = data.subject.strip()[:200]
    body = data.body.strip()[:4000]
    if not subject or not body:
        raise ValidationException("Subject and message body are required.")

    category = data.category if data.category in _VALID_CATEGORIES else "general"
    priority = data.priority if data.priority in _VALID_PRIORITIES else "normal"

    admins = db.query(User).filter(User.user_type == "admin").all()
    primary_admin = admins[0] if admins else None

    # Create one canonical ticket addressed to the first admin for threading purposes
    ticket = Message(
        sender_id=current_user.id,
        recipient_id=primary_admin.id if primary_admin else None,
        message_type="support_ticket",
        subject=subject,
        body=body,
        priority=priority,
        category=category,
        status="new",
        visible_to_dealer=True,
    )
    db.add(ticket)
    db.flush()  # get ticket.id before committing
    ticket.ticket_number = f"SUP-{ticket.id}"

    # Notify every admin so anyone can pick it up; also email them with a reply-to token
    submitted_by = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email
    for admin in admins:
        db.add(
            Notification(
                user_id=admin.id,
                notification_type="support",
                title=f"New support ticket from {current_user.email}",
                body=subject,
                link="/dashboard/messages",
                read=False,
            )
        )
        try:
            token = generate_reply_token(ticket.id, admin.id)
            reply_to_addr = f"reply+{token}@{REPLY_TO_DOMAIN}"
            email_service.send_email(
                to_email=admin.email,
                subject=f"[Support] {subject}",
                html_content=f"""
                <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:linear-gradient(135deg,#10214F,#01BBDC);padding:28px;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:22px;">New Support Ticket</h1>
                    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px;">{ticket.ticket_number}</p>
                  </div>
                  <div style="padding:30px;background:#f9fafb;">
                    <p style="color:#64748b;font-size:13px;margin-bottom:16px;">
                      <strong>From:</strong> {submitted_by} ({current_user.email})<br>
                      <strong>Category:</strong> {category} &nbsp; <strong>Priority:</strong> {priority}
                    </p>
                    <h2 style="color:#10214F;font-size:18px;margin:0 0 12px;">{subject}</h2>
                    <div style="background:white;border-left:4px solid #01BBDC;padding:20px;border-radius:4px;margin-bottom:24px;">
                      <p style="white-space:pre-wrap;color:#334155;margin:0;">{body}</p>
                    </div>
                    <p style="color:#64748b;font-size:13px;">Reply directly to this email to respond — no login required.</p>
                    <div style="text-align:center;margin-top:20px;">
                      <a href="{email_service.base_url}/dashboard/messages"
                         style="background:#10214F;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
                        View in Dashboard
                      </a>
                    </div>
                  </div>
                  <div style="background:#1e293b;padding:18px;text-align:center;color:#94a3b8;font-size:12px;">
                    &#169; 2026 YachtVersal.
                  </div>
                </body></html>
                """,
                reply_to=reply_to_addr,
            )
        except Exception:
            pass

    db.commit()
    db.refresh(ticket)
    return {"id": ticket.id, "ticket_number": ticket.ticket_number, "status": "created"}