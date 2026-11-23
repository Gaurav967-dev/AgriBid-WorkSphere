# AgriBid WorkSphere
# Use Case Catalogue

| Attribute | Details |
|---|---|
| Project | AgriBid WorkSphere |
| Document | Use Case Catalogue |
| Version | 1.0 |
| Date | 11 November 2026 |
| Status | Draft for Senior Review |
| Source | Project Development Assignment and Senior Clarifications |

## 1. Purpose

This document describes how users interact with AgriBid WorkSphere
to accomplish specific business goals.

Each use case describes:
- Use case ID and name.
- Primary actor.
- Supporting actors.
- Preconditions.
- Trigger.
- Main success flow.
- Alternate and exception flows.
- Postconditions.
- Relevant requirements.

## 2. Actors

### ACT-001: Admin
Manages users, roles, teams, projects, settings and system activity.

### ACT-002: Project Manager
Manages assigned projects, project members, tickets, assignments,
sprints and project reports.

### ACT-003: Developer
Works on assigned development tickets and records development progress.

### ACT-004: Tester / QA
Performs testing, records results, reports bugs and provides test evidence.

### ACT-005: Email Service
Represents the company's email system. Dummy email data and simulated
delivery will be used during initial development.

### ACT-006: GitHub Enterprise
Represents the company's GitHub Enterprise integration. Mock repository,
branch, commit and pull request data will be used initially.

### ACT-007: Background Processing
Represents scheduled or asynchronous processing for notifications
and related background operations, where implemented.

## 3. Use Case Index

| ID | Use Case | Primary Actor |
|---|---|---|
| UC-001 | Sign In | All Employees |
| UC-002 | Sign Out | Authenticated Employee |
| UC-003 | Create Employee Invitation | Admin |
| UC-004 | Accept Employee Invitation | Invited Employee |
| UC-005 | Forgot Password | Employee |
| UC-006 | Reset Password | Employee |
| UC-007 | Manage Employee Accounts | Admin |
| UC-008 | Manage Roles | Admin |
| UC-009 | Manage Teams | Admin |
| UC-010 | Manage Team Membership | Admin |
| UC-011 | Create Project | Admin / Authorized PM |
| UC-012 | Manage Project Members | Authorized PM / Admin |
| UC-013 | Create Ticket | Authorized PM / Admin |
| UC-014 | Assign or Reassign Ticket | PM / Admin |
| UC-015 | Update Development Ticket | Developer |
| UC-016 | Perform Ticket Testing | Tester |
| UC-017 | Add Comments and Mentions | Authorized Employee |
| UC-018 | Upload and Manage Attachments | Authorized Employee |
| UC-019 | Notifications use case | Excluded by senior clarification |
| UC-020 | Manage Sprint and Backlog | Authorized PM |
| UC-021 | Search, Filter and Sort Records | Authorized Employee |
| UC-022 | View Project Dashboard | All Roles |
| UC-023 | Generate Reports | Authorized Employee |
| UC-024 | Link GitHub Development Activity | Authorized Employee |
| UC-025 | View Audit Logs | Admin |

# 4. Detailed Use Cases

## UC-001: Sign In

Primary actor: Employee (Admin, PM, Developer or Tester).

Goal: Access the application using authorized company credentials.

Preconditions:
- Employee account exists.
- Employee account is active.
- Employee has completed invitation activation.
- Employee has exactly one assigned role.

Trigger:
Employee opens the Sign In page.

Main success flow:
1. Employee enters their email/username.
2. Employee enters their password.
3. Employee optionally selects Remember Me.
4. Employee clicks Sign In.
5. Frontend validates the input format.
6. Frontend sends credentials to the backend.
7. Backend validates the credentials.
8. Backend checks the employee account status.
9. Backend establishes an authenticated session.
10. Application retrieves employee information and role.
11. Application displays the authorized dashboard.

Alternate and exception flows:
- A required field is missing: display validation error.
- Email/username format is invalid: reject the input.
- Password is incorrect: show a safe authentication error.
- Account is inactive: deny access.
- Account is missing: reject authentication.
- Too many login attempts: apply configured rate limiting.
- Backend is unavailable: display an appropriate error.
- Session creation fails: do not treat the user as authenticated.

