"""add chat_conversations, chat_messages and ai_usage_events

Revision ID: 059
Revises: 058
Create Date: 2026-10-20 00:00:00.000000

chat_conversations / chat_messages store every chat-widget exchange (with any
lead data the visitor volunteered) for follow-up and response auditing.
ai_usage_events backs the per-visitor / per-account quotas on token-spending
endpoints (AI search, chatbot).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '059'
down_revision: Union[str, Sequence[str], None] = '058'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _indexes(inspector, table):
    return {ix['name'] for ix in inspector.get_indexes(table)}


def upgrade() -> None:
    # Inspector-guarded like the other recent migrations: create_table with
    # index=True already makes ix_<table>_<col>, so only explicit extras are
    # created separately, and only when missing.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'chat_conversations' not in tables:
        op.create_table(
            'chat_conversations',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('session_id', sa.String(length=64), nullable=False),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('ip_hash', sa.String(length=64), nullable=True),
            sa.Column('page_url', sa.String(), nullable=True),
            sa.Column('listing_id', sa.Integer(), sa.ForeignKey('listings.id', ondelete='SET NULL'), nullable=True),
            sa.Column('contact_name', sa.String(), nullable=True),
            sa.Column('contact_email', sa.String(), nullable=True),
            sa.Column('contact_phone', sa.String(), nullable=True),
            sa.Column('inquiry_id', sa.Integer(), sa.ForeignKey('inquiries.id', ondelete='SET NULL'), nullable=True),
            sa.Column('lead_captured_at', sa.DateTime(), nullable=True),
            sa.Column('message_count', sa.Integer(), server_default='0'),
            sa.Column('reviewed', sa.Boolean(), server_default=sa.false()),
            sa.Column('admin_notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('last_message_at', sa.DateTime(), nullable=True),
        )
        inspector = sa.inspect(bind)
    existing = _indexes(inspector, 'chat_conversations')
    for name, cols, unique in [
        ('ix_chat_conversations_session_id', ['session_id'], True),
        ('ix_chat_conversations_user_id', ['user_id'], False),
        ('ix_chat_conversations_ip_hash', ['ip_hash'], False),
        ('ix_chat_conversations_contact_email', ['contact_email'], False),
        ('ix_chat_conversations_created_at', ['created_at'], False),
        ('ix_chat_conversations_last_message_at', ['last_message_at'], False),
    ]:
        if name not in existing:
            op.create_index(name, 'chat_conversations', cols, unique=unique)

    if 'chat_messages' not in tables:
        op.create_table(
            'chat_messages',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('conversation_id', sa.Integer(), sa.ForeignKey('chat_conversations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('role', sa.String(length=20), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('intent', sa.String(length=30), nullable=True),
            sa.Column('result_refs', sa.JSON(), nullable=True),
            sa.Column('admin_rating', sa.Integer(), nullable=True),
            sa.Column('admin_note', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        inspector = sa.inspect(bind)
    if 'ix_chat_messages_conversation_id' not in _indexes(inspector, 'chat_messages'):
        op.create_index('ix_chat_messages_conversation_id', 'chat_messages', ['conversation_id'])

    if 'ai_usage_events' not in tables:
        op.create_table(
            'ai_usage_events',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('kind', sa.String(length=30), nullable=False),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('ip_hash', sa.String(length=64), nullable=True),
            sa.Column('visitor_id', sa.String(length=64), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        inspector = sa.inspect(bind)
    existing = _indexes(inspector, 'ai_usage_events')
    for name, col in [
        ('ix_ai_usage_events_kind', 'kind'),
        ('ix_ai_usage_events_user_id', 'user_id'),
        ('ix_ai_usage_events_ip_hash', 'ip_hash'),
        ('ix_ai_usage_events_visitor_id', 'visitor_id'),
        ('ix_ai_usage_events_created_at', 'created_at'),
    ]:
        if name not in existing:
            op.create_index(name, 'ai_usage_events', [col])


def downgrade() -> None:
    for table in ('ai_usage_events', 'chat_messages', 'chat_conversations'):
        op.drop_table(table)
