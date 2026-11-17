from __future__ import annotations

import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import AuthUserResponse

RoleCode = Literal["ADMIN", "PM", "DEVELOPER", "TESTER"]

InvitationStatus = Literal["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]


class InvitationCreateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=320)
    employee_id: str | None = Field(default=None, max_length=50)
    role_code: RoleCode
    team_ids: list[UUID] = Field(default_factory=list)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        full_name = " ".join(value.split())

        if not full_name:
            raise ValueError("Full name is required.")

        return full_name

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()

        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ValueError("Enter a valid email address.")

        return email

    @field_validator("employee_id")
    @classmethod
    def normalize_employee_id(cls, value: str | None) -> str | None:
        if value is None:
            return None

        employee_id = value.strip()
        return employee_id or None

    @field_validator("team_ids")
    @classmethod
    def validate_unique_team_ids(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate team IDs are not allowed.")

        return value


class InvitationAcceptRequest(BaseModel):
    token: str = Field(min_length=32, max_length=512)
    password: str = Field(min_length=1, max_length=1024)


class InvitationTeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class InvitationDetailsResponse(BaseModel):
    id: UUID
    full_name: str
    email: str
    employee_id: str | None
    role_code: str
    role_name: str
    teams: list[InvitationTeamResponse]

    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None

    status: InvitationStatus


class InvitationCreatedResponse(InvitationDetailsResponse):
    invitation_url: str


class InvitationListResponse(BaseModel):
    items: list[InvitationDetailsResponse]
    total: int
    page: int
    page_size: int


class InvitationAcceptResponse(BaseModel):
    message: str
    user: AuthUserResponse


class InvitationRevokeResponse(BaseModel):
    message: str
    invitation_id: UUID
    revoked_at: datetime
