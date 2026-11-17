# AgriBid WorkSphere
# Software Requirements Specification (SRS)

## 1. Document Control

| Attribute | Details |
|---|---|
| Project | AgriBid WorkSphere |
| Document | Software Requirements Specification |
| Version | 1.0 |
| Date | 11 November 2026 |
| Status | Draft for Senior Review |
| Prepared for | Project Development Assignment |
| Prepared by | Gaurav |
| Primary source | Complete Project Development Assignment and Technical Specification (44 pages) |

## 2. Introduction

### 2.1 Purpose

This document defines the functional requirements, non-functional requirements, business rules, interfaces, constraints and acceptance criteria for AgriBid WorkSphere.

It serves as the baseline for:
- Frontend design and development.
- Backend API development.
- PostgreSQL database design.
- Authentication and authorization.
- Integration.
- Testing and quality assurance.

### 2.2 Product Scope

AgriBid WorkSphere is an internal project management and team collaboration platform.

It supports the company's software development lifecycle through centralized management of projects, teams, employees, tickets, bugs, testing, collaboration, documents, notifications, development activities and reports.

The product is intended to provide functionality comparable to Jira, Linear and ClickUp.

### 2.3 Intended Audience

- Project senior and reviewers.
- Frontend developers.
- Backend developers.
- Database designers.
- Testers and QA.
- Project administrators.

### 2.4 Requirement Sources

1. AgriBid WorkSphere Complete Project Development Assignment and Technical Specification.
2. Business clarifications provided by the project senior.
3. Approved requirement and design decisions recorded during development.

### 2.5 Requirement Language

- SHALL: Mandatory requirement.
- SHOULD: Recommended requirement.
- MAY: Optional requirement.
- TBD: Decision pending confirmation.

## 3. Overall System Description

### 3.1 Product Perspective

The application consists of three primary technical layers:

1. Frontend: Next.js web application.
2. Backend: FastAPI REST API.
3. Database: PostgreSQL.

External integration boundaries:
- Company email service.
- Company GitHub Enterprise.
- Approved file/object storage, when available.

During the current development assignment, email and GitHub Enterprise interactions will use dummy data.

Production hosting is excluded for now.

### 3.2 User Classes

The platform supports four primary roles:

- Admin
- Project Manager (PM)
- Developer
- Tester / QA

Each employee shall have exactly one role.

An employee may belong to multiple teams.

### 3.3 Operating Environment

Development environment:

- Windows.
- Visual Studio Code.
- Node.js 22.
- Next.js with App Router.
- TypeScript.
- Python 3.11.
- FastAPI.
- PostgreSQL 18.
- Git and GitHub.

Exact versions must be recorded in the project setup documentation.

### 3.4 Technology Requirements

#### Frontend

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Motion.
- TanStack Query.
- React Hook Form.
- Zod.
- Zustand only where global client-side state is required.

#### Backend

- Python.
- FastAPI.
- Pydantic.

#### Database

- PostgreSQL.

Redis is optional and must only be introduced when technically justified.

## 4. Functional Requirements

# 4.1 Module 1 - Authentication and Authorization

### FR-AUTH-001: Invitation-Only Account Creation

The system SHALL prohibit unrestricted public account registration.

Only authorized Admin users SHALL be able to create employee accounts and initiate invitations.

### FR-AUTH-002: Invitation Acceptance

The system SHALL allow invited employees to activate their accounts using an invitation link.

The system SHALL validate:
- Invitation existence.
- Invitation expiry.
- Invitation usage status.
- Employee account status.

An invitation SHALL not be reusable after successful activation.

### FR-AUTH-003: Employee Login

The system SHALL allow employees to sign in using company-approved email or username and password.

The backend SHALL validate credentials.

### FR-AUTH-004: Logout

The system SHALL allow authenticated users to log out and invalidate their active session according to the selected session design.

### FR-AUTH-005: Password Management

