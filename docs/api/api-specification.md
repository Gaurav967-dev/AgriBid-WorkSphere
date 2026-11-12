# AgriBid WorkSphere — API Specification

**Document Status:** Draft for Technical Review
**Version:** 0.1
**API Base Path:** `/api/v1`

## 1. Introduction

This document defines the proposed REST API structure for AgriBid WorkSphere.

It establishes communication contracts between the frontend and backend, including:
- API endpoints
- HTTP methods
- Request and response formats
- Authentication and authorization
- Validation rules
- Error handling
- Security requirements
- API testing expectations

**Important:** This is an API design document. Routes and payloads are proposals until reviewed and approved. It does not mean that the backend has already been implemented.

## 2. API Conventions

### 2.1 Base URL

All application APIs use:

`/api/v1`

Example:

`http://localhost:8000/api/v1/auth/login`

The host and port are configurable development settings.

### 2.2 HTTP Methods

| Method | Purpose |
|---|---|
| GET | Retrieve resources |
| POST | Create resources or perform actions |
| PUT | Replace a resource |
| PATCH | Partially update a resource |
| DELETE | Delete or remove a resource |

### 2.3 Naming Conventions

- Use plural nouns for collection endpoints.
- Use lowercase paths.
- Use snake_case for JSON fields.
- Use ISO 8601 timestamps with timezone information.
- Use stable machine-readable values for roles and statuses.
- Use JSON for normal request and response bodies.
- Use multipart/form-data for file uploads.

### 2.4 Common Success Response

Example:

```json
{
  "data": {
    "id": "resource-id",
    "name": "Example"
  },
  "message": "Request completed successfully"
}
```

