from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

DashboardRole = Literal["ADMIN", "PM", "DEVELOPER", "TESTER"]


class DashboardMetricResponse(BaseModel):
    key: str
    title: str
    value: int | float
    description: str


class DashboardProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    key: str
    status: str
    start_date: date | None
    end_date: date | None
    created_at: datetime
    updated_at: datetime
    team_name: str
    project_manager_name: str
    member_count: int


class TeamProjectDistributionResponse(BaseModel):
    team_id: UUID
    team_name: str
    project_count: int


class DashboardActivityResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    ticket_key: str
    ticket_title: str
    project_id: UUID
    project_name: str
    actor_name: str
    action: str
    description: str | None
    created_at: datetime


class DashboardDeadlineResponse(BaseModel):
    ticket_id: UUID
    ticket_key: str
    title: str
    project_id: UUID
    project_name: str
    due_date: date
    status: str
    priority: str
    assignee_name: str | None
    tester_name: str | None


class DashboardTeamWorkloadResponse(BaseModel):
    team_id: UUID
    team_name: str
    project_count: int
    open_tickets: int
    overdue_tickets: int


class DashboardResponse(BaseModel):
    role_code: DashboardRole
    metrics: list[DashboardMetricResponse]
    projects: list[DashboardProjectResponse]
    team_project_distribution: list[TeamProjectDistributionResponse]
    recent_activities: list[DashboardActivityResponse] = Field(default_factory=list)
    upcoming_deadlines: list[DashboardDeadlineResponse] = Field(default_factory=list)
    team_workload: list[DashboardTeamWorkloadResponse] = Field(default_factory=list)
