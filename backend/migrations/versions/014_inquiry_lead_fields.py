"""014 – Inquiry lead management fields

Adds:
  Table  : inquiries
  Columns: lead_stage, lead_score, notes, assigned_to_id, updated_at

These support the lead-pipeline dashboard (stage tracking, scoring, notes).
All ALTER TABLE statements use IF NOT EXISTS so they are idempotent.
"""

revision = "014_inquiry_lead_fields"
down_revision = "013_auth_tables"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def _column_exists(conn, table: str, column: str) -> bool:
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).fetchone()
    return row is not None


def upgrade():
    conn = op.get_bind()

    if not _column_exists(conn, "inquiries", "lead_stage"):
        conn.execute(sa.text(
            "ALTER TABLE inquiries ADD COLUMN lead_stage VARCHAR(50) DEFAULT 'new'"
        ))

    if not _column_exists(conn, "inquiries", "lead_score"):
        conn.execute(sa.text(
            "ALTER TABLE inquiries ADD COLUMN lead_score INTEGER DEFAULT 0"
        ))

    if not _column_exists(conn, "inquiries", "notes"):
        conn.execute(sa.text(
            "ALTER TABLE inquiries ADD COLUMN notes TEXT DEFAULT ''"
        ))

    if not _column_exists(conn, "inquiries", "assigned_to_id"):
        conn.execute(sa.text(
            "ALTER TABLE inquiries ADD COLUMN assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        ))

    if not _column_exists(conn, "inquiries", "updated_at"):
        conn.execute(sa.text(
            "ALTER TABLE inquiries ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()"
        ))


def downgrade():
    conn = op.get_bind()
    for col in ("lead_stage", "lead_score", "notes", "assigned_to_id", "updated_at"):
        if _column_exists(conn, "inquiries", col):
            conn.execute(sa.text(f"ALTER TABLE inquiries DROP COLUMN {col}"))
