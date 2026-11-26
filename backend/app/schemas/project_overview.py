from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.dashboard import DashboardActivityResponse, DashboardDeadlineResponse


class ProjectTicketDistributionResponse(BaseModel):
    status: str
    count: int


class ProjectOverviewMemberResponse(BaseModel):
    user_id: UUID
    full_name: str
    email: str
    role_code: str
    joined_at: datetime


class ProjectOverviewResponse(BaseModel):
    project_id: UUID
    project_name: str
    project_key: str
    total_tickets: int
    completed_tickets: int
    completion_percentage: float
    ticket_distribution: list[ProjectTicketDistributionResponse] = Field(default_factory=list)
    team_members: list[ProjectOverviewMemberResponse] = Field(default_factory=list)
    recent_activities: list[DashboardActivityResponse] = Field(default_factory=list)
    upcoming_deadlines: list[DashboardDeadlineResponse] = Field(default_factory=list)