Collection response:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 0,
    "total_pages": 0
  }
}
```

The exact response envelope must be agreed upon before implementation.

### 2.5 Pagination

Proposed query parameters:

| Parameter | Description | Default |
|---|---|---|
| page | Page number | 1 |
| page_size | Records per page | 20 |
| search | Search term | Optional |
| sort_by | Sorting field | Endpoint-specific |
| sort_order | asc or desc | desc |

The backend must validate pagination values and enforce a maximum page size.

## 3. Authentication APIs

### 3.1 Confirmed Business Rules

- Employee account creation is invitation-only.
- Public self-registration is not allowed.
- Google authentication is excluded.
- Apple authentication is excluded.
- Each employee has exactly one role.
- Available roles are ADMIN, PM, DEVELOPER and TESTER.
- Company email integration uses dummy data such as `name@agribid.ai`.

### 3.2 Proposed Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | /auth/login | Employee login | Public |
| POST | /auth/refresh | Refresh session | Refresh credential |
| POST | /auth/logout | Logout | Authenticated |
| GET | /auth/me | Get current employee | Authenticated |
| POST | /invitations | Create invitation | Admin |
| GET | /invitations/{token} | Validate invitation | Invitation token |
| POST | /invitations/accept | Accept invitation | Valid invitation |

There is no public registration endpoint.

### 3.3 Login Request

`POST /auth/login`

```json
{
  "email": "employee@agribid.ai",
  "password": "example-password"
}
```

The backend validates credentials and employee account status.

The authentication response must not expose passwords, password hashes or secret credentials in its JSON body.

Token format, expiry, refresh strategy and cookie configuration require security approval.

### 3.4 Current Employee

`GET /auth/me`

Proposed response data:

```json
{
  "id": "user-id",
  "name": "Employee Name",
  "email": "employee@agribid.ai",
  "role": {
    "key": "DEVELOPER",
    "name": "Developer"
  },
  "teams": [
    {
      "id": "team-id",
      "name": "Development Team"
    }
  ],
  "is_active": true
}
```

One employee has one role and may belong to multiple teams.

### 3.5 Invitation Acceptance

The invitation flow must validate:
- Invitation existence.
- Invitation validity.
- Expiry.
- Whether it has already been used.
- Employee account creation eligibility.

Invitation expiry, resend behavior and role assignment during invitation require confirmation.

Email delivery is simulated using dummy data for this assignment. Do not claim a real email was delivered.

## 4. User Management APIs

### 4.1 Proposed Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | /users | List employees | Admin; other access to confirm |
| GET | /users/{user_id} | Get employee details | Authorized user |
| PATCH | /users/{user_id} | Update employee details | Admin or approved self-service |
| PATCH | /users/{user_id}/role | Change employee role | Admin |
| PATCH | /users/{user_id}/status | Activate/deactivate employee | Admin |

Employee account creation uses invitations, not public registration.

### 4.2 User Representation

```json
{
  "id": "user-id",
  "name": "Employee Name",
  "email": "employee@agribid.ai",
  "role": "DEVELOPER",
  "team_ids": [
    "team-1",
    "team-2"
  ],
  "is_active": true,
  "created_at": "2026-11-12T10:00:00+05:30",
  "updated_at": "2026-11-12T10:00:00+05:30"
}
```

### 4.3 Validation

- Email must be valid and unique.
- Name is required.
- Role must be one of the configured roles.
- An employee cannot have multiple roles.
- Team IDs must refer to valid teams.
- Deactivated employees must not access normal application functionality.
- Backend authorization must be enforced independently of frontend controls.

## 5. Team Management APIs

### 5.1 Proposed Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /teams | List teams |
| POST | /teams | Create team |
| GET | /teams/{team_id} | Get team details |
| PATCH | /teams/{team_id} | Update team |
| GET | /teams/{team_id}/members | List team members |
| POST | /teams/{team_id}/members | Add team member |
| DELETE | /teams/{team_id}/members/{user_id} | Remove team member |

Team creation and membership permissions for PMs require confirmation.

### 5.2 Add Team Member Request

```json
{
  "user_id": "user-id"
}
```

An employee can belong to multiple teams. Duplicate memberships must be prevented.

## 6. Project Management APIs

### 6.1 Proposed Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | /projects | List accessible projects | Authorized user |
| POST | /projects | Create project | PM, Admin |
| GET | /projects/{project_id} | Project details | Project access |
| PATCH | /projects/{project_id} | Update project | PM, Admin |
| GET | /projects/{project_id}/members | List project members | Project access |
| POST | /projects/{project_id}/members | Add project member | PM, Admin |
| DELETE | /projects/{project_id}/members/{user_id} | Remove project member | PM, Admin |
| GET | /projects/{project_id}/activity | Project activity | Project access |

### 6.2 Project Creation Request

```json
{
  "name": "WorkSphere Project",
  "description": "Project description",
  "team_ids": [
    "team-id"
  ],
  "member_ids": [
    "user-id"
  ]
}
```

The final fields must match the approved database design and functional requirements.

The backend must validate project membership and access before returning project data.

## 7. Ticket Management APIs

### 7.1 Proposed Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /tickets | List accessible tickets |
| POST | /tickets | Create ticket |
| GET | /tickets/{ticket_id} | Get ticket details |
| PATCH | /tickets/{ticket_id} | Update ticket |
| POST | /tickets/{ticket_id}/assign | Assign ticket |
| POST | /tickets/{ticket_id}/status | Change ticket status |
| GET | /tickets/{ticket_id}/history | Ticket history |
| GET | /tickets/{ticket_id}/comments | List comments |
| POST | /tickets/{ticket_id}/comments | Add comment |
| GET | /tickets/{ticket_id}/attachments | List attachments |
| POST | /tickets/{ticket_id}/attachments | Upload attachments |
| DELETE | /tickets/{ticket_id}/attachments/{attachment_id} | Remove attachment |
| POST | /tickets/{ticket_id}/relationships | Create ticket relationship |

All endpoints must enforce role and project-level authorization.

### 7.2 Ticket Creation Request

```json
{
  "project_id": "project-id",
  "title": "Implement employee dashboard",
  "description": "Ticket description",
  "priority": "HIGH",
  "assignee_id": "user-id",
  "label_ids": [
    "label-id"
  ]
}
```

The final required fields and initial status must match the approved requirements.

### 7.3 Ticket Assignment Request

`POST /tickets/{ticket_id}/assign`

```json
{
  "assignee_id": "user-id"
}
```

The backend validates that the employee exists, is active and is eligible for assignment.

Assignment changes must be recorded in ticket history.

### 7.4 Ticket Status Request

`POST /tickets/{ticket_id}/status`

```json
{
  "target_status": "IN_PROGRESS",
  "comment": "Starting implementation"
}
```

The backend must validate:
- Current ticket status.
- Requested target status.
- Employee role.
- Allowed workflow transition.
- Project/resource access.

The frontend must never be trusted to enforce workflow permissions.

### 7.5 Confirmed Ticket Workflow Rules

| Role | Confirmed permission |
|---|---|
| Admin | Can change any ticket to any configured status |
| PM | Can create, assign and move tickets to any status |
| Developer | Can move tickets from TODO to IN_PROGRESS or IN_REVIEW |
| Tester | Can move tickets from TESTING to TESTING_DONE or BUG_FIXED |

Additional confirmed rules:

- TESTING_DONE and COMPLETED are separate statuses.
- A ticket in BUG_FIXED proceeds to COMPLETED.
- The role permitted to perform BUG_FIXED to COMPLETED has not yet been specified.
- Do not silently assign this transition to Tester or another role.
- The Developer transition rule above follows the senior's explicit clarification.

The backend must reject any unauthorized transition without modifying the ticket.

### 7.6 Ticket Filtering

The list endpoint may support:

- project_id
- status
- priority
- assignee_id
- reporter_id
- label_id
- search
- page
- page_size
- sort_by
- sort_order

Only approved filters should be supported.

## 8. Comments and Mentions APIs

### 8.1 Proposed Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /tickets/{ticket_id}/comments | List comments |
| POST | /tickets/{ticket_id}/comments | Create comment |
| PATCH | /comments/{comment_id} | Edit comment |
| DELETE | /comments/{comment_id} | Delete comment |

### 8.2 Comment Request

```json
{
  "body": "Implementation is ready for review.",
  "mentioned_user_ids": [
    "user-id"
  ]
}
```

The backend validates the comment body and mentioned employee IDs.

Mention records may be stored for application functionality. This does not authorize implementation of the excluded Notifications module.

Comment editing, deletion and mention visibility permissions require confirmation if not already specified.

## 9. Attachment APIs

### 9.1 Upload Endpoint

`POST /tickets/{ticket_id}/attachments`

Content type:

`multipart/form-data`

Proposed field:

`files`

### 9.2 Confirmed File Constraints

- Maximum individual file size: 5 MB per file.
- Maximum document count: 5 documents.
- The scope of the five-document limit must be confirmed before enforcement is finalized.

### 9.3 Validation

The backend must validate:

1. Individual file size.
2. Maximum document count.
3. Approved file types.
4. File content validity.
5. Employee permission.
6. Parent ticket existence and accessibility.

Rejected uploads must not create orphaned attachment records.

### 9.4 Attachment Response

```json
{
  "id": "attachment-id",
  "ticket_id": "ticket-id",
  "file_name": "requirements.pdf",
  "file_size": 1048576,
  "content_type": "application/pdf",
  "uploaded_by": "user-id",
  "uploaded_at": "2026-11-12T10:00:00+05:30"
}
```

Storage provider, download strategy, file retention, malware scanning and MIME allowlist require approval.

## 10. Labels APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | /projects/{project_id}/labels | List labels |
| POST | /projects/{project_id}/labels | Create label |
| PATCH | /labels/{label_id} | Update label |
| DELETE | /labels/{label_id} | Delete label |

Final fields and permissions must follow the approved requirements.

## 11. Ticket Relationship APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | /tickets/{ticket_id}/relationships | Create relationship |
| DELETE | /tickets/{ticket_id}/relationships/{relationship_id} | Remove relationship |

The relationship catalogue and directionality must be agreed upon.

The backend must prevent invalid references and duplicate relationships where duplicates are not allowed.

## 12. Sprint APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | /projects/{project_id}/sprints | List project sprints |
| POST | /projects/{project_id}/sprints | Create sprint |
| GET | /sprints/{sprint_id} | Get sprint |
| PATCH | /sprints/{sprint_id} | Update sprint |
| GET | /sprints/{sprint_id}/tickets | List sprint tickets |
| POST | /sprints/{sprint_id}/tickets | Add ticket to sprint |
| DELETE | /sprints/{sprint_id}/tickets/{ticket_id} | Remove ticket from sprint |

Sprint lifecycle, date validation and ticket movement rules require confirmation.

## 13. Activity and Audit APIs

### 13.1 Proposed Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | /projects/{project_id}/activity | Project activity | Project access |
| GET | /tickets/{ticket_id}/history | Ticket history | Project access |
| GET | /audit-logs | System audit history | Admin; confirm |

Activity history and audit logs are separate:

- Activity history displays relevant project and ticket events.
- Audit logs record security- and administration-relevant actions.

Important events include ticket status changes, assignment changes, membership changes and employee role/status changes.

The Notifications module is excluded. Do not create notification endpoints or notification delivery functionality.

## 14. GitHub Integration APIs

### 14.1 Confirmed Scope

- GitHub button leads to the employee's personal GitHub account or configured destination.
- Mock GitHub activity data may be displayed in the application.
- GitHub Enterprise integration uses dummy data for the assignment.
- Real GitHub Enterprise credentials and production integration are not assumed.

The actual personal GitHub URL must be supplied and configured. Do not invent it.

### 14.2 Proposed Mock Activity Endpoint

`GET /projects/{project_id}/github/activity`

Proposed response:

```json
{
  "data": [
    {
      "id": "activity-id",
      "event_type": "PUSH",
      "repository": "agribid-demo",
      "actor": "developer@agribid.ai",
      "title": "Update ticket workflow",
      "occurred_at": "2026-11-12T10:00:00+05:30",
      "is_mock": true
    }
  ]
}
```

Mock activity must be clearly identified as mock data.

It must not imply that a real commit, webhook or GitHub synchronization occurred.

The external GitHub button does not require a backend endpoint merely to open a profile.

## 15. Excluded API Features

The following are excluded based on senior clarification:

- Notifications module and related endpoints.
- Automate Pro and automation-management endpoints.
- Google authentication.
- Apple authentication.
- Public employee registration.
- Live GitHub Enterprise synchronization.
- Real email delivery for the assignment.
- Production hosting and deployment work.

Do not create endpoints, tables, screens or background jobs for these excluded features unless the senior changes the scope.

## 16. Authorization Requirements

Every protected endpoint must:

1. Authenticate the request.
2. Verify employee active status.
3. Load the employee's single role.
4. Verify project/team/resource access.
5. Check the requested action against approved permissions.
6. Return an appropriate error response when access is denied.

Frontend visibility is not security. The backend is the source of truth for authorization.

### 16.1 High-Level Permission Summary

| Capability | Admin | PM | Developer | Tester |
|---|---|---|---|---|
| Create employee invitation | Yes | Not confirmed | No | No |
| Change employee role/status | Yes | No | No | No |
| Create project | Yes | Yes | No | No |
| Create ticket | Yes | Yes | Not confirmed | Not confirmed |
| Assign ticket | Yes | Yes | Not confirmed | Not confirmed |
| Move ticket to any status | Yes | Yes | No | No |
| TODO to IN_PROGRESS or IN_REVIEW | Yes | Yes | Yes | Not confirmed |
| TESTING to TESTING_DONE or BUG_FIXED | Yes | Yes | Not confirmed | Yes |

Not-confirmed permissions must not be implemented as assumed grants.

## 17. Error Response Format

All errors should follow a consistent structure.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": [
      {
        "field": "email",
        "message": "Enter a valid email address."
      }
    ],
    "request_id": "request-id"
  }
}
```

