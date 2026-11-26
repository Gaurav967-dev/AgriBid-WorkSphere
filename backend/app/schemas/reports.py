from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ReportProjectOption(BaseModel):
    id: UUID
    name: str
    key: str
    status: str


class ReportTeamOption(BaseModel):
    id: UUID
    name: str
    project_count: int


class ReportSprintOption(BaseModel):
    id: UUID
    project_id: UUID
    project_key: str
    name: str
    status: str
    start_date: date
    end_date: date


class ReportsOptionsResponse(BaseModel):
    projects: list[ReportProjectOption] = Field(default_factory=list)
    teams: list[ReportTeamOption] = Field(default_factory=list)
    sprints: list[ReportSprintOption] = Field(default_factory=list)


class ReportBucket(BaseModel):
    key: str
    label: str
    count: int


class ProjectReportResponse(BaseModel):
    project_id: UUID
    project_name: str
    project_key: str
    project_status: str
    team_name: str
    total_tickets: int
    completed_tickets: int
    pending_tickets: int
    overdue_tickets: int
    completion_percentage: float
    tickets_by_priority: list[ReportBucket]
    tickets_by_status: list[ReportBucket]
    tickets_by_type: list[ReportBucket]


class TeamMemberWorkloadResponse(BaseModel):
    user_id: UUID
    full_name: str
    role_code: str
    assigned_tickets: int
    completed_tickets: int
    pending_tickets: int
    overdue_tickets: int
    in_progress_tickets: int
    completion_percentage: float


class TeamReportResponse(BaseModel):
    team_id: UUID
    team_name: str
    project_count: int
    total_assigned_tickets: int
    completed_tickets: int
    pending_tickets: int
    overdue_tickets: int
    completion_percentage: float
    workload_by_member: list[TeamMemberWorkloadResponse]
    tickets_by_status: list[ReportBucket]
    interpretation_note: str


class SprintScopeChangeResponse(BaseModel):
    ticket_id: UUID
    ticket_key: str
    title: str
    change_type: Literal["ADDED_AFTER_START", "REMOVED_AFTER_START"]
    occurred_at: datetime


class SprintReportTicketResponse(BaseModel):
    ticket_id: UUID
    ticket_key: str
    title: str
    status: str
    priority: str
    type: str
    assignee_name: str | None
    added_at: datetime


class SprintReportResponse(BaseModel):
    sprint_id: UUID
    sprint_name: str
    project_id: UUID
    project_name: str
    project_key: str
    sprint_status: str
    start_date: date
    end_date: date
    started_at: datetime | None
    completed_at: datetime | None
    total_tickets: int
    completed_work: int
    incomplete_work: int
    cancelled_work: int
    completion_rate: float
    tickets_added_after_start: int
    tickets_removed_after_start: int
    scope_change_count: int
    tickets: list[SprintReportTicketResponse]
    scope_changes: list[SprintScopeChangeResponse]
