# AgriBid WorkSphere
# Technical Design Document (TDD)

| Attribute | Details |
|---|---|
| Project | AgriBid WorkSphere |
| Document | Technical Design Document |
| Version | 1.0 |
| Date | 12 November 2026 |
| Status | Draft for Senior Review |
| Related Documents | SRS, System Architecture, Database Design, ERD, Approved Scope Changes |

## 1. Purpose

This document explains how the AgriBid WorkSphere requirements
will be translated into technical implementation.

It defines:
- Frontend implementation design.
- Backend implementation design.
- Database interaction.
- API communication.
- Authentication and authorization.
- Ticket workflow implementation.
- File handling.
- GitHub and email mock integrations.
- Testing strategy.
- Error handling.

This document supplements the approved system architecture.

## 2. Technical Stack

### Frontend

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui with Base UI.
- Motion.
- TanStack Query.
- React Hook Form.
- Zod.
- Zustand only where necessary.
- Lucide React.

### Backend

- Python.
- FastAPI.
- Pydantic.

### Database

- PostgreSQL 18.

### Proposed supporting tools

- SQLAlchemy: database ORM.
- Alembic: database migrations.
- Pytest: backend tests.
- HTTPX: API testing.

These supporting tools are proposals. Confirm company coding
conventions and approved dependencies before adoption.

## 3. Frontend Technical Design

### 3.1 Application Structure

Use Next.js App Router with route groups to separate
authentication pages from authenticated application pages.

Proposed routing:

```text
src/app/
├── (auth)/
│   ├── sign-in/
│   ├── invitation/
│   ├── forgot-password/
│   └── reset-password/
│
├── (workspace)/
│   ├── dashboard/
│   ├── users/
│   ├── teams/
│   ├── projects/
│   ├── tickets/
│   ├── board/
│   ├── calendar/
│   ├── backlog/
│   ├── sprints/
│   ├── reports/
│   ├── github/
│   ├── audit-logs/
│   └── settings/
│
├── layout.tsx
└── globals.css
```

The exact route structure may be refined during implementation.

Do not create Notifications or Automate Pro routes.

### 3.2 Feature-Based Organization

Proposed feature folders:

```text
src/features/
├── auth/
├── users/
├── teams/
├── projects/
├── tickets/
├── comments/
├── attachments/
├── activities/
├── sprints/
├── reports/
├── github/
└── audit-logs/
```

Each feature should organize its own components, hooks,
schemas, types and API functions as needed.

### 3.3 Shared Components

```text
src/components/
├── ui/
├── layout/
├── shared/
└── data-display/
```

Responsibilities:

- ui: shadcn/ui primitives.
- layout: sidebar, header and workspace layout.
- shared: reusable application-level components.
- data-display: tables, badges, charts and status indicators.

### 3.4 API Client

All frontend API calls should use a centralized service layer.

Proposed structure:

```text
src/
├── lib/
│   ├── api-client.ts
│   ├── constants.ts
│   └── utils.ts
│
├── services/
│   ├── auth.service.ts
│   ├── users.service.ts
│   ├── teams.service.ts
│   ├── projects.service.ts
│   ├── tickets.service.ts
│   ├── attachments.service.ts
│   ├── sprints.service.ts
│   ├── reports.service.ts
│   ├── github.service.ts
│   └── audit-logs.service.ts
```

Requirements:

- Avoid duplicated API base URLs.
- Read API configuration from environment variables.
- Use consistent request/response types.
- Handle authentication failures consistently.
- Handle HTTP errors safely.
- Avoid exposing secrets in client bundles.

### 3.5 Server State

TanStack Query will manage data fetched from FastAPI.

Examples:

- Current employee profile.
- User lists.
- Team details.
- Project lists.
- Ticket lists.
- Ticket details.
- Sprint information.
- Dashboard metrics.
- Report data.
- GitHub mock activity.

After mutations, invalidate or update the relevant query cache.

Avoid maintaining duplicate API datasets in Zustand.

### 3.6 Form Handling

React Hook Form manages form state.

Zod defines frontend schemas.

Use shared validation conventions where practical, but
the backend must independently validate all requests.

