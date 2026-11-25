from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base


class Attachment(Base):
    """Metadata for a private project- or ticket-level attachment."""

    __tablename__ = "attachments"
    __table_args__ = (
        CheckConstraint("file_size > 0", name="ck_attachments_positive_file_size"),
        CheckConstraint(
            "ticket_id IS NULL OR project_id IS NOT NULL",
            name="ck_attachments_ticket_requires_project",
        ),
        Index("ix_attachments_project_active", "project_id", "deleted_at"),
        Index("ix_attachments_ticket_active", "ticket_id", "deleted_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    ticket_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=True
    )
    uploaded_by_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    uploader = relationship("User", foreign_keys=[uploaded_by_user_id])
