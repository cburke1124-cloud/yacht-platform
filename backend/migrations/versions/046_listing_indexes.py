"""Add missing indexes on listings for status/user_id/created_at/deleted_at.

Every listing list endpoint (public search, admin dashboard, dealer
dashboard) filters on deleted_at/status and sorts by created_at, and the
dealer dashboard filters by user_id — none of these columns had an index,
forcing a sequential scan + sort on every request as the table grows.

Revision ID: 046
Revises: 045
"""

revision = '046'
down_revision = '045'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def _existing_indexes(inspector, table_name: str) -> set[str]:
    return {ix['name'] for ix in inspector.get_indexes(table_name)}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'listings' not in inspector.get_table_names():
        return
    existing = _existing_indexes(inspector, 'listings')

    if 'ix_listings_user_id' not in existing:
        op.create_index('ix_listings_user_id', 'listings', ['user_id'])
    if 'ix_listings_status' not in existing:
        op.create_index('ix_listings_status', 'listings', ['status'])
    if 'ix_listings_created_at' not in existing:
        op.create_index('ix_listings_created_at', 'listings', ['created_at'])
    if 'ix_listings_deleted_at' not in existing:
        op.create_index('ix_listings_deleted_at', 'listings', ['deleted_at'])


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'listings' not in inspector.get_table_names():
        return
    existing = _existing_indexes(inspector, 'listings')
    for name in ('ix_listings_deleted_at', 'ix_listings_created_at', 'ix_listings_status', 'ix_listings_user_id'):
        if name in existing:
            op.drop_index(name, table_name='listings')
