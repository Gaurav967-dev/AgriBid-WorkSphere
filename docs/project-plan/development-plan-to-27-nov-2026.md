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