Forms must provide:
- Required field messages.
- Format validation.
- Length validation.
- Clear invalid states.
- Loading states.
- Submission error handling.
- Duplicate-submission prevention.

### 3.7 UI Design

Use the supplied PDF UI screenshots as the design references.

Authentication:
- AgriBid WorkSphere branding.
- Invitation-only access.
- No Google/Apple login.
- Responsive authentication cards.

Workspace:
- Sidebar.
- Top toolbar.
- Search.
- Filter and Sort.
- Role-specific navigation.
- Main content area.

Explicit exclusions:
- Notifications.
- Automate Pro.

The GitHub toolbar button opens the developer's configured
personal GitHub account URL.

### 3.8 Role-Aware Frontend

The frontend may use the authenticated user's role to:
- Show authorized navigation.
- Hide restricted actions.
- Display role-specific dashboards.
- Render permitted ticket actions.
- Show appropriate empty and error states.

This is a usability mechanism only.

The backend must independently enforce every permission.

## 4. Backend Technical Design

### 4.1 Backend Structure

Proposed modular package organization:

```text
backend/
└── app/
    ├── main.py
    ├── core/
    │   ├── config.py
    │   ├── database.py
    │   ├── security.py
    │   ├── exceptions.py
    │   └── logging.py
    │
    ├── common/
    │   ├── schemas/
    │   ├── dependencies/
    │   └── utilities/
    │
    ├── modules/
    │   ├── auth/
    │   ├── users/
    │   ├── roles/
    │   ├── permissions/
    │   ├── teams/
    │   ├── projects/
    │   ├── project_members/
    │   ├── tickets/
    │   ├── ticket_comments/
    │   ├── attachments/
    │   ├── ticket_activities/
    │   ├── sprints/
    │   ├── reports/
    │   ├── github/
    │   └── audit_logs/
    │
    ├── integrations/
    │   ├── email/
    │   ├── github/
    │   └── storage/
    │
    └── tests/
```

No Notifications module is included.

Each business module should separate:
- routes.py
- schemas.py
- models.py
- service.py
- repository.py
- dependencies.py or permissions.py where required.

Use smaller files when a module grows.

### 4.2 Main Application

The FastAPI application should:
- Load environment configuration.
- Initialize database dependencies.
- Register API routers.
- Configure CORS.
- Register exception handlers.
- Initialize logging.
- Expose OpenAPI documentation.
- Provide health-check functionality.

### 4.3 Router Layer

Routers should:
- Define HTTP methods and paths.
- Accept request data.
- Apply authentication dependencies.
- Apply permission dependencies.
- Validate request schemas.
- Call the appropriate service.
- Return response schemas.

Routers should not contain large business workflows.

### 4.4 Schema Layer

Pydantic schemas should define:
- Create request models.
- Update request models.
- Response models.
- Query/filter parameters.
- Validation constraints.

Never return password hashes or sensitive session values.

### 4.5 Service Layer

Services contain business rules such as:
- Invitation creation.
- Account activation.
- User role assignment.
- Team membership validation.
- Project creation.
- Ticket creation and assignment.
- Ticket transitions.
- File-upload authorization.
- Sprint lifecycle.
- GitHub mock linking.
- Audit recording.

Business logic must be testable independently of HTTP routes.

### 4.6 Repository Layer

Repositories are responsible for data access.

They should:
- Execute database queries.
- Load required relationships.
- Persist changes.
- Apply filtering and pagination.
- Avoid unnecessary queries.
- Keep database operations consistent.

Authorization decisions must be made in the appropriate service
or dependency layer; a repository must not blindly trust user input.

## 5. Authentication Technical Design

### 5.1 Invitation Workflow

1. Admin creates an employee.
2. Admin assigns exactly one role.
3. System generates a secure invitation token.
4. System stores only a protected representation of the token.
5. Development email adapter simulates delivery.
6. Employee opens the invitation.
7. Backend validates token, expiry, usage and account state.
8. Employee creates a password.
9. Backend hashes the password.
10. System activates the account.
11. Invitation is marked as used.

Invitation tokens must be single-use and expiring.

### 5.2 Login Workflow

