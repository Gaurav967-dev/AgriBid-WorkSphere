# AgriBid WorkSphere
# Scenario, Edge Case and Validation Catalogue

| Attribute | Details |
|---|---|
| Project | AgriBid WorkSphere |
| Document | Scenario, Edge Case and Validation Catalogue |
| Version | 1.0 |
| Date | 11 November 2026 |
| Status | Draft for Senior Review |
| Requirement Source | Original project assignment and senior clarifications |

## 1. Purpose

This document identifies positive scenarios, negative scenarios,
edge cases, validation rules and expected system behavior.

Validation shall be implemented at appropriate frontend,
backend, service and database layers.

Client-side validation is for user experience.
Backend validation and authorization are mandatory.

## 2. Validation Layers

### 2.1 Frontend Validation

- Required field validation.
- Input format validation.
- Length validation.
- Numeric/date boundary validation.
- Password confirmation.
- File selection and size feedback.
- Clear field-level error messages.
- Prevent unintended repeated submissions.

### 2.2 Backend Validation

- Request schema validation using Pydantic.
- Business rule validation.
- Authentication checks.
- Role permission checks.
- Project/ticket resource authorization.
- File extension and MIME validation.
- File size and document count validation.
- Duplicate and relationship validation.

### 2.3 Database Validation

- Primary keys.
- Foreign keys.
- Unique constraints.
- NOT NULL constraints.
- Check constraints.
- Transaction integrity.
- Duplicate membership prevention.
- Referential integrity.
- Required retention behavior.

## 3. General Validation Rules

| ID | Validation | Expected Result |
|---|---|---|
| VAL-GEN-001 | Required field missing | Reject request |
| VAL-GEN-002 | Whitespace-only required field | Reject request |
| VAL-GEN-003 | Invalid identifier | Return validation error |
| VAL-GEN-004 | Unsupported enum value | Reject request |
| VAL-GEN-005 | Invalid date format | Reject request |
| VAL-GEN-006 | Invalid numeric value | Reject request |
| VAL-GEN-007 | Unauthorized resource access | Deny access |
| VAL-GEN-008 | Duplicate request | Handle without unintended duplicate data |
| VAL-GEN-009 | Concurrent update | Detect and handle conflict |
| VAL-GEN-010 | Database failure | Roll back incomplete transaction |
| VAL-GEN-011 | API timeout | Display controlled failure state |
| VAL-GEN-012 | Unexpected server error | Return safe error response |

## 4. Module 1 - Authentication Scenarios

### 4.1 Login

| ID | Scenario | Expected Result |
|---|---|---|
| AUTH-SC-001 | Valid employee credentials | Login succeeds |
| AUTH-SC-002 | Invalid email format | Frontend validation error |
| AUTH-SC-003 | Empty email | Required validation |
| AUTH-SC-004 | Empty password | Required validation |
| AUTH-SC-005 | Incorrect password | Generic authentication failure |
| AUTH-SC-006 | Unknown email | Generic authentication failure |
| AUTH-SC-007 | Inactive employee | Login rejected |
| AUTH-SC-008 | Employee has no valid role | Authentication/authorization rejected |
| AUTH-SC-009 | Repeated invalid login attempts | Rate limiting applied |
| AUTH-SC-010 | Expired session | Re-authentication required |
| AUTH-SC-011 | Revoked session | Access denied |
| AUTH-SC-012 | Unauthenticated protected API request | HTTP 401 |
| AUTH-SC-013 | Authenticated user without permission | HTTP 403 |
| AUTH-SC-014 | Network failure during login | Error displayed without false success |

### 4.2 Invitation and Account Activation

