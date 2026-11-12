# AgriBid WorkSphere
# Functional Requirements Specification

| Attribute | Details |
|---|---|
| Project | AgriBid WorkSphere |
| Document | Functional Requirements |
| Version | 1.0 |
| Date | 11 November 2026 |
| Status | Draft for Senior Review |
| Reference | Complete Project Development Assignment and approved scope changes |

## 1. Introduction

This document defines the functional behavior expected from AgriBid WorkSphere.

It supplements the Software Requirements Specification and defines
the system operations, user interactions, business workflows and
expected behavior of each included module.

The original assignment PDF and senior-approved clarifications
are the sources of requirements.

## 2. Actors

- Admin
- Project Manager (PM)
- Developer
- Tester / QA
- Simulated Email Service
- Mock GitHub Activity Provider

Every employee must have exactly one role.

An employee may belong to multiple teams.

## 3. Module 1 - Authentication and Authorization

### FR-AUTH-001: Invitation-Only Registration
- Public self-registration must not be available.
- Admin can create employee accounts.
- Admin assigns exactly one role.
- System creates an invitation for the employee.
- Invitation must have an expiry.
- Invitation must be single-use.

### FR-AUTH-002: Invitation Acceptance
- Employee opens an invitation link.
- System validates the invitation token.
- Employee sets and confirms a password.
- System validates the password.
- System securely hashes the password.
- Account is activated after successful validation.
- Used invitations cannot be reused.

### FR-AUTH-003: Sign In
- Employees can sign in using company email/username and password.
- Backend validates credentials.
- Inactive accounts cannot sign in.
- Invalid credentials produce safe errors.
- Successful login establishes an authenticated session.

### FR-AUTH-004: Sign Out
- Authenticated employees can sign out.
- Server-side session credentials are invalidated according
  to the selected session design.
- Application authentication state is cleared.

### FR-AUTH-005: Forgot and Reset Password
- Employee can request a password reset.
- System generates a secure expiring reset token for eligible accounts.
- Reset requests must not disclose account existence.
- Employee can set and confirm a new password.
- Reset tokens are single-use.

### FR-AUTH-006: Session Management
- System handles expiry, revocation and invalid sessions.
- Protected frontend pages require authentication.
- Protected APIs require backend authentication.
- Login attempts receive appropriate rate limiting.

### FR-AUTH-007: Role Authorization
- Exactly one role is associated with each employee.
- Admin, PM, Developer and Tester have different permissions.
- Backend permissions are authoritative.
- Frontend visibility must not replace backend authorization.

## 4. Module 2 - User Management

### FR-USER-001: Employee Creation
Admin can create employee records containing:
- Full name.
- Email.
- Profile image.
- Employee ID where applicable.
- Role.
- Team membership.
- Account status.
- Creation date.
- Last login.

### FR-USER-002: Employee Operations
Admin can:
- View employee records.
- Search and filter employees.
- Create employees.
- Edit employee details.
- Assign one role.
- Assign one or more teams.
- Activate/deactivate accounts.
- View project assignments.
- View employee activity.

### FR-USER-003: Employee Validation
- Email must be valid and unique.
- Required information must not be empty.
- Role must be valid.
- Deactivated employees cannot authenticate.
- Historical employee records must be preserved.

## 5. Module 3 - Team Management

### FR-TEAM-001: Team Creation
Admin can create teams with name, description and team lead.

### FR-TEAM-002: Team Operations
Admin can create, view, edit and archive teams according
to retention rules.

### FR-TEAM-003: Team Membership
- A team can contain multiple employees.
- An employee can belong to multiple teams.
- Duplicate active memberships are prevented.
- Team membership history is maintained.

### FR-TEAM-004: Team Details
Display:
- Team name.
- Description.
- Team lead.
- Members.
- Member roles.
- Designations.
- Assigned projects.
- Active ticket counts.
- Completed ticket counts.

### FR-TEAM-005: Team Workload
Display work assigned to team members using authorized,
actual project and ticket records.

## 6. Module 4 - Project Management

### FR-PROJ-001: Project Creation
Authorized Admin/PM users can create projects according
to their permissions.

### FR-PROJ-002: Project Information
A project supports:
- Name.
- Unique project key.
- Description.
- Logo/icon.
- Project manager.
- Assigned team.
- Start date.
- End date.
- Status.
- Visibility.
- Created date.

### FR-PROJ-003: Project Status
Support:
- Planning.
- Active.
- On Hold.
- Completed.
- Archived.