The system SHALL support:
- Forgot password.
- Password reset.
- Change password.
- Password validation.
- Password visibility controls in relevant frontend forms.

Passwords SHALL be securely hashed and SHALL never be stored in plaintext.

### FR-AUTH-006: Session Management

The system SHALL handle:
- Session persistence.
- Session expiration.
- Unauthorized access.
- Inactive accounts.
- Invalid and expired credentials.

### FR-AUTH-007: Protected Resources

The backend SHALL authenticate protected API requests.

The frontend SHALL protect authenticated application routes.

Backend authorization SHALL remain authoritative.

### FR-AUTH-008: Login Security

The system SHALL implement appropriate login rate limiting and safe authentication error messages.

# 4.2 User Management

### FR-USER-001: Create Employee

Admin SHALL be able to create an employee account.

### FR-USER-002: Employee Information

Employee records SHALL support:
- Full name.
- Email.
- Profile image.
- Employee ID, if used internally.
- Role.
- Team membership.
- Account status.
- Created date.
- Last login.

### FR-USER-003: Role Assignment

Each employee SHALL have exactly one role.

Supported roles:
- Admin.
- PM.
- Developer.
- Tester.

### FR-USER-004: Employee Operations

Admin SHALL be able to:
- View users.
- Create users.
- Edit user information.
- Assign roles.
- Assign team membership.
- Activate/deactivate users.
- View employee details.
- View project assignments.
- View employee activity.

### FR-USER-005: Account Deactivation

Deactivated employees SHALL not be allowed to authenticate.

Historical tickets and employee activity SHALL be preserved.

# 4.3 Module 2 - Team Management

### FR-TEAM-001: Team Creation

Authorized Admin users SHALL be able to create teams.

### FR-TEAM-002: Team Operations

The system SHALL support:
- Create team.
- Edit team.
- Archive/delete team according to retention rules.
- Add members.
- Remove members.
- Assign team lead.
- View team details.
- View team members.
- View team projects.
- View workload.

### FR-TEAM-003: Multiple Team Membership

An employee MAY belong to multiple teams.

The database SHALL prevent duplicate active memberships for the same user/team combination.

### FR-TEAM-004: Historical Membership

Removing an employee from a team SHALL NOT delete historical work or ticket assignment records.

### FR-TEAM-005: Member Details

The system SHALL display member name, image, role, email, designation, assigned projects, active ticket count and completed ticket count.

# 4.4 Module 3 - Project Management

### FR-PROJ-001: Project Creation

Authorized Admin/PM users SHALL be able to create projects according to assigned permissions.

### FR-PROJ-002: Project Information

Project records SHALL support:

- Project name.
- Unique project key.
- Description.
- Project logo/icon.
- Project manager.
- Assigned team.
- Start date.
- End date.
- Status.
- Visibility.
- Created date.

### FR-PROJ-003: Project Status

Default project statuses:

- Planning.
- Active.
- On Hold.
- Completed.
- Archived.

### FR-PROJ-004: Project Operations

The system SHALL support:
- Create.
- Edit.
- Archive.
- Delete according to retention rules.
- View details.
- Assign PM.
- Add/remove project members.
- Update dates and status.
- View activity.
- View project tickets.
- View reports.

### FR-PROJ-005: Project Validation

Project keys SHALL be unique.

Start and end dates SHALL be validated.

Project membership SHALL be checked against user and project permissions.

### FR-PROJ-006: Project Overview

Project details SHALL display summary, description, manager, members, total/completed/pending/overdue tickets, activities, progress, attachments and GitHub repository information.

### FR-PROJ-007: Project Statistics

Project statistics SHALL be calculated from actual ticket records.

# 4.5 Module 4 - Ticket and Task Management

### FR-TKT-001: Ticket Types

The system SHALL support:

- Epic.
- Story.
- Task.
- Subtask.
- Bug.
- Improvement.
- Technical Debt.

### FR-TKT-002: Ticket Creation