| ID | Scenario | Expected Result |
|---|---|---|
| AUTH-INV-001 | Admin creates valid invitation | Invitation created |
| AUTH-INV-002 | Admin enters duplicate email | Duplicate rejected |
| AUTH-INV-003 | Missing employee name | Validation error |
| AUTH-INV-004 | Invalid email | Validation error |
| AUTH-INV-005 | Invalid role | Request rejected |
| AUTH-INV-006 | Admin selects one valid role | Invitation created |
| AUTH-INV-007 | Invitation token is valid | Activation allowed |
| AUTH-INV-008 | Invitation token is invalid | Activation denied |
| AUTH-INV-009 | Invitation has expired | Activation denied |
| AUTH-INV-010 | Invitation is reused | Activation denied |
| AUTH-INV-011 | Employee is deactivated before acceptance | Activation denied |
| AUTH-INV-012 | Invitation accepted successfully | Account activated |
| AUTH-INV-013 | Invitation submitted twice | No duplicate activation |
| AUTH-INV-014 | Email delivery simulation fails | Safe error and appropriate retry handling |

Public self-registration must not be implemented.

### 4.3 Password Management

| ID | Scenario | Expected Result |
|---|---|---|
| AUTH-PWD-001 | Valid password | Accepted |
| AUTH-PWD-002 | Empty password | Rejected |
| AUTH-PWD-003 | Weak password | Rejected according to approved policy |
| AUTH-PWD-004 | Confirmation mismatch | Rejected |
| AUTH-PWD-005 | Valid reset token | Password reset permitted |
| AUTH-PWD-006 | Expired reset token | Rejected |
| AUTH-PWD-007 | Reused reset token | Rejected |
| AUTH-PWD-008 | Unknown email reset request | Non-enumerating response |
| AUTH-PWD-009 | Password change succeeds | Updated password is required for subsequent authentication |

Exact password complexity and session expiry values require security approval.

## 5. User Management Scenarios

| ID | Scenario | Expected Result |
|---|---|---|
| USER-SC-001 | Admin creates valid employee | Employee record created |
| USER-SC-002 | Duplicate employee email | Rejected |
| USER-SC-003 | Employee without role | Rejected |
| USER-SC-004 | Employee assigned multiple roles | Rejected |
| USER-SC-005 | Unauthorized role assignment | Rejected |
| USER-SC-006 | Admin updates employee | Changes saved |
| USER-SC-007 | Admin deactivates employee | Account access disabled |
| USER-SC-008 | Deactivated employee uses existing session | Access denied according to session policy |
| USER-SC-009 | Historical tickets reference employee | Historical records preserved |
| USER-SC-010 | User attempts to manage another employee | Permission checked |

Confirmed rule:
Each employee must have exactly one role.

## 6. Team Management Scenarios

| ID | Scenario | Expected Result |
|---|---|---|
| TEAM-SC-001 | Admin creates valid team | Team created |
| TEAM-SC-002 | Team name missing | Rejected |
| TEAM-SC-003 | Invalid team lead | Rejected |
| TEAM-SC-004 | Employee added to team | Membership created |
| TEAM-SC-005 | Same employee added twice | Duplicate prevented |
| TEAM-SC-006 | Employee belongs to multiple teams | Allowed |
| TEAM-SC-007 | Employee removed from team | Membership updated |
| TEAM-SC-008 | Employee removed with historical tickets | Historical work preserved |
| TEAM-SC-009 | Team lead removed | Apply approved lead reassignment policy |
| TEAM-SC-010 | Team deleted with active projects | Apply retention and dependency rules |

## 7. Project Management Scenarios

| ID | Scenario | Expected Result |
|---|---|---|
| PROJ-SC-001 | Create valid project | Project created |
| PROJ-SC-002 | Missing project name | Rejected |
| PROJ-SC-003 | Missing project key | Rejected |
| PROJ-SC-004 | Duplicate project key | Rejected |
| PROJ-SC-005 | Project key contains unsupported characters | Rejected according to key policy |
| PROJ-SC-006 | Invalid manager | Rejected |
| PROJ-SC-007 | Invalid assigned team | Rejected |
| PROJ-SC-008 | End date before start date | Rejected |
| PROJ-SC-009 | Valid project status | Accepted |
| PROJ-SC-010 | Invalid project status | Rejected |
| PROJ-SC-011 | Unauthorized project access | Denied |
| PROJ-SC-012 | PM accesses unrelated project | Denied unless explicitly permitted |
| PROJ-SC-013 | Archived project appears in active list | Excluded |
| PROJ-SC-014 | Project archived with historical tickets | History preserved |
| PROJ-SC-015 | Project member removed | Historical activity retained |

