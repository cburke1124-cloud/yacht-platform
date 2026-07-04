"""add indexes on team_members.dealer_id and team_members.user_id

Revision ID: c3d8a2f5b1e6
Revises: b2c9f1a7e3d4
Create Date: 2026-07-04 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c3d8a2f5b1e6'
down_revision: Union[str, Sequence[str], None] = 'b2c9f1a7e3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(op.f('ix_team_members_dealer_id'), 'team_members', ['dealer_id'], unique=False)
    op.create_index(op.f('ix_team_members_user_id'), 'team_members', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_team_members_user_id'), table_name='team_members')
    op.drop_index(op.f('ix_team_members_dealer_id'), table_name='team_members')
