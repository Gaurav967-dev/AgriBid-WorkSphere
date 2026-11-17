# AgriBid WorkSphere — Development Plan to 27 November 2026

**Plan date:** 12 November 2026
**Target completion:** 27 November 2026
**Planning note:** The agreed exclusions remain excluded. The project must be delivered as a working, testable application rather than spending the remaining time expanding documentation indefinitely.

## 1. Milestones

| Date | Focus | Expected deliverable |
|---|---|---|
| 12 Nov | Confirm senior decisions and freeze the documentation baseline | Updated workflow and technology decisions |
| 13 Nov | RTM, repository structure and development setup | Traceability matrix, root Git workflow, environment examples |
| 14 Nov | Backend foundation and database setup | FastAPI structure, PostgreSQL connection, first Alembic migration |
| 16–17 Nov | Authentication, invitations and RBAC | Login, invitation acceptance, role enforcement, user/team foundations |
| 18 Nov | Project management | Project CRUD, membership and access checks |
| 19–20 Nov | Ticket management and workflow | Ticket CRUD, assignment, status-transition service and Kanban |
| 21–22 Nov | Planned non-working days | No milestone dependency |
| 23 Nov | Collaboration and documents | Comments, mentions, attachments and validation |
| 24 Nov | Planning features | Labels, sprint management and calendar essentials |
| 25 Nov | Reporting and integrations | Dashboards, reports and mock GitHub activity |
| 26 Nov | Integration and quality | API tests, frontend tests, end-to-end tests, security checks and bug fixes |
| 27 Nov | Final verification and delivery | Acceptance checklist, README, screenshots and final handover |

15 November is also a planned non-working day.

## 2. Priority Order

### P0 — Core working application

- Authentication and invitation-only employee access.
- One role per employee and multiple team memberships.
- Backend-enforced permissions.
- Team and project management.
- Ticket creation, assignment and status history.
- Confirmed role-based workflow.
- Kanban board and ticket detail view.
- Comments and required attachment handling.
- Audit/activity history.

### P1 — Required supporting functionality

- Sprints and backlog.
- Calendar essentials.
- Project and team reports.
- Dashboard statistics.
- Search, filters and pagination.
- Mock GitHub activity.
- Responsive interface and useful loading/error states.

### P2 — Finish and polish

- Consistent visual styling.
- Accessibility and keyboard interaction checks.
- Performance improvements based on measurements.
- Final documentation and test report.

## 3. Scope Controls

The following are excluded based on senior clarification:

- Notifications module.
- Automate Pro.
- Live GitHub Enterprise integration.
- Real email delivery.
- Production hosting.

Do not spend implementation time building these excluded features.

## 4. Daily Development Discipline

At the start of each development session:

1. Pull the latest approved branch.
2. Check the current ticket/task and its acceptance criteria.
3. Implement one small, testable unit.
4. Run relevant tests and lint/type checks.
5. Update documentation if the implementation changes a contract.
6. Commit using a meaningful conventional commit message.
7. Record blockers and the next task.

Do not leave untested large features until the final two days.

## 5. Release Readiness

By 26 November:

- Critical authentication and authorization tests must pass.
- Ticket status rules must be tested for all four roles.
- Upload size and count validation must be tested.
- Project and team access restrictions must be tested.
- API errors and frontend error states must be checked.
- No secrets may be committed.
- Setup instructions must work on a clean local environment.

On 27 November, focus on acceptance verification and delivery rather than introducing new features.

## Recovery schedule and daily integration cadence — 17 November 2026

### Current position

The authentication foundation is implemented and locally verified, but invitation creation/acceptance and the full User Management module are not complete. Therefore Module 1 is still in progress. Team Management (Module 3) and Project Management (Module 4) remain to be delivered. The schedule below is a recovery target, not a claim that those modules are already complete.

### Recovery milestones

| Date | Module / focus | Minimum integrated deliverable |
|---|---|---|
| 17 Nov | Documentation and repository alignment | Current auth contract, invitation schema decision, test plan, repository folder-level config and updated recovery plan |
| 18 Nov | Module 1 + Module 2 — User Management backend | Invitation schema migration, Admin-protected invitation create/list/detail/status APIs, token validation and transactional acceptance |
| 19 Nov | Module 2 — User Management frontend and verification | Employee table, search/filter/pagination, create-invitation flow, edit/status/role operations and User API tests |
| 20 Nov | Module 3 — Team Management | Team CRUD, team lead, multiple membership add/remove, duplicate prevention and membership history |
| 21–22 Nov | Planned non-working days | No milestone dependency |
| 23 Nov | Module 3 completion + Module 4 backend | Team UI/integration and project models/migrations/API foundation |
| 24 Nov | Module 4 — Project Management | Project list/create/detail/edit/archive, manager/team assignment and project access checks |
| 25 Nov | Module 4 integration + Module 5 start | Project UI/API integrated and tested; ticket schema/API foundations started |
| 26 Nov | Module 5 — Ticket Management | Ticket create/list/detail/assignment and canonical backend status-transition service; role-based tests |
| 27 Nov | Integration, regression and handover | Verify integrated priority workflows, fix critical bugs, update RTM/test evidence/README and report any deferred requirements explicitly |

This plan targets completion through Module 4 by 24 November, then prioritizes the core ticket workflow. It does not assume that every remaining PDF feature can be completed by the deadline. Any required feature that cannot be delivered must be identified to the senior before handover rather than silently omitted.

### Daily development and integration rules

1. Start from the latest remote `develop`: fetch and fast-forward before creating or updating a feature branch.
2. Work in a short-lived feature branch for one coherent module or fix.
3. Implement a small vertical slice: migration/model, API/service, UI, and relevant tests.
4. Run backend tests and Ruff for backend changes; run frontend lint and production build for frontend changes. Run both when changing shared contracts.
5. Commit completed, tested increments each working day. Do not make empty commits or backdate history.
6. Push the feature branch to the personal GitHub repository during the day; keep the remote branch current.
7. At the daily integration checkpoint, merge tested work into `develop` locally and push `develop`. Pull requests are optional because the senior has said they are not required for this assignment.
8. Keep `main` stable; integrate to `main` only at an agreed milestone or final handover.
9. Update the development progress log and traceability/test evidence with actual work completed. Record blockers and the next day's target.
10. Never commit .env files, secrets, real tokens or passwords.

### Commit message convention

Use the senior's requested Conventional Commit style:

- `feat(auth): implement invitation acceptance API`
- `feat(users): add employee listing and filters`
- `feat(teams): support multiple team memberships`
- `feat(projects): add project creation API`
- `feat(tickets): enforce role-based status transitions`
- `fix(tickets): prevent invalid status transition`
- `test(users): cover duplicate invitation handling`
- `docs(api): align user management endpoint contract`

A commit title must describe the change actually included in that commit.
