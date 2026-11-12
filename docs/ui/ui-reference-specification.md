# AgriBid WorkSphere - UI Reference Specification

Version: 1.0
Reference: Original assignment PDF, page 42
Status: Senior Clarifications Recorded

## Included UI Elements

- Sidebar navigation for approved application modules.
- Search.
- Dashboard.
- Assigned work.
- Projects and tasks.
- Filter.
- Sort.
- Kanban board.
- Task cards.
- GitHub button linked to the developer's personal GitHub account.

## Excluded UI Elements

- Notifications navigation item.
- Notification bell and notification panel.
- Notification unread count.
- Automate Pro button and automation feature.

## Board Requirements

The board must support:
- Status-based columns.
- Task cards.
- Ticket identifiers.
- Task titles and descriptions.
- Priority information.
- Assignee information.
- Due dates.
- Labels.
- Authorized task operations.
- Valid role-based status transitions.
- Search and filtering.

The actual displayed cards must use application data.

## GitHub Button

The GitHub button must open the developer's personal GitHub
account or configured repository URL.

It must not be a decorative button.

The URL should be configurable, without embedding access tokens.

## Visual Direction

Use the supplied PDF screenshot as the visual reference.
Maintain a professional, responsive enterprise interface
consistent with AgriBid WorkSphere branding.

---
End of Document


## Ticket status display update - 12 November 2026

Use the status keys in `../workflows/ticket-workflow.md`.

Display `COMPLETED`, not `DONE`. Keep `TESTING_DONE` as its own status. Include `BLOCKED`, `REOPENED` and `CANCELLED` in the relevant status controls and views, subject to user permissions.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.