Authorized users SHALL be able to create tickets according to their permissions.

### FR-TKT-003: Ticket Fields

Tickets SHALL support:

- Automatically generated unique ticket ID.
- Title.
- Description.
- Project.
- Type.
- Priority.
- Status.
- Reporter/creator.
- Assignee.
- Reviewer/tester where applicable.
- Start date.
- Due date.
- Estimated effort.
- Labels.
- Optional parent ticket.
- Attachments.
- Created date.
- Updated date.

### FR-TKT-004: Ticket Priority

Priorities:

- Low.
- Medium.
- High.
- Critical.

### FR-TKT-005: Ticket Status Catalogue

Original PDF statuses:

- BACKLOG.
- TODO.
- IN_PROGRESS.
- IN_REVIEW.
- TESTING.
- COMPLETED.
- BLOCKED.
- REOPENED.
- CANCELLED.

Additional senior-confirmed statuses:

- TESTING_DONE.
- BUG_FIXED.

The distinction between COMPLETED and TESTING_DONE remains TBD.

### FR-TKT-006: Ticket Status Authorization

The backend SHALL enforce the following senior-confirmed rules.

Admin:
- Can change any ticket to any configured status.

Project Manager:
- Can create tickets.
- Can assign/reassign tickets.
- Can move tickets to any configured status.

Developer:
- Can move a ticket from TODO to IN_PROGRESS.
- Can move a ticket from TODO to IN_REVIEW.
- Other transitions require explicit approval.

Tester / QA:
- Can move a ticket from TESTING to TESTING_DONE.
- Can move a ticket from TESTING to BUG_FIXED.
- Other transitions require explicit approval.

The transition rules SHALL be implemented in backend business logic.

The exact behavior for remaining statuses is pending clarification.

### FR-TKT-007: Ticket Assignment

The system SHALL support assignment, reassignment, reviewer/tester assignment, assignee display, assignment history and assignment notifications.

The system SHALL verify project access before assignment.

### FR-TKT-008: Ticket Operations

The system SHALL support:

- Create/view/edit/delete.
- Archive where required.
- Status change.
- Priority change.
- Assignment/reassignment.
- Due date and effort updates.
- Labels.
- Parent/child relationships.
- Duplicate ticket.
- Authorized share link.
- Copy ticket URL.
- Search/filter/sort.

### FR-TKT-009: Ticket Details

The ticket detail page SHALL display all relevant ticket fields, comments, attachments, GitHub links and activity history.

### FR-TKT-010: Ticket Deletion

Ticket deletion SHALL require permission and confirmation.

Soft deletion SHALL be used by default.

Required history SHALL be retained.

### FR-TKT-011: Ticket Completion

The system SHALL enforce configured completion conditions, record completion time and user, update project statistics and notify relevant stakeholders.

# 4.6 Module 5 - Comments and Collaboration

### FR-COM-001: Comments

Users SHALL be able to add and view comments on accessible tickets.

Authorized users SHALL be able to edit/delete their own comments according to permissions.

### FR-COM-002: Replies and Mentions

The system SHALL support comment replies and @username mentions.

### FR-COM-003: Mention Notifications

Mentioned users SHALL receive notifications only when they are authorized to access the related project/ticket.

### FR-COM-004: Ticket Activity

The system SHALL record:
- Ticket creation.
- Title/description updates.
- Assignment changes.
- Priority changes.
- Status changes.
- Due date changes.
- Comment additions.
- Attachment uploads/deletions.
- Ticket completion.

Activities SHALL contain actor, action, timestamp and relevant old/new values.

# 4.7 Module 6 - File and Attachment Management

### FR-FILE-001: Supported Formats

The system SHALL support:

JPG, JPEG, PNG, WEBP, PDF, XLS, XLSX, CSV, DOC and DOCX.

### FR-FILE-002: Document Count

A maximum of five documents SHALL be allowed.

