from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class SearchProjectResult(BaseModel):
    id: UUID
    name: str
    key: str
    status: str


class SearchTicketResult(BaseModel):
    id: UUID
    ticket_key: str
    title: str
    status: str
    priority: str
    project_id: UUID
    project_name: str
    project_key: str


class SearchUserResult(BaseModel):
    id: UUID
    full_name: str
    email: str
    role_code: str


class SearchTeamResult(BaseModel):
    id: UUID
    name: str


class GlobalSearchResponse(BaseModel):
    projects: list[SearchProjectResult] = Field(default_factory=list)
    tickets: list[SearchTicketResult] = Field(default_factory=list)
    users: list[SearchUserResult] = Field(default_factory=list)
    teams: list[SearchTeamResult] = Field(default_factory=list)
