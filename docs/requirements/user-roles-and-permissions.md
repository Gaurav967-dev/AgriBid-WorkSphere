# AgriBid WorkSphere
# Role-Permission Matrix

Version: 1.0
Date: 11 November 2026
Status: Draft for Senior Review

## 1. Purpose

Define access permissions for the four primary application roles.

Roles:
1. Admin
2. Project Manager (PM)
3. Developer
4. Tester / QA

Each employee has exactly one role.

Authorization must be enforced by the backend. Frontend visibility is not sufficient.

## 2. Permission Matrix

| Feature | Admin | PM | Developer | Tester |
|---|---|---|---|---|
| View users | Yes | No | No | No |
| Manage users | Yes | No | No | No |
| Manage roles | Yes | No | No | No |
| Create projects | Yes | Permission-based | No | No |
| Manage teams | Yes | Permission-based | No | No |
| Create tickets | Yes | Yes | Permission-based | Permission-based |
| Assign tickets | Yes | Yes | No | No |
| Update ticket status | Any configured status | Any configured status | Restricted | Restricted |
| Add comments | Yes | Yes | Yes | Yes |
| Upload files | Yes | Yes | Yes | Yes |
| Delete tickets | Yes | Permission-based | No | No |
| View reports | All | Assigned projects | Own work | Assigned work |
| Manage GitHub integration | Yes | Permission-based | No | TBD |
| Manage global settings | Yes | No | No | No |
| View audit logs | Yes | No | No | No |
| Manage workflows | Yes | No | No | No |
| Manage notification settings | Yes | TBD | TBD | TBD |

Note: Permission-based means access requires an explicitly configured permission.

## 3. Admin Permissions

Admin has system-level access.

Admin can:
- View and manage all users.
- Assign one role per employee.
- Create and manage teams.
- Create and manage projects.
- Assign project managers.
- View tickets across projects.
- Change tickets to any configured status.
- Manage global settings and workflows.
- View dashboards and reports.
- View audit logs.
- Manage GitHub integration configuration.

## 4. Project Manager Permissions

PM manages assigned projects.

PM can:
- Create projects when permitted.
- Edit assigned project information.
- Add/remove authorized project members.
- Create tickets.
- Assign and reassign tickets.
- Change ticket priority and deadlines.
- Move tickets to any configured status.
- Create/manage sprints.
- Review project progress.
- Monitor overdue tickets.
- View assigned project reports.
- Comment on tickets.
- Upload/manage project files.

Restriction:
PM must not access unrelated projects unless explicitly granted permission.

## 5. Developer Permissions

Developer works on assigned development tickets.

Developer can:
- View assigned projects and tickets.
- View ticket details and requirements.
- Move tickets from TODO to IN_PROGRESS.
- Move tickets to IN_REVIEW.
- Add comments.
- Upload attachments.
- Update development progress.
- Link GitHub branches, commits and pull requests.
- View deadlines and notifications.

Developer cannot:
- Manage users.
- Manage roles.
- Change system settings.
- Assign tickets.
- Access unrelated project data.
- Perform unapproved status transitions.

The exact source state for IN_REVIEW must be confirmed with the senior.

## 6. Tester / QA Permissions

Tester can:
- View assigned testing tickets.
- Review requirements.
- Add testing comments.
- Upload evidence and bug screenshots.
- Report bugs.
- Change testing status according to permitted transitions.
- View testing dashboard.
- Receive notifications.

Confirmed transitions:

TESTING -> TESTING_DONE
TESTING -> BUG_FIXED

Other transitions require senior approval.

## 7. Ticket Transition Permission Matrix

The complete canonical workflow is maintained in `../workflows/ticket-workflow.md`. The table below summarizes the confirmed source/target/actor rules.

| Current status | Target status | Admin | PM | Developer | Tester |
|---|---|---|---|---|---|
| Any configured status | Any configured status | Yes | Yes, within authorized projects | No | No |
| TODO | IN_PROGRESS | Yes | Yes | Yes | No |
| IN_PROGRESS | IN_REVIEW | Yes | Yes | Yes | No |
| REOPENED | IN_PROGRESS | Yes | Yes | Assigned Developer | No |
| TESTING | TESTING_DONE | Yes | Yes | No | Yes |
| TESTING | BUG_FIXED | Yes | Yes | No | Yes |
| TESTING | REOPENED | Yes | Yes | No | Yes, with comment |
| TESTING | IN_PROGRESS | Yes | Yes | No | Yes, with comment |
| BUG_FIXED | COMPLETED | Yes | Yes | No | No |
| Any configured status | BLOCKED / CANCELLED | Yes | Yes | No | No |

Additional rules:
- Admin and PM can manage REOPENED; Tester may also mark REOPENED from TESTING.
- An assigned Developer resumes reopened work using REOPENED -> IN_PROGRESS.
- Reasons/comments are required for BLOCKED, REOPENED and CANCELLED as specified by the canonical workflow.
- Backend authorization is authoritative; frontend visibility is not a security boundary.
- PM/Admin any-status authority remains limited to authorized project scope.

## 8. Resource-Level Authorization

### Projects

PM must access only assigned projects unless permission is explicitly granted.

Developer and Tester access must be limited to authorized project/ticket data.

### Tickets

The system must verify:
- Ticket exists.
- User is authenticated.
- User has access to the parent project.
- User has permission for the requested operation.
- Requested status transition is allowed.

### Files

File preview, download and deletion must enforce access to the related project/ticket.

### Notifications

Users must only access their own notifications.

### Audit Logs

Normal users must not modify audit records.

## 9. Employee and Team Relationship

One employee:
- Has exactly one role.
- Can belong to multiple teams.

One team:
- Can contain multiple employees.
- Should have an identifiable team lead.

Removing a team member must preserve historical work and assignment records.

## 10. Authorization Error Handling

Recommended API behavior:

401 - User is unauthenticated.
403 - User lacks permission.
404 - Resource does not exist or is intentionally concealed.
409 - Conflicting business state.
422 - Invalid request or business validation.

## 11. Pending Approvals

1. Exact IN_REVIEW transition source.
2. TESTING_DONE versus COMPLETED relationship.
3. BUG_FIXED follow-up transition.
4. Developer/Tester permissions for BLOCKED.
5. Developer/Tester permissions for REOPENED.
6. Project creation permissions for PM.
7. Tester GitHub visibility.
8. Team-level visibility rules.
9. PM notification-management permissions.

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


## Senior workflow clarification - 12 November 2026

Use `../workflows/ticket-workflow.md` as the canonical source for ticket transition permissions.

Admin and PM retain any-status authority. Developer and Tester permissions must follow the explicit transitions in that workflow document. Do not infer additional transitions from frontend visibility.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.

## Authoritative permission corrections — 17 November 2026

Use `../workflows/ticket-workflow.md` as the only canonical ticket-transition matrix. Replace the stale Developer row in section 7: Developer does not have `TODO` → `IN_REVIEW`; the normal path is `TODO` → `IN_PROGRESS` followed by `IN_PROGRESS` → `IN_REVIEW`. An assigned Developer may move `REOPENED` → `IN_PROGRESS`. Tester may move `TESTING` → `TESTING_DONE`, `BUG_FIXED` or `REOPENED`, and may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Admin and PM retain any-status authority within authorized project scope.

For the next User Management module, employee list/create invitation/edit/role/status operations are Admin-only unless a separate self-service permission is approved. Admin may assign one role and multiple team memberships to an employee. This does not grant PM permission to manage employee accounts. Notification-management permissions are out of scope because Notifications is excluded.
