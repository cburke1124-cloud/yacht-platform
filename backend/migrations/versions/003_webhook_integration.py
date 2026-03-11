"""003 - Webhook integration tables

Adds: webhook_configs and webhook_logs tables for direct DMS/CRM lead delivery
"""

revision = '003_webhook_integration'
down_revision = '002_inquiry_leads_expansion'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    conn = op.get_bind()

    # ── Check for existing webhook_configs table ──────────────────────────────
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'webhook_configs' not in existing_tables:
        conn.execute(sa.text("""
            CREATE TABLE webhook_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                webhook_url VARCHAR NOT NULL,
                format_type VARCHAR DEFAULT 'json',
                auth_type VARCHAR DEFAULT 'none',
                auth_token VARCHAR,
                enabled BOOLEAN DEFAULT 1,
                test_passed BOOLEAN DEFAULT 0,
                last_webhook_sent TIMESTAMP,
                total_webhooks_sent INTEGER DEFAULT 0,
                webhook_failures INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """))
        conn.execute(sa.text("CREATE INDEX idx_webhook_configs_user ON webhook_configs(user_id)"))

    if 'webhook_logs' not in existing_tables:
        conn.execute(sa.text("""
            CREATE TABLE webhook_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                webhook_config_id INTEGER NOT NULL,
                inquiry_id INTEGER NOT NULL,
                status_code INTEGER,
                success BOOLEAN DEFAULT 0,
                error_message TEXT,
                payload JSON,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                retry_count INTEGER DEFAULT 0,
                FOREIGN KEY (webhook_config_id) REFERENCES webhook_configs(id) ON DELETE CASCADE,
                FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
            )
        """))
        conn.execute(sa.text("CREATE INDEX idx_webhook_logs_config ON webhook_logs(webhook_config_id)"))
        conn.execute(sa.text("CREATE INDEX idx_webhook_logs_inquiry ON webhook_logs(inquiry_id)"))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS webhook_logs"))
    conn.execute(sa.text("DROP TABLE IF EXISTS webhook_configs"))
