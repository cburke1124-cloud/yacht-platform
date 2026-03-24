"""
Lead / Inquiry management routes.

Visibility rules:
  - Dealer:       sees all inquiries assigned to themselves OR any of their team members.
  - Team member:  sees only inquiries assigned to themselves.
  - Admin:        sees everything.
"""
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from datetime import datetime
from typing import Optional

import os

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserPreferences
from app.models.misc import Inquiry, LeadNote, Message, Notification
from app.services.email_service import email_service
from app.core.reply_token import generate_reply_token
from app.exceptions import (
    ResourceNotFoundException,
    AuthorizationException,
    ValidationException,
)

router = APIRouter()

REPLY_TO_DOMAIN = os.getenv("REPLY_TO_DOMAIN", "mail.yachtversal.com")

VALID_STAGES = ("new", "contacted", "qualified", "proposal", "won", "lost")


# ── helpers ──────────────────────────────────────────────────────────────────

def _allowed_user_ids(current_user: User, db: Session) -> list[int]:
    """
    Return the list of user IDs whose inquiries this user may view.
    """
    if current_user.user_type == "admin":
        return []  # empty → no filter (see all)

    ids = [current_user.id]

    if current_user.user_type in ("dealer", "team_member"):
        # Dealers own their team; team members only see themselves
        if current_user.user_type == "dealer" or current_user.role == "owner":
            team = (
                db.query(User.id)
                .filter(User.parent_dealer_id == current_user.id, User.active == True)
                .all()
            )
            ids += [row.id for row in team]

    return ids


def _assert_can_access_inquiry(inquiry: Inquiry, current_user: User, db: Session):
    if current_user.user_type == "admin":
        return
    allowed = _allowed_user_ids(current_user, db)
    if inquiry.assigned_to_id not in allowed:
        raise AuthorizationException("Not authorized to access this inquiry")