## 8. Ticket Management Scenarios

### 8.1 Ticket Creation and Validation

| ID | Scenario | Expected Result |
|---|---|---|
| TKT-SC-001 | Create valid ticket | Ticket created |
| TKT-SC-002 | Missing title | Rejected |
| TKT-SC-003 | Missing description | Rejected if required |
| TKT-SC-004 | Missing project | Rejected |
| TKT-SC-005 | Invalid project | Rejected |
| TKT-SC-006 | Invalid ticket type | Rejected |
| TKT-SC-007 | Invalid priority | Rejected |
| TKT-SC-008 | Invalid initial status | Rejected |
| TKT-SC-009 | Invalid assignee | Rejected |
| TKT-SC-010 | Assignee lacks project access | Rejected |
| TKT-SC-011 | Due date earlier than start date | Rejected |
| TKT-SC-012 | Past due date | Accept and classify as overdue unless policy prohibits |
| TKT-SC-013 | Negative estimated effort | Rejected |
| TKT-SC-014 | Duplicate ticket submission | Prevent unintended duplicate |
| TKT-SC-015 | Concurrent ticket creation | Unique ticket IDs maintained |
| TKT-SC-016 | Self-parent relationship | Rejected |
| TKT-SC-017 | Parent ticket belongs to another project | Rejected according to relationship policy |
| TKT-SC-018 | Parent-child cycle | Rejected |

### 8.2 Ticket Status and Role Permissions

Confirmed senior rules:

ADMIN:
Any configured source status -> Any configured target status.

PROJECT MANAGER:
Any configured source status -> Any configured target status.

DEVELOPER:
TODO -> IN_PROGRESS
TODO -> IN_REVIEW

TESTER:
TESTING -> TESTING_DONE
TESTING -> BUG_FIXED

BUG FIX WORKFLOW:
BUG_FIXED -> COMPLETED.

TESTING_DONE and COMPLETED are separate statuses.

Detailed test cases:

| ID | Role | Transition | Expected |
|---|---|---|---|
| TKT-TR-001 | Admin | Any configured transition | Allowed |
| TKT-TR-002 | PM | Any configured transition | Allowed within project permissions |
| TKT-TR-003 | Developer | TODO -> IN_PROGRESS | Allowed |
| TKT-TR-004 | Developer | IN_PROGRESS -> IN_REVIEW | Allowed |
| TKT-TR-005 | Developer | TESTING -> COMPLETED | Denied |
| TKT-TR-006 | Tester | TESTING -> TESTING_DONE | Allowed |
| TKT-TR-007 | Tester | TESTING -> BUG_FIXED | Allowed |
| TKT-TR-008 | Tester | TODO -> IN_PROGRESS | Denied |
| TKT-TR-009 | Developer | TODO -> COMPLETED | Denied |
| TKT-TR-010 | Approved workflow | BUG_FIXED -> COMPLETED | Required follow-up transition |
| TKT-TR-011 | Unauthorized role | Invalid transition | HTTP 403 |
| TKT-TR-012 | Any role | Nonexistent status | Validation error |
| TKT-TR-013 | Any role | Concurrent status update | Conflict handled |
| TKT-TR-014 | Any role | Invalid drag-and-drop transition | API rejects and UI restores original position |
| TKT-TR-015 | Tester | TESTING -> REOPENED | Allowed with required comment |
| TKT-TR-016 | Tester | TESTING -> IN_PROGRESS | Allowed with required comment |
| TKT-TR-017 | Assigned Developer | REOPENED -> IN_PROGRESS | Allowed |
| TKT-TR-018 | Tester | REOPENED -> COMPLETED | Denied |

The canonical actor and status rules are confirmed in ../workflows/ticket-workflow.md: Admin and PM perform BUG_FIXED -> COMPLETED; TESTING_DONE remains distinct from COMPLETED.

### 8.3 Ticket Assignment

