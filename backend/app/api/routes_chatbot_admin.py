"""
Admin dashboard API for chatbot conversations: browse/search transcripts,
see captured leads, rate assistant answers and export them for tuning.
"""
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.exceptions import AuthorizationException
from app.models.charter import CharterListing
from app.models.chatbot import AIUsageEvent, ChatConversation, ChatMessage
from app.models.listing import Listing
from app.models.user import User

router = APIRouter()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    return current_user


def _convo_summary(c: ChatConversation) -> dict:
    return {
        "id": c.id,
        "session_id": c.session_id,
        "user_id": c.user_id,
        "contact_name": c.contact_name,
        "contact_email": c.contact_email,
        "contact_phone": c.contact_phone,
        "is_lead": c.inquiry_id is not None,
        "inquiry_id": c.inquiry_id,
        "lead_captured_at": c.lead_captured_at.isoformat() if c.lead_captured_at else None,
        "message_count": c.message_count or 0,
        "page_url": c.page_url,
        "listing_id": c.listing_id,
        "reviewed": bool(c.reviewed),
        "admin_notes": c.admin_notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
    }


@router.get("/admin/chatbot/stats")
def chatbot_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    day_ago = now - timedelta(hours=24)

    total = db.query(func.count(ChatConversation.id)).scalar() or 0
    week = db.query(func.count(ChatConversation.id)).filter(ChatConversation.created_at >= week_ago).scalar() or 0
    leads = db.query(func.count(ChatConversation.id)).filter(ChatConversation.inquiry_id.isnot(None)).scalar() or 0
    leads_week = (
        db.query(func.count(ChatConversation.id))
        .filter(ChatConversation.inquiry_id.isnot(None), ChatConversation.created_at >= week_ago)
        .scalar()
        or 0
    )
    unreviewed = (
        db.query(func.count(ChatConversation.id)).filter(ChatConversation.reviewed.is_(False)).scalar() or 0
    )
    rated = db.query(func.count(ChatMessage.id)).filter(ChatMessage.admin_rating.isnot(None)).scalar() or 0

    def usage(kind: str, anonymous: bool) -> int:
        q = db.query(func.count(AIUsageEvent.id)).filter(
            AIUsageEvent.kind == kind, AIUsageEvent.created_at >= day_ago
        )
        q = q.filter(AIUsageEvent.user_id.is_(None) if anonymous else AIUsageEvent.user_id.isnot(None))
        return q.scalar() or 0

    return {
        "conversations_total": total,
        "conversations_7d": week,
        "leads_total": leads,
        "leads_7d": leads_week,
        "lead_rate_pct": round(leads / total * 100, 1) if total else 0,
        "unreviewed": unreviewed,
        "rated_messages": rated,
        "ai_usage_24h": {
            "ai_search_guests": usage("ai_search", True),
            "ai_search_accounts": usage("ai_search", False),
            "chatbot_guests": usage("chatbot", True),
            "chatbot_accounts": usage("chatbot", False),
        },
    }


@router.get("/admin/chatbot/conversations")
def list_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    filter: str = Query("all", pattern="^(all|leads|unreviewed)$"),
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(ChatConversation)
    if filter == "leads":
        query = query.filter(ChatConversation.inquiry_id.isnot(None))
    elif filter == "unreviewed":
        query = query.filter(ChatConversation.reviewed.is_(False))
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        in_messages = (
            db.query(ChatMessage.conversation_id)
            .filter(func.lower(ChatMessage.content).like(like))
            .subquery()
        )
        query = query.filter(
            or_(
                func.lower(func.coalesce(ChatConversation.contact_email, "")).like(like),
                func.lower(func.coalesce(ChatConversation.contact_name, "")).like(like),
                ChatConversation.id.in_(in_messages),
            )
        )
    total = query.count()
    rows = (
        query.order_by(ChatConversation.last_message_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    items = []
    for c in rows:
        item = _convo_summary(c)
        first_user = next((m.content for m in c.messages if m.role == "user"), "")
        item["preview"] = first_user[:140]
        items.append(item)
    return {"total": total, "items": items}


@router.get("/admin/chatbot/conversations/{conversation_id}")
def get_conversation(conversation_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    c = db.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")

    listing_ids, charter_ids = set(), set()
    for m in c.messages:
        for ref in m.result_refs or []:
            (charter_ids if ref.get("type") == "charter" else listing_ids).add(ref.get("id"))
    listing_titles = (
        {l.id: l.title for l in db.query(Listing.id, Listing.title).filter(Listing.id.in_(listing_ids)).all()}
        if listing_ids
        else {}
    )
    charter_titles = (
        {l.id: l.title for l in db.query(CharterListing.id, CharterListing.title).filter(CharterListing.id.in_(charter_ids)).all()}
        if charter_ids
        else {}
    )

    messages = []
    for m in c.messages:
        refs = [
            {
                "type": r.get("type"),
                "id": r.get("id"),
                "title": (charter_titles if r.get("type") == "charter" else listing_titles).get(r.get("id")),
            }
            for r in (m.result_refs or [])
        ]
        messages.append(
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "intent": m.intent,
                "results": refs,
                "admin_rating": m.admin_rating,
                "admin_note": m.admin_note,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
        )
    return {**_convo_summary(c), "messages": messages}


class ConversationUpdate(BaseModel):
    reviewed: Optional[bool] = None
    admin_notes: Optional[str] = None


@router.patch("/admin/chatbot/conversations/{conversation_id}")
def update_conversation(
    conversation_id: int,
    data: ConversationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    c = db.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if data.reviewed is not None:
        c.reviewed = data.reviewed
    if data.admin_notes is not None:
        c.admin_notes = data.admin_notes
    db.commit()
    return _convo_summary(c)


class MessageUpdate(BaseModel):
    admin_rating: Optional[int] = None  # 1 good, -1 bad, 0 clears
    admin_note: Optional[str] = None


@router.patch("/admin/chatbot/messages/{message_id}")
def update_message(
    message_id: int,
    data: MessageUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    m = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Message not found")
    if data.admin_rating is not None:
        if data.admin_rating not in (-1, 0, 1):
            raise HTTPException(status_code=422, detail="admin_rating must be -1, 0 or 1")
        m.admin_rating = data.admin_rating or None
    if data.admin_note is not None:
        m.admin_note = data.admin_note or None
    db.commit()
    return {"id": m.id, "admin_rating": m.admin_rating, "admin_note": m.admin_note}


@router.get("/admin/chatbot/export")
def export_transcripts(
    rated_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """JSONL, one conversation per line, for reviewing or tuning responses.
    Contact details are deliberately omitted."""
    query = db.query(ChatConversation).order_by(ChatConversation.id)
    lines = []
    for c in query.all():
        msgs = c.messages
        if rated_only and not any(m.admin_rating for m in msgs):
            continue
        lines.append(
            json.dumps(
                {
                    "conversation_id": c.id,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "is_lead": c.inquiry_id is not None,
                    "messages": [
                        {
                            "role": m.role,
                            "content": m.content,
                            "intent": m.intent,
                            "admin_rating": m.admin_rating,
                            "admin_note": m.admin_note,
                        }
                        for m in msgs
                    ],
                },
                ensure_ascii=False,
            )
        )
    return Response(
        content="\n".join(lines),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": 'attachment; filename="chatbot-transcripts.jsonl"'},
    )