Postconditions:
- Successful login establishes an authorized session.
- Login time may be recorded.
- User receives access only to permitted application resources.

Related requirements:
FR-AUTH-003, FR-AUTH-006, FR-AUTH-007, FR-AUTH-008.

## UC-002: Sign Out

Primary actor: Authenticated Employee.

Preconditions:
- Employee has an active session.

Trigger:
Employee selects Sign Out.

Main success flow:
1. Employee opens the profile menu.
2. Employee selects Sign Out.
3. Frontend requests logout.
4. Backend invalidates the session according to the authentication design.
5. Frontend clears applicable client authentication state.
6. Employee is redirected to Sign In.

Alternate flows:
- Network failure occurs during logout.
- Session has already expired.
- Session is already revoked.

Postconditions:
- The previous session must not remain usable after successful logout.

Related requirement:
FR-AUTH-004.

## UC-003: Create Employee Invitation

Primary actor: Admin.

Supporting actor: Email Service.

Preconditions:
- Admin is authenticated.
- Admin has user-management permission.

Trigger:
Admin selects Create User.

Main success flow:
1. Admin opens User Management.
2. Admin selects Create User.
3. System displays the employee form.
4. Admin enters employee full name and email.
5. Admin assigns exactly one role.
6. Admin selects one or more teams if applicable.
7. Admin submits the form.
8. Backend validates the fields and permissions.
9. System checks whether the email already exists.
10. System creates an inactive employee account or invitation record
    according to the approved data model.
11. System generates a secure, expiring invitation token.
12. System stores the invitation securely.
13. Email delivery is simulated using dummy company email data.
14. System displays the invitation creation result.

Alternate and exception flows:
- Required employee name is missing.
- Email address is invalid.
- Email already exists.
- Role is missing or invalid.
- Admin lacks permission.
- One or more selected teams do not exist.
- Invitation creation fails.
- Email simulation fails.
- Admin submits the request more than once.

Postconditions:
- Employee invitation is created successfully.
- Employee is not considered activated until completing the
  invitation acceptance workflow.

Related requirements:
FR-USER-001, FR-USER-002, FR-USER-003, BR-001.

## UC-004: Accept Employee Invitation

Primary actor: Invited Employee.

Supporting actor: Email Service.

Preconditions:
- Admin has created an invitation.
- Invitation belongs to the employee.
- Invitation is valid and unused.

Trigger:
Employee opens the invitation link.

Main success flow:
1. Employee opens the invitation link.
2. Frontend sends the invitation token for verification.
3. Backend verifies the token.
4. Backend checks invitation expiry and usage status.
5. System displays the account activation form.
6. Employee enters a new password.
7. Employee confirms the password.
8. Frontend validates password requirements.
9. Backend independently validates password requirements.
10. Backend securely hashes the password.
11. Backend activates the employee account.
12. Invitation is marked used.
13. System displays successful activation.
14. Employee proceeds to Sign In.

Alternate and exception flows:
- Token is invalid.
- Token is expired.
- Token has already been used.
- Employee account is inactive or revoked.
- Password does not meet requirements.
- Password confirmation does not match.
- Activation request is submitted more than once.
- Backend operation fails.

Postconditions:
- Employee account is activated only after successful verification.
- Password is stored as a secure hash.
- Invitation cannot be reused.

Related requirements:
FR-AUTH-001, FR-AUTH-002, FR-AUTH-005.

## UC-005: Forgot Password

Primary actor: Employee.

Supporting actor: Email Service.

Preconditions:
- Employee has an existing account.

Trigger:
Employee selects Forgot Password.

Main success flow:
1. Employee opens Forgot Password.
2. Employee enters the registered email.
3. Frontend validates the email format.
4. Request is submitted to the backend.
5. Backend processes the request using a non-enumerating response.
6. For an eligible account, a reset token is generated and stored securely.
7. A reset event is simulated using dummy email data.
8. Employee receives the simulated reset link through the development flow.
9. System displays the request result.

Alternate flows:
- Invalid email format.
- Email is not registered.
- Account is inactive.
- Repeated reset requests.
- Rate limit is reached.
- Reset-token generation fails.

Postconditions:
- A valid password reset process can be initiated.
- The response must not reveal whether an account exists.

