"""
Persistence + lead handling for the site chatbot.

Every exchange is stored (ChatConversation / ChatMessage) so admins can audit
and improve responses. When a visitor gives an email, the conversation becomes
a lead: an Inquiry is created (routed through the normal broker/admin inbox
pipeline) and the site team is alerted internally.
"""
import html as _html
import logging
import os
import re
from datetime import datetime
from typing import List, Optional

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.models.chatbot import ChatConversation, ChatMessage
from app.models.misc import Notification
from app.models.user import User
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "info@yachtversal.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://yachtversal.com").rstrip("/")

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_SESSION_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")


def clean_session_id(raw: Optional[str]) -> Optional[str]:
    return raw if raw and _SESSION_RE.match(raw) else None


def is_valid_email(value: Optional[str]) -> bool:
    return bool(value and _EMAIL_RE.match(value.strip()))


def get_or_create_conversation(
    db: Session,
    session_id: str,
    user: Optional[User],
    ip_hash: Optional[str],
    page_url: Optional[str],
    listing_id: Optional[int],
) -> ChatConversation:
    convo = db.query(ChatConversation).filter(ChatConversation.session_id == session_id).first()
    if convo is None:
        convo = ChatConversation(
            session_id=session_id,
            user_id=user.id if user else None,
            ip_hash=ip_hash,
            page_url=(page_url or None) and page_url[:500],
            listing_id=listing_id,
        )
        if user:
            name = " ".join(p for p in (user.first_name, user.last_name) if p) or None
            convo.contact_name = name
            convo.contact_email = user.email
            convo.contact_phone = user.phone
        db.add(convo)
        db.commit()
        db.refresh(convo)
    elif user and not convo.user_id:
        convo.user_id = user.id
    if listing_id and not convo.listing_id:
        convo.listing_id = listing_id
    return convo


def add_message(
    db: Session,
    convo: ChatConversation,
    role: str,
    content: str,
    intent: Optional[str] = None,
    result_refs: Optional[list] = None,
) -> ChatMessage:
    msg = ChatMessage(
        conversation_id=convo.id,
        role=role,
        content=content,
        intent=intent,
        result_refs=result_refs,
    )
    db.add(msg)
    convo.message_count = (convo.message_count or 0) + 1
    convo.last_message_at = datetime.utcnow()
    db.commit()
    return msg


def apply_contact_info(convo: ChatConversation, contact: Optional[dict]) -> None:
    """Merge whatever contact details the model extracted into the
    conversation, never overwriting an existing value with an empty one."""
    if not contact:
        return
    name = (contact.get("sender_name") or "").strip()
    email = (contact.get("sender_email") or "").strip()
    phone = (contact.get("sender_phone") or "").strip()
    if name:
        convo.contact_name = name[:200]
    if is_valid_email(email):
        convo.contact_email = email[:200]
    if phone:
        convo.contact_phone = phone[:50]


def transcript_text(convo: ChatConversation, limit: int = 14) -> str:
    lines = [
        f"{'Visitor' if m.role == 'user' else 'Assistant'}: {m.content}"
        for m in convo.messages[-limit:]
    ]
    return "\n".join(lines)


def mark_lead(convo: ChatConversation, inquiry_id: int) -> None:
    convo.inquiry_id = inquiry_id
    convo.lead_captured_at = datetime.utcnow()


def notify_team_of_lead(
    db: Session,
    background_tasks: BackgroundTasks,
    *,
    kind_label: str,
    name: str,
    email: str,
    phone: Optional[str],
    page_url: Optional[str],
    body_text: str,
    link: str,
    skip_user_id: Optional[int] = None,
) -> None:
    """Internal alert: in-app notification to every admin plus an email to the
    site team inbox, pointing at where the lead can be followed up.

    The inquiry pipeline already notifies whoever the inquiry was routed to
    (listing broker, or the first admin when there's no listing), so pass that
    user as skip_user_id to avoid a double alert."""
    name = name or "A website visitor"
    summary = f"{name} ({email}) — {kind_label}."

    try:
        admins = db.query(User).filter(User.user_type == "admin", User.active == True).all()  # noqa: E712
        for admin in admins:
            if skip_user_id is not None and admin.id == skip_user_id:
                continue
            db.add(
                Notification(
                    user_id=admin.id,
                    notification_type="inquiry",
                    title=f"New lead: {name}",
                    body=summary[:160],
                    link=link,
                    read=False,
                )
            )
        db.commit()
    except Exception:
        logger.exception("Lead alert: in-app admin notification failed")
        db.rollback()

    esc = _html.escape
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#10214F;">New lead: {esc(kind_label)}</h2>
      <p style="color:#334155;"><strong>Name:</strong> {esc(name)}</p>
      <p style="color:#334155;"><strong>Email:</strong> {esc(email or '')}</p>
      {'<p style="color:#334155;"><strong>Phone:</strong> ' + esc(phone) + '</p>' if phone else ''}
      {'<p style="color:#334155;"><strong>Page:</strong> ' + esc(page_url) + '</p>' if page_url else ''}
      <div style="background:#f9fafb;border-left:4px solid #01BBDC;padding:16px;margin:16px 0;">
        <p style="white-space:pre-wrap;color:#334155;margin:0;">{esc(body_text)}</p>
      </div>
      <p><a href="{FRONTEND_URL}{link}" style="color:#01BBDC;">Open in the admin dashboard</a></p>
    </div>
    """

    def _send():
        try:
            email_service.send_email(
                to_email=CONTACT_EMAIL,
                subject=f"[Lead] {kind_label}: {name}",
                html_content=html,
                reply_to=email,
            )
        except Exception:
            logger.exception("Lead alert: team email failed")

    background_tasks.add_task(_send)


def notify_team_of_chat_lead(
    db: Session,
    background_tasks: BackgroundTasks,
    convo: ChatConversation,
    inquiry,
) -> None:
    """Lead alert for a chat conversation, linking to its transcript."""
    notify_team_of_lead(
        db,
        background_tasks,
        kind_label="chatbot conversation",
        name=convo.contact_name or "",
        email=convo.contact_email or "",
        phone=convo.contact_phone,
        page_url=convo.page_url,
        body_text=transcript_text(convo),
        link=f"/admin?tab=chatbot&conversation={convo.id}",
        skip_user_id=getattr(inquiry, "assigned_to_id", None),
    )