The exact scope of this limit (ticket, project or upload operation) remains TBD.

### FR-FILE-003: File Size

Working interpretation: maximum 5 MB per individual document.

This interpretation requires confirmation.

### FR-FILE-004: Upload Operations

The system SHALL support upload to projects/tickets where authorized, metadata display, preview of supported images/PDFs, downloads and permission-controlled deletion.

### FR-FILE-005: File Security

The backend SHALL validate extensions, actual MIME/content type and file size.

The system SHALL:
- Use generated storage names.
- Prevent path traversal.
- Avoid trusting client filenames.
- Store files outside publicly executable application directories.
- Enforce download/preview permissions.
- Avoid storing large file binaries directly in PostgreSQL.

### FR-FILE-006: Attachment Metadata

PostgreSQL SHALL store file ID, original filename, storage key, size, MIME type, uploader, project/ticket reference, timestamp and deletion status.

# 4.8 Module 7 - Notification System

### FR-NOT-001: Notification Events

The system SHALL support notifications for:

- Assignment/reassignment.
- Status and priority changes.
- Comments and mentions.
- Upcoming/overdue deadlines.
- Project membership.
- Invitations.
- Review/testing requests.
- Reopened/completed tickets.

### FR-NOT-002: Notification Interface

The system SHALL provide notification icon, unread count, notification list, read/unread state, mark-as-read and mark-all-as-read operations, timestamps and links to related resources.

### FR-NOT-003: Notification Privacy

Users SHALL only access their own notifications.

### FR-NOT-004: Duplicate Prevention

The system SHALL avoid duplicate notifications for repeated processing of the same event.

### FR-NOT-005: Scheduled Notifications

Time-based reminders SHALL use an appropriate scheduled/background processing mechanism.

# 4.9 Module 8 - Dashboard and Multiple Views

### FR-DASH-001: Role-Based Dashboard

The application SHALL provide separate dashboard data for Admin, PM, Developer and Tester.

### FR-DASH-002: Admin Dashboard

Display user/team/project/ticket totals, active/completed projects, pending/completed/overdue tickets, recent system activity and team-wise project distribution.

### FR-DASH-003: PM Dashboard

Display assigned projects, completion percentage, ticket statistics, overdue work, workload, deadlines and activity.

### FR-DASH-004: Developer Dashboard

Display assigned/pending/in-progress/review/completed tickets, deadlines, overdue work and recent activity.

### FR-DASH-005: Tester Dashboard

Display assigned testing queue, passed/failed/reopened tickets, reported bugs and upcoming testing deadlines.

### FR-DASH-006: Kanban Board

The system SHALL provide:
- Columns based on ticket status.
- Drag-and-drop movement.
- Ticket cards.
- Priority.
- Assignee.
- Due dates.
- Ticket type.
- Search and filters.
- Controlled loading or pagination.

Drag-and-drop SHALL only allow backend-approved transitions.

### FR-DASH-007: List View

Display ticket ID, title, type, priority, status, assignee, reporter, due date and updated date.

Support sorting, filtering, searching and pagination.

### FR-DASH-008: Calendar View

Support monthly and weekly views, ticket selection, overdue/upcoming indication and filtering.

### FR-DASH-009: Project Overview

Display project summary, progress, ticket distribution, team members, activities and deadlines.

### FR-DASH-010: Backlog

Display unassigned, future, prioritized and sprint-ready tickets.

### FR-DASH-011: Real Data

Dashboards and charts SHALL use backend data, not hardcoded production statistics.

The frontend SHALL handle loading, empty and error states.

# 4.10 Module 9 - Sprint and Backlog Management

### FR-SPR-001: Sprint Operations

Authorized PM users SHALL be able to create, edit, start and complete sprints.

### FR-SPR-002: Sprint Information

Support sprint name, goal, project, start/end dates, status and assigned/completed/pending tickets.

### FR-SPR-003: Sprint Tickets

