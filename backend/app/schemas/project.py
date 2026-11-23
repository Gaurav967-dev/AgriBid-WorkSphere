from __future__ import annotations

import re
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

ProjectStatus = Literal[
    "PLANNING",
    "ACTIVE",
    "ON_HOLD",
    "COMPLETED",
    "ARCHIVED",
]


class ProjectCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    key: str = Field(min_length=2, max_length=20)
    description: str | None = Field(default=None, max_length=5000)
    logo_key: str | None = Field(default=None, max_length=500)
    project_manager_id: UUID
    team_id: UUID
    start_date: date | None = None
    end_date: date | None = None
    status: ProjectStatus = "PLANNING"
    visibility: str = Field(default="INTERNAL", min_length=1, max_length=30)
    member_ids: list[UUID] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        name = " ".join(value.split())
        if not name:
            raise ValueError("Project name is required.")
        return name

    @field_validator("key")
    @classmethod
    def normalize_key(cls, value: str) -> str:
        key = value.strip().upper()
        if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,19}", key):
            raise ValueError(
                "Project key must start with a letter and contain "
                "2–20 uppercase letters, numbers or underscores."
            )
        return key

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("logo_key")
    @classmethod
    def normalize_logo_key(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("visibility")
    @classmethod
    def normalize_visibility(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Project visibility is required.")
        return normalized

    @field_validator("member_ids")
    @classmethod
    def validate_member_ids(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate project member IDs are not allowed.")
        return value

    @model_validator(mode="after")
    def validate_dates(self) -> ProjectCreateRequest:
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("Project end date cannot be before start date.")
        return self


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    key: str | None = Field(default=None, min_length=2, max_length=20)
    description: str | None = Field(default=None, max_length=5000)
    logo_key: str | None = Field(default=None, max_length=500)
    project_manager_id: UUID | None = None
    team_id: UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: ProjectStatus | None = None
    visibility: str | None = Field(default=None, max_length=30)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = " ".join(value.split())
        if not name:
            raise ValueError("Project name cannot be empty.")
        return name

    @field_validator("key")
    @classmethod
    def normalize_key(cls, value: str | None) -> str | None:
        if value is None:
            return None
        key = value.strip().upper()
        if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,19}", key):
            raise ValueError(
                "Project key must start with a letter and contain "
                "2–20 uppercase letters, numbers or underscores."
            )
        return key

    @field_validator("description", "logo_key")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("visibility")
    @classmethod
    def normalize_visibility(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Project visibility cannot be empty.")
        return normalized

    @model_validator(mode="after")
    def validate_dates(self) -> ProjectUpdateRequest:
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("Project end date cannot be before start date.")
        return self


class ProjectMemberAddRequest(BaseModel):
    user_id: UUID


class ProjectUserSummaryResponse(BaseModel):
    id: UUID
    full_name: str
    email: str
    role_code: str
    employee_id: str | None


class ProjectTeamSummaryResponse(BaseModel):
    id: UUID
    name: str


class ProjectOptionsResponse(BaseModel):
    teams: list[ProjectTeamSummaryResponse]
    project_managers: list[ProjectUserSummaryResponse]
    team_members: list[ProjectUserSummaryResponse]


class ProjectMemberResponse(BaseModel):
    id: UUID
    user: ProjectUserSummaryResponse
    joined_at: datetime


class ProjectSummaryResponse(BaseModel):
    id: UUID
    name: str
    key: str
    description: str | None
    logo_key: str | None
    project_manager: ProjectUserSummaryResponse
    team: ProjectTeamSummaryResponse
    start_date: date | None
    end_date: date | None
    status: ProjectStatus
    visibility: str
    member_count: int
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class ProjectDetailsResponse(ProjectSummaryResponse):
    members: list[ProjectMemberResponse]


class ProjectListResponse(BaseModel):
    items: list[ProjectSummaryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ProjectMemberRemoveResponse(BaseModel):
    message: str
    project_id: UUID
    user_id: UUID
    removed_at: datetime