### FR-PROJ-004: Project Operations
Authorized users can:
- View projects.
- Create projects.
- Edit project details.
- Assign project managers.
- Add/remove members.
- Update dates.
- Change status.
- Archive projects.
- View project activity.
- View project tickets.

### FR-PROJ-005: Project Overview
Display:
- Project summary and description.
- Project manager.
- Team members.
- Total tickets.
- Completed tickets.
- Pending tickets.
- Overdue tickets.
- Project progress.
- Recent activities.
- Attachments.
- GitHub repository information.

### FR-PROJ-006: Project Authorization
- PM can access assigned projects.
- Unrelated projects cannot be accessed without permission.
- Archived projects must not appear in active project listings.

## 7. Module 5 - Ticket and Task Management

### FR-TKT-001: Ticket Types

Support:
- Epic.
- Story.
- Task.
- Subtask.
- Bug.
- Improvement.
- Technical Debt.

### FR-TKT-002: Ticket Creation

Authorized PM/Admin users can create tickets with:
- Generated unique ticket ID.
- Title.
- Description.
- Project.
- Ticket type.
- Priority.
- Initial status.
- Reporter.
- Assignee.
- Reviewer/tester where applicable.
- Start date.
- Due date.
- Estimated effort.
- Labels.
- Optional parent ticket.
- Attachments.
- Created/updated timestamps.

### FR-TKT-003: Ticket Priority

Support:
- Low.
- Medium.
- High.
- Critical.

### FR-TKT-004: Ticket Status Catalogue

Support the original PDF statuses:
- BACKLOG.
- TODO.
- IN_PROGRESS.
- IN_REVIEW.
- TESTING.
- COMPLETED.
- BLOCKED.
- REOPENED.
- CANCELLED.

Also support senior-confirmed:
- TESTING_DONE.
- BUG_FIXED.

TESTING_DONE and COMPLETED are separate statuses.

BUG_FIXED leads to COMPLETED.

### FR-TKT-005: Role-Based Ticket Transitions

Admin:
- Can move tickets from any configured status to any configured status.

Project Manager:
- Can create tickets.
- Can assign/reassign tickets.
- Can move tickets to any configured status within authorized projects.

Developer:
- TODO -> IN_PROGRESS.
- TODO -> IN_REVIEW.
- Other transitions are not permitted unless approved.

Tester:
- TESTING -> TESTING_DONE.
- TESTING -> BUG_FIXED.
- Other transitions are not permitted unless approved.

Bug-fix workflow:
- BUG_FIXED -> COMPLETED.

The actor responsible for this final transition and the exact
relationship between TESTING_DONE and final ticket completion
must follow the senior-approved workflow.

### FR-TKT-006: Ticket Assignment
PM/Admin can:
- Assign tickets.
- Reassign tickets.
- Assign developer.
- Assign reviewer/tester where applicable.

Assignment changes must preserve history.

The selected employee must have valid access to the project.

### FR-TKT-007: Ticket Operations
Support:
- Create.
- View.
- Edit.
- Delete with permission.
- Archive where appropriate.
- Change status.
- Change priority.
- Assign/reassign.
- Update due date and effort.
- Add labels.
- Add parent/child relationships.
- Duplicate tickets.
- Share authorized ticket links.
- Copy ticket URL.
- Search.
- Filter.
- Sort.

### FR-TKT-008: Ticket Detail View

Display all relevant ticket fields, assignments, comments,
attachments, GitHub links and activity history.

### FR-TKT-009: Ticket Activity
Record:
- Creation.
- Title/description changes.
- Assignment changes.
- Priority changes.
- Status changes.
- Due date changes.
- Comments.
- Attachments.
- Completion.

### FR-TKT-010: Ticket Deletion
Use soft deletion by default and preserve the audit history
required by the retention policy.

## 8. Module 6 - Comments and Collaboration

### FR-COM-001: Comments
Authorized employees can add and view ticket comments.

### FR-COM-002: Comment Management
Users can edit/delete their own comments subject to permissions.

### FR-COM-003: Replies and Mentions
Support comment replies and @username mentions.

### FR-COM-004: Activity History
Display ticket activities in chronological order with actor,
action, timestamp and relevant changed values.

The Notifications module is excluded. Mentions must not trigger
an in-app notification feature during the current assignment.

## 9. Module 7 - File and Attachment Management

### FR-FILE-001: Supported File Types
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

### FR-FILE-002: Attachment Count
Maximum five documents.

The exact scope of the five-document count requires confirmation.

### FR-FILE-003: File Size
Maximum 5 MB per individual document.

