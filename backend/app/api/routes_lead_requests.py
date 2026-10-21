"""
"Leave us a message" fallback for when the AI can't help (chat assistant or AI
search unavailable, e.g. provider outage or exhausted credit). The visitor's
details become a normal Inquiry routed to the admin inbox (or the listing's
broker) and the team is alerted so someone follows up by hand.
"""
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_optional_user
from app.api.routes_inquiries import create_inquiry_and_notify
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.user import User
from app.services import chatbot_store as store
from app.services.ai_quota import get_client_ip, hash_ip

router = APIRouter()


class ManualRequest(BaseModel):
    source: Literal["chatbot", "ai_search"]
    name: str
    email: str
    phone: Optional[str] = None
    message: str
    query: Optional[str] = None       # the AI search the visitor tried
    session_id: Optional[str] = None  # chat conversation to attach this to
    page_url: Optional[str] = None
    listing_id: Optional[int] = None
    website: Optional[str] = None     # honeypot: real visitors never fill this


_LABELS = {
    "chatbot": "Chat assistant unavailable — visitor left a message",
    "ai_search": "AI search unavailable — visitor left a request",
}


@router.post("/manual-requests")
@limiter.limit("10/hour")
async def create_manual_request(
    request: Request,
    payload: ManualRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if payload.website:  # bot filled the honeypot: pretend success, store nothing
        return {"ok": True, "inquiry_id": None}

    name = payload.name.strip()[:200]
    email = payload.email.strip()[:200]
    text = payload.message.strip()[:4000]
    page_url = (payload.page_url or "").strip()[:500] or None

    parts = [f"[{_LABELS[payload.source]}]", ""]
    if payload.query:
        parts += [f"They searched for: {payload.query.strip()[:500]}", ""]
    parts.append(text)
    if page_url:
        parts += ["", f"(Sent from: {page_url})"]
    inquiry_message = "\n".join(parts)

    # Raises ValidationException (HTTP 400) for a missing name/email/message.
    inquiry = create_inquiry_and_notify(
        db=db,
        background_tasks=background_tasks,
        sender_name=name,
        sender_email=email,
        sender_phone=payload.phone,
        message=inquiry_message,
        listing_id=payload.listing_id,
    )

    session_id = store.clean_session_id(payload.session_id)
    if payload.source == "chatbot" and session_id:
        convo = store.get_or_create_conversation(
            db,
            session_id=session_id,
            user=current_user,
            ip_hash=hash_ip(get_client_ip(request)),
            page_url=page_url,
            listing_id=payload.listing_id,
        )
        store.apply_contact_info(
            convo, {"sender_name": name, "sender_email": email, "sender_phone": payload.phone}
        )
        store.add_message(db, convo, "user", f"[Left a message] {text}")
        store.add_message(
            db, convo, "assistant",
            f"Thanks {name.split()[0] if name.split() else name}! Your message was passed to our team "
            f"and they'll follow up at {email}.",
            intent="fallback",
        )
        store.mark_lead(convo, inquiry.id)
        db.commit()
        store.notify_team_of_chat_lead(db, background_tasks, convo, inquiry)
    else:
        store.notify_team_of_lead(
            db,
            background_tasks,
            kind_label=_LABELS[payload.source],
            name=name,
            email=email,
            phone=payload.phone,
            page_url=page_url,
            body_text=inquiry_message,
            link="/dashboard/inquiries",
            skip_user_id=inquiry.assigned_to_id,
        )

    return {"ok": True, "inquiry_id": inquiry.id}
