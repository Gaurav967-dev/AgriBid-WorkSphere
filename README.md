# AgriBid WorkSphere

Internal project management and team collaboration platform.

AgriBid WorkSphere is being developed to manage employees, teams, projects, tickets, development workflows, testing activities, documents, sprints, dashboards and development activity.

## Project deadline

**27 November 2026**

## Repository structure

```text
AgriBid-WorkSphere/
├── frontend/          # Next.js frontend
├── backend/            # FastAPI backend
├── docs/               # Requirements and technical documentation
├── .gitattributes
├── README.md
└── CONTRIBUTING.md
```

## Technology stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod
- Zustand where client-side global state is required
- Motion

### Backend

- Python 3.11
- FastAPI
- Pydantic
- PostgreSQL

Additional selected open-source tools and technical decisions are documented in:

- `docs/architecture/technology-decisions.md`
- `docs/architecture/technical-design.md`

Do not assume every selected dependency has already been installed or integrated. Check the relevant dependency manifests.

## Current development status

- Next.js frontend with integrated sign-in and protected dashboard flow.
- FastAPI backend with sign-in, ID-token verification, access-token verification, refresh rotation and logout endpoints.
- PostgreSQL identity, roles, permissions, teams, team membership, refresh session, invitation foundation and password-reset-token schema migrated locally.
- Backend test suite: 25 tests passed; Ruff lint/format passed.
- Frontend lint and production build passed.
- User Management invitation endpoints, Team Management APIs and Project Management APIs remain to be implemented.
- Requirements and traceability documentation are being aligned with the verified implementation; the test plan distinguishes passed evidence from planned tests.

## Getting started

### Prerequisites

- Node.js and npm
- Python 3.11
- PostgreSQL
- Git

### Frontend

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Sign-in is connected to the local backend authentication APIs. The protected dashboard currently demonstrates the authenticated employee and role; full dashboard modules are still being implemented.

### Backend

Run these commands from the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
# Edit .env with your local PostgreSQL URL and generate a strong local JWT_SECRET_KEY
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Swagger UI: `http://127.0.0.1:8000/docs`.

## Configuration

Environment examples:

- Frontend: `frontend/.env.example` (copy to `frontend/.env.local`).
- Backend: `backend/.env.example` (copy to `backend/.env`).

There is intentionally no root-level `.env.example` or `.gitignore`. The frontend and backend folders contain their own environment examples and ignore rules.

Copy example files to their local environment filenames and replace placeholders with local values.

Never commit actual credentials, tokens, private keys or production secrets.

## Documentation

Start with:

1. `docs/requirements/project-overview.md`
2. `docs/requirements/software-requirements-specification.md`
3. `docs/requirements/confirmed-business-rules.md`
4. `docs/workflows/ticket-workflow.md`
5. `docs/architecture/system-architecture.md`
6. `docs/architecture/technical-design.md`
7. `docs/architecture/technology-decisions.md`
8. `docs/database/database-design.md`
9. `docs/database/erd.md`
10. `docs/api/api-specification.md`
11. `docs/traceability/requirements-traceability-matrix.md`

## Confirmed scope exclusions

Based on senior clarification, the current assignment excludes:

- Notifications module
- Automate Pro
- Public employee registration
- Google and Apple authentication
- Real email delivery
- Live GitHub Enterprise synchronization
- Production hosting and deployment

Mock GitHub activity and dummy company email data are used where required.

## Git workflow

See `CONTRIBUTING.md` for branch naming, commit conventions and daily integration. Pull requests are optional for this assignment; follow the senior's instruction to push meaningful commits and integrate tested work into `develop`.

The root repository is the source of truth for the complete project.
