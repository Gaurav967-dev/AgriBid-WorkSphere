from __future__ import annotations

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base


class Sprint(Base):
    """A time-boxed collection of tickets belonging to one project."""

    __tablename__ = "sprints"
    __table_args__ = (
        CheckConstraint(
            "end_date >= start_date",
            name="ck_sprints_valid_dates",
        ),
        CheckConstraint(
            "status IN ('PLANNED', 'ACTIVE', 'COMPLETED')",
            name="ck_sprints_status",
        ),
        Index("ix_sprints_project_status_start", "project_id", "status", "start_date"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        default="PLANNED",
        server_default=text("'PLANNED'"),
        nullable=False,
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project = relationship("Project")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    ticket_assignments: Mapped[list[SprintTicket]] = relationship(
        back_populates="sprint",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SprintTicket.added_at",
    )


class SprintTicket(Base):
    """A ticket's membership record in a sprint, including its close snapshot."""

    __tablename__ = "sprint_tickets"
    __table_args__ = (
        Index(
            "uq_sprint_tickets_active_ticket",
            "ticket_id",
            unique=True,
            postgresql_where=text("removed_at IS NULL"),
            sqlite_where=text("removed_at IS NULL"),
        ),
        Index(
            "ix_sprint_tickets_sprint_active",
            "sprint_id",
            "removed_at",
        ),
        Index(
            "ix_sprint_tickets_ticket_history",
            "ticket_id",
            "added_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    sprint_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("sprints.id", ondelete="CASCADE"),
        nullable=False,
    )
    ticket_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tickets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    added_by_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status_at_close: Mapped[str | None] = mapped_column(String(30), nullable=True)

    sprint: Mapped[Sprint] = relationship(back_populates="ticket_assignments")
    ticket = relationship("Ticket")
    added_by = relationship("User", foreign_keys=[added_by_user_id])
