# AgriBid WorkSphere
# Approved Scope Changes and UI Reference Decisions

Version: 1.0
Date: 11 November 2026
Status: Senior Clarifications Recorded

## 1. Purpose

This document records additional decisions communicated by
the project senior after reviewing the original assignment PDF.

These decisions take precedence over conflicting requirements
in the original assignment for the current implementation.

## 2. UI Reference - Original PDF Page 42

The reference contains:

- Left sidebar navigation.
- Search field.
- Kanban task board.
- Filter and Sort controls.
- Automate Pro button.
- GitHub button.
- Project/task cards.
- Task actions.

The implementation must retain relevant task-management
functionality while applying the following exclusions.

## 3. Explicitly Excluded Features

### SCOPE-001: Notifications

The Notifications feature SHALL NOT be implemented.

This exclusion applies to:
- Notifications sidebar navigation item.
- Notification bell.
- Notification panel.
- Unread notification count.
- Notification preferences.
- Notification API endpoints.
- Notification database module.
- Notification background jobs.
- Notification delivery functionality.

Existing requirements that mention notification generation
are excluded from the current implementation.

Important:
Ticket activity history and audit logs remain separate
requirements and are still in scope.

### SCOPE-002: Automate Pro

The Automate Pro feature SHALL NOT be implemented.

This exclusion applies to:
- Automate Pro toolbar button.
- Pro automation interface.
- Automation feature functionality.

Filter and Sort controls remain in scope.

## 4. GitHub Button

### SCOPE-003: Personal GitHub Account

The GitHub button shown in the page 42 UI reference
must use the developer's own GitHub account for this assignment.

Requirements:
- Implement a functional GitHub button.
- Link it to the developer's personal GitHub profile/repository.
- Use the account intended for hosting this assignment.
- Do not leave the button decorative or non-functional.
- Do not expose credentials or access tokens in frontend code.

Implementation interpretation:
Initially implement the button as an external link to the
developer's GitHub account.

If authenticated OAuth/API integration is separately required,
it must be implemented through a secure backend integration.

The personal source-code repository and the application's
mock GitHub activity data are separate concerns.

### SCOPE-004: Mock GitHub Data

For the WorkSphere GitHub activity module during the assignment,
use dummy repository, branch, commit and pull request data.

No real company GitHub Enterprise credentials are assumed.

## 5. Confirmed Ticket Workflow Rules

| Role / Event | Source | Destination |
|---|---|---|
| Admin | Any configured status | Any configured status |
| PM | Any configured status | Any configured status |
| Developer | TODO | IN_PROGRESS |
| Developer | TODO | IN_REVIEW |
| Tester | TESTING | TESTING_DONE |
| Tester | TESTING | BUG_FIXED |
| Bug-fix workflow | BUG_FIXED | COMPLETED |

Additional rules:

1. TESTING_DONE and COMPLETED are separate statuses.
2. BUG_FIXED leads to COMPLETED.
3. Status transitions must be checked by the backend.
4. The actor responsible for the final BUG_FIXED-to-COMPLETED
   transition must follow the approved workflow implementation.
5. No other developer/tester transitions should be invented.

## 6. Confirmed User and Team Rules

- Account creation is invitation-only.
- Each employee has exactly one role.
- An employee may belong to multiple teams.
- Historical team membership and ticket records must be preserved.

## 7. Attachment Requirements

- Maximum number of documents: 5.
- Maximum file size: 5 MB per individual document.
- Supported formats are defined in the original assignment.
- Backend validation is mandatory.
- Unauthorized file access must be rejected.

## 8. Development Integration Decisions

### Email
Use dummy company-style employee information.

Example:
name@agribid.ai

Do not claim actual company email delivery during mock testing.

### GitHub
- Use the developer's personal GitHub account for the UI button
  and assignment source-code repository.
- Use mock GitHub Enterprise-style records inside the initial
  application integration screens.

### Hosting
Production hosting and deployment are excluded from the
current assignment scope.

## 9. Scope Precedence

1. Senior-approved business clarifications.
2. Approved requirement and scope-change documents.
3. Original assignment PDF.
4. Unapproved technical assumptions.

Changes to the agreed scope must be recorded before
implementation is modified.

---
End of Document
