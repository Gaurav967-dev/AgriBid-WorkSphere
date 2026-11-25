from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AttachmentUploaderResponse(BaseModel):
    id: UUID
    full_name: str
    email: str


class AttachmentResponse(BaseModel):
    id: UUID
    project_id: UUID
    ticket_id: UUID | None
    original_filename: str
    file_size: int
    mime_type: str
    uploaded_by: AttachmentUploaderResponse
    uploaded_at: datetime


class AttachmentListResponse(BaseModel):
    items: list[AttachmentResponse]
