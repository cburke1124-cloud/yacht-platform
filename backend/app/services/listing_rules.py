from sqlalchemy.orm import Session
from app.models.listing import Listing
from app.models.user import User
from app.exceptions import AuthorizationException
from app.constants import TIER_LIMITS


def check_listing_limit(user: User, db: Session):
    active_count = db.query(Listing).filter(
        Listing.user_id == user.id,
        Listing.status == "active"
    ).count()

    limit = TIER_LIMITS.get(user.subscription_tier, TIER_LIMITS["free"])["listings"]

    if active_count >= limit:
        raise AuthorizationException(
            f"You've reached your listing limit ({limit}). Upgrade your subscription to create more listings."
        )