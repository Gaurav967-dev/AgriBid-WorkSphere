# Workflow Decision Record — 12 November 2026

## Decision

The PDF's default ticket workflow remains the implementation baseline:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`

The senior clarified that `COMPLETED` replaces the former `DONE` status.

## Role clarifications

- Developer: `TODO` → `IN_PROGRESS` → `IN_REVIEW`.
- Tester can mark `REOPENED` when testing fails.
- Failed testing can return to `IN_PROGRESS` or `REOPENED` with a comment, as specified by the PDF.
- Reopened work returns to Developer and can move to `IN_PROGRESS`.
- Admin and PM retain any-status authority and can manage `BLOCKED`, `REOPENED` and `CANCELLED`.
- `BUG_FIXED` proceeds to `COMPLETED`.
- `TESTING_DONE` remains a separate status from `COMPLETED`.

## Superseded draft

An earlier draft incorrectly described Developer as moving directly from `TODO` to `IN_REVIEW`.

That description is superseded. The PDF's sequence is retained.

## Canonical reference

See `../workflows/ticket-workflow.md` for the complete workflow contract.
