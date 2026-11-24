"""add ticket comments and project-authorized mentions

Revision ID: 1f5c8a2d7b90
Revises: d0a41b7c9e21
Create Date: 2026-11-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "1f5c8a2d7b90"
down_revision: str | Sequence[str] | None = "d0a41b7c9e21"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ticket_comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("ticket_id", sa.Uuid(), nullable=False),
        sa.Column("author_user_id", sa.Uuid(), nullable=False),
        sa.Column("parent_comment_id", sa.Uuid(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            name="fk_ticket_comments_ticket_id_tickets",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["author_user_id"],
            ["users.id"],
            name="fk_ticket_comments_author_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["parent_comment_id"],
            ["ticket_comments.id"],
            name="fk_ticket_comments_parent_comment_id_ticket_comments",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ticket_comments"),
    )
    op.create_index("ix_ticket_comments_ticket_id", "ticket_comments", ["ticket_id"], unique=False)
    op.create_index(
        "ix_ticket_comments_author_user_id", "ticket_comments", ["author_user_id"], unique=False
    )
    op.create_index(
        "ix_ticket_comments_ticket_created",
        "ticket_comments",
        ["ticket_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_ticket_comments_parent", "ticket_comments", ["parent_comment_id"], unique=False
    )

    op.create_table(
        "ticket_comment_mentions",
        sa.Column("comment_id", sa.Uuid(), nullable=False),
        sa.Column("mentioned_user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["comment_id"],
            ["ticket_comments.id"],
            name="fk_ticket_comment_mentions_comment_id_ticket_comments",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["mentioned_user_id"],
            ["users.id"],
            name="fk_ticket_comment_mentions_mentioned_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "comment_id", "mentioned_user_id", name="pk_ticket_comment_mentions"
        ),
    )


def downgrade() -> None:
    op.drop_table("ticket_comment_mentions")
    op.drop_index("ix_ticket_comments_parent", table_name="ticket_comments")
    op.drop_index("ix_ticket_comments_ticket_created", table_name="ticket_comments")
    op.drop_index("ix_ticket_comments_author_user_id", table_name="ticket_comments")
    op.drop_index("ix_ticket_comments_ticket_id", table_name="ticket_comments")
    op.drop_table("ticket_comments")