PM SHALL be able to add/remove tickets according to project permissions.

### FR-SPR-004: Sprint Lifecycle

The system SHALL support sprint creation, ticket planning, starting, monitoring, completing and handling incomplete tickets.

### FR-SPR-005: Sprint Validation

Validate dates and project relationships.

# 4.11 Module 10 - Search, Filters and Sorting

### FR-SEARCH-001: Global Search

Search authorized projects, tickets, users, teams, ticket IDs and titles.

### FR-SEARCH-002: Ticket Filters

Support filtering by project, status, priority, type, assignee, reporter, team, due date, created date, labels and sprint.

### FR-SEARCH-003: Sorting

Support newest, oldest, due date, priority, updated date and created date.

### FR-SEARCH-004: Combined Filtering

Filters SHALL be combinable with search, sorting and pagination.

### FR-SEARCH-005: Data Security

Search SHALL NOT expose inaccessible records, counts or result information.

# 4.12 Module 11 - Reports and Analytics

### FR-REPORT-001: Project Reports

Display total, completed, pending and overdue tickets, priority/status/type distributions and completion percentage.

### FR-REPORT-002: Team Reports

Display assigned/completed/pending/overdue tickets, workload by member and ticket status distribution.

### FR-REPORT-003: Sprint Reports

Display sprint progress, completed/incomplete work, completion rate, late-added tickets and scope changes.

### FR-REPORT-004: CSV Export

Authorized users SHALL be able to export reports as CSV.

### FR-REPORT-005: Accurate Metrics

Reports SHALL be based on actual records. Ticket counts alone SHALL NOT be treated as sufficient employee performance measurements.

# 4.13 Module 12 - GitHub Integration and Development Activity

### FR-GH-001: Repository Connection

Authorized users SHALL be able to connect, view and disconnect repositories according to permissions.

### FR-GH-002: Ticket Linking

Support links between tickets and GitHub branches, commits and pull requests.

Ticket IDs SHOULD be used in branch names and commit messages.

### FR-GH-003: GitHub Activity Display

Display linked branch, commit history, PR title/status/URL/author/dates and review status where available.

### FR-GH-004: Webhooks

The architecture SHALL support push, pull-request opened/updated/closed/merged and review-submitted events.

Webhook processing SHALL verify signatures, handle retries and prevent duplicate processing when real integration is enabled.

### FR-GH-005: Development Summary

Display commits, opened/merged PRs, linked tickets and tickets awaiting review based on actual or explicitly labelled mock data.

### FR-GH-006: Current Assignment Mock Integration

Use dummy GitHub Enterprise data during the current development assignment.

Real company integration credentials are not assumed.

# 4.14 Module 13 - Audit Logs and Activity Tracking

### FR-AUDIT-001: Audit Events

Record important user, role, team, project, ticket, comment, attachment, repository and permission actions.

### FR-AUDIT-002: Audit Record Fields

Each audit record SHALL contain actor, action, resource type/ID, timestamp and relevant metadata. Request/correlation ID SHOULD be included where appropriate.

### FR-AUDIT-003: Audit Protection

Normal users SHALL not be able to edit audit records.

# 4.15 Module 14 - UI/UX and Design

### FR-UI-001: Application Layout

Provide sidebar, top navigation, profile menu, notification panel, breadcrumbs and main content area.

### FR-UI-002: Permission-Based Navigation

Navigation items SHALL be displayed according to user permissions.

Backend authorization remains mandatory.

### FR-UI-003: Design System

Use shadcn/ui and Tailwind CSS consistently.

Use Motion for meaningful transitions only.

### FR-UI-004: Responsive Behavior

Support desktop, tablet and mobile layouts.

### FR-UI-005: Feedback and Accessibility

Provide loading skeletons, empty states, errors, success/error feedback, destructive-action confirmations, keyboard interactions and readable contrast.

### FR-UI-006: Authentication Screens

Authentication UI SHALL use the supplied reference image.