Related requirements:
FR-AUTH-005.

## UC-006: Reset Password

Primary actor: Employee.

Preconditions:
- Employee has a valid, unused, unexpired reset token.

Trigger:
Employee opens the password reset link.

Main success flow:
1. Employee opens the reset link.
2. Backend verifies the token.
3. System displays the reset form.
4. Employee enters a new password.
5. Employee confirms the password.
6. Frontend validates the password.
7. Backend repeats password validation.
8. Backend hashes the new password.
9. Backend updates the password securely.
10. Reset token is marked used.
11. System displays successful password reset.

Alternate flows:
- Invalid token.
- Expired token.
- Reused token.
- Password too weak.
- Confirmation mismatch.
- Database failure.

Postconditions:
- Password is updated.
- Reset token cannot be reused.
- Existing sessions follow the approved revocation policy.

Related requirement:
FR-AUTH-005.

## UC-007: Manage Employee Accounts

Primary actor: Admin.

Preconditions:
- Admin is authenticated and authorized.

Trigger:
Admin opens User Management.

Main success flow:
1. System displays employees.
2. Admin searches or filters employees.
3. Admin selects an employee.
4. System displays employee details.
5. Admin selects an available operation.
6. Admin edits information, activates/deactivates an account
   or initiates a new invitation.
7. Backend validates permissions and business rules.
8. System saves the change.
9. System records relevant activity.
10. System refreshes employee information.

Alternate flows:
- Employee does not exist.
- Duplicate email.
- Invalid role.
- Unauthorized operation.
- Employee has historical ticket assignments.
- Admin attempts to deactivate a protected administrator account.
- Conflicting concurrent update.

Postconditions:
- Employee information reflects the authorized change.
- Historical work remains preserved.

Related requirements:
FR-USER-001 to FR-USER-005.

## UC-008: Manage Roles

Primary actor: Admin.

Preconditions:
- Admin is authorized to manage roles.

Trigger:
Admin opens role management.

Main success flow:
1. Admin views the supported roles.
2. Admin selects an employee.
3. Admin assigns or changes the employee's role.
4. Backend validates the role.
5. Database stores exactly one role for the employee.
6. System records the role-change activity.

Alternate flows:
- Invalid role.
- Employee does not exist.
- Unauthorized role change.
- Attempt to assign multiple roles.
- Role change conflicts with an existing permission-sensitive session.

Postconditions:
- Employee has exactly one valid role.
- Effective permissions reflect the updated role.

Related requirements:
FR-USER-003, FR-SEC-001, BR-002.

## UC-009: Manage Teams

Primary actor: Admin.

Preconditions:
- Admin is authenticated.
- Admin has team-management permission.

Trigger:
Admin opens Team Management.

Main success flow:
1. Admin views existing teams.
2. Admin selects Create Team.
3. Admin enters team name and description.
4. Admin selects a team lead.
5. Backend validates the information.
6. System creates the team.
7. System displays team details.

Alternate flows:
- Missing team name.
- Duplicate team name according to uniqueness policy.
- Invalid/inactive team lead.
- Unauthorized user.
- Database operation fails.

Postconditions:
- Team is created with a valid identifier.
- Team information is available to authorized users.

Related requirements:
FR-TEAM-001, FR-TEAM-002.

## UC-010: Manage Team Membership

Primary actor: Admin.

Preconditions:
- Team exists.
- Employee exists.
- Admin has team-management permission.

Trigger:
Admin selects Manage Members.

Main success flow:
1. Admin opens team details.
2. Admin views current members.
3. Admin selects one or more employees.
4. Admin adds employees to the team.
5. Backend checks employee and team validity.
6. Backend prevents duplicate active memberships.
7. Database records membership.
8. Team details refresh.

Alternate flows:
- Team does not exist.
- Employee does not exist.
- Employee is inactive.
- Employee is already an active member.
- Admin removes a non-member.
- Team lead is removed.
- Historical ticket records exist.

Postconditions:
- Membership records are correct.
- Historical work is preserved.
- One employee may belong to multiple teams.

Related requirements:
FR-TEAM-003, FR-TEAM-004, BR-003.

## UC-011: Create Project

Primary actor: Admin or authorized PM.

