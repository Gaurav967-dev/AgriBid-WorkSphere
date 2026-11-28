"""add multi-project and multi-ticket assignment relationships

Revision ID: c91a6f3e2d40
Revises: f2b7c9d4e6a1
Create Date: 2026-11-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c91a6f3e2d40"
down_revision: str | Sequence[str] | None = "f2b7c9d4e6a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_project_managers",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("project_id", "user_id"),
    )
    op.create_table(
        "project_teams",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("project_id", "team_id"),
    )
    op.create_table(
        "ticket_assignees",
        sa.Column("ticket_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("ticket_id", "user_id"),
    )
    op.create_table(
        "ticket_reviewers",
        sa.Column("ticket_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("ticket_id", "user_id"),
    )
    op.create_table(
        "ticket_testers",
        sa.Column("ticket_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("ticket_id", "user_id"),
    )

    # Preserve all existing single assignments in the new association tables.
    op.execute(sa.text(
        "INSERT INTO project_project_managers (project_id, user_id) "
        "SELECT id, project_manager_id FROM projects "
        "WHERE project_manager_id IS NOT NULL"
    ))
    op.execute(sa.text(
        "INSERT INTO project_teams (project_id, team_id) "
        "SELECT id, team_id FROM projects WHERE team_id IS NOT NULL"
    ))
    op.execute(sa.text(
        "INSERT INTO ticket_assignees (ticket_id, user_id) "
        "SELECT id, assignee_id FROM tickets WHERE assignee_id IS NOT NULL"
    ))
    op.execute(sa.text(
        "INSERT INTO ticket_reviewers (ticket_id, user_id) "
        "SELECT id, reviewer_id FROM tickets WHERE reviewer_id IS NOT NULL"
    ))
    op.execute(sa.text(
        "INSERT INTO ticket_testers (ticket_id, user_id) "
        "SELECT id, tester_id FROM tickets WHERE tester_id IS NOT NULL"
    ))


def downgrade() -> None:
    op.drop_table("ticket_testers")
    op.drop_table("ticket_reviewers")
    op.drop_table("ticket_assignees")
    op.drop_table("project_teams")
    op.drop_table("project_project_managers")