- Product branding: AgriBid WorkSphere.
- Sign in.
- Invitation/account activation.
- Password setup.
- Forgot password.
- Reset password.
- No Google login.
- No Apple login.
- No unrestricted public registration.

# 4.16 Module 15 - Backend API and Architecture

### FR-API-001: Modular Backend

Organize backend modules for:
- Authentication.
- Users.
- Roles.
- Permissions.
- Teams.
- Projects.
- Project members.
- Tickets.
- Comments.
- Attachments.
- Ticket activities.
- Notifications.
- Sprints.
- Reports.
- GitHub.
- Audit logs.

### FR-API-002: Layer Separation

Maintain separation between:
- API routes/controllers.
- Request and response schemas.
- Business logic/services.
- Database models.
- Repositories/data-access.
- External integrations.
- Background jobs.

### FR-API-003: REST API Requirements

APIs SHALL use appropriate HTTP methods, validation, response schemas, authentication, authorization, consistent errors, status codes and pagination/filtering where appropriate.

### FR-API-004: API Documentation

Every module SHALL document endpoints, request body, query parameters, responses, validation, authentication, permissions and errors.

Use FastAPI OpenAPI documentation.

# 4.17 Module 16 - Security and Production Readiness

### FR-SEC-001: Authorization

Enforce permissions in the backend for every protected operation.

### FR-SEC-002: Password Security

Use secure password hashing.

### FR-SEC-003: Session Security

Use secure session/token handling and expiry.

### FR-SEC-004: Input Security

Validate inputs and protect against SQL injection and XSS.

Apply CSRF protection where applicable.

### FR-SEC-005: Application Security

Configure CORS, rate limiting, secure file uploads, secrets management and environment-based configuration.

### FR-SEC-006: Error Security

Do not expose secrets, stack traces or internal database errors to users.

### FR-SEC-007: Download Security

Enforce authorization for attachment downloads and previews.

### FR-SEC-008: Integration Security

Protect GitHub credentials and verify real webhook signatures when enabled.

# 4.18 Module 17 - Performance and Optimization

### FR-PERF-001: Frontend Performance

Use TanStack Query, controlled loading, caching, cache invalidation, debounced search, optimized images and appropriate lazy loading.

### FR-PERF-002: Backend Performance

Use database indexes, query optimization, pagination, connection pooling and avoid N+1 queries.

### FR-PERF-003: Optional Redis

Use Redis only where a measurable technical need justifies it.

### FR-PERF-004: Background Processing

Move long-running tasks to appropriate background processing where required.

### FR-PERF-005: Performance Testing

Measure performance using realistic test data.

# 4.19 Module 18 - Testing and Quality Assurance

### FR-TEST-001: Frontend Tests

Test login forms, navigation, project/ticket forms, status transitions, Kanban, comments, attachments, filters, dashboards and error handling.

### FR-TEST-002: Backend Tests

Test authentication, authorization, project/team/ticket APIs, status transitions, assignment, comments, files, notifications, GitHub webhook validation and reports.

### FR-TEST-003: Integration Tests

Test complete workflows across frontend, backend and database.

### FR-TEST-004: Negative Scenarios

Test invalid/missing input, unauthorized access, expired sessions, duplicate requests, deleted users, archived projects, invalid/oversized files, past due dates, concurrent ticket changes, webhook retries, network failures and empty datasets.

### FR-TEST-005: Acceptance

Critical workflows, permission tests and API tests SHALL pass.

No known critical security issue should remain at the approved release gate.

Test results SHALL be documented.

# 4.20 Module 19 - GitHub Repository and Daily Development Maintenance

### FR-GIT-001: Repository Setup

Maintain a dedicated repository with README, .gitignore, environment example and setup/contribution instructions.

### FR-GIT-002: Branching

Use:

