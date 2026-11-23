from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import get_dashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    return DashboardResponse(
        **get_dashboard(
            db=db,
            current_user=current_user,
        )
    )
