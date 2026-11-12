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
├── tests/              # Cross-project test resources
├── infrastructure/     # Infrastructure configuration
├── .env.example        # Workspace configuration example
├── .gitignore
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

- Frontend scaffold and initial sign-in UI are committed.
- Backend application implementation is pending.
- PostgreSQL database has been prepared locally.
- Requirements, architecture, database, API, workflow and traceability documentation have been prepared.
- Requirements Traceability Matrix is an initial register; detailed mappings and test evidence remain to be completed.

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

The current sign-in interface is a frontend scaffold and is not yet connected to the backend authentication implementation.

### Backend

The backend setup instructions will be completed after the backend dependency manifest, environment configuration and application entry point are implemented.

See `backend/requirements.txt` and `docs/architecture/technical-design.md`.

## Configuration

Environment examples:

- Root: `.env.example`
- Frontend: `frontend/.env.example`
- Backend: `backend/.env.example`

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

See `CONTRIBUTING.md` for branch naming, commit conventions, pull requests and review expectations.

The root repository is the source of truth for the complete project.
