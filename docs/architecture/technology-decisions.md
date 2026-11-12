# AgriBid WorkSphere — Technology Decisions

**Decision date:** 12 November 2026
**Decision owner:** Developer
**Decision authority:** Senior delegated pending technical choices to the developer
**Status:** Selected for implementation; verify actual installed versions in lockfiles

## 1. Decision Principles

- Retain the stack specified in the assignment PDF.
- Prefer open-source tools with established documentation.
- Avoid unnecessary dependencies and infrastructure.
- Select tools that can be implemented and tested before 27 November 2026.
- Record actual package versions after installation.
- Do not claim a tool is used in the application until it has been installed and integrated.

## 2. Retained Assignment Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js App Router | Frontend framework |
| React | UI components |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| Motion | UI animations |
| TanStack Query | Server-state management |
| React Hook Form | Form management |
| Zod | Form/schema validation |
| Zustand | Limited client-side global state |
| Lucide React | Icons |

Keep the existing frontend scaffold and package lockfile. Do not perform unnecessary major-version upgrades during the deadline period.

### Backend

| Technology | Purpose |
|---|---|
| Python 3.11 | Backend runtime |
| FastAPI | REST API framework |
| Pydantic | Request and response validation |
| PostgreSQL 18 | Relational database |

### Infrastructure

PostgreSQL is the primary application database.

Redis is optional in the assignment and should be added only when a measurable caching, background-processing or real-time requirement justifies it.

## 3. Selected Additional Open-Source Tools

### Backend

| Tool | Selected purpose | Decision |
|---|---|---|
| SQLAlchemy 2.1.x | ORM and database access | Use |
| Alembic | Database migrations | Use |
| Psycopg 3 | PostgreSQL driver | Use |
| PyJWT | JWT creation and validation | Use |
| pwdlib with Argon2 | Password hashing | Use |
| SlowAPI | API rate limiting | Use |
| python-multipart | Multipart file uploads | Use |
| pytest | Backend tests | Use |
| HTTPX | FastAPI API tests | Use |
| Ruff | Python linting and formatting | Use |

Use synchronous SQLAlchemy sessions for the initial implementation to reduce complexity. Keep database access out of API route functions by using services/repositories.

Use Alembic migrations for all schema changes. Do not rely on automatic table creation as the production schema-management strategy.

### Frontend

| Tool | Selected purpose | Decision |
|---|---|---|
| `@dnd-kit/react` | Kanban drag-and-drop | Use |
| `@dnd-kit/helpers` | Sortable/drag-and-drop helpers | Use where needed |
| Recharts | Dashboard and report charts | Use |
| Vitest | Frontend unit/component test runner | Use |
| React Testing Library | Component behavior tests | Use |
| Playwright | Browser end-to-end testing | Use |

Use the current dnd-kit React package documentation rather than copying examples from its archived legacy documentation.

### API Documentation

Use FastAPI's built-in OpenAPI documentation:

- `/docs` for Swagger UI.
- `/redoc` for ReDoc.

The API specification Markdown file remains the human-readable contract.

## 4. Authentication Decisions

### 4.1 Passwords

Use `pwdlib[argon2]` with Argon2 for password hashing and verification.

Never store plaintext passwords.

### 4.2 Access Token

Use PyJWT to sign access JWTs.

Initial assignment policy:

- Signing algorithm: HS256.
- Access-token lifetime: 15 minutes.
- Token contains the employee identifier as its subject.
- Secret key is loaded from environment configuration.
- Never commit the signing secret.

The frontend holds the access token in memory and sends it through the `Authorization: Bearer` header.

Do not store access tokens in localStorage or sessionStorage.

### 4.3 Refresh Token

Use a cryptographically random opaque refresh token.

- Initial refresh lifetime: 7 days.
- Store only a hash of the refresh token in PostgreSQL.
- Store session ownership, expiry and revocation data.
- Rotate the refresh token on successful refresh.
- Revoke the active refresh session on logout.
- Set the browser cookie to HttpOnly and SameSite=Strict.
- Use Secure cookies in deployed HTTPS environments. For local HTTP development, configure Secure appropriately for localhost.