### FR-FILE-004: File Operations
Authorized employees can:
- Upload files to projects.
- Upload files to tickets.
- View file metadata.
- Preview supported images and PDFs.
- Download attachments.
- Delete attachments with permission.

### FR-FILE-005: File Validation and Security
- Validate extension.
- Validate MIME/content type.
- Validate actual file size.
- Generate safe storage keys.
- Prevent path traversal.
- Restrict unauthorized downloads.
- Prevent file overwrite.
- Handle failed storage/database operations safely.

### FR-FILE-006: File Metadata
Store file metadata in PostgreSQL.

Store file binaries using the approved storage approach.

## 10. Module 8 - Dashboards and Multiple Views

### FR-DASH-001: Role-Based Dashboards

Provide:
- Admin dashboard.
- PM dashboard.
- Developer dashboard.
- Tester dashboard.

### FR-DASH-002: Admin Dashboard
Display users, teams, projects, tickets, project statuses,
ticket statistics and recent system activity.

### FR-DASH-003: PM Dashboard
Display assigned projects, progress, ticket distribution,
overdue work, deadlines, workload and project activity.

### FR-DASH-004: Developer Dashboard
Display assigned/pending/in-progress/review/done tickets,
deadlines, overdue work and recent activity.

### FR-DASH-005: Tester Dashboard
Display testing queue, testing outcomes, bugs, reopened work
and pending testing.

### FR-DASH-006: Kanban Board
Display status-based columns and ticket cards.

Support:
- Drag and drop.
- Priority indicators.
- Assignee information.
- Due dates.
- Ticket types.
- Filters.
- Search.
- Controlled loading or pagination.

Every move must pass backend transition validation.

### FR-DASH-007: List View
Display ticket ID, title, type, priority, status, assignee,
reporter, due date and updated date.

Support sorting, filtering, searching and pagination.

### FR-DASH-008: Calendar View
Display ticket due dates in monthly and weekly views.

### FR-DASH-009: Project Overview
Display summary, project progress, ticket distribution,
members, recent activities and deadlines.

### FR-DASH-010: Backlog
Display unassigned, future, prioritized and sprint-ready tickets.

### FR-DASH-011: Data Accuracy
Use backend data, not hardcoded production metrics.

Provide loading, empty and error states.

## 11. Module 9 - Sprint and Backlog Management

### FR-SPR-001: Sprint Management

Authorized PM users can:
- Create sprints.
- Edit sprints.
- Set sprint goals.
- Set start/end dates.
- Add/remove tickets.
- Start sprints.
- Complete sprints.
- View sprint progress.

### FR-SPR-002: Sprint Information
Store project, name, goal, dates, status and associated tickets.

### FR-SPR-003: Sprint Completion
Incomplete tickets must be handled according to the approved
backlog/next-sprint policy.

## 12. Module 10 - Search, Filtering and Sorting

### FR-SEARCH-001: Global Search
Search authorized projects, tickets, users, teams, IDs and titles.

### FR-SEARCH-002: Ticket Filters
Support project, status, priority, type, assignee, reporter,
team, due date, created date, labels and sprint.

### FR-SEARCH-003: Sorting
Support newest, oldest, due date, priority, updated date
and created date.

### FR-SEARCH-004: Combined Operations
Search, filters, sorting and pagination must work together.

### FR-SEARCH-005: Authorization
Never return records the user is not permitted to access.

## 13. Module 11 - Reports and Analytics

### FR-REPORT-001: Project Reports
Display totals, completion, pending/overdue tickets and
priority/status/type distributions.

### FR-REPORT-002: Team Reports
Display assigned/completed/pending/overdue tickets and
workload by team member.

### FR-REPORT-003: Sprint Reports
Display sprint progress, completion rate, incomplete work
and scope changes.

### FR-REPORT-004: CSV Export
Authorized users can export permitted report data to CSV.

### FR-REPORT-005: Data Accuracy
All reports must use actual database records.

## 14. Module 12 - GitHub Integration and Development Activity

### FR-GH-001: GitHub Toolbar Button
The GitHub button shown in the provided UI reference shall
open the developer's configured personal GitHub account URL.

The URL must be configurable.

No GitHub password or personal access token may be exposed
in frontend code.

### FR-GH-002: Mock GitHub Activity
Use mock repository, branch, commit and pull request records
for the initial development assignment.

### FR-GH-003: Ticket Linking
Allow relevant mock branches, commits and pull requests
to be linked to tickets.

