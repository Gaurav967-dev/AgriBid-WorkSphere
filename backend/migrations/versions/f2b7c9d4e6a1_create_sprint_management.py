"""create sprint and sprint ticket management tables

Revision ID: f2b7c9d4e6a1
Revises: a6c9e3f12b47
Create Date: 2026-11-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2b7c9d4e6a1"
down_revision: str | Sequence[str] | None = "a6c9e3f12b47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sprints",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'PLANNED'"),
            nullable=False,
        ),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("end_date >= start_date", name="ck_sprints_valid_dates"),
        sa.CheckConstraint(
            "status IN ('PLANNED', 'ACTIVE', 'COMPLETED')",
            name="ck_sprints_status",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sprints_project_id", "sprints", ["project_id"], unique=False)
    op.create_index(
        "ix_sprints_project_status_start",
        "sprints",
        ["project_id", "status", "start_date"],
        unique=False,
    )

    op.create_table(
        "sprint_tickets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sprint_id", sa.Uuid(), nullable=False),
        sa.Column("ticket_id", sa.Uuid(), nullable=False),
        sa.Column("added_by_user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status_at_close", sa.String(length=30), nullable=True),
        sa.ForeignKeyConstraint(
            ["sprint_id"], ["sprints.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"], ["tickets.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["added_by_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_sprint_tickets_active_ticket",
        "sprint_tickets",
        ["ticket_id"],
        unique=True,
        postgresql_where=sa.text("removed_at IS NULL"),
        sqlite_where=sa.text("removed_at IS NULL"),
    )
    op.create_index(
        "ix_sprint_tickets_sprint_active",
        "sprint_tickets",
        ["sprint_id", "removed_at"],
        unique=False,
    )
    op.create_index(
        "ix_sprint_tickets_ticket_history",
        "sprint_tickets",
        ["ticket_id", "added_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_sprint_tickets_ticket_history", table_name="sprint_tickets")
    op.drop_index("ix_sprint_tickets_sprint_active", table_name="sprint_tickets")
    op.drop_index("uq_sprint_tickets_active_ticket", table_name="sprint_tickets")
    op.drop_table("sprint_tickets")

    op.drop_index("ix_sprints_project_status_start", table_name="sprints")
    op.drop_index("ix_sprints_project_id", table_name="sprints")
    op.drop_table("sprints")
