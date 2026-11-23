from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: str
    employee_id: str | None
    role_code: str
    role_name: str
    is_active: bool


class UserListResponse(BaseModel):
    items: list[UserSummaryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
