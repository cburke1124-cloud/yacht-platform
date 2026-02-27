from app.db.base_class import Base

# Import all models so Alembic / metadata.create_all can see them
from app.models.user import User, UserPreferences
from app.models.listing import Listing, ListingImage, FeaturedListing, SavedListing, PriceAlert, SearchAlert
from app.models.dealer import (
    DealerProfile, 
    TeamMember, 
    DealerAnnouncement, 
    DealerReview,
    PasswordReset,
    EmailVerification,
    TwoFactorAuth,
    TwoFactorCode,
    ActivityLog,
)
from app.models.misc import (
    Message,
    Notification,
    CRMIntegration,
    CRMSyncLog,
    ScraperJob,
    ScrapedListing,
    CurrencyRate,
    SiteSettings,
    Inquiry,
    Payment,
    Invoice,
    AccountDeletionRequest,
)

# Import MediaFile from media.py instead
from app.models.media import (
    MediaFile,
    MediaFolder,
    ListingMediaAttachment
)

from app.models.api_keys import (
    APIKey, 
    ListingAPIBlock, 
    DealerInvitation, 
    PromotionalOffer,
    RateLimitLog
)

# ADD BLOG MODELS HERE
from app.models.blog import (
    BlogPost,
    BlogCategory,
    BlogTag,
    BlogComment,
    BlogPostTag
)

from app.models.partner_growth import (
    AffiliateAccount,
    PartnerDeal,
    ReferralSignup,
)