def _serialize_inquiry(inq: Inquiry, db: Session, include_notes: bool = False) -> dict:
    from app.models.listing import Listing

    listing = db.query(Listing).filter(Listing.id == inq.listing_id).first() if inq.listing_id else None
    assigned = db.query(User).filter(User.id == inq.assigned_to_id).first() if inq.assigned_to_id else None

    out = {
        "id": inq.id,
        "listing_id": inq.listing_id,
        "listing_title": listing.title if listing else None,
        "listing_make": listing.make if listing else None,
        "listing_model": listing.model if listing else None,
        "listing_price": listing.price if listing else None,
        "sender_name": inq.sender_name,
        "sender_email": inq.sender_email,
        "sender_phone": inq.sender_phone,
        "message": inq.message,
        "status": inq.status,
        "lead_stage": inq.lead_stage or "new",
        "lead_score": inq.lead_score or 0,
        "notes": inq.notes,
        "paperwork_status": inq.paperwork_status,
        "assigned_to_id": inq.assigned_to_id,
        "assigned_to_name": (
            f"{assigned.first_name} {assigned.last_name}".strip() if assigned else None
        ),
        "created_at": inq.created_at.isoformat(),
        "updated_at": inq.updated_at.isoformat() if inq.updated_at else None,
    }

    if include_notes:
        out["lead_notes"] = [
            {
                "id": n.id,
                "content": n.content,
                "author_id": n.author_id,
                "author_name": (
                    f"{n.author.first_name} {n.author.last_name}".strip()
                    if n.author else "Unknown"
                ),
                "created_at": n.created_at.isoformat(),
                "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            }
            for n in inq.lead_notes
        ]

        # Include linked Message thread (root message + replies)
        root_msgs = (
            db.query(Message)
            .filter(
                Message.ticket_number == f"INQ-{inq.id}",
                Message.parent_message_id == None,  # noqa: E711
            )
            .order_by(Message.created_at.asc())
            .all()
        )
        if root_msgs:
            root = root_msgs[0]
            replies = (
                db.query(Message)
                .filter(Message.parent_message_id == root.id)
                .order_by(Message.created_at.asc())
                .all()
            )
            all_msgs = [root] + list(replies)
            out["message_id"] = root.id
            out["message_thread"] = [
                {
                    "id": m.id,
                    "body": m.body,
                    "sender_name": (
                        f"{m.sender.first_name} {m.sender.last_name}".strip()
                        if m.sender
                        else inq.sender_name
                    ),
                    "is_from_buyer": m.sender_id is None,
                    "created_at": m.created_at.isoformat(),
                }
                for m in all_msgs
            ]
        else:
            out["message_id"] = None
            out["message_thread"] = []

    return out


# ── List inquiries / leads ────────────────────────────────────────────────────

@router.get("/inquiries")
def list_inquiries(
    stage: Optional[str] = Query(None),
    assigned_to: Optional[int] = Query(None),
    listing_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("newest"),          # newest | oldest | score | stage
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List leads visible to the current user, with optional filters."""
    allowed = _allowed_user_ids(current_user, db)

    q = db.query(Inquiry).options(joinedload(Inquiry.lead_notes))

    if allowed:  # admin has no restriction
        q = q.filter(Inquiry.assigned_to_id.in_(allowed))

    if stage:
        q = q.filter(Inquiry.lead_stage == stage)
    if assigned_to and (not allowed or assigned_to in allowed):
        q = q.filter(Inquiry.assigned_to_id == assigned_to)
    if listing_id:
        q = q.filter(Inquiry.listing_id == listing_id)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                Inquiry.sender_name.ilike(term),
                Inquiry.sender_email.ilike(term),
                Inquiry.message.ilike(term),
            )
        )

    if sort == "oldest":
        q = q.order_by(Inquiry.created_at.asc())
    elif sort == "score":
        q = q.order_by(Inquiry.lead_score.desc(), Inquiry.created_at.desc())
    elif sort == "stage":
        q = q.order_by(Inquiry.lead_stage.asc(), Inquiry.created_at.desc())
    else:
        q = q.order_by(Inquiry.created_at.desc())

    total = q.count()
    inquiries = q.offset(offset).limit(limit).all()

    return {
        "total": total,
        "items": [_serialize_inquiry(inq, db) for inq in inquiries],
    }


# ── Create inquiry (public endpoint for listing inquiries) ─────────────────────

@router.post("/inquiries")
async def create_inquiry(
    data: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Create a new inquiry (public endpoint, no auth required).
    
    Required fields:
      - sender_name: str
      - sender_email: str
      - message: str
      - listing_id: int (optional)
    
    Optional fields:
      - sender_phone: str
    """
    sender_name = data.get("sender_name", "").strip()
    sender_email = data.get("sender_email", "").strip()
    message = data.get("message", "").strip()
    sender_phone = data.get("sender_phone", "").strip() if data.get("sender_phone") else None
    listing_id = data.get("listing_id")
    
    # Validate required fields
    if not sender_name:
        raise ValidationException("sender_name is required")
    if not sender_email or "@" not in sender_email:
        raise ValidationException("valid sender_email is required")
    if not message:
        raise ValidationException("message is required")
    
    # Resolve who should receive this inquiry (salesman > dealer owner > admin)
    from app.models.listing import Listing
    notify_user_id = None
    listing = None
    listing_title = "General Inquiry"
    if listing_id:
        listing = db.query(Listing).filter(Listing.id == listing_id).first()
        if listing:
            notify_user_id = listing.assigned_salesman_id or listing.user_id
            listing_title = listing.title or listing_title
    if not notify_user_id:
        admin = db.query(User).filter(User.user_type == "admin").first()
        if admin:
            notify_user_id = admin.id

    # Create inquiry
    inquiry = Inquiry(
        sender_name=sender_name,
        sender_email=sender_email,
        sender_phone=sender_phone,
        message=message,
        listing_id=listing_id,
        assigned_to_id=notify_user_id,
        lead_stage="new",
        lead_score=0,
    )

    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)

    # Create Message record so inquiry appears in the Messages dashboard
    if notify_user_id:
        phone_line = f"Phone: {sender_phone}\n" if sender_phone else ""
        msg_body = f"From {sender_name} ({sender_email}):\n{phone_line}\n{message}"
        msg = Message(
            ticket_number=f"INQ-{inquiry.id}",
            sender_id=None,
            recipient_id=notify_user_id,
            listing_id=listing_id,
            message_type="inquiry",
            subject=f"Inquiry from {sender_name}: {listing_title}",
            body=msg_body,
            status="new",
            visible_to_dealer=True,
            external_sender_email=sender_email,
            priority="normal",
            category="inquiry",
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)

        recipient = db.query(User).filter(User.id == notify_user_id).first()
        if recipient:
            prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == notify_user_id)
                .first()
            )
            allow_email = getattr(prefs, "email_new_inquiry", True) if prefs else True
            allow_app = getattr(prefs, "app_new_inquiry", True) if prefs else True

            # In-app notification
            if allow_app:
                try:
                    db.add(
                        Notification(
                            user_id=notify_user_id,
                            notification_type="inquiry",
                            title=f"New inquiry from {sender_name}",
                            body=message[:160],
                            link=f"/dashboard/inquiries",
                            read=False,
                        )
                    )
                    db.commit()
                except Exception:
                    pass

            # Email notification with reply-to token
            if allow_email:
                try:
                    token = generate_reply_token(msg.id, notify_user_id)
                    reply_to_addr = f"reply+{token}@{REPLY_TO_DOMAIN}"
                    email_service.send_email(
                        to_email=recipient.email,
                        subject=f"New Inquiry from {sender_name}: {listing_title}",
                        html_content=f"""
                    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                      <div style="background:linear-gradient(135deg,#10214F,#01BBDC);padding:30px;text-align:center;">
                        <h1 style="color:white;margin:0;">New Inquiry</h1>
                      </div>
                      <div style="padding:30px;background:#f9fafb;">
                        <h2 style="color:#10214F;">{listing_title}</h2>
                        <p style="color:#334155;"><strong>From:</strong> {sender_name}</p>
                        <p style="color:#334155;"><strong>Email:</strong> {sender_email}</p>
                        {'<p style="color:#334155;"><strong>Phone:</strong> ' + sender_phone + '</p>' if sender_phone else ''}
                        <div style="background:white;border-left:4px solid #01BBDC;padding:20px;margin:20px 0;">
                          <p style="white-space:pre-wrap;color:#334155;">{message}</p>
                        </div>
                        <p style="color:#64748b;font-size:13px;">
                          Reply directly to this email to respond &#8212; no login required.
                        </p>
                        <div style="text-align:center;margin-top:20px;">
                          <a href="{email_service.base_url}/dashboard/inquiries"
                             style="background:#10214F;color:white;padding:12px 28px;text-decoration:none;
                                    border-radius:6px;display:inline-block;font-weight:bold;">
                            View Inquiry
                          </a>
                        </div>
                      </div>
                      <div style="background:#1e293b;padding:18px;text-align:center;color:#94a3b8;font-size:12px;">
                        2026 YachtVersal. Reply to this email to respond directly.
                      </div>
                    </body></html>
                    """,
                        reply_to=reply_to_addr,
                        from_email=email_service.notifications_email,
                    )
                except Exception:
                    pass

    # Dispatch webhook in background
    background_tasks.add_task(dispatch_webhook_for_inquiry_bg, inquiry.id)

    return {
        "success": True,
        "inquiry_id": inquiry.id,
        "message": "Inquiry created successfully"
    }


