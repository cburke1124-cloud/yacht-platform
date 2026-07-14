"""Add charter_id to saved_listings and comparison_items.

Revision ID: 052
Revises: 051
"""

revision = '052'
down_revision = '051'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'saved_listings' in inspector.get_table_names():
        cols = {c['name'] for c in inspector.get_columns('saved_listings')}
        if 'charter_id' not in cols:
            op.add_column('saved_listings', sa.Column('charter_id', sa.Integer(), sa.ForeignKey('charter_listings.id', ondelete='CASCADE'), nullable=True))

    if 'comparison_items' in inspector.get_table_names():
        cols = {c['name'] for c in inspector.get_columns('comparison_items')}
        if 'charter_id' not in cols:
            op.add_column('comparison_items', sa.Column('charter_id', sa.Integer(), sa.ForeignKey('charter_listings.id', ondelete='CASCADE'), nullable=True))


def downgrade():
    op.drop_column('comparison_items', 'charter_id')
    op.drop_column('saved_listings', 'charter_id')