- main.
- develop.
- feature/*.
- fix/*.
- hotfix/*.

### FR-GIT-003: Commit Messages

Use meaningful commit messages such as:

- feat(auth): implement login API
- feat(projects): add project creation
- fix(tickets): prevent invalid status transition
- test(auth): add authentication tests
- docs(readme): update project setup guide

### FR-GIT-004: Daily Maintenance

Every working day:
- Pull approved changes.
- Work on feature/fix branches.
- Commit changes regularly.
- Push code to GitHub.
- Update assigned tickets.
- Record progress and blockers.
- Run relevant tests.
- Create pull requests when features are ready.
- Resolve review comments.

### FR-GIT-005: Pull Request

Every PR SHALL describe implementation, related ticket, changed files, UI screenshots where applicable, tests, limitations and migrations.

Unreviewed code SHALL NOT be merged into protected main.

## 5. Non-Functional Requirements

### NFR-001: Security

Authentication, authorization, password handling, session management and file access must follow secure development practices.

### NFR-002: Performance

The application should use pagination, indexes, optimized queries and controlled frontend fetching.

Actual performance targets require approval and measurement.

### NFR-003: Reliability

Multi-step database operations should maintain transactional integrity.

External integration processing should handle failure and retry scenarios safely.

### NFR-004: Usability

The user interface must be consistent, clear, responsive and accessible.

### NFR-005: Maintainability

Frontend, backend and database layers must remain modular and independently understandable.

### NFR-006: Scalability

Data access and API design should support increasing project, employee and ticket records.

Exact capacity targets are TBD.

### NFR-007: Data Integrity

Use primary keys, foreign keys, uniqueness, constraints, migrations and controlled deletion.

### NFR-008: Observability

Application errors and relevant business events should be logged safely.

### NFR-009: Compatibility

The web interface should work in supported modern browsers. The exact browser support matrix is TBD.

### NFR-010: Backup and Recovery

Production backup and recovery requirements will be defined when hosting scope is approved.

## 6. External Interface Requirements

### 6.1 User Interface

The web frontend SHALL communicate with FastAPI through defined REST endpoints.

### 6.2 Database Interface

FastAPI SHALL interact with PostgreSQL through a controlled database-access layer.

### 6.3 Email Interface

Use dummy company-style employee addresses and simulated email events in the development assignment.

Actual delivery through the company's email service is not assumed.

### 6.4 GitHub Interface

Use mock GitHub Enterprise repositories, branches, commits and pull requests during initial development.

### 6.5 File Interface

Use an approved storage abstraction. The final company storage provider remains TBD.

## 7. Data Requirements

The database design SHALL cover the entities identified in the assignment, including:

- Users.
- Roles.
- Permissions.
- Teams.
- Team members.
- Projects.
- Project members.
- Tickets.
- Ticket labels.
- Labels.
- Ticket relationships.
- Comments.
- Comment mentions.
- Attachments.
- Ticket activities.
- Notifications.
- Sprints.
- Sprint tickets.
- GitHub repositories.
- GitHub branches.
- GitHub commits.
- GitHub pull requests.
- GitHub webhook events.
- Audit logs.

### Database Rules

1. Use primary and foreign keys.
2. Apply unique constraints.
3. Add justified indexes.
4. Use database migrations.
5. Use transactions for multi-step operations.
6. Store timestamps consistently in UTC.
7. Define retention and deletion behavior.
8. Prevent duplicate and orphan records.
9. Avoid N+1 queries.
10. Do not expose internal database errors.

## 8. Business Constraints

1. Public registration is not permitted.
2. Each employee has exactly one role.
3. Employees may belong to multiple teams.
4. Admin can move tickets to any configured status.
5. PM can create, assign and move tickets to any configured status.
6. Developer transitions are limited to the senior-confirmed rules.
7. Tester transitions are limited to the senior-confirmed rules.
8. Maximum attachment count is five documents; exact scope is TBD.
9. Working file-size interpretation is 5 MB per document; final scope is TBD.
10. Dummy company email data is used initially.
11. Dummy GitHub Enterprise data is used initially.
12. Production hosting and deployment are excluded.

## 9. Acceptance Criteria

The project SHALL be evaluated on:

- Authentication and invitation workflow.
- Role-based access enforcement.
- User and team management.
- Project management.
- Ticket creation and assignment.
- Valid status transitions.
- Comment and attachment operations.
- Notification behavior.
- Dashboard data correctness.
- Search/filter operations.
- API response and error consistency.
- Database integrity.
- GitHub workflow compliance.
- Frontend/backend integration.
- Testing coverage and documented results.

## 10. Open Requirements and Pending Decisions

| ID | Question | Status |
|---|---|---|
| TBD-001 | Does TESTING_DONE replace COMPLETED? | Pending |
| TBD-002 | What happens after BUG_FIXED? | Pending |
| TBD-003 | Can Developer transition from IN_PROGRESS to IN_REVIEW? | Pending; senior's stated rule records TODO as source |
| TBD-004 | Who can use BLOCKED, REOPENED and CANCELLED? | Pending |
| TBD-005 | Does five-document limit apply per ticket, project or upload operation? | Pending |
| TBD-006 | Confirm 5 MB per individual document | Working interpretation |
| TBD-007 | Which company email provider will eventually be used? | Mock data currently |
| TBD-008 | Which GitHub Enterprise API configuration will be used? | Mock data currently |
| TBD-009 | What is the final team lead assignment policy? | Pending |
| TBD-010 | Can PM create projects in all cases or only with specific permission? | Follow PDF permission rules |

## 11. Requirement Traceability

Every functional requirement SHALL be mapped to:

- A module.
- A database entity where applicable.
- One or more API endpoints.
- One or more UI screens.
- Positive test cases.
- Negative/edge test cases.
- An acceptance criterion.

A separate Requirements Traceability Matrix (RTM) SHALL maintain these links.

## 12. Change Management

Any requirement change must be recorded with:

- Requirement ID.
- Previous behavior.
- New requested behavior.
- Decision owner.
- Approval date.
- Affected UI, API and database components.
- Affected test cases.

Unapproved assumptions SHALL NOT silently become permanent business rules.

---
End of Document

## Approved Scope Change - 11 November 2026

See `docs/requirements/approved-scope-changes.md`.

This approved clarification supersedes conflicting requirements
in this document for the current implementation.

Key changes:
- Notifications module excluded.
- Automate Pro feature excluded.
- GitHub UI button uses the developer's personal GitHub account.
- GitHub activity uses mock data during initial development.
- TESTING_DONE and COMPLETED are separate statuses.
- BUG_FIXED leads to COMPLETED.
- Attachment size is 5 MB per individual file.

<!-- SCOPE-CHANGE-2026-11-11-01 -->


## Senior clarification update - 12 November 2026

The latest senior-confirmed workflow supersedes earlier draft status rules. Refer to `../workflows/ticket-workflow.md`.

The selected open-source implementation tools and authentication/database decisions are documented in `../architecture/technology-decisions.md`.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.

## Authoritative implementation alignment — 17 November 2026

The implemented authentication contract is recorded in `../architecture/technology-decisions.md` and `../api/api-specification.md`; use those sections instead of the earlier provisional bearer-only/SameSite=Strict design text. The current local implementation uses the ID, access and refresh HttpOnly cookie paths and lifetimes documented there.

The invitation design must preserve pending employee full name, optional employee ID, one role and selected teams. The current invitation model does not yet contain all pending fields. Add the normalized invitation-team association and migration before building invitation APIs. Acceptance must create the employee and memberships in a single transaction.

The latest senior-confirmed ticket transitions are defined only in `../workflows/ticket-workflow.md`. The earlier direct Developer `TODO` → `IN_REVIEW` statement is superseded. The Notifications and Automate Pro modules are excluded; retain traceability references but mark Notifications requirements excluded from current delivery.
