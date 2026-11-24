from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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


class UserManagementTeamResponse(BaseModel):
    id: UUID
    name: str


class UserManagementRecordResponse(BaseModel):
    """One employee account or one unaccepted invitation in the admin directory."""

    id: UUID
    record_type: Literal["EMPLOYEE", "INVITATION"]
    user_id: UUID | None = None
    invitation_id: UUID | None = None
    full_name: str
    email: str
    profile_image_key: str | None = None
    employee_id: str | None = None
    role_code: str
    role_name: str
    teams: list[UserManagementTeamResponse]
    account_status: Literal["ACTIVE", "INACTIVE", "PENDING", "REVOKED", "EXPIRED"]
    created_at: datetime
    last_login_at: datetime | None = None
    expires_at: datetime | None = None


class UserManagementListResponse(BaseModel):
    items: list[UserManagementRecordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class UserTeamSummaryResponse(BaseModel):
    id: UUID
    name: str


class UserDetailResponse(UserSummaryResponse):
    profile_image_key: str | None = None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None
    deactivated_at: datetime | None = None
    teams: list[UserTeamSummaryResponse] = Field(default_factory=list)


class UserUpdateRequest(BaseModel):
    """Admin-editable employee fields. Email and password remain immutable."""

    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    employee_id: str | None = Field(default=None, max_length=50)
    role_code: str | None = Field(default=None, min_length=1, max_length=30)
    team_ids: list[UUID] | None = None


class UserStatusUpdateRequest(BaseModel):
    is_active: bool
