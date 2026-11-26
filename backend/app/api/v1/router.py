from fastapi import APIRouter

from app.api.v1.endpoints.attachments import router as attachments_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.projects import router as projects_router
from app.api.v1.endpoints.search import router as search_router
from app.api.v1.endpoints.sprints import router as sprints_router
from app.api.v1.endpoints.teams import router as teams_router
from app.api.v1.endpoints.tickets import router as tickets_router
from app.api.v1.endpoints.users import router as users_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(attachments_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(teams_router)
api_router.include_router(projects_router)
api_router.include_router(sprints_router)
api_router.include_router(search_router)
api_router.include_router(tickets_router)
api_router.include_router(dashboard_router)