| ID | Scenario | Expected Result |
|---|---|---|
| TKT-AS-001 | PM assigns eligible developer | Assignment succeeds |
| TKT-AS-002 | PM assigns eligible tester | Assignment succeeds |
| TKT-AS-003 | Invalid employee | Rejected |
| TKT-AS-004 | Inactive employee | Rejected |
| TKT-AS-005 | Unauthorized user assigns ticket | Denied |
| TKT-AS-006 | Ticket reassigned | Previous assignment history preserved |
| TKT-AS-007 | Cross-project assignment | Rejected unless explicitly permitted |

## 9. Comments and Collaboration

| ID | Scenario | Expected Result |
|---|---|---|
| COM-SC-001 | Add valid comment | Saved |
| COM-SC-002 | Empty comment | Rejected |
| COM-SC-003 | Whitespace-only comment | Rejected |
| COM-SC-004 | Excessively long comment | Rejected according to length policy |
| COM-SC-005 | User edits own comment | Allowed |
| COM-SC-006 | User edits another user's comment | Denied unless authorized |
| COM-SC-007 | Mention valid project member | Mention stored |
| COM-SC-008 | Mention nonexistent user | Rejected or treated as plain text according to policy |
| COM-SC-009 | Mention user without project access | Access rules enforced |
| COM-SC-010 | Malicious HTML/script content | Safely sanitized or escaped |
| COM-SC-011 | Duplicate comment request | No unintended duplicate |

Notification generation from mentions is excluded from the current implementation scope.

## 10. File and Attachment Validation

### Supported formats

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

### Confirmed limits

- Maximum documents: 5.
- Maximum size per individual file: 5 MB.

The precise scope of the five-document count remains to be confirmed.

| ID | Scenario | Expected Result |
|---|---|---|
| FILE-SC-001 | Upload valid JPG | Accepted |
| FILE-SC-002 | Upload valid PDF | Accepted |
| FILE-SC-003 | Upload valid XLSX | Accepted |
| FILE-SC-004 | Unsupported extension | Rejected |
| FILE-SC-005 | Valid extension but incorrect content | Rejected |
| FILE-SC-006 | File size below 5 MB | Accepted subject to other rules |
| FILE-SC-007 | File size exactly 5 MB | Accepted if within the configured byte limit |
| FILE-SC-008 | File size above 5 MB | Rejected |
| FILE-SC-009 | Empty file | Rejected |
| FILE-SC-010 | More than 5 selected documents | Rejected according to approved count scope |
| FILE-SC-011 | Double-extension filename | Actual content validation enforced |
| FILE-SC-012 | Filename contains path traversal | Safe generated filename used |
| FILE-SC-013 | Duplicate filename | No unintended overwrite |
| FILE-SC-014 | Unauthorized download | Denied |
| FILE-SC-015 | Unauthorized deletion | Denied |
| FILE-SC-016 | Storage failure | Safe error and cleanup/recovery |
| FILE-SC-017 | Database failure after upload | Orphan storage object handled |
| FILE-SC-018 | Archived/deleted parent ticket | Apply retention policy |

Use generated storage keys. Never trust the client filename or client MIME type.

File malware scanning is required where the approved infrastructure supports it.

## 11. Sprint and Backlog Scenarios

| ID | Scenario | Expected Result |
|---|---|---|
| SPR-SC-001 | Create valid sprint | Created |
| SPR-SC-002 | Missing sprint name | Rejected |
| SPR-SC-003 | End date before start date | Rejected |
| SPR-SC-004 | Add ticket from another project | Rejected |
| SPR-SC-005 | Add duplicate ticket | Prevented |
| SPR-SC-006 | Start sprint | Status updated |
| SPR-SC-007 | Complete sprint | Status updated |
| SPR-SC-008 | Complete sprint with incomplete tickets | Apply approved backlog policy |
| SPR-SC-009 | Unauthorized developer modifies sprint | Denied unless granted permission |

## 12. Search, Filter and Sorting Scenarios

