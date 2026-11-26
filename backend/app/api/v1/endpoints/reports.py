from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import User
from app.schemas.reports import (
    ProjectReportResponse,
    ReportsOptionsResponse,
    SprintReportResponse,
    TeamReportResponse,
)
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["Reports"])


def _not_found(error: LookupError) -> None:
    raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/options", response_model=ReportsOptionsResponse)
@limiter.limit("60/minute")
def get_report_options(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportsOptionsResponse:
    return ReportsOptionsResponse(
        **report_service.get_reports_options(db, current_user)
    )


@router.get("/projects/{project_id}", response_model=ProjectReportResponse)
@limiter.limit("60/minute")
def get_project_report(
    request: Request,
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectReportResponse:
    try:
        report = report_service.get_project_report(
            db,
            project_id=project_id,
            current_user=current_user,
        )
    except LookupError as error:
        _not_found(error)
    return ProjectReportResponse(**report)


@router.get("/teams/{team_id}", response_model=TeamReportResponse)
@limiter.limit("60/minute")
def get_team_report(
    request: Request,
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamReportResponse:
    try:
        report = report_service.get_team_report(
            db,
            team_id=team_id,
            current_user=current_user,
        )
    except LookupError as error:
        _not_found(error)
    return TeamReportResponse(**report)


@router.get("/sprints/{sprint_id}", response_model=SprintReportResponse)
@limiter.limit("60/minute")
def get_sprint_report(
    request: Request,
    sprint_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintReportResponse:
    try:
        report = report_service.get_sprint_report(
            db,
            sprint_id=sprint_id,
            current_user=current_user,
        )
    except LookupError as error:
        _not_found(error)
    return SprintReportResponse(**report)


@router.get("/{report_type}/{report_id}/export.csv")
@limiter.limit("20/minute")
def export_report_csv(
    request: Request,
    report_type: str,
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        filename, csv_content = report_service.build_report_csv(
            db,
            report_type=report_type,
            report_id=report_id,
            current_user=current_user,
        )
    except LookupError as error:
        _not_found(error)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
