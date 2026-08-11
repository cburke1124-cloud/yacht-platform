"""add scraped_listings.charter_listing_id (separate FK from the overloaded listing_id)

Revision ID: 057
Revises: 056
Create Date: 2026-08-11 00:00:00.000000

scraped_listings.listing_id has a hard FK to listings.id, but
master_ocean.py's charter sync was storing CharterListing.id in that same
column ("reusing listing_id to point to charter"). That only avoided FK
violations by coincidence — CharterListing and Listing have independent id
sequences, so any charter.id with no matching listings.id row would fail the
insert outright. This adds a proper, separate nullable FK column for charter
rows so the two id spaces are never conflated again.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '057'
down_revision: Union[str, Sequence[str], None] = '056'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {c['name'] for c in inspector.get_columns('scraped_listings')}
    if 'charter_listing_id' not in columns:
        op.add_column(
            'scraped_listings',
            sa.Column('charter_listing_id', sa.Integer(), sa.ForeignKey('charter_listings.id'), nullable=True),
        )

    inspector = sa.inspect(bind)  # refresh after add_column
    indexes = {ix['name'] for ix in inspector.get_indexes('scraped_listings')}
    if 'ix_scraped_listings_charter_listing_id' not in indexes:
        op.create_index('ix_scraped_listings_charter_listing_id', 'scraped_listings', ['charter_listing_id'])

    # Backfill: any existing scraped_listings row for a charter/event source_url
    # currently has CharterListing.id sitting in the (wrong) listing_id column —
    # move it to the new column and null out listing_id so the FK to listings.id
    # stops being coincidentally satisfied by an unrelated row.
    op.execute("""
        UPDATE scraped_listings
        SET charter_listing_id = listing_id, listing_id = NULL
        WHERE (source_url LIKE 'masterocean://charter/%' OR source_url LIKE 'masterocean://event/%')
          AND listing_id IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE scraped_listings
        SET listing_id = charter_listing_id
        WHERE charter_listing_id IS NOT NULL
    """)
    op.drop_index('ix_scraped_listings_charter_listing_id', table_name='scraped_listings')
    op.drop_column('scraped_listings', 'charter_listing_id')