Do not expose stack traces, database errors, secrets or internal file paths.

### 17.1 HTTP Status Codes

| Status | Meaning | Example |
|---|---|---|
| 200 | Successful request | Resource retrieved |
| 201 | Resource created | Ticket created |
| 202 | Accepted for asynchronous processing | Approved async operation |
| 204 | Success with no response body | Membership removed |
| 400 | Bad request | Invalid query parameter |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not found | Resource unavailable |
| 409 | Conflict | Duplicate membership |
| 413 | Content too large | File exceeds 5 MB |
| 415 | Unsupported media type | Unsupported file type |
| 422 | Validation error | Missing required field |
| 429 | Too many requests | Rate limit exceeded |
| 500 | Internal server error | Unexpected server failure |

### 17.2 HTTP 419

The frontend has been asked to handle HTTP 419 separately.

However, 419 is not a standard HTTP status code. Its exact meaning and usage must be agreed upon before backend implementation.

Do not use 419 interchangeably with 401 or 403 without an approved contract.

### 17.3 Validation Errors

Validation responses should identify the relevant field wherever possible.

The frontend should display field-level messages and appropriate general request errors.

## 18. Security Requirements

- Never store plaintext passwords.
- Never return password hashes or secret credentials.
- Enforce authorization on every protected endpoint.
- Validate and normalize all input on the backend.
- Use parameterized database operations or a safe ORM.
- Validate uploads on the backend.
- Restrict file size and allowed file types.
- Do not expose internal storage credentials or paths.
- Never log passwords, tokens or invitation secrets.
- Apply appropriate rate limiting to sensitive operations.
- Use secure transport in deployed environments.
- Define CORS, cookie, CSRF and token policies before authentication implementation.
- Use generic authentication errors where detailed errors could reveal account existence.

