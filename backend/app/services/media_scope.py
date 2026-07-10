from sqlalchemy.orm import Session

from app.models.user import User


def org_media_ids(user: User, db: Session) -> list[int]:
    """User ids in `user`'s organisation (dealer + all their team members) —
    media is shared org-wide, so any ownership check on a MediaFile must use
    this, not a bare user.id comparison.

    Shared by routes_media.py, routes_charter.py and routes_listings.py so
    the "who can see/attach this media" rule stays a single source of truth.
    """
    root_dealer_id = user.parent_dealer_id or user.id
    team_ids = (
        db.query(User.id)
        .filter(
            (User.id == root_dealer_id) |
            (User.parent_dealer_id == root_dealer_id)
        )
        .all()
    )
    return [row[0] for row in team_ids] or [user.id]
