"""add pending_registrations table

Revision ID: 054
Revises: 053
Create Date: 2026-07-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '054'
down_revision: Union[str, Sequence[str], None] = '053'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'pending_registrations' not in tables:
        op.create_table(
            'pending_registrations',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('email', sa.String(), nullable=False),
            sa.Column('password_hash', sa.String(), nullable=False),
            sa.Column('first_name', sa.String(), nullable=True),
            sa.Column('last_name', sa.String(), nullable=True),
            sa.Column('phone', sa.String(), nullable=True),
            sa.Column('company_name', sa.String(), nullable=True),
            sa.Column('website', sa.String(), nullable=True),
            sa.Column('user_type', sa.String(), nullable=False),
            sa.Column('subscription_tier', sa.String(), nullable=False),
            sa.Column('referral_code', sa.String(), nullable=True),
            sa.Column('marketing_opt_in', sa.Boolean(), server_default=sa.false()),
            sa.Column('stripe_checkout_session_id', sa.String(), nullable=True),
            sa.Column('resulting_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )

    indexes = {ix['name'] for ix in inspector.get_indexes('pending_registrations')} if 'pending_registrations' in tables else set()
    if 'ix_pending_registrations_email' not in indexes:
        op.create_index('ix_pending_registrations_email', 'pending_registrations', ['email'])
    if 'ix_pending_registrations_stripe_checkout_session_id' not in indexes:
        op.create_index('ix_pending_registrations_stripe_checkout_session_id', 'pending_registrations', ['stripe_checkout_session_id'])


def downgrade() -> None:
    op.drop_table('pending_registrations')
