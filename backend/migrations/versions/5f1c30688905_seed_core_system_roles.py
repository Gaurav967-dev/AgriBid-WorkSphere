"""seed core system roles

Revision ID: 5f1c30688905
Revises: 67cf7d167068
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5f1c30688905"
down_revision: str | Sequence[str] | None = "67cf7d167068"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    roles_table = sa.table(
        "roles",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String(length=30)),
        sa.column("name", sa.String(length=60)),
        sa.column("description", sa.Text()),
    )

    op.bulk_insert(
        roles_table,
        [
            {
                "id": uuid.UUID("00000000-0000-4000-8000-000000000001"),
                "code": "ADMIN",
                "name": "Admin",
                "description": "System-wide administrator",
            },
            {
                "id": uuid.UUID("00000000-0000-4000-8000-000000000002"),
                "code": "PM",
                "name": "Project Manager",
                "description": "Manages assigned projects and project teams",
            },
            {
                "id": uuid.UUID("00000000-0000-4000-8000-000000000003"),
                "code": "DEVELOPER",
                "name": "Developer",
                "description": "Works on assigned development tickets",
            },
            {
                "id": uuid.UUID("00000000-0000-4000-8000-000000000004"),
                "code": "TESTER",
                "name": "Tester",
                "description": "Manages assigned testing activities",
            },
        ],
    )


def downgrade() -> None:
    roles_table = sa.table(
        "roles",
        sa.column("code", sa.String(length=30)),
    )

    op.execute(
        roles_table.delete().where(roles_table.c.code.in_(("ADMIN", "PM", "DEVELOPER", "TESTER")))
    )
