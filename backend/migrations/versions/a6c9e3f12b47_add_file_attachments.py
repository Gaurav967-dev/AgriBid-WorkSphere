"""add project and ticket file attachments

Revision ID: a6c9e3f12b47
Revises: 1f5c8a2d7b90
Create Date: 2026-11-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a6c9e3f12b47"
down_revision: str | Sequence[str] | None = "1f5c8a2d7b90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attachments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("ticket_id", sa.Uuid(), nullable=True),
        sa.Column("uploaded_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column(
            "uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("file_size > 0", name="ck_attachments_positive_file_size"),
        sa.CheckConstraint(
            "ticket_id IS NULL OR project_id IS NOT NULL",
            name="ck_attachments_ticket_requires_project",
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index("ix_attachments_project_active", "attachments", ["project_id", "deleted_at"])
    op.create_index("ix_attachments_ticket_active", "attachments", ["ticket_id", "deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_attachments_ticket_active", table_name="attachments")
    op.drop_index("ix_attachments_project_active", table_name="attachments")
    op.drop_table("attachments")