### 18.1 Security Decisions Requiring Approval

| Topic | Decision required |
|---|---|
| Authentication | Session cookies or bearer tokens |
| Access credential | Format, expiry and validation |
| Refresh credential | Storage, rotation, expiry and revocation |
| Cookies | HttpOnly, Secure, SameSite, path and domain |
| CSRF | Protection approach |
| Password | Minimum length and complexity |
| Password recovery | Whether in scope |
| Login protection | Rate limits and lockout |
| Invitations | Token generation and expiry |
| CORS | Allowed frontend origins |
| File security | MIME allowlist and malware scanning |

Do not invent final security values in code before approval.

## 19. API Validation and Edge Cases

| Area | Edge case | Expected behavior |
|---|---|---|
| Authentication | Missing credentials | Reject |
| Authentication | Incorrect credentials | Reject without sensitive disclosure |
| Authentication | Deactivated employee | Deny normal access |
| Invitation | Invalid/expired token | Reject |
| Invitation | Reused token | Reject |
| Users | Duplicate email | Reject |
| Users | Invalid role | Reject |
| Users | Multiple roles | Reject |
| Teams | Duplicate membership | Prevent duplicate |
| Teams | Multiple team memberships | Allow |
| Projects | No project access | Deny |
| Tickets | Unknown assignee/project | Reject |
| Tickets | Invalid status | Reject |
| Tickets | Unauthorized transition | Reject without updating |
| Tickets | Concurrent updates | Safely handle conflict |
| Comments | Empty body | Reject |
| Mentions | Unknown employee | Reject or apply approved rule |
| Attachments | File above 5 MB | Reject |
| Attachments | Exceeded document count | Reject |
| Attachments | Unsupported file type | Reject |
| Relationships | Invalid relationship | Reject |
| Sprints | Invalid date range | Reject |
| Pagination | Negative or excessive values | Validate |
| Authorization | Frontend bypass | Backend denies unauthorized action |

