from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class TeamCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    lead_user_id: UUID | None = None
    member_ids: list[UUID] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        name = " ".join(value.split())
        if not name:
            raise ValueError("Team name is required.")
        return name

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("member_ids")
    @classmethod
    def validate_member_ids(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate member IDs are not allowed.")
        return value


class TeamUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = " ".join(value.split())
        if not name:
            raise ValueError("Team name cannot be empty.")
        return name

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class TeamMemberAddRequest(BaseModel):
    user_id: UUID
    designation: str | None = Field(default=None, max_length=100)

    @field_validator("designation")
    @classmethod
    def normalize_designation(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class TeamLeadUpdateRequest(BaseModel):
    user_id: UUID | None


class TeamUserSummaryResponse(BaseModel):
    id: UUID
    full_name: str
    email: str
    role_code: str
    employee_id: str | None


class TeamMemberResponse(BaseModel):
    id: UUID
    user: TeamUserSummaryResponse
    designation: str | None
    joined_at: datetime


class TeamSummaryResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    status: str
    lead: TeamUserSummaryResponse | None
    member_count: int
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
    is_joined: bool
    members_preview: list[TeamUserSummaryResponse]


class TeamDetailsResponse(TeamSummaryResponse):
    members: list[TeamMemberResponse]


class TeamListResponse(BaseModel):
    items: list[TeamSummaryResponse]
    total: int
    page: int
    page_size: int


class TeamMemberRemoveResponse(BaseModel):
    message: str
    team_id: UUID
    user_id: UUID
    removed_at: datetime