Preconditions:
- User is authenticated.
- User has project-creation permission.

Trigger:
User selects Create Project.

Main success flow:
1. User opens Project Management.
2. User selects Create Project.
3. System displays the project form.
4. User enters project name.
5. User enters a unique project key.
6. User enters description.
7. User selects project manager and assigned team.
8. User enters start and end dates.
9. User selects status and visibility.
10. Frontend validates the form.
11. Backend validates fields and permissions.
12. Backend verifies project key uniqueness.
13. Database creates the project.
14. System displays the project details.

Alternate flows:
- Required field missing.
- Duplicate project key.
- Invalid project dates.
- Invalid manager/team.
- Unauthorized project creation.
- Database constraint violation.

Postconditions:
- Project exists.
- Project identifier is unique.
- Relevant activity is recorded.

Related requirements:
FR-PROJ-001 to FR-PROJ-007.

## UC-012: Manage Project Members

Primary actor: Authorized PM or Admin.

Preconditions:
- Project exists.
- User has project-member management permission.

Trigger:
User opens project membership management.

Main success flow:
1. User views current project members.
2. User selects Add Member.
3. User chooses authorized employees.
4. Backend validates employee and project membership.
5. Membership records are created.
6. System refreshes project details.

Alternate flows:
- Duplicate membership.
- Employee is inactive.
- Employee lacks required project access.
- Project is archived.
- Unauthorized membership modification.

Postconditions:
- Project membership is updated.
- Historical project activity is retained.

Related requirements:
FR-PROJ-004, FR-PROJ-005.

## UC-013: Create Ticket

Primary actor: PM or Admin.

Preconditions:
- User has ticket-creation permission.
- Project exists and is accessible.

Trigger:
PM/Admin selects Create Ticket.

Main success flow:
1. User opens a project.
2. User selects Create Ticket.
3. System displays ticket creation form.
4. User enters title and description.
5. User selects project and ticket type.
6. User selects priority and initial status.
7. User selects assignee and reviewer/tester where applicable.
8. User enters dates and estimated effort.
9. User adds optional labels and parent relationship.
10. Frontend validates required fields.
11. Backend validates the request and project access.
12. Backend generates a unique ticket identifier.
13. Database saves the ticket.
14. Relevant activity is recorded.
15. Assigned user receives a notification event.
16. System displays the ticket details.

Alternate flows:
- Required field missing.
- Invalid project.
- Duplicate or invalid ticket key.
- Invalid priority/type/status.
- Assignee lacks project access.
- Invalid parent ticket.
- Parent-child cycle.
- Invalid dates or effort.
- Duplicate request.
- Concurrent ticket creation.

Postconditions:
- Ticket is saved with a unique identifier.
- Assignment and activity information are retained.

Related requirements:
FR-TKT-001 to FR-TKT-003.

## UC-014: Assign or Reassign Ticket

Primary actor: PM or Admin.

Preconditions:
- Ticket exists.
- User has assignment permission.

Trigger:
PM/Admin selects Assign or Reassign.

Main success flow:
1. User opens ticket details.
2. User selects an eligible employee.
3. Backend checks the employee's active status.
4. Backend validates project membership/access.
5. Backend updates the assignment.
6. Previous/new assignment history is recorded.
7. Notification event is generated.
8. Ticket details refresh.

Alternate flows:
- Ticket does not exist.
- Employee does not exist.
- Employee is inactive.
- Employee lacks project access.
- User lacks assignment permission.
- Concurrent assignment update.

Postconditions:
- Current assignment is correct.
- Assignment history is preserved.
- Relevant notification is generated.

Related requirements:
FR-TKT-007.

## UC-015: Update Development Ticket

Primary actor: Developer.

Preconditions:
- Developer is authenticated.
- Ticket is accessible and assigned according to project policy.

Trigger:
Developer opens an assigned ticket.

Main success flow:
1. Developer opens My Work.
2. System displays assigned tickets.
3. Developer opens a ticket.
4. Developer reviews requirements and details.
5. Developer moves the ticket from TODO to IN_PROGRESS.
6. Developer performs implementation work.
7. Developer adds comments and attachments where needed.
8. Developer links a GitHub branch or commit using mock data.
9. Developer completes development.
10. Developer moves the ticket from TODO to IN_REVIEW, subject to the senior's confirmed source-state rule.
11. System validates the transition.
12. System records activity and generates relevant notifications.

