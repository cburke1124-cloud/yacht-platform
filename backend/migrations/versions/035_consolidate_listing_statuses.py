"""Consolidate listing statuses: migrate 'pending' and 'needs_approval' to 'awaiting_review'.

Both statuses served the same purpose (listing submitted for admin review/approval).
Unifying them to 'awaiting_review' for consistency.

Revision ID: 035
"""
from alembic import op
import sqlalchemy as sa

revision = '035'
down_revision = '034'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        UPDATE listings
        SET status = 'awaiting_review'
        WHERE status IN ('pending', 'needs_approval')
          AND deleted_at IS NULL
    """)


def downgrade():
    # Cannot distinguish original values after consolidation; no-op.
    pass