1. Employee submits email/username and password.
2. Backend validates the input.
3. Backend finds the employee.
4. Backend checks account status.
5. Backend verifies the password hash.
6. Backend establishes the approved session mechanism.
7. Frontend loads the current user's authorized workspace.

Invalid credentials must not disclose unnecessary account information.

### 5.3 Password Storage

Passwords must be securely hashed.

The implementation uses pwdlib with Argon2 via pwdlib[argon2]. Passwords are never stored in plaintext; only the password hash is persisted.

Passwords must never be stored as plaintext.

### 5.4 Session Design

Session transport and lifetime are implemented locally: 5-minute ID token, 15-minute access JWT, and 7-day opaque refresh token. Each is an HttpOnly SameSite=Lax cookie with paths /api/v1/auth/id-token/verify, /, and /api/v1/auth/refresh-token respectively. Secure is controlled by COOKIE_SECURE (false for local HTTP, true for HTTPS). Normal protected frontend requests send access_token via the browser cookie; refresh_token is sent only to the scoped refresh/logout endpoints, while id_token is for one-time identity verification. The backend accepts an access cookie or Bearer access header. Refresh tokens are hashed in PostgreSQL, rotated on refresh and revoked on logout. The implementation is for local assignment testing and must be security-reviewed before production deployment.

### 5.5 Authorization

Use reusable backend permission checks.

Each request must validate:
- Authenticated identity.
- Active account status.
- User role.
- Required action.
- Resource/project membership.
- Business rule conditions.

## 6. Role and Team Data Design

### 6.1 One Role per Employee

The users table contains a required role_id foreign key.

There is no user_roles junction table.

### 6.2 Multiple Team Memberships

Users and teams are many-to-many through team_members.

Enforce uniqueness of active user/team memberships.

### 6.3 Project Permissions

PM access is restricted to assigned or explicitly authorized projects.

Developer and Tester access must be restricted to authorized work.

## 7. Ticket Workflow Technical Design

### 7.1 Status Catalogue

Use stable database status keys:

- BACKLOG
- TODO
- IN_PROGRESS
- IN_REVIEW
- TESTING
- TESTING_DONE
- BUG_FIXED
- COMPLETED
- BLOCKED
- REOPENED
- CANCELLED

TESTING_DONE and COMPLETED are separate statuses.

### 7.2 Confirmed Role Transitions

| Role / Workflow | Source | Target |
|---|---|---|
| Admin | Any configured status | Any configured status |
| PM | Any configured status | Any configured status |
| Developer | TODO | IN_PROGRESS |
| Developer | TODO | IN_REVIEW |
| Tester | TESTING | TESTING_DONE |
| Tester | TESTING | BUG_FIXED |
| Bug-fix workflow | BUG_FIXED | COMPLETED |

### 7.3 Transition Processing

The transition service should:

1. Load the ticket.
2. Verify the authenticated user.
3. Verify project/ticket access.
4. Load current and requested statuses.
5. Check the user's role.
6. Check the allowed source/target transition.
7. Check additional business conditions.
8. Update the ticket within a transaction.
9. Record ticket activity.
10. Record audit activity where applicable.
11. Return the updated ticket.

Do not accept a status change merely because the frontend
sent a permitted-looking status value.

### 7.4 Transactional Behavior

Ticket updates and their required activity/audit records
must be handled consistently.

If the transaction fails, incomplete changes must be rolled back.

### 7.5 Drag-and-Drop

The Kanban board may optimistically display a drop,
but the backend remains authoritative.

If a transition is rejected:
- Restore the ticket to its prior column.
- Display a clear error.
- Preserve the current board state.

The BUG_FIXED-to-COMPLETED actor requires explicit workflow approval.

## 8. File Handling Technical Design

### 8.1 Supported Files

- JPG
- JPEG
- PNG
- WEBP
- PDF
- XLS
- XLSX
- CSV
- DOC
- DOCX

### 8.2 Limits

Maximum individual file size: 5 MB.

Maximum attachment count: five documents.

The exact count scope must be finalized.

### 8.3 Upload Processing

