"""Add index on listing_images.listing_id.

The /listings/admin-list endpoint runs a correlated subquery per listing row
against listing_images to find the primary image. Without an index on
listing_id, each of those subqueries is a full sequential scan of the whole
image table — cost grows quadratically as listings (each with 20-30 scraped
images) accumulate. This is what made the admin listings page take minutes
to load. The same column is also hit by selectinload(Listing.images) on the
public /listings endpoint and the legacy-image fallback in /my-listings.

Revision ID: 047
Revises: 046
"""

revision = '047'
down_revision = '046'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


_INDEXES = {
    'listing_images': [
        ('ix_listing_images_listing_id', ['listing_id']),
    ],
    # Sync jobs look up scraped_listings by (job_id, source_url) once per yacht
    # per run, and archive passes scan by job_id — also unindexed until now.
    'scraped_listings': [
        ('ix_scraped_listings_job_id', ['job_id']),
        ('ix_scraped_listings_listing_id', ['listing_id']),
        ('ix_scraped_listings_source_url', ['source_url']),
    ],
}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    for table, indexes in _INDEXES.items():
        if table not in tables:
            continue
        existing = {ix['name'] for ix in inspector.get_indexes(table)}
        for name, cols in indexes:
            if name not in existing:
                op.create_index(name, table, cols)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    for table, indexes in _INDEXES.items():
        if table not in tables:
            continue
        existing = {ix['name'] for ix in inspector.get_indexes(table)}
        for name, _cols in indexes:
            if name in existing:
                op.drop_index(name, table_name=table)
