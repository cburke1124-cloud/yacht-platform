"""Soft-delete Listing rows that were imported by scraper but have no ScrapedListing parent record.

These accumulate when scraper jobs are deleted without their associated listings being cleaned up.
The orphan recovery path in the scraper keeps re-linking them, causing "updated" outcomes
even when a brand-new job is created, and no listings appear in the review queue
because they have incorrect status/source values.

Revision ID: 034
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = '034'
down_revision = '033'
branch_labels = None
depends_on = None


def upgrade():
    # Soft-delete any Listing with source_url set but no ScrapedListing record pointing to it.
    # These are orphans from jobs that were deleted without their listings being cleaned up.
    op.execute("""
        UPDATE listings
        SET deleted_at = NOW()
        WHERE source_url IS NOT NULL
          AND deleted_at IS NULL
          AND id NOT IN (
              SELECT DISTINCT listing_id FROM scraped_listings WHERE listing_id IS NOT NULL
          )
    """)


def downgrade():
    # Cannot safely undo — would un-delete listings that may have been deliberately deleted.
    pass