Alternate flows:
- Ticket is not accessible.
- Ticket is assigned to another developer.
- Requested transition is unauthorized.
- Ticket has already changed status.
- Concurrent status update.
- GitHub mock data cannot be linked.
- Network/database error.

Postconditions:
- Valid development updates are recorded.
- Ticket history reflects permitted changes.

Related requirements:
FR-TKT-006, FR-GH-002, FR-COM-004.

## UC-016: Perform Ticket Testing

Primary actor: Tester / QA.

Preconditions:
- Ticket exists.
- Tester has access to the relevant project/ticket.
- Ticket is available for testing according to workflow policy.

Trigger:
Tester opens a testing ticket.

Main success flow:
1. Tester opens the testing dashboard.
2. Tester selects an assigned ticket.
3. Tester reviews ticket requirements.
4. Tester performs testing.
5. Tester records comments and evidence.
6. If the test is marked successful, Tester moves the ticket from TESTING to TESTING_DONE.
7. If a bug/fix outcome is recorded, Tester may move the ticket from TESTING to BUG_FIXED according to the senior's stated permission.
8. Backend validates the requested transition.
9. System records the status change.
10. Relevant activity and notification events are generated.

Alternate flows:
- Ticket is not assigned/accessible.
- Ticket is not in TESTING.
- Tester attempts an unauthorized transition.
- Evidence upload fails.
- Testing comment is empty or invalid.
- Backend rejects the transition.
- Duplicate status request.

Postconditions:
- Testing result and ticket status are recorded.
- Testing evidence and activity are retained.

Open clarification:
The relationship between TESTING_DONE, BUG_FIXED and COMPLETED must be finalized.

Related requirements:
FR-TKT-006, FR-TKT-010, FR-FILE-004.

## UC-017: Add Comments and Mentions

Primary actor: Authorized Employee.

Preconditions:
- Employee has access to the ticket.

Trigger:
Employee selects Add Comment.

Main success flow:
1. Employee opens ticket details.
2. Employee enters comment text.
3. Employee optionally mentions another user.
4. Frontend validates the comment.
5. Backend validates ticket access and comment content.
6. Comment is stored.
7. Mention records are stored.
8. Activity is recorded.
9. Notification is generated for eligible mentioned users.
10. Comment appears in the ticket conversation.

Alternate flows:
- Empty comment.
- Comment exceeds allowed length.
- Mentioned user does not exist.
- Mentioned user lacks ticket access.
- Employee attempts to edit another user's comment.
- Employee attempts to access a private discussion.
- Duplicate submission.

Postconditions:
- Comment and activity are recorded.
- Only authorized users can view the discussion.

Related requirements:
FR-COM-001 to FR-COM-004.

## UC-018: Upload and Manage Attachments

Primary actor: Authorized Employee.

Preconditions:
- Employee can access the related project or ticket.

Trigger:
Employee selects Upload Attachment.

Main success flow:
1. Employee selects the upload destination.
2. Employee selects up to five documents.
3. Frontend displays selected filenames and sizes.
4. Frontend performs preliminary validation.
5. Backend independently validates all files.
6. Backend checks extension and actual content type.
7. Backend checks per-file size limit of 5 MB under the current assumption.
8. File is stored using a generated storage key.
9. Metadata is stored in PostgreSQL.
10. System displays upload results.

Alternate flows:
- More than five documents selected.
- Unsupported extension.
- MIME/content type mismatch.
- One file exceeds 5 MB.
- Empty file.
- Unauthorized upload destination.
- Storage failure.
- Database failure after storage upload.
- Duplicate filename.
- Unauthorized download/delete.

Postconditions:
- Valid files and metadata are stored.
- Access is restricted by project/ticket permissions.

Open clarification:
Confirm whether the five-file count applies per upload operation, per ticket or per project.

Related requirements:
FR-FILE-001 to FR-FILE-006.

## UC-019: Notifications — Excluded

This use case is retained as a historical traceability identifier only. Notifications UI, preferences, APIs, delivery, background jobs and notification database entities are excluded by senior clarification. Do not implement this use case. Ticket activity history and system audit logs remain in scope.

