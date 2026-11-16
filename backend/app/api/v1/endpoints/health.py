from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import engine

router = APIRouter()


@router.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Check whether the API process is responding."""
    return {
        "status": "ok",
        "service": "agribid-worksphere-api",
    }


@router.get("/health/ready", tags=["Health"])
def readiness_check() -> dict[str, str]:
    """Check API readiness by verifying PostgreSQL connectivity."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database connection is unavailable.",
        ) from None

    return {
        "status": "ready",
        "database": "connected",
    }