1. User selects the file.
2. Frontend performs preliminary validation.
3. Request is sent to FastAPI.
4. Backend validates authorization.
5. Backend validates extension and actual content.
6. Backend checks file size and document count.
7. Backend generates a storage key.
8. Storage adapter writes the binary.
9. PostgreSQL stores metadata.
10. API returns the attachment information.

### 8.4 Failure Handling

Storage and database failures must not leave uncontrolled
orphan records or binaries.

Provide cleanup or retry handling where necessary.

### 8.5 Storage Abstraction

The actual provider is not yet approved.

The application should use a storage interface so a provider
can be configured later without changing ticket business logic.

## 9. GitHub Technical Design

### 9.1 Toolbar Button

Use a configurable public GitHub URL for the user's personal account.

Do not hardcode passwords or private tokens.

The public profile/repository URL is configuration, not a secret.

### 9.2 Mock GitHub Activity

Use mock data for:
- Repositories.
- Branches.
- Commits.
- Pull requests.
- Ticket links.

Keep these records in the GitHub module.

### 9.3 Future Integration

The module should be isolated so real company GitHub Enterprise
integration can be added later.

Real OAuth, App credentials and webhook integration are not
assumed in the current mock-data scope.

## 10. Email Technical Design

Use a replaceable email adapter.

Initial implementation:
- Dummy addresses such as name@agribid.ai.
- Simulated invitation delivery.
- Simulated password-reset delivery.
- Development-only test messages or reset links.

Do not claim actual email delivery.

Avoid coupling account activation logic to a particular email provider.

## 11. API Communication Design

### 11.1 Frontend

The frontend calls a centralized API client.

The API client is responsible for:
- Base URL configuration.
- Request serialization.
- Response handling.
- Authentication configuration.
- Error normalization.

### 11.2 Backend

FastAPI exposes REST endpoints.

Proposed API prefix:

/api/v1

### 11.3 API Contract

Every endpoint must document:
- HTTP method.
- Route.
- Request schema.
- Response schema.
- Authentication.
- Permission.
- Validation.
- Success status.
- Error responses.

### 11.4 Error Handling

Use consistent API error responses.

Expected HTTP behavior includes:
- 200 successful request.
- 201 created resource.
- 204 successful operation without body.
- 400 invalid request.
- 401 unauthenticated.
- 403 unauthorized.
- 404 resource unavailable.
- 409 conflict.
- 413 oversized request.
- 415 unsupported media type.
- 422 validation failure.
- 429 rate limited.
- 500 unexpected server failure.
- 503 temporary service failure.

Internal exceptions and sensitive database information
must not reach the frontend.

## 12. Audit and Activity Design

### Ticket Activity

Record:
- Ticket creation.
- Ticket changes.
- Assignment.
- Status changes.
- Priority changes.
- Comments.
- Attachments.
- Completion.

### System Audit

Record:
- User creation.
- Role changes.
- Team operations.
- Project operations.
- Ticket operations.
- Permission changes.
- Repository configuration.

Audit data must not be editable by normal employees.

## 13. Explicitly Excluded Functionality

The implementation must not include:
- Notifications module.
- Notification bell/panel/unread count.
- Notification APIs or notification delivery.
- Notification background jobs.
- Automate Pro.
- Automation UI or functionality.
- Production hosting/deployment.
- Real company email delivery in mock development.
- Real GitHub Enterprise OAuth/webhooks in initial mock development.

Ticket activity and audit logs remain included.

## 14. Testing Design

### Frontend

Test:
- Authentication screens.
- Form validation.
- Role-aware navigation.
- User/team/project forms.
- Ticket creation.
- Kanban movement.
- Comments.
- Attachments.
- Search and filtering.
- Dashboard data states.

### Backend

Test:
- Login and invitations.
- Password handling.
- Role authorization.
- Team memberships.
- Project access.
- Ticket creation and transitions.
- Assignment history.
- Comment authorization.
- Attachment validation.
- Sprint operations.
- GitHub mock operations.
- Audit recording.

### Integration

Test complete workflows across frontend, backend and PostgreSQL.

### Regression

Previously accepted behavior must continue working
after new changes.

Notifications and Automate Pro are outside the current
acceptance test scope.

## 15. Proposed Implementation Sequence

