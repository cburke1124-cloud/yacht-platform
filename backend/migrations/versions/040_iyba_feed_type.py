"""Add feed_type column to yachtworld_sync_jobs for IYBA XML feed support.

Existing rows are backfilled as 'boats_group'.
api_key is made nullable so IYBA jobs (which need no key) can be created cleanly.

Revision ID: 040
Revises: 039
"""
revision = '040'
down_revision = '039'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c['name'] for c in inspector.get_columns('yachtworld_sync_jobs')}

    if 'feed_type' not in cols:
        op.add_column(
            'yachtworld_sync_jobs',
            sa.Column('feed_type', sa.String(), nullable=True, server_default='boats_group'),
        )
        op.execute("UPDATE yachtworld_sync_jobs SET feed_type = 'boats_group' WHERE feed_type IS NULL")

    # Make api_key nullable — IYBA feeds don't require an API key
    op.alter_column('yachtworld_sync_jobs', 'api_key', nullable=True)


def downgrade():
    op.drop_column('yachtworld_sync_jobs', 'feed_type')
    op.alter_column('yachtworld_sync_jobs', 'api_key', nullable=False)