## UC-020: Manage Sprint and Backlog

Primary actor: Authorized PM.

Preconditions:
- PM has access to the project.
- Project exists.

Trigger:
PM opens Sprint Management.

Main success flow:
1. PM opens the project backlog.
2. PM selects Create Sprint.
3. PM enters sprint name, goal and dates.
4. PM selects backlog tickets.
5. System validates project relationships and dates.
6. Database creates sprint and memberships.
7. PM starts the sprint.
8. System displays sprint progress.
9. PM monitors assigned/completed/pending tickets.
10. PM completes sprint.
11. Incomplete tickets are handled according to the approved policy.

Alternate flows:
- Invalid sprint dates.
- Ticket belongs to another project.
- Ticket is already part of an incompatible active sprint.
- Sprint has no tickets.
- Sprint is completed with incomplete tickets.
- Unauthorized user attempts sprint management.

Postconditions:
- Sprint state and associated tickets are recorded.
- Sprint statistics can be calculated.

Related requirements:
FR-SPR-001 to FR-SPR-005.

## UC-021: Search, Filter and Sort Records

Primary actor: Authorized Employee.

Preconditions:
- Employee is authenticated.

Trigger:
Employee enters a search term or selects filters.

Main success flow:
1. Employee opens a relevant list or global search.
2. Employee enters a search term.
3. Employee selects one or more filters.
4. Employee selects a sort order.
5. Frontend sends validated query parameters.
6. Backend applies authorization filters.
7. Backend retrieves matching records.
8. Frontend displays results with pagination.

Alternate flows:
- Empty search term.
- Invalid filter value.
- Invalid sort column.
- No results.
- Invalid page/page size.
- User attempts to retrieve inaccessible records through query manipulation.
- Search request times out.

Postconditions:
- Only authorized records are displayed.
- Search and filter state is reflected in the results.

Related requirements:
FR-SEARCH-001 to FR-SEARCH-005.

## UC-022: View Dashboard

Primary actor: Admin, PM, Developer or Tester.

Preconditions:
- Employee is authenticated.

Trigger:
Employee opens the dashboard.

Main success flow:
1. Frontend requests the employee's dashboard.
2. Backend identifies the authenticated employee and role.
3. Backend checks dashboard permissions.
4. Backend calculates relevant metrics from authorized records.
5. Frontend displays the correct role-specific dashboard.
6. Frontend displays loading, empty or error states where necessary.

Alternate flows:
- No assigned projects.
- No assigned tickets.
- Empty team.
- API unavailable.
- Insufficient permission.
- Inconsistent or unavailable source records.

Postconditions:
- Dashboard reflects the latest available authorized data.
- No unauthorized counts or records are exposed.

Related requirements:
FR-DASH-001 to FR-DASH-011.

## UC-023: Generate Reports

Primary actor: Authorized Employee.

Preconditions:
- Employee has report access for the selected project/team/sprint.

Trigger:
Employee opens Reports.

Main success flow:
1. Employee selects report type.
2. Employee selects an authorized project/team/sprint.
3. Employee selects filters/date range.
4. Backend aggregates actual database data.
5. Frontend displays report information.
6. Employee optionally exports CSV.
7. Backend validates export permission.
8. System returns the authorized report.

Alternate flows:
- No matching data.
- Unauthorized report access.
- Invalid filter/date range.
- Export generation failure.
- Large export requires controlled processing.

Postconditions:
- Report reflects actual records.
- Export contains only authorized information.

Related requirements:
FR-REPORT-001 to FR-REPORT-005.

## UC-024: Link GitHub Development Activity

Primary actor: Authorized Employee, principally Developer.

Supporting actor: GitHub Enterprise.

Preconditions:
- Project has a configured repository in the approved design.
- Employee has the required access.

Trigger:
Developer opens a ticket's GitHub section.

Main success flow:
1. Developer opens ticket details.
2. Developer selects Link GitHub Activity.
3. Developer selects mock repository/branch/commit/PR information.
4. System validates the linked project/ticket relationship.
5. Backend saves the GitHub activity reference.
6. Frontend displays the linked information.
7. Ticket activity is updated where required.