async def dispatch_webhook_for_inquiry_bg(inquiry_id: int):
    """Background task to dispatch webhook for inquiry"""
    from app.db.session import SessionLocal
    from app.api.routes_crm import dispatch_webhook_for_inquiry
    
    db = SessionLocal()
    try:
        await dispatch_webhook_for_inquiry(inquiry_id, db)
    finally:
        db.close()


# ── Inquiry detail ────────────────────────────────────────────────────────────

@router.get("/inquiries/{inquiry_id}")
def get_inquiry(
    inquiry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inq = (
        db.query(Inquiry)
        .options(joinedload(Inquiry.lead_notes).joinedload(LeadNote.author))
        .filter(Inquiry.id == inquiry_id)
        .first()
    )
    if not inq:
        raise ResourceNotFoundException("Inquiry", inquiry_id)
    _assert_can_access_inquiry(inq, current_user, db)

    # Mark as read on first view (if still "new")
    if inq.status == "new":
        inq.status = "read"
        db.commit()

    return _serialize_inquiry(inq, db, include_notes=True)


# ── Reply to an inquiry ───────────────────────────────────────────────────────

@router.post("/inquiries/{inquiry_id}/reply")
def reply_to_inquiry(
    inquiry_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a reply to an inquiry from the dealer/salesman side.
    Creates the root message thread if one does not already exist.
    """
    inq = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inq:
        raise ResourceNotFoundException("Inquiry", inquiry_id)
    _assert_can_access_inquiry(inq, current_user, db)

    body = (data.get("body") or "").strip()
    if not body:
        raise ValidationException("Reply body is required")

    # Find or create the root message for this inquiry
    root = (
        db.query(Message)
        .filter(
            Message.ticket_number == f"INQ-{inq.id}",
            Message.parent_message_id == None,  # noqa: E711
        )
        .order_by(Message.created_at.asc())
        .first()
    )

    if not root:
        # Inquiry predates the Message integration — create root now
        phone_line = f"Phone: {inq.sender_phone}\n" if inq.sender_phone else ""
        msg_body = f"From {inq.sender_name} ({inq.sender_email}):\n{phone_line}\n{inq.message}"
        from app.models.listing import Listing
        listing = db.query(Listing).filter(Listing.id == inq.listing_id).first() if inq.listing_id else None
        listing_title = (listing.title if listing else None) or "General Inquiry"
        root = Message(
            ticket_number=f"INQ-{inq.id}",
            sender_id=None,
            recipient_id=inq.assigned_to_id,
            listing_id=inq.listing_id,
            message_type="inquiry",
            subject=f"Inquiry from {inq.sender_name}: {listing_title}",
            body=msg_body,
            status="replied",
            visible_to_dealer=True,
            external_sender_email=inq.sender_email,
            priority="normal",
            category="inquiry",
        )
        db.add(root)
        db.commit()
        db.refresh(root)

    # Create the reply message
    sender_name = f"{current_user.first_name} {current_user.last_name}".strip()
    reply = Message(
        sender_id=current_user.id,
        recipient_id=None,  # going to external buyer
        parent_message_id=root.id,
        listing_id=root.listing_id,
        subject=f"Re: {root.subject}",
        body=body,
        message_type=root.message_type,
        priority=root.priority,
        category=root.category,
        status="new",
    )
    db.add(reply)
    root.status = "replied"
    root.replied_at = datetime.utcnow()
    db.commit()
    db.refresh(reply)

    # Email the buyer
    if inq.sender_email:
        try:
            from app.models.listing import Listing as _Listing
            listing = db.query(_Listing).filter(_Listing.id == inq.listing_id).first() if inq.listing_id else None
            listing_title = (listing.title if listing else None) or "General Inquiry"
            # Generate a token so the buyer can reply back through the platform.
            # user_id=0 is the sentinel for "external buyer reply" in routes_email_inbound.
            buyer_reply_token = generate_reply_token(root.id, 0)
            buyer_reply_to = f"reply+{buyer_reply_token}@{REPLY_TO_DOMAIN}"
            # Use the dealer's actual email as reply-to so buyer replies land
            # in their inbox (external buyers have no platform account, so the
            # token-based inbound chain can't identify them correctly).
            email_service.send_email(
                to_email=inq.sender_email,
                subject=f"Re: Inquiry about {listing_title}",
                html_content=f"""
            <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:linear-gradient(135deg,#10214F,#01BBDC);padding:28px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:22px;">Reply from {sender_name}</h1>
              </div>
              <div style="padding:30px;background:#f9fafb;">
                <div style="background:white;border-left:4px solid #01BBDC;padding:20px;border-radius:4px;margin-bottom:20px;">
                  <p style="white-space:pre-wrap;color:#334155;margin:0;">{body}</p>
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
                reply_to=buyer_reply_to,
                from_email=email_service.notifications_email,
            )
        except Exception:
            pass

    # Re-serialize the updated thread and return it
    replies_list = (
        db.query(Message)
        .filter(Message.parent_message_id == root.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    all_msgs = [root] + list(replies_list)
    message_thread = [
        {
            "id": m.id,
            "body": m.body,
            "sender_name": (
                f"{m.sender.first_name} {m.sender.last_name}".strip()
                if m.sender
                else inq.sender_name
            ),
            "is_from_buyer": m.sender_id is None,
            "created_at": m.created_at.isoformat(),
        }
        for m in all_msgs
    ]
    return {"message_id": root.id, "message_thread": message_thread}


# ── Update inquiry (stage / score / assignment / quick note) ─────────────────

@router.put("/inquiries/{inquiry_id}")
def update_inquiry(
    inquiry_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update lead stage, score, quick note, assignment, or paperwork status.

    Accepted fields (all optional):
      lead_stage, lead_score, notes, assigned_to_id, paperwork_status, status
    """
    inq = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inq:
        raise ResourceNotFoundException("Inquiry", inquiry_id)
    _assert_can_access_inquiry(inq, current_user, db)

    if "lead_stage" in data:
        if data["lead_stage"] not in VALID_STAGES:
            raise ValidationException(f"lead_stage must be one of: {', '.join(VALID_STAGES)}")
        inq.lead_stage = data["lead_stage"]
        # Keep legacy status in sync for older code paths
        if data["lead_stage"] in ("won", "lost"):
            inq.status = "closed"

    if "lead_score" in data:
        score = int(data["lead_score"])
        if not 0 <= score <= 100:
            raise ValidationException("lead_score must be 0–100")
        inq.lead_score = score

    if "notes" in data:
        inq.notes = data["notes"]

    if "assigned_to_id" in data:
        # Only dealers / admins may reassign
        if current_user.user_type not in ("dealer", "admin"):
            raise AuthorizationException("Only dealers can reassign inquiries")
        new_assignee = db.query(User).filter(User.id == data["assigned_to_id"]).first()
        if not new_assignee:
            raise ResourceNotFoundException("User", data["assigned_to_id"])
        # Must be within the dealer's own team
        allowed = _allowed_user_ids(current_user, db)
        if allowed and data["assigned_to_id"] not in allowed:
            raise AuthorizationException("Cannot assign to a user outside your team")
        inq.assigned_to_id = data["assigned_to_id"]

    if "paperwork_status" in data:
        inq.paperwork_status = data["paperwork_status"]

    if "status" in data:
        inq.status = data["status"]

    inq.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(inq)

    return _serialize_inquiry(inq, db)


# ── Lead notes CRUD ───────────────────────────────────────────────────────────

@router.post("/inquiries/{inquiry_id}/notes")
def add_note(
    inquiry_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inq = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inq:
        raise ResourceNotFoundException("Inquiry", inquiry_id)
    _assert_can_access_inquiry(inq, current_user, db)

    content = (data.get("content") or "").strip()
    if not content:
        raise ValidationException("Note content is required")

    note = LeadNote(
        inquiry_id=inquiry_id,
        author_id=current_user.id,
        content=content,
    )
    db.add(note)
    inq.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)

    return {
        "id": note.id,
        "content": note.content,
        "author_id": note.author_id,
        "author_name": f"{current_user.first_name} {current_user.last_name}".strip(),
        "created_at": note.created_at.isoformat(),
    }


@router.put("/inquiries/{inquiry_id}/notes/{note_id}")
def update_note(
    inquiry_id: int,
    note_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.query(LeadNote).filter(
        LeadNote.id == note_id,
        LeadNote.inquiry_id == inquiry_id,
    ).first()
    if not note:
        raise ResourceNotFoundException("Note", note_id)

    inq = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    _assert_can_access_inquiry(inq, current_user, db)

    # Only the author or an admin/dealer may edit a note
    if note.author_id != current_user.id and current_user.user_type not in ("dealer", "admin"):
        raise AuthorizationException("Cannot edit another user's note")

    content = (data.get("content") or "").strip()
    if not content:
        raise ValidationException("Note content is required")

    note.content = content
    note.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "id": note.id, "content": note.content}


@router.delete("/inquiries/{inquiry_id}/notes/{note_id}")
def delete_note(
    inquiry_id: int,
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.query(LeadNote).filter(
        LeadNote.id == note_id,
        LeadNote.inquiry_id == inquiry_id,
    ).first()
    if not note:
        raise ResourceNotFoundException("Note", note_id)

    inq = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    _assert_can_access_inquiry(inq, current_user, db)

    if note.author_id != current_user.id and current_user.user_type not in ("dealer", "admin"):
        raise AuthorizationException("Cannot delete another user's note")

    db.delete(note)
    db.commit()
    return {"success": True}


# ── Stage summary (kanban counts) ────────────────────────────────────────────

@router.get("/inquiries-summary")
def inquiries_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return per-stage counts for the pipeline view."""
    allowed = _allowed_user_ids(current_user, db)
    q = db.query(Inquiry)
    if allowed:
        q = q.filter(Inquiry.assigned_to_id.in_(allowed))

    counts = {stage: 0 for stage in VALID_STAGES}
    for inq in q.all():
        stage = inq.lead_stage or "new"
        if stage in counts:
            counts[stage] += 1

    return counts
