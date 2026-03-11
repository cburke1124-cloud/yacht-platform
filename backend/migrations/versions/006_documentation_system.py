"""006 - Documentation management system

Adds: documentation table for admin-editable guides and documentation
"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    conn = op.get_bind()

    # Check if table exists first
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "documentation" not in existing_tables:
        # Create documentation table
        op.create_table(
            "documentation",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True, index=True),
            sa.Column("slug", sa.String(), nullable=False, unique=True, index=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.String()),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("category", sa.String(), default="general", index=True),
            sa.Column("audience", sa.String(), default="all"),
            sa.Column("order", sa.Integer(), default=0),
            sa.Column("published", sa.Boolean(), default=True, index=True),
            sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
            sa.Column("updated_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        )


def downgrade():
    op.drop_table("documentation")
