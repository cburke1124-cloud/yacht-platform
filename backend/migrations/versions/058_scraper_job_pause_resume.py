"""add scraper_jobs.pause_requested and pending_urls for resumable pause

Revision ID: 058
Revises: 057
Create Date: 2026-08-26 00:00:00.000000

Supports interrupting an in-flight run without losing progress: pausing
sets pause_requested, which run_scraper_job's per-URL loop checks between
iterations; on stopping it saves the not-yet-processed URLs to
pending_urls so the next run resumes there instead of rediscovering and
reprocessing everything from scratch.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '058'
down_revision: Union[str, Sequence[str], None] = '057'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c['name'] for c in inspector.get_columns('scraper_jobs')}

    if 'pause_requested' not in columns:
        op.add_column(
            'scraper_jobs',
            sa.Column('pause_requested', sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if 'pending_urls' not in columns:
        op.add_column('scraper_jobs', sa.Column('pending_urls', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('scraper_jobs', 'pending_urls')
    op.drop_column('scraper_jobs', 'pause_requested')
