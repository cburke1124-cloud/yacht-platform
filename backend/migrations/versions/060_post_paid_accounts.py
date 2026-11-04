"""add users.billing_model and users.post_paid_rate

Revision ID: 060
Revises: 059
Create Date: 2026-11-04 00:00:00.000000

billing_model: "prepaid" (pays the flat signup fee — the default) or
"post_paid" (free upfront, pays a percentage of a sold listing when the lead
came from the site). Post-paid accounts are also always_free, so they behave
like any comped account; this column only labels them so sales and commission
tracking can be built on top later. post_paid_rate is that percentage.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '060'
down_revision: Union[str, Sequence[str], None] = '059'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {c['name'] for c in sa.inspect(bind).get_columns('users')}
    if 'billing_model' not in cols:
        op.add_column('users', sa.Column('billing_model', sa.String(length=20), nullable=False, server_default='prepaid'))
    if 'post_paid_rate' not in cols:
        op.add_column('users', sa.Column('post_paid_rate', sa.Float(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    cols = {c['name'] for c in sa.inspect(bind).get_columns('users')}
    if 'post_paid_rate' in cols:
        op.drop_column('users', 'post_paid_rate')
    if 'billing_model' in cols:
        op.drop_column('users', 'billing_model')
