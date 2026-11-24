from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base
from app.models.core import Project, User


class Ticket(Base):
    """Store a project ticket and its current workflow state."""

    __tablename__ = "tickets"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "number",
            name="uq_tickets_project_number",
        ),
        CheckConstraint(
            "due_date IS NULL OR start_date IS NULL OR due_date >= start_date",
            name="ck_tickets_valid_dates",
        ),
        CheckConstraint(
            "estimated_effort IS NULL OR estimated_effort >= 0",
            name="ck_tickets_nonnegative_effort",
        ),
        CheckConstraint(
            "type IN ('EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG', 'IMPROVEMENT', 'TECHNICAL_DEBT')",
            name="ck_tickets_type",
        ),
        CheckConstraint(
            "priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="ck_tickets_priority",
        ),
        CheckConstraint(
            "status IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', "
            "'TESTING', 'TESTING_DONE', 'BUG_FIXED', 'COMPLETED', "
            "'BLOCKED', 'REOPENED', 'CANCELLED')",
            name="ck_tickets_status",
        ),
        Index(
            "ix_tickets_project_status_updated",
            "project_id",
            "status",
            "updated_at",
        ),
        Index(
            "ix_tickets_assignee_status",
            "assignee_id",
            "status",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    project_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    ticket_key: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    type: Mapped[str] = mapped_column(
        String(30),
        default="TASK",
        server_default=text("'TASK'"),
        nullable=False,
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default="MEDIUM",
        server_default=text("'MEDIUM'"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="BACKLOG",
        server_default=text("'BACKLOG'"),
        nullable=False,
        index=True,
    )

    reporter_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assignee_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    reviewer_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    tester_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    estimated_effort: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    labels: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )

    parent_ticket_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tickets.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_by_user_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    project: Mapped[Project] = relationship("Project")

    reporter: Mapped[User] = relationship(
        "User",
        foreign_keys=[reporter_id],
    )
    assignee: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[assignee_id],
    )
    reviewer: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[reviewer_id],
    )
    tester: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[tester_id],
    )
    completed_by: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[completed_by_user_id],
    )

    parent: Mapped[Ticket | None] = relationship(
        "Ticket",
        remote_side=[id],
        foreign_keys=[parent_ticket_id],
    )

    activities: Mapped[list[TicketActivity]] = relationship(
        "TicketActivity",
        back_populates="ticket",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TicketActivity.created_at",
    )


class TicketActivity(Base):
    """Keep an immutable record of changes made to a ticket."""

    __tablename__ = "ticket_activities"
    __table_args__ = (
        Index(
            "ix_ticket_activities_ticket_created",
            "ticket_id",
            "created_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    ticket_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    action: Mapped[str] = mapped_column(String(50), nullable=False)
    field_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    old_value: Mapped[object | None] = mapped_column(JSON, nullable=True)
    new_value: Mapped[object | None] = mapped_column(JSON, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    ticket: Mapped[Ticket] = relationship(
        "Ticket",
        back_populates="activities",
    )

    actor: Mapped[User] = relationship(
        "User",
        foreign_keys=[actor_user_id],
    )
