"""Add performance indexes on listings: status, user_id, created_at

These cover the most common admin and dealer queries:
  - Filter by status (admin-list endpoint, get_my_listings)
  - Filter by user_id (dealer dashboard)
  - Composite (status, user_id) for dealer filtered views
  - created_at for ORDER BY in all list endpoints

Revision ID: 036
Revises: 035
"""
from alembic import op

revision = '036'
down_revision = '035'
branch_labels = None
depends_on = None


def upgrade():
    # Use CREATE INDEX IF NOT EXISTS so re-running is safe.
    # CONCURRENTLY is not available inside a transaction, but Alembic wraps
    # each migration in a transaction by default; using op.execute with the
    # connection out of autobegin lets us fall back to a regular (non-concurrent)
    # build which is fine for an initial deploy.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_listings_status "
        "ON listings (status) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_listings_user_id "
        "ON listings (user_id) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_listings_status_user_id "
        "ON listings (status, user_id) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_listings_created_at "
        "ON listings (created_at DESC) WHERE deleted_at IS NULL"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_listings_status")
    op.execute("DROP INDEX IF EXISTS ix_listings_user_id")
    op.execute("DROP INDEX IF EXISTS ix_listings_status_user_id")
    op.execute("DROP INDEX IF EXISTS ix_listings_created_at")
