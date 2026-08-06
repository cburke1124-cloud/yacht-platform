"""add commission_payouts table and referral_signups.payout_id

Revision ID: 056
Revises: 055
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '056'
down_revision: Union[str, Sequence[str], None] = '055'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'commission_payouts' not in tables:
        op.create_table(
            'commission_payouts',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('sales_rep_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('amount', sa.Float(), nullable=False),
            sa.Column('referral_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('paid_by_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('paid_at', sa.DateTime(), nullable=True),
        )

    inspector = sa.inspect(bind)
    payout_indexes = {ix['name'] for ix in inspector.get_indexes('commission_payouts')}
    if 'ix_commission_payouts_sales_rep_id' not in payout_indexes:
        op.create_index('ix_commission_payouts_sales_rep_id', 'commission_payouts', ['sales_rep_id'])

    referral_columns = {c['name'] for c in inspector.get_columns('referral_signups')}
    if 'payout_id' not in referral_columns:
        op.add_column('referral_signups', sa.Column('payout_id', sa.Integer(), sa.ForeignKey('commission_payouts.id'), nullable=True))

    inspector = sa.inspect(bind)  # refresh after add_column
    referral_indexes = {ix['name'] for ix in inspector.get_indexes('referral_signups')}
    if 'ix_referral_signups_payout_id' not in referral_indexes:
        op.create_index('ix_referral_signups_payout_id', 'referral_signups', ['payout_id'])


def downgrade() -> None:
    op.drop_index('ix_referral_signups_payout_id', table_name='referral_signups')
    op.drop_column('referral_signups', 'payout_id')
    op.drop_index('ix_commission_payouts_sales_rep_id', table_name='commission_payouts')
    op.drop_table('commission_payouts')
