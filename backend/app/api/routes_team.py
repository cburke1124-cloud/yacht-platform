from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, timedelta
import secrets

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.listing import Listing
from app.models.misc import Message, Inquiry
from app.exceptions import AuthorizationException, ValidationException, ResourceNotFoundException
from app.services.permissions import Permission, has_permission, TEAM_ROLE_PERMISSIONS, TeamMemberRole
from app.security.auth import get_password_hash
from app.services.email_service import email_service

router = APIRouter()


@router.get("/performance")
def get_team_performance(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dealer-facing sales team snapshot and lead responsiveness metrics."""
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission")

    days = max(7, min(days, 180))
    now = datetime.utcnow()
    period_start = now - timedelta(days=days)
    previous_start = period_start - timedelta(days=days)

    members = db.query(User).filter(
        User.parent_dealer_id == current_user.id,
        User.active == True,
    ).all()

    member_ids = [member.id for member in members]
    dealer_and_team_ids = [current_user.id] + member_ids

    def inquiry_count_between(start: datetime, end: datetime) -> int:
        return db.query(func.count(Message.id)).filter(
            Message.parent_message_id.is_(None),
            Message.message_type == "inquiry",
            Message.recipient_id.in_(dealer_and_team_ids),
            Message.created_at >= start,
            Message.created_at < end,
        ).scalar() or 0

    current_period_leads = inquiry_count_between(period_start, now)
    previous_period_leads = inquiry_count_between(previous_start, period_start)

    members_payload = []
    total_pending_inquiries = 0
    response_rate_values = []

    for member in members:
        listing_query = db.query(Listing).filter(
            or_(
                Listing.user_id == member.id,
                Listing.created_by_user_id == member.id,
                Listing.assigned_salesman_id == member.id,
            )
        )

        listings_total = listing_query.count()
        listings_active = listing_query.filter(Listing.status == "active").count()

        listing_stats = listing_query.with_entities(
            func.coalesce(func.sum(Listing.views), 0).label("views"),
            func.coalesce(func.sum(Listing.inquiries), 0).label("inquiries"),
        ).first()

        inquiries_total = db.query(func.count(Message.id)).filter(
            Message.parent_message_id.is_(None),
            Message.message_type == "inquiry",
            Message.recipient_id == member.id,
        ).scalar() or 0

        inquiries_current_period = db.query(func.count(Message.id)).filter(
            Message.parent_message_id.is_(None),
            Message.message_type == "inquiry",
            Message.recipient_id == member.id,
            Message.created_at >= period_start,
            Message.created_at <= now,
        ).scalar() or 0

        pending_inquiries = db.query(func.count(Message.id)).filter(
            Message.parent_message_id.is_(None),
            Message.message_type == "inquiry",
            Message.recipient_id == member.id,
            Message.status.in_(["new", "read"]),
        ).scalar() or 0

        replied_inquiries = db.query(func.count(Message.id)).filter(
            Message.parent_message_id.is_(None),
            Message.message_type == "inquiry",
            Message.recipient_id == member.id,
            Message.replied_at.isnot(None),
        ).scalar() or 0

        avg_response_seconds = db.query(
            func.avg(func.extract('epoch', Message.replied_at - Message.created_at))
        ).filter(
            Message.parent_message_id.is_(None),
            Message.message_type == "inquiry",
            Message.recipient_id == member.id,
            Message.replied_at.isnot(None),
        ).scalar()

        response_rate = (replied_inquiries / inquiries_total * 100.0) if inquiries_total > 0 else 0.0
        avg_response_hours = (float(avg_response_seconds) / 3600.0) if avg_response_seconds else None

        last_message_at = db.query(func.max(Message.created_at)).filter(
            Message.recipient_id == member.id
        ).scalar()

        total_pending_inquiries += pending_inquiries
        if inquiries_total > 0:
            response_rate_values.append(response_rate)

        members_payload.append({
            "id": member.id,
            "name": f"{member.first_name or ''} {member.last_name or ''}".strip() or member.email,
            "email": member.email,
            "role": member.role,
            "listings_total": listings_total,
            "listings_active": listings_active,
            "views_total": int(listing_stats.views or 0),
            "listing_inquiries_total": int(listing_stats.inquiries or 0),
            "inquiries_total": inquiries_total,
            "inquiries_current_period": inquiries_current_period,
            "pending_inquiries": pending_inquiries,
            "replied_inquiries": replied_inquiries,
            "response_rate": round(response_rate, 1),
            "avg_response_hours": round(avg_response_hours, 2) if avg_response_hours is not None else None,
            "last_message_at": last_message_at.isoformat() if last_message_at else None,
            "joined_at": member.created_at.isoformat() if member.created_at else None,
            "active": member.active,
        })

    average_response_rate = (
        round(sum(response_rate_values) / len(response_rate_values), 1)
        if response_rate_values
        else 0.0
    )

    lead_delta = current_period_leads - previous_period_leads
    lead_delta_percent = (
        round((lead_delta / previous_period_leads) * 100.0, 1)
        if previous_period_leads > 0
        else (100.0 if current_period_leads > 0 else 0.0)
    )

    return {
        "range_days": days,
        "summary": {
            "team_members": len(members),
            "period_leads": current_period_leads,
            "previous_period_leads": previous_period_leads,
            "lead_delta": lead_delta,
            "lead_delta_percent": lead_delta_percent,
            "pending_inquiries": total_pending_inquiries,
            "average_response_rate": average_response_rate,
        },
        "members": sorted(
            members_payload,
            key=lambda m: (m["pending_inquiries"], -m["inquiries_current_period"]),
            reverse=True,
        ),
    }


@router.post("/invite")
def invite_team_member(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Invite a new team member."""
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission to manage team")

    email = data.get("email")
    if db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first():
        raise ValidationException("User already exists")

    role = data.get("role", "salesperson")
    if role not in TeamMemberRole.__members__.values():
        role = "salesperson"

    permissions = {perm.value: allowed for perm, allowed in TEAM_ROLE_PERMISSIONS[TeamMemberRole(role)].items()}

    if "permissions" in data:
        permissions.update(data["permissions"])

    temp_password = secrets.token_urlsafe(12)

    member = User(
        email=email,
        password_hash=get_password_hash(temp_password, skip_validation=True),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        phone=data.get("phone"),
        user_type="team_member",
        parent_dealer_id=current_user.id,
        role=role,
        permissions=permissions,
        subscription_tier=current_user.subscription_tier,
        active=True,
    )

    db.add(member)
    db.commit()
    db.refresh(member)

    # Create email verification token for the new team member
    from app.models.dealer import EmailVerification
    verification_token = None
    try:
        verification_token = secrets.token_urlsafe(32)
        verification = EmailVerification(
            user_id=member.id,
            token=verification_token,
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        db.add(verification)
        db.commit()
    except Exception:
        db.rollback()
        verification_token = None

    # Build invite email with temp password and optional verify link
    verify_section = (
        f'<p>Please verify your email address: '
        f'<a href="https://yachtversal.com/verify-email?token={verification_token}">Verify Email</a></p>'
        if verification_token else ""
    )
    email_service.send_email(
        to_email=email,
        subject="Team Invitation - YachtVersal",
        html_content=f"""
        <h2>You've been invited to join {current_user.company_name or 'a team'} on YachtVersal!</h2>
        <p>Your temporary password is: <code>{temp_password}</code></p>
        <p>Please log in at <a href="https://yachtversal.com/login">https://yachtversal.com/login</a> and change your password.</p>
        {verify_section}
        """,
    )

    return {"success": True, "member_id": member.id}


@router.get("/members")
def get_team_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all team members for the current dealer."""
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission")

    members = db.query(User).filter(
        User.parent_dealer_id == current_user.id,
        User.active == True
    ).all()

    return [
        {
            "id": m.id,
            "email": m.email,
            "first_name": m.first_name,
            "last_name": m.last_name,
            "phone": m.phone,
            "role": m.role,
            "permissions": m.permissions or {},
            "active": m.active,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in members
    ]


@router.put("/members/{member_id}/permissions")
def update_member_permissions(
    member_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update team member permissions."""
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission")

    member = (
        db.query(User)
        .filter(User.id == member_id, User.parent_dealer_id == current_user.id)
        .first()
    )

    if not member:
        raise ResourceNotFoundException("Team member", member_id)

    if "role" in data:
        role = data["role"]
        if role in TeamMemberRole.__members__.values():
            member.role = role
            member.permissions = {perm.value: allowed for perm, allowed in TEAM_ROLE_PERMISSIONS[TeamMemberRole(role)].items()}

    if "permissions" in data:
        if member.permissions is None:
            member.permissions = {}
        member.permissions.update(data["permissions"])

    db.commit()

    return {"success": True, "permissions": member.permissions}


@router.delete("/members/{member_id}")
def remove_team_member(
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft-delete a team member with 90-day recovery window.
    Transfer their listings to the dealer owner.
    """
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission")

    member = (
        db.query(User)
        .filter(User.id == member_id, User.parent_dealer_id == current_user.id)
        .first()
    )

    if not member:
        raise ResourceNotFoundException("Team member", member_id)

    # Transfer listings to dealer
    from app.models.listing import Listing
    listing_count = db.query(Listing).filter(Listing.user_id == member_id).count()
    
    db.query(Listing).filter(Listing.user_id == member_id).update(
        {"user_id": current_user.id}
    )

    # Soft-delete the team member (90-day recovery window)
    member.deleted_at = datetime.utcnow()
    member.recovery_deadline = datetime.utcnow() + timedelta(days=90)
    db.commit()

    return {
        "success": True,
        "message": f"Team member removed. {listing_count} listing(s) transferred to dealer.",
        "member_id": member.id,
        "member_email": member.email,
        "listings_transferred": listing_count,
        "recovery_deadline": member.recovery_deadline.isoformat(),
        "note": "This team member can be recovered within 90 days via admin recovery endpoints."
    }


# ── Dealer oversight: read a team member's messages (no alerts, safety view) ──

def _assert_dealer_owns_member(dealer: User, member_id: int, db: Session) -> User:
    """Raise if `member_id` is not a team member of `dealer`."""
    if not has_permission(dealer, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission")
    member = (
        db.query(User)
        .filter(User.id == member_id, User.parent_dealer_id == dealer.id)
        .first()
    )
    if not member:
        raise ResourceNotFoundException("Team member", member_id)
    return member


@router.get("/members/{member_id}/messages")
def get_member_messages(
    member_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Dealer-only read-only view of a team member's messages.
    No notifications are sent; this is a supervisory safety feature.
    """
    _assert_dealer_owns_member(current_user, member_id, db)

    q = db.query(Message).filter(
        or_(Message.sender_id == member_id, Message.recipient_id == member_id)
    ).order_by(Message.created_at.desc())

    total = q.count()
    messages = q.offset(offset).limit(limit).all()

    return {
        "total": total,
        "items": [
            {
                "id": m.id,
                "subject": m.subject,
                "body": m.body,
                "message_type": m.message_type,
                "status": m.status,
                "sender_id": m.sender_id,
                "recipient_id": m.recipient_id,
                "sender_name": (
                    f"{m.sender.first_name} {m.sender.last_name}".strip()
                    if m.sender else "Unknown"
                ),
                "listing_id": m.listing_id,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.get("/members/{member_id}/inquiries")
def get_member_inquiries(
    member_id: int,
    stage: str = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Dealer-only read-only view of leads assigned to a team member.
    """
    _assert_dealer_owns_member(current_user, member_id, db)

    q = db.query(Inquiry).filter(Inquiry.assigned_to_id == member_id)
    if stage:
        q = q.filter(Inquiry.lead_stage == stage)
    q = q.order_by(Inquiry.created_at.desc())

    total = q.count()
    inquiries = q.offset(offset).limit(limit).all()

    from app.models.listing import Listing as ListingModel

    def _fmt(inq: Inquiry) -> dict:
        listing = (
            db.query(ListingModel).filter(ListingModel.id == inq.listing_id).first()
            if inq.listing_id else None
        )
        return {
            "id": inq.id,
            "sender_name": inq.sender_name,
            "sender_email": inq.sender_email,
            "sender_phone": inq.sender_phone,
            "message": inq.message,
            "lead_stage": inq.lead_stage or "new",
            "lead_score": inq.lead_score or 0,
            "listing_id": inq.listing_id,
            "listing_title": listing.title if listing else None,
            "created_at": inq.created_at.isoformat(),
            "updated_at": inq.updated_at.isoformat() if inq.updated_at else None,
        }

    return {
        "total": total,
        "items": [_fmt(inq) for inq in inquiries],
    }


@router.get("/members/{member_id}/overview")
def get_member_overview(
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Full dashboard overview for a single team member — listings, inquiry
    pipeline counts, message count, and response metrics.
    """
    member = _assert_dealer_owns_member(current_user, member_id, db)

    # Listings
    listing_q = db.query(Listing).filter(
        or_(
            Listing.user_id == member_id,
            Listing.assigned_salesman_id == member_id,
        )
    )
    listings_total = listing_q.count()
    listings_active = listing_q.filter(Listing.status == "active").count()

    # Inquiries by stage
    stage_counts: dict = {}
    for (stage,), cnt in (
        db.query(Inquiry.lead_stage, func.count(Inquiry.id))
        .filter(Inquiry.assigned_to_id == member_id)
        .group_by(Inquiry.lead_stage)
        .all()
    ):
        stage_counts[stage or "new"] = cnt

    # Messages
    message_total = db.query(func.count(Message.id)).filter(
        or_(Message.sender_id == member_id, Message.recipient_id == member_id)
    ).scalar() or 0

    pending_messages = db.query(func.count(Message.id)).filter(
        Message.recipient_id == member_id,
        Message.status.in_(["new", "read"]),
    ).scalar() or 0

    return {
        "member": {
            "id": member.id,
            "name": f"{member.first_name} {member.last_name}".strip(),
            "email": member.email,
            "phone": member.phone,
            "role": member.role,
            "active": member.active,
            "joined_at": member.created_at.isoformat() if member.created_at else None,
        },
        "listings": {
            "total": listings_total,
            "active": listings_active,
        },
        "inquiries": {
            "total": sum(stage_counts.values()),
            "by_stage": stage_counts,
        },
        "messages": {
            "total": message_total,
            "pending": pending_messages,
        },
    }

# ============= Listing Reassignment (After Team Member Removal) =============

@router.get("/members/{member_id}/listings")
def get_member_listings(
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all listings owned by a team member.
    Useful for reassignment after member is removed.
    """
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission")

    member = (
        db.query(User)
        .filter(User.id == member_id, User.parent_dealer_id == current_user.id)
        .first()
    )

    if not member:
        raise ResourceNotFoundException("Team member", member_id)

    listings = db.query(Listing).filter(Listing.user_id == member_id).all()

    return {
        "member_id": member.id,
        "member_name": f"{member.first_name or ''} {member.last_name or ''}".strip() or member.email,
        "member_email": member.email,
        "total_listings": len(listings),
        "listings": [
            {
                "id": listing.id,
                "title": listing.title,
                "status": listing.status,
                "make_model": listing.make_model,
                "price": listing.price,
                "created_at": listing.created_at.isoformat() if listing.created_at else None,
                "views": listing.views or 0,
                "inquiries": listing.inquiries or 0,
            }
            for listing in listings
        ]
    }


@router.put("/listings/{listing_id}/reassign-owner")
def reassign_listing_owner(
    listing_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reassign a listing to a different team member or dealer.
    Can only be done by dealer owners or admins.
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)

    # Check if current user owns this listing or is an admin/dealer
    if listing.user_id != current_user.id:
        if not has_permission(current_user, Permission.MANAGE_TEAM):
            raise AuthorizationException("Not authorized to reassign this listing")

    new_owner_id = data.get("new_owner_id")
    if not new_owner_id:
        raise ValidationException("new_owner_id is required")

    new_owner = db.query(User).filter(User.id == new_owner_id).first()
    if not new_owner:
        raise ResourceNotFoundException("New owner", new_owner_id)

    # Verify new owner is part of the same organization
    if current_user.user_type == "dealer":
        # Can only assign to own team members or self
        if new_owner_id != current_user.id:
            if new_owner.parent_dealer_id != current_user.id:
                raise AuthorizationException("New owner must be part of your team")

    # Reassign
    listing.user_id = new_owner_id
    db.commit()
    db.refresh(listing)

    return {
        "success": True,
        "listing_id": listing.id,
        "listing_title": listing.title,
        "old_owner_id": listing.user_id,
        "new_owner_id": new_owner_id,
        "new_owner_name": f"{new_owner.first_name or ''} {new_owner.last_name or ''}".strip() or new_owner.email,
        "message": f"Listing reassigned to {new_owner.first_name or new_owner.email}"
    }


@router.post("/members/{member_id}/bulk-reassign-listings")
def bulk_reassign_team_member_listings(
    member_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bulk reassign all listings from one team member to another.
    Useful when removing a team member.
    """
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission")

    member = (
        db.query(User)
        .filter(User.id == member_id, User.parent_dealer_id == current_user.id)
        .first()
    )

    if not member:
        raise ResourceNotFoundException("Team member", member_id)

    new_owner_id = data.get("new_owner_id")
    if not new_owner_id:
        raise ValidationException("new_owner_id is required")

    new_owner = (
        db.query(User)
        .filter(User.id == new_owner_id)
        .first()
    )

    if not new_owner:
        raise ResourceNotFoundException("New owner", new_owner_id)

    # Verify new owner is dealer or part of same team
    if new_owner_id != current_user.id:
        if new_owner.parent_dealer_id != current_user.id:
            raise AuthorizationException("New owner must be part of your team or be the dealer")

    # Reassign all listings
    updated_count = db.query(Listing).filter(
        Listing.user_id == member_id
    ).update(
        {"user_id": new_owner_id},
        synchronize_session=False
    )
    db.commit()

    return {
        "success": True,
        "member_id": member.id,
        "member_name": f"{member.first_name or ''} {member.last_name or ''}".strip() or member.email,
        "new_owner_id": new_owner_id,
        "new_owner_name": f"{new_owner.first_name or ''} {new_owner.last_name or ''}".strip() or new_owner.email,
        "listings_reassigned": updated_count,
        "message": f"{updated_count} listing(s) reassigned from {member.first_name or member.email} to {new_owner.first_name or new_owner.email}"
    }