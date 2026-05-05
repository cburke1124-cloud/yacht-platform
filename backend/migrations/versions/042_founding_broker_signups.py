"""Create founding_broker_signups table.

Revision ID: 042
Revises: 041
"""
revision = '042'
down_revision = '041'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'founding_broker_signups' not in existing_tables:
        op.create_table(
            'founding_broker_signups',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('email', sa.String(), nullable=False, index=True),
            sa.Column('company_name', sa.String(), nullable=False),
            sa.Column('website', sa.String(), nullable=True),
            sa.Column('phone', sa.String(), nullable=True),
            sa.Column('years_experience', sa.String(), nullable=True),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('status', sa.String(), nullable=False, server_default='new'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )


def downgrade():
    op.drop_table('founding_broker_signups')