| ID | Scenario | Expected Result |
|---|---|---|
| SEARCH-001 | Search valid ticket ID | Matching ticket returned |
| SEARCH-002 | Search nonexistent ID | Empty result |
| SEARCH-003 | Search unauthorized ticket | No record exposed |
| SEARCH-004 | Combine multiple filters | Correct combined result |
| SEARCH-005 | Invalid status filter | Rejected |
| SEARCH-006 | Unsupported sort field | Rejected |
| SEARCH-007 | Invalid page number | Rejected or safely normalized according to API contract |
| SEARCH-008 | Page size exceeds maximum | Rejected or capped according to API contract |
| SEARCH-009 | Empty results | Proper empty state |
| SEARCH-010 | Search contains special characters | Safe search behavior |
| SEARCH-011 | Filter changes while paginated | Page state reset or corrected |
| SEARCH-012 | Very large result set | Server-side pagination |

## 13. Dashboard and Reporting Scenarios

| ID | Scenario | Expected Result |
|---|---|---|
| DASH-001 | Admin opens dashboard | Admin metrics shown |
| DASH-002 | PM opens dashboard | Assigned project data shown |
| DASH-003 | Developer opens dashboard | Own work shown |
| DASH-004 | Tester opens dashboard | Testing work shown |
| DASH-005 | User has no assigned work | Empty state displayed |
| DASH-006 | Backend unavailable | Error state shown |
| DASH-007 | Dashboard statistics change after ticket update | Metrics reflect updated records |
| DASH-008 | Unauthorized project statistics requested | Denied |
| REPORT-001 | Generate project report | Correct metrics |
| REPORT-002 | Generate team workload | Correct member workload |
| REPORT-003 | Generate sprint report | Correct sprint results |
| REPORT-004 | Export authorized CSV | CSV generated |
| REPORT-005 | Export includes unauthorized records | Must be prevented |
| REPORT-006 | CSV contains formula-like user text | Spreadsheet formula injection prevented |

## 14. GitHub Scenarios

The application uses mock GitHub activity data during the current assignment.

The toolbar GitHub button is an external link to the developer's configured GitHub profile/account entry point.

| ID | Scenario | Expected Result |
|---|---|---|
| GH-SC-001 | Click GitHub toolbar button | Opens configured GitHub URL |
| GH-SC-002 | GitHub URL is missing or invalid | Configuration error or safe disabled state |
| GH-SC-003 | Display mock repository | Repository information shown |
| GH-SC-004 | Display mock branch | Branch details shown |
| GH-SC-005 | Link mock commit to ticket | Valid link stored |
| GH-SC-006 | Link mock pull request | PR information displayed |
| GH-SC-007 | Duplicate external event | No duplicate activity |
| GH-SC-008 | Unknown ticket reference | Link rejected |
| GH-SC-009 | Unauthorized repository access | Denied |

Future real GitHub integration must validate OAuth/App credentials and webhook signatures.

No GitHub password or personal access token may be embedded in frontend code.

## 15. Audit Log Scenarios

| ID | Scenario | Expected Result |
|---|---|---|
| AUD-SC-001 | User created | Audit event recorded |
| AUD-SC-002 | Role changed | Audit event recorded |
| AUD-SC-003 | Project created | Audit event recorded |
| AUD-SC-004 | Ticket assigned | Audit event recorded |
| AUD-SC-005 | Ticket status changed | Audit event recorded |
| AUD-SC-006 | Attachment uploaded | Audit event recorded |
| AUD-SC-007 | Unauthorized user views logs | Denied |
| AUD-SC-008 | User edits audit record | Denied |
| AUD-SC-009 | Sensitive password/token appears in metadata | Must be prevented |

## 16. UI and Scope Exclusions

The following features are explicitly excluded by senior clarification:

- Notifications module and UI.
- Notification bell, panel and unread count.
- Notification preferences and delivery workflows.
- Automate Pro button and automation functionality.

The following remain in scope:

- Ticket activity timeline.
- System audit logs.
- Comments.
- GitHub button.
- Kanban board.
- Filter and Sort.
- Role-specific dashboards.

Excluded features must not accidentally remain active through the UI or API.

## 17. API and HTTP Error Validation

Use a consistent error response format.