Alternate flows:
- Repository does not exist.
- Ticket ID does not match.
- Duplicate external record.
- Employee lacks project access.
- Mock GitHub data is unavailable.
- Repository has been disconnected.

Postconditions:
- Valid GitHub references are associated with the ticket.
- Mock data is clearly identified as development data.

Current assignment scope:
Use dummy GitHub Enterprise data. Real OAuth and webhooks are not assumed.

Related requirements:
FR-GH-001 to FR-GH-006.

## UC-025: View Audit Logs

Primary actor: Admin.

Preconditions:
- Admin is authenticated.
- Admin has audit-log access.

Trigger:
Admin opens Audit Logs.

Main success flow:
1. Admin opens the audit-log screen.
2. System fetches authorized audit records.
3. Admin selects date range, actor, action or resource filters.
4. Backend retrieves matching audit events.
5. Frontend displays actor, action, resource and timestamp.
6. Admin views relevant activity details.

Alternate flows:
- No records exist.
- Invalid date range.
- API request fails.
- Unauthorized user requests audit logs.
- User attempts to modify audit records.

Postconditions:
- Audit records are displayed without modification.
- Normal users cannot edit audit data.

Related requirements:
FR-AUDIT-001 to FR-AUDIT-003.

## 5. Cross-Use-Case Business Rules

1. Every protected operation requires authentication.
2. Backend permissions are authoritative.
3. Each employee has exactly one role.
4. An employee can belong to multiple teams.
5. PM access is restricted to authorized projects.
6. Developer and Tester access is restricted to authorized work.
7. Ticket transitions must respect role permissions.
8. Invitation links must expire and be single-use.
9. Passwords must never be stored in plaintext.
10. File downloads must enforce authorization.
11. Notifications are excluded from this assignment and must not be implemented.
12. Audit records must not be editable by ordinary users.
13. Email and GitHub use mock data in the initial assignment.
14. Production hosting is excluded.

## 6. Use Case Traceability

| Use Case | Main Requirement Area |
|---|---|
| UC-001 to UC-006 | Authentication |
| UC-007 to UC-008 | User Management and Authorization |
| UC-009 to UC-010 | Team Management |
| UC-011 to UC-012 | Project Management |
| UC-013 to UC-016 | Ticket Management |
| UC-017 | Comments and Collaboration |
| UC-018 | File Management |
| UC-019 | Notifications (excluded) |
| UC-020 | Sprint and Backlog |
| UC-021 | Search and Filters |
| UC-022 | Dashboards |
| UC-023 | Reports |
| UC-024 | GitHub Integration |
| UC-025 | Audit Logs |

## 7. Pending Clarifications

1. Confirm whether the maximum five-document limit applies per ticket, per project or per upload operation.
2. Confirm any remaining project/team administration permissions not explicitly defined by the senior.
3. Confirm report visibility and export permissions.
4. Confirm any retention duration requiring company policy.

Ticket workflow questions about TESTING_DONE, BUG_FIXED, Developer IN_REVIEW, REOPENED, BLOCKED and CANCELLED are resolved in ../workflows/ticket-workflow.md. Notifications is excluded, not a pending feature.

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


## Workflow clarification - 12 November 2026

Use `../workflows/ticket-workflow.md` as the canonical source for status-change actors, source states, target states and rejection cases.

Update use-case flows and acceptance criteria to use `COMPLETED` instead of the former `DONE` status.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.

## Excluded use-case and authoritative workflow update — 17 November 2026

UC-019 is retained only as a traceability identifier and is excluded from implementation. Remove it from active planning, estimates, test execution and acceptance. The Notifications module has no UI, API, data model, preferences, delivery or background jobs in this assignment. Ticket activity and audit records remain separate in-scope capabilities.

For User Management, UC-003 (Create Employee Invitation), UC-004 (Accept Employee Invitation), UC-007 (Manage Employee Accounts), UC-008 (Manage Roles) and UC-010 (Manage Team Membership) are the applicable use cases. Invitation acceptance must create the employee and initial memberships transactionally, using the invitation data model described in `../database/database-design.md`. No public registration is permitted.

Use `../workflows/ticket-workflow.md` as the only authoritative ticket workflow. It supersedes all earlier transition descriptions in detailed use cases.
