# AgriBid WorkSphere
# Confirmed Business Rules and Requirement Clarifications

## 1. Document Information

Project: AgriBid WorkSphere
Document: Confirmed Business Rules
Version: 1.0
Status: Initial Baseline
Prepared for: Project Development Assignment
Prepared by: Gaurav

## 2. Purpose

This document records business requirements and implementation
clarifications provided by the project senior.

The original 44-page project specification remains the primary
requirement source. This document supplements it with confirmed
company-specific decisions.

## 3. User Account and Role Rules

BR-001: Account Creation

- Public registration is not permitted.
- Only Admin can create employee accounts.
- Employee account activation must happen through an invitation.
- Invitation links must be securely generated.
- Invitation links must have an expiry.
- An invitation must not be reused after successful activation.
- Employees must set their password during account activation.

BR-002: User Roles

The application supports four primary roles:

- Admin
- Project Manager
- Developer
- Tester / QA

Every employee must have exactly one role.

A user cannot simultaneously hold multiple roles.

BR-003: Team Membership

- An employee can belong to multiple teams.
- A team can contain multiple employees.
- A team must have an identifiable team lead.
- Removing an employee from a team must not delete historical work.
- Membership history should be retained.

## 4. Ticket Management Rules

BR-004: Admin Permissions

- Admin can manage tickets across the system.
- Admin can change any ticket to any configured status.
- Admin has system-level ticket management permissions.

BR-005: Project Manager Permissions

- PM can create tickets.
- PM can assign and reassign tickets.
- PM can move tickets to any configured status.
- PM access must respect assigned project permissions.

BR-006: Developer Permissions

- Developer can move a ticket from TODO to IN_PROGRESS.
- Developer moves TODO -> IN_PROGRESS, then IN_PROGRESS -> IN_REVIEW.
- An assigned Developer may move REOPENED -> IN_PROGRESS.
- Other status transitions are not permitted unless defined in ../workflows/ticket-workflow.md.
- Developer must not access unrelated project tickets.

BR-007: Tester Permissions

- Tester can move tickets from TESTING to TESTING_DONE.
- Tester can move tickets from TESTING to BUG_FIXED or REOPENED.
- Failed testing may return to IN_PROGRESS or REOPENED with a comment.
- TESTING_DONE and COMPLETED are separate statuses.
- Testing evidence and comments must be associated with the ticket.

## 5. Ticket Status Catalogue

Original specification statuses:

- BACKLOG
- TODO
- IN_PROGRESS
- IN_REVIEW
- TESTING
- COMPLETED
- BLOCKED
- REOPENED
- CANCELLED

Additional statuses communicated by senior:

- TESTING_DONE
- BUG_FIXED

All status values must be validated by the backend.

The authoritative transition matrix is maintained in ../workflows/ticket-workflow.md.

## 6. Attachment Rules

BR-008: Attachment Count

Maximum allowed documents: 5.

The exact scope of the five-document limit is pending confirmation:
per upload operation, per ticket or per project.

BR-009: Attachment File Size

Working assumption: maximum 5 MB per individual document.

This interpretation must be confirmed before final implementation.

BR-010: Allowed File Types

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

BR-011: File Security

- Validate extension.
- Validate actual MIME/content type.
- Generate unique storage names.
- Prevent path traversal.
- Prevent unauthorized download.
- Store metadata in PostgreSQL.
- Do not store file binaries directly in PostgreSQL.
- Do not trust client-provided filenames.

## 7. External Integrations

BR-012: Email Integration

- The eventual application will use the company's email service.
- During development, dummy data will be used.
- Example test address: name@agribid.ai.
- No actual email delivery is assumed during mock testing.
- Email integration must be replaceable with the company's service.

BR-013: GitHub Integration

- The intended external integration is the company's GitHub Enterprise.
- During development, mock GitHub Enterprise data will be used.
- Repository, branch, commit and pull request information can be
  represented using test fixtures.
- Real OAuth/App credentials and webhooks will not be assumed.

BR-014: Source Code Repository

- Developer is permitted to upload the assignment source code
  to their own GitHub account.
- Repository should preferably remain private unless otherwise
  instructed by the senior.
- Never commit passwords, tokens, API keys or environment secrets.

## 8. Hosting and Deployment

BR-015:

- Hosting and production deployment are excluded from the current task.
- Development and testing will run locally.
- Environment configuration should remain deployment-ready.
- Production credentials must not be used in local development.

## 9. Technical Stack

Frontend:
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Motion
- TanStack Query
- React Hook Form
- Zod
- Zustand where required

Backend:
- Python
- FastAPI
- Pydantic

Database:
- PostgreSQL

Redis:
- Optional, only when technically justified.

## 10. Open Questions

OPEN-001:
Does the maximum five-document attachment count apply per
ticket, per project or per upload operation?

OPEN-002:
Is the five MB file size limit per document or a combined limit?
Current working assumption: per document.

OPEN-003:
Does TESTING_DONE replace COMPLETED or are they separate statuses?

OPEN-004:
What is the source state for a Developer moving a ticket to
IN_REVIEW?

OPEN-005:
What transition should follow BUG_FIXED?

OPEN-006:
What are the exact permissions for BLOCKED, REOPENED and
CANCELLED transitions?

OPEN-007:
Which exact company email service will eventually be configured?

OPEN-008:
Which GitHub Enterprise organization and integration credentials
will be supplied, if real integration is required?

## 11. Approval and Change History

Version 1.0:
Initial business rules recorded using the senior's clarifications.

All pending decisions must be confirmed before the affected
business logic is finalized.

Any subsequent changes must be documented with date, decision
owner and affected requirements.

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

The latest senior-confirmed status catalogue and role transition rules are maintained in `../workflows/ticket-workflow.md`.

This clarification replaces the earlier `BUG_FIXED` to `DONE` rule with `BUG_FIXED` to `COMPLETED`.

`TESTING_DONE` remains separate from `COMPLETED`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED`. Tester may also mark `REOPENED` from `TESTING`. A reopened ticket returns to Developer work and can be moved to `IN_PROGRESS` by its assigned Developer.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.

## Current authoritative clarifications — 17 November 2026

The following clarifications supersede the pending draft statements above where they conflict:

- `TESTING_DONE` and `COMPLETED` are separate statuses.
- `BUG_FIXED` proceeds to `COMPLETED`.
- Developer normal workflow is `TODO` → `IN_PROGRESS` → `IN_REVIEW`; do not allow direct `TODO` → `IN_REVIEW`.
- Tester may return failed work from `TESTING` to `IN_PROGRESS` or `REOPENED` with a comment. Tester may mark `REOPENED`.
- An assigned Developer can move `REOPENED` → `IN_PROGRESS`.
- Admin and PM retain any-status authority within their authorized scope, including managing `BLOCKED`, `REOPENED` and `CANCELLED`.
- 5 MB applies to each individual file. The scope of the maximum five-document count remains to be confirmed.
- Notifications and Automate Pro are excluded.
- The GitHub toolbar button opens the developer's personal GitHub account/repository; application GitHub activity remains mock data.

For the implemented authentication cookie/token contract, see `../architecture/technology-decisions.md` and `../api/api-specification.md`. For invitation pending-profile and selected-team persistence, see `../database/database-design.md`; this requires a migration and is not yet implemented.