## 20. API Testing Requirements

Every implemented endpoint should be tested for:

- Successful authorized request.
- Unauthenticated request.
- Insufficient role permissions.
- Invalid request body.
- Invalid query parameters.
- Missing resource.
- Duplicate/conflicting operation.
- Boundary values.
- Project/team access restrictions.
- Valid and invalid workflow transitions.

Ticket workflow tests must cover all senior-confirmed transitions and the unresolved BUG_FIXED to COMPLETED actor rule.

Tests should verify both response status and response body.

Rejected requests must not leave partial database changes.

## 21. Implementation Readiness Checklist

Before implementing the backend, confirm:

- [ ] API base path and response envelope.
- [ ] Authentication and refresh/session strategy.
- [ ] Invitation token and expiry behavior.
- [ ] Complete role-permission matrix.
- [ ] Actor for BUG_FIXED to COMPLETED.
- [ ] Complete ticket status catalogue and transitions.
- [ ] Project and team access rules.
- [ ] Team and project administration permissions.
- [ ] Ticket fields and priorities.
- [ ] Ticket relationship types.
- [ ] Scope of maximum five uploaded documents.
- [ ] Allowed file types and storage strategy.
- [ ] HTTP 419 meaning.
- [ ] GitHub mock response format.
- [ ] Error response contract.
- [ ] Excluded modules remain excluded.

