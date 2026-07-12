"""Add special_features column to charter_listings.

Revision ID: 051
Revises: 050
"""

revision = '051'
down_revision = '050'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'charter_listings' in inspector.get_table_names():
        cols = {c['name'] for c in inspector.get_columns('charter_listings')}
        if 'special_features' not in cols:
            op.add_column('charter_listings', sa.Column('special_features', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('charter_listings', 'special_features')
