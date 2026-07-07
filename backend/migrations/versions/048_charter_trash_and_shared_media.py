"""Charter listings: real soft-delete, salesman attribution, shared media.

Three additive changes, all guarded so this applies cleanly whether the
columns already exist or not:

1. charter_listings.deleted_at — real soft-delete timestamp, mirroring
   Listing.deleted_at. Previously "Delete" only flipped status to
   'inactive', indistinguishable from a deliberately paused listing and
   with no way to restore or permanently purge.
2. charter_listings.assigned_salesman_id — mirrors Listing.assigned_salesman_id
   so a charter can be attributed to a specific team member for
   sales-rep/team dashboards (CharterListing previously had no attribution
   path beyond the raw owning user_id).
3. listing_media_attachments.charter_listing_id — lets charter listings use
   the same MediaFile/ListingMediaAttachment gallery system for-sale
   listings use (primary flag, display_order, captions, shared library)
   instead of a flat JSON URL array. listing_id is loosened to nullable
   since a row now belongs to exactly one of listing_id / charter_listing_id.

Revision ID: 048
Revises: f2c7a1d94b8e
"""

revision = '048'
down_revision = 'f2c7a1d94b8e'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def _cols(inspector, table: str) -> set:
    return {c['name'] for c in inspector.get_columns(table)}


def _indexes(inspector, table: str) -> set:
    return {ix['name'] for ix in inspector.get_indexes(table)}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'charter_listings' in tables:
        cols = _cols(inspector, 'charter_listings')
        if 'deleted_at' not in cols:
            op.add_column('charter_listings', sa.Column('deleted_at', sa.DateTime(), nullable=True))
        if 'assigned_salesman_id' not in cols:
            op.add_column('charter_listings', sa.Column('assigned_salesman_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
        idx = _indexes(inspector, 'charter_listings')
        if 'ix_charter_listings_deleted_at' not in idx:
            op.create_index('ix_charter_listings_deleted_at', 'charter_listings', ['deleted_at'])
        if 'ix_charter_listings_assigned_salesman_id' not in idx:
            op.create_index('ix_charter_listings_assigned_salesman_id', 'charter_listings', ['assigned_salesman_id'])

    if 'listing_media_attachments' in tables:
        cols = _cols(inspector, 'listing_media_attachments')
        if 'charter_listing_id' not in cols:
            op.add_column('listing_media_attachments', sa.Column('charter_listing_id', sa.Integer(), sa.ForeignKey('charter_listings.id'), nullable=True))
        idx = _indexes(inspector, 'listing_media_attachments')
        if 'idx_attachment_charter_listing' not in idx:
            op.create_index('idx_attachment_charter_listing', 'listing_media_attachments', ['charter_listing_id'])
        if 'idx_attachment_charter_order' not in idx:
            op.create_index('idx_attachment_charter_order', 'listing_media_attachments', ['charter_listing_id', 'display_order'])
        # listing_id was NOT NULL — loosen it so charter-owned rows can leave it null.
        # Postgres: ALTER COLUMN ... DROP NOT NULL is safe/instant, no rewrite.
        col_info = next((c for c in inspector.get_columns('listing_media_attachments') if c['name'] == 'listing_id'), None)
        if col_info is not None and not col_info.get('nullable', True):
            op.alter_column('listing_media_attachments', 'listing_id', nullable=True)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'listing_media_attachments' in tables:
        idx = _indexes(inspector, 'listing_media_attachments')
        if 'idx_attachment_charter_order' in idx:
            op.drop_index('idx_attachment_charter_order', table_name='listing_media_attachments')
        if 'idx_attachment_charter_listing' in idx:
            op.drop_index('idx_attachment_charter_listing', table_name='listing_media_attachments')
        cols = _cols(inspector, 'listing_media_attachments')
        if 'charter_listing_id' in cols:
            op.drop_column('listing_media_attachments', 'charter_listing_id')

    if 'charter_listings' in tables:
        idx = _indexes(inspector, 'charter_listings')
        if 'ix_charter_listings_assigned_salesman_id' in idx:
            op.drop_index('ix_charter_listings_assigned_salesman_id', table_name='charter_listings')
        if 'ix_charter_listings_deleted_at' in idx:
            op.drop_index('ix_charter_listings_deleted_at', table_name='charter_listings')
        cols = _cols(inspector, 'charter_listings')
        if 'assigned_salesman_id' in cols:
            op.drop_column('charter_listings', 'assigned_salesman_id')
        if 'deleted_at' in cols:
            op.drop_column('charter_listings', 'deleted_at')