## 22. Change Management

Any approved change to this specification must also be reflected in:

- Software Requirements Specification.
- Functional Requirements.
- Use Case Catalogue.
- User Roles and Permissions.
- Database Design.
- ERD.
- Technical Design.
- Validation and Edge Cases.
- Requirements Traceability Matrix.
- API and integration tests.

Do not implement a route merely because it appears in this draft. Confirm that it supports an approved requirement and has agreed authorization, request/response fields and validation rules.


## Latest senior-confirmed workflow and authentication contract - 12 November 2026

### Ticket status contract

The canonical status catalogue and role transition rules are maintained in `../workflows/ticket-workflow.md`.

The valid status key is `COMPLETED`; `DONE` must not be accepted or returned as a status key.

Tester may change `TESTING` to `TESTING_DONE`, `BUG_FIXED` or `REOPENED`.

Developer may change `TODO` to `IN_PROGRESS` or `IN_REVIEW`, and an assigned Developer may move `REOPENED` to `IN_PROGRESS`.

Admin and PM may move tickets between any configured statuses within their authorized scope, including managing `BLOCKED`, `REOPENED` and `CANCELLED`.

Every successful status change must create a ticket activity/history record in the same database transaction.

### Authentication implementation contract

Use PyJWT for 15-minute access JWTs and an opaque, randomly generated refresh token with a 7-day initial lifetime.

Return the access token for in-memory frontend use. Set the refresh token in an HttpOnly, SameSite=Strict cookie. Store only a hash of the refresh token in the database. Rotate refresh tokens and revoke the current session during logout.

Use `pwdlib[argon2]` for password hashing. Restrict CORS to the configured frontend origin. Validate the request Origin on refresh and logout.

For this assignment, use standard HTTP status codes such as 401, 403, 409 and 422. Do not introduce a custom 419 status.

### Upload contract

Keep the confirmed 5 MB limit per individual file. The exact scope for the maximum five-document count must be settled before enforcing the count in the database.


## Authoritative workflow correction — 12 November 2026

This section supersedes earlier draft workflow descriptions in this API document.

The canonical workflow is defined in `../workflows/ticket-workflow.md`.

### Normal workflow

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`

The original PDF's default sequence is retained. Only the final status key changes from `DONE` to `COMPLETED`.

### Role transitions

- Developer: `TODO` → `IN_PROGRESS`.
- Developer: `IN_PROGRESS` → `IN_REVIEW`.
- Developer: assigned `REOPENED` ticket → `IN_PROGRESS`.
- Tester: `TESTING` → `TESTING_DONE`, `BUG_FIXED` or `REOPENED`.
- Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment, following the PDF.
- `BUG_FIXED` proceeds to `COMPLETED`.
- Admin and PM can move tickets to any configured status within their authorized scope, including managing `BLOCKED`, `REOPENED` and `CANCELLED`.

`TESTING_DONE` remains distinct from `COMPLETED`. No extra Tester transition out of `TESTING_DONE` is assumed.

All successful changes must be recorded in ticket history. The backend must validate each transition.

### API request contract

The status-change endpoint remains:

`POST /api/v1/tickets/{ticket_id}/status`

Example:

```json
{
  "target_status": "IN_REVIEW",
  "comment": "Development completed and submitted for review."
}
```

When reopening, blocking or cancelling a ticket, the reason/comment is required.

`DONE` must not be accepted or returned as a status key.
