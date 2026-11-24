from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

TicketType = Literal[
    "EPIC",
    "STORY",
    "TASK",
    "SUBTASK",
    "BUG",
    "IMPROVEMENT",
    "TECHNICAL_DEBT",
]

TicketPriority = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

TicketStatus = Literal[
    "BACKLOG",
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "TESTING",
    "TESTING_DONE",
    "BUG_FIXED",
    "COMPLETED",
    "BLOCKED",
    "REOPENED",
    "CANCELLED",
]


class TicketCreateRequest(BaseModel):
    project_id: UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)

    type: TicketType = "TASK"
    priority: TicketPriority = "MEDIUM"

    assignee_id: UUID | None = None
    reviewer_id: UUID | None = None
    tester_id: UUID | None = None

    start_date: date | None = None
    due_date: date | None = None
    estimated_effort: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)

    labels: list[str] = Field(default_factory=list, max_length=20)
    parent_ticket_id: UUID | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        title = " ".join(value.split())
        if not title:
            raise ValueError("Ticket title is required.")
        return title

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("labels")
    @classmethod
    def normalize_labels(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()

        for label in value:
            item = " ".join(label.split())

            if not item:
                continue

            if len(item) > 40:
                raise ValueError("Each ticket label must be at most 40 characters.")

            key = item.casefold()
            if key not in seen:
                normalized.append(item)
                seen.add(key)

        return normalized

    @model_validator(mode="after")
    def validate_dates(self) -> TicketCreateRequest:
        if (
            self.start_date is not None
            and self.due_date is not None
            and self.due_date < self.start_date
        ):
            raise ValueError("Ticket due date cannot be before its start date.")

        return self


class TicketUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)

    type: TicketType | None = None
    priority: TicketPriority | None = None

    assignee_id: UUID | None = None
    reviewer_id: UUID | None = None
    tester_id: UUID | None = None

    start_date: date | None = None
    due_date: date | None = None
    estimated_effort: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=10,
        decimal_places=2,
    )

    labels: list[str] | None = Field(default=None, max_length=20)
    parent_ticket_id: UUID | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None

        title = " ".join(value.split())
        if not title:
            raise ValueError("Ticket title cannot be empty.")

        return title

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("labels")
    @classmethod
    def normalize_labels(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None

        normalized: list[str] = []
        seen: set[str] = set()

        for label in value:
            item = " ".join(label.split())

            if not item:
                continue

            if len(item) > 40:
                raise ValueError("Each ticket label must be at most 40 characters.")

            key = item.casefold()
            if key not in seen:
                normalized.append(item)
                seen.add(key)

        return normalized

    @model_validator(mode="after")
    def validate_dates(self) -> TicketUpdateRequest:
        if (
            self.start_date is not None
            and self.due_date is not None
            and self.due_date < self.start_date
        ):
            raise ValueError("Ticket due date cannot be before its start date.")

        return self


class TicketStatusUpdateRequest(BaseModel):
    status: TicketStatus
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class TicketUserSummaryResponse(BaseModel):
    id: UUID
    full_name: str
    email: str
    role_code: str


class TicketProjectSummaryResponse(BaseModel):
    id: UUID
    name: str
    key: str


class TicketResponse(BaseModel):
    id: UUID
    project: TicketProjectSummaryResponse
    number: int
    ticket_key: str

    title: str
    description: str | None

    type: TicketType
    priority: TicketPriority
    status: TicketStatus

    reporter: TicketUserSummaryResponse
    assignee: TicketUserSummaryResponse | None
    reviewer: TicketUserSummaryResponse | None
    tester: TicketUserSummaryResponse | None

    start_date: date | None
    due_date: date | None
    estimated_effort: Decimal | None
    labels: list[str]
    parent_ticket_id: UUID | None

    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    completed_by: TicketUserSummaryResponse | None


class TicketActivityResponse(BaseModel):
    id: UUID
    actor: TicketUserSummaryResponse
    action: str
    field_name: str | None
    old_value: object | None
    new_value: object | None
    description: str | None
    created_at: datetime


class TicketDetailsResponse(TicketResponse):
    activities: list[TicketActivityResponse] = Field(default_factory=list)


class TicketListResponse(BaseModel):
    items: list[TicketResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TicketDeleteResponse(BaseModel):
    message: str
    ticket_id: UUID
    deleted_at: datetime
