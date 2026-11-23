# AgriBid WorkSphere Backend

FastAPI REST API for AgriBid WorkSphere.

## Requirements

- Python 3.11
- PostgreSQL
- pip

## Environment setup

Run these commands from the backend directory:

    python -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
    Copy-Item .env.example .env

Edit `.env` and configure the PostgreSQL connection and required application settings using `.env.example` as a reference.

Never commit `.env` or files containing secrets.

## Database migrations

The project uses SQLAlchemy for ORM and database session management, and Alembic for database migrations.

After configuring the database connection, apply the migrations:

    .\.venv\Scripts\python.exe -m alembic upgrade head

Check the current migration revision:

    .\.venv\Scripts\python.exe -m alembic current

Migration files are maintained in `migrations/versions/`.

## Start the development server

Run from the backend directory:

    .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload

API root: `http://127.0.0.1:8000/`

Swagger documentation: `http://127.0.0.1:8000/docs`

## API endpoints

### Health

- `GET /api/v1/health` - API liveness.
- `GET /api/v1/health/ready` - PostgreSQL connectivity readiness.

### Authentication

- `POST /api/v1/auth/sign` - Sign in.
- `GET /api/v1/auth/id-token/verify` - Verify the ID-token flow.
- `GET /api/v1/auth/verify-token` - Verify the access token.
- `POST /api/v1/auth/refresh-token` - Refresh authentication tokens.
- `POST /api/v1/auth/refresh-token/logout` - Revoke the refresh-token session.
- `POST /api/v1/auth/logout` - Sign out.

Account creation is invitation-only. Public sign-up is not part of the current scope.

## Run tests

    .\.venv\Scripts\python.exe -m pytest

## Code quality

    .\.venv\Scripts\ruff.exe check .
    .\.venv\Scripts\ruff.exe format --check .

## Project structure

- `app/api/` - API routers, endpoints, and dependencies.
- `app/core/` - Configuration, database setup, security, and shared infrastructure.
- `app/integrations/` - External integration package.
- `app/models/` - SQLAlchemy database models.
- `app/repositories/` - Repository layer package for data-access operations.
- `app/schemas/` - Request and response schemas.
- `app/services/` - Business and authentication services.
- `migrations/` - Alembic configuration and migration scripts.
- `scripts/` - Administrative and verification scripts.
- `tests/` - Backend automated tests.
