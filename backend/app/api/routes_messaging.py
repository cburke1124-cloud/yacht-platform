from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
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

router = APIRouter()


# ─── Messages ─────────────────────────────────────────────────────────────────

@router.get("/messages")
def get_messages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    message_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    query = db.query(Message).filter(
        (Message.sender_id == current_user.id) | (Message.recipient_id == current_user.id)
    )
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
            "sender_name": f"{m.sender.first_name} {m.sender.last_name}"
            if m.sender
            else "Unknown",
            "sender_email": m.sender.email if m.sender else None,
            "created_at": m.created_at.isoformat(),
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
            "sender_name": f"{message.sender.first_name} {message.sender.last_name}"
            if message.sender
            else "Unknown",
            "sender_email": message.sender.email if message.sender else None,
            "created_at": message.created_at.isoformat(),
        },
        "replies": [
            {
                "id": r.id,
                "body": r.body,
                "sender_name": f"{r.sender.first_name} {r.sender.last_name}"
                if r.sender
                else "Unknown",
                "created_at": r.created_at.isoformat(),
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
            try:
                email_service.send_email(
                    to_email=recipient.email,
                    subject=f"New Message: {data['subject']}",
                    html_content=f"""
                    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                      <div style="background:linear-gradient(135deg,#10214F,#01BBDC);padding:30px;text-align:center;">
                        <h1 style="color:white;margin:0;">New Message</h1>
                      </div>
                      <div style="padding:30px;background:#f9fafb;">
                        <h2 style="color:#10214F;">{data['subject']}</h2>
                        <p><strong>From:</strong> {current_user.first_name} {current_user.last_name} ({current_user.email})</p>
                        <div style="background:white;border-left:4px solid #01BBDC;padding:20px;margin:20px 0;">
                          <p style="white-space:pre-wrap;">{data['body']}</p>
                        </div>
                      </div>
                      <div style="background:#10214F;padding:20px;text-align:center;color:#9ca3af;font-size:12px;">
                        <p style="margin:0;">© 2026 YachtVersal.</p>
                      </div>
                    </body></html>
                    """,
                )
            except Exception:
                pass
            try:
                db.add(
                    Notification(
                        user_id=recipient_id,
                        notification_type="message",
                        title=f"New message: {data['subject']}",
                        body=data["body"][:160],
                        link=f"/dashboard/messages/{message.id}",
                        read=False,
                    )
                )
                db.commit()
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
    if "body" not in data:
        raise ValidationException("Reply body is required")

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
        body=data["body"],
        message_type=parent.message_type,
        ticket_number=parent.ticket_number,
        priority=parent.priority,
        category=parent.category,
        status="new",
    )
    db.add(reply)
    parent.status = "replied"
    parent.replied_at = datetime.utcnow()
    db.commit()
    db.refresh(reply)

    if recipient_id:
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if recipient:
            try:
                email_service.send_email(
                    to_email=recipient.email,
                    subject=f"Re: {parent.subject}",
                    html_content=f"""
                    <html><body style="font-family:Arial,sans-serif;">
                      <h2 style="color:#10214F;">Reply from {current_user.first_name} {current_user.last_name}</h2>
                      <p style="white-space:pre-wrap;">{data['body']}</p>
                    </body></html>
                    """,
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