| HTTP Status | Meaning |
|---|---|
| 200 | Request successful |
| 201 | Resource created |
| 204 | Successful operation without response body |
| 400 | Invalid request |
| 401 | Authentication required or invalid |
| 403 | Permission denied |
| 404 | Resource unavailable |
| 409 | Conflict or duplicate resource |
| 413 | File/request too large |
| 415 | Unsupported media type |
| 422 | Validation/business rule failure |
| 429 | Rate limited |
| 500 | Internal error |
| 503 | Service unavailable |

Do not expose stack traces, internal database errors, file paths or secrets.

## 18. Performance and Network Edge Cases

Test:
- API timeout.
- Browser offline.
- Database connection interruption.
- Database deadlock and transaction rollback.
- Concurrent ticket updates.
- Duplicate submission after network failure.
- Large ticket lists.
- Slow project queries.
- Storage service failure.
- GitHub mock service failure.

Expected behavior:
- No silent data corruption.
- No unauthorized data access.
- Clear user feedback.
- Safe retry behavior.
- Correct transaction rollback.

## 19. Scenario Traceability

Every scenario SHALL map to:
- Requirement ID.
- Use Case ID.
- Validation rule.
- Test Case ID.
- Expected outcome.
- Execution result.
- Defect ID where applicable.

## 20. Pending Clarifications

1. Exact scope of the five-document count.
2. Exact byte limit interpretation for 5 MB.
3. Actor responsible for BUG_FIXED -> COMPLETED.
4. Remaining permitted BLOCKED/REOPENED/CANCELLED transitions.
5. Final project/team management permission boundaries.
6. Exact approved browser compatibility matrix.
7. Password complexity and session expiry values.

## 21. Approval

This catalogue is a draft requirements and testing baseline.

Senior review is required before finalizing pending business rules.

---
End of Document


## Workflow validation additions - 12 November 2026

Use `../workflows/ticket-workflow.md` as the canonical transition contract.

Add tests for:
- `BUG_FIXED` to `COMPLETED`.
- Tester changing `TESTING` to `REOPENED`.
- Developer changing an assigned `REOPENED` ticket to `IN_PROGRESS`.
- Admin/PM setting and clearing `BLOCKED`, `REOPENED` and `CANCELLED`.
- Rejection of unauthorized transitions.
- Rejection of status key `DONE`.
- Preservation of distinct `TESTING_DONE` and `COMPLETED` states.
- Required comment/reason when reopening, blocking or cancelling a ticket.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.

## User Management and invitation test additions — 17 November 2026

Add the following scenarios before accepting the User Management module:

| ID | Scenario | Expected result |
|---|---|---|
| USER-SC-011 | Invitation includes valid name, email, one role and multiple valid teams | Pending invitation saved with all selected details |
| USER-SC-012 | Invitation email matches an existing employee, case-insensitively | Reject duplicate |
| USER-SC-013 | Invitation email matches another active pending invitation | Reject or require explicit revoke/resend flow |
| USER-SC-014 | Invitation references a nonexistent or archived team | Reject entire request |
| USER-SC-015 | Invitation has no role or invalid role | Reject |
| USER-SC-016 | Invitation token is invalid, expired or revoked | Reject without creating user |
| USER-SC-017 | Invitation is accepted twice | Second acceptance rejected; no duplicate user/membership |
| USER-SC-018 | Password confirmation differs | Reject; invitation remains unused |
| USER-SC-019 | Acceptance database operation fails partway through | Roll back user, memberships and accepted state |
| USER-SC-020 | Two invitations attempt the same normalized email concurrently | Unique constraint/transaction prevents duplicate users |
| USER-SC-021 | Selected team appears twice | Normalize or reject duplicates; never create duplicate active membership |
| USER-SC-022 | Deactivated employee attempts to sign in with a valid password | Reject authentication |
| USER-SC-023 | Non-Admin calls employee-management endpoint | 403 |
| USER-SC-024 | Employee has exactly one role and multiple memberships | Accept |
| USER-SC-025 | Admin deactivates employee with active sessions | Access and refresh sessions must no longer authorize |

These are proposed test cases to be implemented and verified. Do not mark them passed merely because they are documented.

The canonical ticket workflow is `../workflows/ticket-workflow.md`; it supersedes stale `TKT-TR-004` direct `TODO` → `IN_REVIEW` scenario text.
