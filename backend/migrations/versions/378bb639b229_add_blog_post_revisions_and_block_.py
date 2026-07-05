"""add blog post revisions and block editor columns

Revision ID: 378bb639b229
Revises: c3d8a2f5b1e6
Create Date: 2026-07-05 09:30:33.781347

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '378bb639b229'
down_revision: Union[str, Sequence[str], None] = 'c3d8a2f5b1e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('blog_posts', sa.Column('content_blocks', sa.Text(), nullable=True))
    op.add_column('blog_posts', sa.Column('content_html', sa.Text(), nullable=True))

    op.create_table(
        'blog_post_revisions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('editor_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('excerpt', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('content_blocks', sa.Text(), nullable=True),
        sa.Column('content_html', sa.Text(), nullable=True),
        sa.Column('featured_image', sa.String(length=500), nullable=True),
        sa.Column('featured_image_alt', sa.String(length=255), nullable=True),
        sa.Column('meta_title', sa.String(length=255), nullable=True),
        sa.Column('meta_description', sa.Text(), nullable=True),
        sa.Column('meta_keywords', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['editor_id'], ['users.id']),
        sa.ForeignKeyConstraint(['post_id'], ['blog_posts.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_blog_post_revisions_id'), 'blog_post_revisions', ['id'], unique=False)
    op.create_index(op.f('ix_blog_post_revisions_post_id'), 'blog_post_revisions', ['post_id'], unique=False)
    op.create_index(op.f('ix_blog_post_revisions_created_at'), 'blog_post_revisions', ['created_at'], unique=False)
    op.create_index('idx_revision_post_created', 'blog_post_revisions', ['post_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_revision_post_created', table_name='blog_post_revisions')
    op.drop_index(op.f('ix_blog_post_revisions_created_at'), table_name='blog_post_revisions')
    op.drop_index(op.f('ix_blog_post_revisions_post_id'), table_name='blog_post_revisions')
    op.drop_index(op.f('ix_blog_post_revisions_id'), table_name='blog_post_revisions')
    op.drop_table('blog_post_revisions')

    op.drop_column('blog_posts', 'content_html')
    op.drop_column('blog_posts', 'content_blocks')
