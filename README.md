# AgriBid WorkSphere

Internal project management and team collaboration platform.

**Assignment target date:** 27 November 2026

## Current implementation

The repository contains the integrated application work completed through Module 11 of the assignment.

### Frontend pages and workflows

- Sign-in, invitation acceptance, forgot-password, reset-password and change-password flows.
- Role-based dashboard for Admin, Project Manager, Developer and Tester.
- Admin user management: invitation creation/revocation, employee directory, employee details, role and team membership updates, account activation/deactivation.
- Team management: create, update, archive, manage members and team lead.
- Project management: create, update, archive, project membership, overview, activities and upcoming deadlines.
- Ticket management: create/detail/edit, role-controlled status transitions, Kanban board, list view, calendar view and backlog view.
- Ticket comments, replies, mentions and ticket activity history.
- Project and ticket attachments with validation, preview, download and permission-controlled deletion.
- Sprint and backlog management.
- Global search, ticket filters, sorting, pagination and shareable filter/view URLs.
- Project, team and sprint reports with authorized CSV export.

The Calendar view is available from Tasks at `/dashboard/tickets?view=calendar`. GitHub Activity and Settings navigation are intentionally not implemented in the current assignment scope.

### Backend

- FastAPI REST API with PostgreSQL and SQLAlchemy.
- Alembic database migrations.
- Invitation-only user onboarding and role-based access checks.
- Short-lived ID/access tokens and rotating refresh sessions stored in HttpOnly cookies.
- Ticket workflow validation and ticket activity records.
- Private file storage; PostgreSQL stores attachment metadata.
- Database-backed dashboards, search, sprint reports and analytics.

## Confirmed scope restrictions

Follow `docs/requirements/approved-scope-changes.md` as the authoritative senior-approved scope:

- Do not implement Notifications.
- Do not implement Automate Pro.
- Do not add public employee registration or Google/Apple sign-in.
- Do not claim real company email delivery.
- The header GitHub button links to the developer's personal GitHub profile.
- Application GitHub Enterprise integration uses mock data where specified; do not add live company OAuth/webhooks without separate approval.
- Production hosting and deployment are excluded.

## Technology stack

### Frontend

- Next.js App Router, React and TypeScript
- Tailwind CSS and shadcn/ui
- TanStack Query
- React Hook Form and Zod
- Lucide React and Motion

### Backend

- Python 3.11
- FastAPI and Pydantic
- SQLAlchemy and Alembic
- PostgreSQL
- PyJWT, Argon2 password hashing and SlowAPI rate limiting

Check `frontend/package.json`, `backend/requirements.txt` and the lockfiles for the installed versions. Design decisions are recorded in `docs/architecture/technology-decisions.md`.

## Local setup

### Prerequisites

- Node.js and npm
- Python 3.11
- PostgreSQL
- Git

### 1. Configure the backend

From the repository root:

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Edit `backend/.env` with your local PostgreSQL connection string and a generated local JWT secret. Keep `COOKIE_SECURE=false` for local HTTP development.

Apply migrations and start the API:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 2. Configure the frontend

In a second terminal from the repository root:

```powershell
Set-Location .\frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The frontend environment example includes the API URL and personal GitHub profile URL used by the header button. Never commit `.env`, `.env.local`, tokens, passwords, API keys or production credentials.

## Validation commands

Run from the repository root.

### Backend

```powershell
Push-Location .\backend
$backendPython = ".\.venv\Scripts\python.exe"

& $backendPython -m ruff check app tests
if ($LASTEXITCODE -ne 0) { throw "Backend lint failed." }

& $backendPython -m pytest -q
if ($LASTEXITCODE -ne 0) { throw "Backend tests failed." }

& $backendPython -m alembic current
Pop-Location
```

### Frontend

```powershell
Push-Location .\frontend

npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed." }

npm run lint
if ($LASTEXITCODE -ne 0) { throw "Frontend lint failed." }

npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }

Pop-Location
```

## Documentation

Start with:

1. `docs/requirements/project-overview.md`
2. `docs/requirements/software-requirements-specification.md`
3. `docs/requirements/approved-scope-changes.md`
4. `docs/requirements/confirmed-business-rules.md`
5. `docs/workflows/ticket-workflow.md`
6. `docs/architecture/system-architecture.md`
7. `docs/architecture/technical-design.md`
8. `docs/database/database-design.md`
9. `docs/api/api-specification.md`
10. `docs/testing/test-plan.md`
11. `docs/traceability/requirements-traceability-matrix.md`

## Verification status

Backend automated validation was last run after Module 11 and reported **115 tests passed** with two non-blocking deprecation warnings; Ruff passed. Frontend TypeScript, ESLint and production build passed on the feature branch before the last small Reports layout refinements. Those final refinements were then checked in the browser, including Project, Team and Sprint report views, CSV exports and role visibility. Re-run the validation commands above on merged `main` before the formal demonstration.

The current automated tests are not a substitute for a complete browser acceptance pass across all four roles. The test plan records known automated and manual evidence and remaining coverage gaps.

## Git workflow

See `CONTRIBUTING.md` for branch naming and commit conventions. The repository's `main` branch is the integrated source of truth.