1. Approve requirements and design.
2. Finalize the database logical model.
3. Finalize API contracts.
4. Prepare frontend and backend folder structures.
5. Configure backend environment.
6. Configure SQLAlchemy and migrations if approved.
7. Implement authentication.
8. Implement users and teams.
9. Implement projects.
10. Implement tickets and workflow.
11. Implement comments and attachments.
12. Implement dashboards and views.
13. Implement sprints and reports.
14. Implement GitHub mock integration and personal profile link.
15. Implement audit logs.
16. Execute integration and regression tests.

The exact delivery priority must follow the senior-approved
three-week schedule and available working hours.

## 16. Technical Decisions Requiring Approval

| ID | Decision | Status |
|---|---|---|
| TD-001 | Database ORM | SQLAlchemy proposed |
| TD-002 | Migration tool | Alembic proposed |
| TD-003 | Authentication session transport | Implemented locally; re-review before production |
| TD-004 | Session lifetime and renewal | ID 5m / access 15m / refresh 7d; implemented |
| TD-005 | Password hashing configuration | pwdlib/Argon2; implemented |
| TD-006 | File storage provider | Pending |
| TD-007 | Exact five-document count scope | Pending |
| TD-008 | BUG_FIXED-to-COMPLETED actor | Pending |
| TD-009 | Multiple ticket assignees | Pending |
| TD-010 | Company coding conventions | Pending review |

## 17. Approval

This document defines a proposed implementation design.

Review it against the approved SRS, system architecture,
database design, ERD, use cases and scope changes.

Do not finalize implementation choices that require
company approval until those decisions are recorded.

---
End of Document


## Selected technical decisions - 12 November 2026

The senior delegated the remaining open-source technology choices to the developer.

The selected implementation tools, authentication policy, database approach, storage approach and deliberately excluded infrastructure are documented in `./technology-decisions.md`.

The canonical ticket workflow is documented in `../workflows/ticket-workflow.md`.

The implementation must use SQLAlchemy, Alembic, Psycopg, PyJWT, pwdlib/Argon2, SlowAPI, pytest, HTTPX and Ruff on the backend. The frontend additions selected are dnd-kit, Recharts, Vitest, React Testing Library and Playwright.

Use the assignment's existing FastAPI, Pydantic, PostgreSQL and Next.js stack. Do not introduce Redis unless a measured requirement justifies it.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.

## 18. Implemented authentication and invitation design update — 17 November 2026

This section supersedes the earlier statements that session transport and lifetime are undecided.

### Implemented authentication

The current code uses a 5-minute ID token, 15-minute access JWT and 7-day opaque refresh token. All three are HttpOnly cookies with SameSite=Lax; Secure is environment-configurable. Cookie paths are respectively `/api/v1/auth/id-token/verify`, `/`, and `/api/v1/auth/refresh-token`.

Sign-in issues all three. ID-token verification is one-time and clears the ID cookie. Protected requests use the access token; backend dependency accepts the access cookie or a Bearer access header. Refresh rotates the opaque token, stores only its hash, revokes the previous session, and returns new access/refresh cookies. Logout revokes the session and clears active and legacy cookie paths.

The frontend uses credentialed cookie requests, coalesces concurrent verification/refresh work and retries a protected request once after refresh. The browser test evidence recorded for the current implementation is: access verification 401 after expiry, refresh 200, then verification retry 200.

### User invitation design to implement next

Extend the current invitation entity with pending employee full name and optional employee ID. Use a normalized invitation-team association for initial team choices. Invitation creation must not create a usable user with a fake password. Invitation acceptance must validate the token and selected teams, hash the submitted password, create the user and memberships, and mark the invitation accepted in one database transaction.

Add the Alembic migration and tests before implementing invitation endpoints. Public self-registration remains prohibited.

### Backend module naming

The current backend repository uses `app/api/v1/endpoints`, `app/api/v1/dependencies`, `app/core`, `app/models`, `app/schemas`, `app/services`, `app/repositories`, `app/integrations`, `migrations`, `scripts` and `tests`. The earlier proposed `app/modules/*` tree is conceptual and should not be represented as the current physical folder layout.