Use an `auth_sessions` table or equivalent to track refresh-session lifecycle.

### 4.4 CSRF and CORS

- Restrict CORS to the exact frontend origin.
- Enable credentials only where required.
- Validate the Origin header on refresh/logout operations.
- Do not allow wildcard origins with credentialed requests.
- Keep normal protected API access based on the Authorization bearer header.

These decisions are for the assignment implementation and must be re-reviewed before any real company deployment.

## 5. Database Design Decisions

- PostgreSQL is the system of record.
- SQLAlchemy models represent database entities.
- Alembic manages schema versioning.
- Use foreign keys and unique constraints.
- Use indexes for common filters and joins.
- Use transactions for multi-step operations.
- Store timestamps in UTC.
- Avoid N+1 queries.
- Keep ticket activity and audit logs separate.
- Add or confirm an `auth_sessions` table for refresh-session lifecycle.
- Add or confirm a `user_invitations` table for invitation-only account creation.

The single-role-per-employee rule must be reflected in the final schema. An employee may still belong to multiple teams.

## 6. File Storage Decision

For this assignment, use local filesystem storage for uploaded documents.

- Store uploaded files outside the frontend public directory.
- Generate server-side unique storage names.
- Keep original filename and file metadata in PostgreSQL.
- Validate file size and approved file types on the backend.
- Enforce the confirmed 5 MB per-file limit.
- Enforce the maximum five-document rule after its exact scope is finalized.
- Require authorization before returning file contents.
- Prevent path traversal and direct access to arbitrary server files.

Keep storage operations behind a small service interface so the storage provider can be changed later without changing ticket business logic.

## 7. Rate Limiting Decision

Use SlowAPI for rate limiting on sensitive endpoints such as login and refresh.

Use its in-memory backend for the single-instance local assignment.

This is not suitable as a shared rate-limit store for multiple backend instances. A shared Redis backend can be considered only if a multi-instance deployment becomes part of the approved scope.

## 8. Decisions Not to Add

The following are deliberately not selected for the current assignment:

| Tool/technology | Decision | Reason |
|---|---|---|
| Redis | Not initially | No confirmed measurable need |
| Celery | Not initially | No required external background-processing workload |
| Docker | Not required | Keep local setup simple for the current environment |
| Separate workflow engine | Not required | Use a focused backend workflow service and database transition rules |
| Real email provider | Excluded | Use approved dummy company email data |
| GitHub OAuth/App integration | Excluded for current assignment | Use mock activity and the configured personal GitHub destination |
| Third-party authentication provider | Excluded | Invitation-only employee accounts and local application auth |

Do not add these dependencies merely for architectural appearance.

## 9. Integration Scope

### Email

Use dummy company-style email addresses such as `name@agribid.ai`.

Do not claim real email delivery.

### GitHub

Use mock GitHub Enterprise activity for the application display.

The GitHub button opens the actual personal GitHub URL supplied by the developer.

Do not implement real OAuth, webhooks or repository synchronization in the current agreed scope.

### Notifications and Automate Pro

These modules remain excluded by senior clarification.

Do not introduce notification delivery or automation infrastructure.

## 10. Version and License Recording

After installing each dependency:

- Record its exact installed version.
- Preserve `package-lock.json`.
- Preserve Python dependency versions in the selected dependency file.
- Record the tool's official documentation URL.
- Record license information from its package/repository metadata.
- Run dependency vulnerability checks before delivery.

Selected dependencies are not described as already used until they are integrated into the project.

## 11. Official References

- SQLAlchemy: https://docs.sqlalchemy.org/
- Alembic: https://alembic.sqlalchemy.org/
- FastAPI security and JWT: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- FastAPI testing: https://fastapi.tiangolo.com/tutorial/testing/
- SlowAPI: https://pypi.org/project/slowapi/
- Ruff: https://docs.astral.sh/ruff/
- dnd-kit React: https://dndkit.com/react/quickstart/
- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/docs/intro
- Recharts: https://recharts.org/

## 12. Review Rule

If a dependency creates installation or compatibility problems, prefer the simplest compatible open-source alternative and document the change.

Do not spend deadline time replacing a working stack without a concrete technical reason.
