# AgriBid WorkSphere — Ticket Workflow and Status Rules

**Effective date:** 12 November 2026
**Authority:** Original assignment workflow and latest senior clarifications
**Status:** Current workflow baseline

## 1. Purpose

This document defines the ticket status catalogue, normal workflow, exception statuses and role-based transition rules.

It follows Module 4, Section 6.4 of the original assignment PDF, incorporating the senior's later clarifications.

This document supersedes conflicting earlier draft descriptions.

## 2. Ticket Status Catalogue

The configured status keys are:

| Status key | Meaning |
|---|---|
| `BACKLOG` | Work identified but not yet scheduled |
| `TODO` | Work is ready to be started |
| `IN_PROGRESS` | Developer is working on the ticket |
| `IN_REVIEW` | Development work is awaiting review |
| `TESTING` | Work is being tested |
| `TESTING_DONE` | Testing completion state; distinct from final completion |
| `BUG_FIXED` | A reported bug has been fixed |
| `COMPLETED` | Final successful completion; replaces `DONE` |
| `BLOCKED` | Work cannot proceed due to a blocker |
| `REOPENED` | Previously progressed work has been reopened |
| `CANCELLED` | Work has been cancelled |

`DONE` is no longer a valid status key. Use `COMPLETED`.

`TESTING_DONE` and `COMPLETED` are separate statuses and must not be merged.

## 3. Default Workflow

The original assignment's default workflow is:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`

The final status label has been updated from the original PDF's `DONE` to `COMPLETED` based on the senior's clarification.

### 3.1 Normal workflow responsibilities

1. PM creates a ticket.
2. PM assigns it to a Developer.
3. Developer moves it from `TODO` to `IN_PROGRESS`.
4. Developer completes development and moves it from `IN_PROGRESS` to `IN_REVIEW`.
5. The authorized reviewer reviews the work and moves approved work to `TESTING`.
6. Tester performs testing.
7. Testing outcome is recorded using the configured testing statuses.
8. The ticket reaches `COMPLETED` according to the confirmed completion rules.

The normal Developer path is therefore:

`TODO` → `IN_PROGRESS` → `IN_REVIEW`

Do not replace this with a direct `TODO` → `IN_REVIEW` transition.

## 4. Confirmed Role-Based Permissions

### 4.1 Admin

- Can move any ticket to any configured status.
- Can manage `BLOCKED`, `REOPENED` and `CANCELLED`.
- Can override normal workflow restrictions.
- All changes must be recorded in ticket history.

### 4.2 Project Manager (PM)

- Can create tickets.
- Can assign and reassign tickets.
- Can move tickets to any configured status within authorized projects.
- Can manage `BLOCKED`, `REOPENED` and `CANCELLED`.
- All changes must be recorded in ticket history.

### 4.3 Developer

Normal workflow:

- `TODO` → `IN_PROGRESS`
- `IN_PROGRESS` → `IN_REVIEW`

Reopened work:

- An assigned Developer can move `REOPENED` → `IN_PROGRESS`.

The Developer should receive the reopened ticket for further development.

### 4.4 Tester

Testing outcomes:

- `TESTING` → `TESTING_DONE`
- `TESTING` → `BUG_FIXED`
- `TESTING` → `REOPENED`
- If testing fails, the Tester may send the ticket back to `IN_PROGRESS` or `REOPENED` with a comment, following the PDF's workflow.

Tester can mark a ticket `REOPENED`; this is an explicit clarification from the senior.

## 5. Special Status Rules

### 5.1 COMPLETED

`COMPLETED` replaces the former `DONE` status.

Do not expose `DONE` as a selectable or returned ticket status.

### 5.2 BUG_FIXED

The confirmed progression is:

`BUG_FIXED` → `COMPLETED`

Admin and PM can perform the transition under their any-status authority.

### 5.3 TESTING_DONE

`TESTING_DONE` is not another name for `COMPLETED`.

Keep it as a distinct configured status.

Admin and PM retain their general ability to move a ticket from this status to another configured status.

No additional Tester transition out of `TESTING_DONE` is assumed unless separately confirmed.

### 5.4 BLOCKED

Admin and PM can manage the `BLOCKED` status.

A reason/comment should be recorded when a ticket is blocked or unblocked.

Ticket assignment and project relationships should be preserved unless separately changed by an authorized action.

### 5.5 CANCELLED

Admin and PM can manage the `CANCELLED` status.

A cancellation reason should be recorded.

### 5.6 REOPENED

Admin and PM can manage the `REOPENED` status.

Tester can also mark a ticket `REOPENED` when testing fails.

The reopened work returns to Developer:

`TESTING` → `REOPENED` → `IN_PROGRESS`

The ticket must be assigned to an eligible Developer before the Developer resumes work.

A comment explaining the reason for reopening is required.

## 6. Workflow Transition Matrix

| Source | Target | Actor / permission |
|---|---|---|
| `BACKLOG` | `TODO` | Authorized workflow action |
| `TODO` | `IN_PROGRESS` | Developer; Admin; PM |
| `IN_PROGRESS` | `IN_REVIEW` | Developer; Admin; PM |
| `IN_REVIEW` | `TESTING` | Authorized reviewer; Admin; PM |
| `TESTING` | `TESTING_DONE` | Tester; Admin; PM |
| `TESTING` | `BUG_FIXED` | Tester; Admin; PM |
| `TESTING` | `REOPENED` | Tester; Admin; PM |
| `TESTING` | `IN_PROGRESS` | Tester where returning directly to development; Admin; PM |
| `REOPENED` | `IN_PROGRESS` | Assigned Developer; Admin; PM |
| `BUG_FIXED` | `COMPLETED` | Admin; PM |
| Any configured status | Any configured status | Admin; PM within authorized scope |

The table records the senior-confirmed permissions and the PDF's normal workflow. Any additional transition must be approved or configured by an authorized Admin/PM.

## 7. Required Workflow Validation

The backend must:

- Validate the employee's active account.
- Validate the employee's role.
- Validate project access.
- Validate current and target status.
- Check the actor's transition permission.
- Prevent unauthorized status changes.
- Require a reason/comment for reopening, blocking and cancellation.
- Record successful transitions in ticket activity/history.
- Use a database transaction for status and history updates.
- Handle concurrent updates safely.

The frontend must not be treated as the authorization layer.

## 8. Status History

Each successful transition should record:

- Ticket ID.
- Previous status.
- New status.
- Acting employee ID.
- Comment or reason, when required.
- Timestamp.
- Request/correlation ID where available.

Rejected transitions must not update the ticket status or create a successful transition-history entry.

## 9. Implementation Notes

Use the `ticket_statuses` and `workflow_transitions` structures to represent the status catalogue and allowed transitions.

Do not hard-code role-transition rules only in the frontend.

The backend ticket service is the source of truth for workflow authorization.

## 10. Source Alignment

The original assignment's default workflow is preserved:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `DONE`

The final key is changed to `COMPLETED` based on the senior's clarification.

The PDF explicitly allows failed testing to return a ticket to `IN_PROGRESS` or `REOPENED` with a comment. Tester reopening and the return to Developer work are retained.
