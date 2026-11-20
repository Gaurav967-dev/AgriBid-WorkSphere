from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

DashboardRole = Literal["ADMIN", "PM", "DEVELOPER", "TESTER"]


class DashboardMetricResponse(BaseModel):
    key: str
    title: str
    value: int
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


class DashboardResponse(BaseModel):
    role_code: DashboardRole
    metrics: list[DashboardMetricResponse]
    projects: list[DashboardProjectResponse]
    team_project_distribution: list[TeamProjectDistributionResponse]