### FR-GH-004: GitHub Activity View
Display repository details, branches, commits, pull request
information, author, dates and review state where available.

### FR-GH-005: Future Integration Readiness
Keep the GitHub integration architecture modular so it can
later connect to the company's GitHub Enterprise.

Real OAuth and webhooks are not assumed during mock development.

## 15. Module 13 - Audit Logs

### FR-AUDIT-001: Audit Recording
Record user, role, team, project, ticket, comment, attachment,
repository and permission changes.

### FR-AUDIT-002: Audit Fields
Record actor, action, resource, timestamp and relevant metadata.

### FR-AUDIT-003: Audit Access
Authorized Admin users can view audit logs.

Normal users cannot modify audit records.

Ticket activity history and system audit logs remain in scope.

## 16. Module 14 - UI and User Experience

### FR-UI-001: Application Layout
Provide sidebar, top toolbar, profile menu, breadcrumbs,
main content and responsive behavior.

### FR-UI-002: Authentication UI
Follow the supplied authentication reference.

Use AgriBid WorkSphere branding.

Include sign-in, invitation acceptance, forgot password
and set/reset password screens.

Do not include Google or Apple authentication buttons.

### FR-UI-003: Page 42 Toolbar Scope

Include relevant search, Filter, Sort and GitHub controls.

Exclude:
- Notifications.
- Automate Pro.

### FR-UI-004: Feedback
Provide field validation, loading skeletons, empty states,
error states and success/error feedback.

### FR-UI-005: Responsive UI
Support desktop, tablet and mobile.

### FR-UI-006: Accessibility
Support keyboard navigation, focus states and readable contrast.

## 17. Module 15 - Backend API and Architecture

### FR-API-001: Modular FastAPI Backend
Provide separate modules for authentication, users, roles,
permissions, teams, projects, tickets, comments, attachments,
activities, sprints, reports, GitHub and audit logs.

### FR-API-002: Layer Separation
Separate routers, schemas, services, models and repositories.

### FR-API-003: REST API
Use appropriate methods, validation, response models,
authentication, authorization, status codes and error handling.

### FR-API-004: OpenAPI
Document endpoints, request/response models, validation,
permissions and error responses.

## 18. Module 16 - Security

- Secure password hashing.
- Backend-enforced RBAC.
- Secure sessions.
- Request validation.
- SQL injection protection.
- XSS protection.
- CSRF protection where applicable.
- CORS configuration.
- Login rate limiting.
- Secure uploads.
- Controlled file downloads.
- Environment-based secrets.
- Safe errors.
- Dependency checks.

## 19. Module 17 - Performance

- Use TanStack Query for server state.
- Avoid unnecessary API requests.
- Use pagination for large data.
- Use debounced search.
- Optimize database queries.
- Add appropriate indexes.
- Avoid N+1 queries.
- Use Redis only when justified.
- Measure using realistic test data.

## 20. Module 18 - Testing and QA

Test:
- Authentication.
- User and role permissions.
- Team membership.
- Project management.
- Ticket creation and transitions.
- Comments and attachments.
- Dashboard calculations.
- Kanban interactions.
- Search and reports.
- GitHub mock integration.
- Audit logs.
- Error and empty states.
- End-to-end workflows.

The excluded Notifications and Automate Pro features are
not part of the current functional acceptance scope.

## 21. Module 19 - GitHub Development Maintenance

- Maintain a GitHub repository.
- Use main and develop branches.
- Use feature, fix and hotfix branches.
- Follow conventional commit messages.
- Commit meaningful work regularly.
- Push work to GitHub.
- Maintain progress updates.
- Create pull requests for completed features.
- Test before requesting review.
- Address review comments.

## 22. Explicit Exclusions

The following are excluded from the current implementation:

1. Notifications module.
2. Notification UI and delivery.
3. Automate Pro and automation functionality.
4. Production hosting and deployment.
5. Real company email delivery during mock testing.
6. Real GitHub Enterprise OAuth/webhook integration during
   the initial mock-data assignment.

The GitHub toolbar button linking to the developer's personal
GitHub account remains included.

## 23. Acceptance

Each implemented functional requirement must be traceable
to its test case and acceptance criteria.

Senior approval is required for unresolved business rules
before the related workflow is finalized.

---
End of Document


## Workflow specification update - 12 November 2026

The canonical ticket status catalogue and role-based transition rules are defined in `../workflows/ticket-workflow.md`.

All functional requirements, use cases and acceptance tests involving ticket status changes must use that document. The status `COMPLETED` replaces the former `DONE` status.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.
