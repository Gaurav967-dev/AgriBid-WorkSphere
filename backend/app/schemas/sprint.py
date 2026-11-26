from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

SprintStatus = Literal["PLANNED", "ACTIVE", "COMPLETED"]


class SprintCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    goal: str = Field(min_length=1, max_length=2000)
    start_date: date
    end_date: date

    @field_validator("name", "goal")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("This field is required.")
        return normalized

    @model_validator(mode="after")
    def validate_dates(self) -> SprintCreateRequest:
        if self.end_date < self.start_date:
            raise ValueError("Sprint end date cannot be before its start date.")
        return self


class SprintUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    goal: str | None = Field(default=None, min_length=1, max_length=2000)
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("name", "goal")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("This field cannot be empty.")
        return normalized


class SprintTicketAddRequest(BaseModel):
    ticket_ids: list[UUID] = Field(min_length=1, max_length=100)

    @field_validator("ticket_ids")
    @classmethod
    def unique_ticket_ids(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("A ticket can only be selected once in a request.")
        return value


class SprintTicketResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    ticket_key: str
    title: str
    type: str
    priority: str
    status: str
    assignee_name: str | None
    due_date: date | None
    added_at: datetime
    status_at_close: str | None = None


class SprintResponse(BaseModel):
    id: UUID
    project_id: UUID
    project_name: str
    project_key: str
    name: str
    goal: str
    start_date: date
    end_date: date
    status: SprintStatus
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    assigned_tickets: int
    completed_tickets: int
    pending_tickets: int
    completion_percentage: float
    tickets: list[SprintTicketResponse] = Field(default_factory=list)


class SprintListResponse(BaseModel):
    items: list[SprintResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SprintBacklogTicketResponse(BaseModel):
    id: UUID
    ticket_key: str
    title: str
    type: str
    priority: str
    status: str
    assignee_name: str | None
    due_date: date | None


class SprintBacklogResponse(BaseModel):
    items: list[SprintBacklogTicketResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SprintDeleteTicketResponse(BaseModel):
    message: str
    sprint_id: UUID
    ticket_id: UUID
