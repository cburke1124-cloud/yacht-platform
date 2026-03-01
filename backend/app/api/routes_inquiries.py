"""
Lead / Inquiry management routes.

Visibility rules:
  - Dealer:       sees all inquiries assigned to themselves OR any of their team members.
  - Team member:  sees only inquiries assigned to themselves.
  - Admin:        sees everything.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from datetime import datetime
from typing import Optional

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.misc import Inquiry, LeadNote
from app.exceptions import (
    ResourceNotFoundException,
    AuthorizationException,
    ValidationException,
)

router = APIRouter()

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
