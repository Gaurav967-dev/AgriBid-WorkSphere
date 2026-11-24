"""apply confirmed ticket workflow and completion actor

Revision ID: d0a41b7c9e21
Revises: aca862017f0c
Create Date: 2026-11-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d0a41b7c9e21"
down_revision: str | Sequence[str] | None = "aca862017f0c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


STATUS_CHECK = (
    "status IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', "
    "'TESTING', 'TESTING_DONE', 'BUG_FIXED', 'COMPLETED', "
    "'BLOCKED', 'REOPENED', 'CANCELLED')"
)

LEGACY_STATUS_CHECK = (
    "status IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', "
    "'TESTING', 'TESTING_DONE', 'BUG_FIXED', 'DONE', 'COMPLETED', "
    "'BLOCKED', 'REOPENED', 'CANCELLED')"
)


def upgrade() -> None:
    # Preserve existing work while replacing the obsolete DONE key.
    op.execute(sa.text("UPDATE tickets SET status = 'COMPLETED' WHERE status = 'DONE'"))

    with op.batch_alter_table("tickets") as batch:
        batch.drop_constraint("ck_tickets_status", type_="check")
        batch.add_column(sa.Column("completed_by_user_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key(
            "fk_tickets_completed_by_user_id_users",
            "users",
            ["completed_by_user_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch.create_check_constraint("ck_tickets_status", STATUS_CHECK)


def downgrade() -> None:
    with op.batch_alter_table("tickets") as batch:
        batch.drop_constraint("ck_tickets_status", type_="check")
        batch.drop_constraint(
            "fk_tickets_completed_by_user_id_users",
            type_="foreignkey",
        )
        batch.drop_column("completed_by_user_id")
        batch.create_check_constraint(
            "ck_tickets_status",
            LEGACY_STATUS_CHECK,
        )
