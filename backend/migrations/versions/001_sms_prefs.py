"""add sms notification preferences

Revision ID: 001_sms_prefs
Revises: 
Create Date: 2026-03-01

"""
from alembic import op
import sqlalchemy as sa

revision = '001_sms_prefs'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use try/except per column so the migration is idempotent —
    # safe to run even if the column already exists.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = [c["name"] for c in inspector.get_columns("user_preferences")]

    if "sms_new_message" not in existing:
        op.add_column(
            "user_preferences",
            sa.Column("sms_new_message", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        )

    if "sms_new_inquiry" not in existing:
        op.add_column(
            "user_preferences",
            sa.Column("sms_new_inquiry", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        )


def downgrade() -> None:
    op.drop_column("user_preferences", "sms_new_inquiry")
    op.drop_column("user_preferences", "sms_new_message")
