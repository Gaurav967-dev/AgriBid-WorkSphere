# AgriBid WorkSphere
# Non-Functional Requirements Specification

| Attribute | Details |
|---|---|
| Project | AgriBid WorkSphere |
| Document | Non-Functional Requirements |
| Version | 1.0 |
| Date | 11 November 2026 |
| Status | Draft for Senior Review |
| Source | Project Development Assignment and approved scope changes |

## 1. Purpose

This document defines the quality attributes and operational
constraints that AgriBid WorkSphere must satisfy.

It covers security, performance, reliability, maintainability,
usability, compatibility, data integrity and testing.

## 2. Security Requirements

### NFR-SEC-001: Password Security
- Passwords must never be stored in plaintext.
- Use secure password hashing.
- Password hashes must not be exposed through APIs or logs.

### NFR-SEC-002: Authentication
- Authentication must be validated by the backend.
- Protected APIs must reject unauthenticated requests.
- Inactive employees must not authenticate.
- Session expiry and revocation must be handled safely.

### NFR-SEC-003: Authorization
- Enforce role permissions at the backend.
- Each employee has exactly one role.
- PM access must respect assigned project permissions.
- Developer and Tester access must respect project/ticket permissions.
- Hiding frontend controls must not be considered sufficient security.

### NFR-SEC-004: Input Validation
- Validate client input on the backend.
- Use parameterized database operations or ORM-safe queries.
- Reject invalid request formats and business-rule violations.
- Validate data before database persistence.

### NFR-SEC-005: SQL Injection Protection
- Do not construct database queries by unsafe string concatenation.
- Use safe parameterized query mechanisms.
- Validate sorting and filtering against approved fields.

### NFR-SEC-006: XSS Protection
- Escape or sanitize user-generated content appropriately.
- Do not render untrusted HTML without sanitization.
- Avoid unsafe DOM operations.

### NFR-SEC-007: CSRF Protection
Where cookie-based authentication is used, apply appropriate
CSRF protections.

### NFR-SEC-008: CORS
- Configure explicit allowed origins.
- Do not use wildcard origins with credentialed requests.
- Configure cookie and origin handling appropriately.

### NFR-SEC-009: Rate Limiting
Apply appropriate rate limiting to login and other abuse-prone
endpoints.

Exact numerical thresholds require security approval.

### NFR-SEC-010: Secret Management
- Keep secrets in environment variables or an approved secret store.
- Never commit secrets to GitHub.
- Maintain .env.example with placeholder values.
- Never expose GitHub credentials in browser code.

### NFR-SEC-011: File Security
- Validate actual file content.
- Enforce file-size and document-count limits.
- Generate safe storage keys.
- Prevent path traversal.
- Enforce access-controlled file downloads.
- Use malware scanning when supported by infrastructure.

### NFR-SEC-012: Error Security
API responses must not expose:
- Passwords.
- Tokens.
- Database passwords.
- Stack traces.
- Internal file paths.
- SQL statements.
- Sensitive system configuration.

### NFR-SEC-013: Audit Integrity
- Audit records must not be editable by ordinary users.
- Sensitive authentication information must never be recorded in audit metadata.

## 3. Performance Requirements

### NFR-PERF-001: Frontend Performance
- Avoid unnecessary React re-renders.
- Fetch only required data.
- Use appropriate caching.
- Use pagination or controlled loading.
- Lazy-load suitable components.
- Optimize image and attachment handling.

### NFR-PERF-002: Server State
Use TanStack Query for server-state handling, caching,
and appropriate cache invalidation.

### NFR-PERF-003: Search
Use debounced search where appropriate.

Avoid issuing unnecessary repeated requests.

### NFR-PERF-004: Database Performance
- Use appropriate indexes.
- Optimize joins and filters.
- Use pagination.
- Avoid N+1 queries.
- Use connection pooling.
- Measure slow queries.

### NFR-PERF-005: Background Processing
Long-running operations should use appropriate background
processing when necessary.

### NFR-PERF-006: Redis
Redis is optional.

It must only be introduced when a measurable requirement
justifies caching or background processing.

### NFR-PERF-007: Performance Measurement
Performance must be measured using realistic test data.

Do not claim performance targets have been achieved without testing.

Exact response-time, concurrency and data-volume targets remain TBD.

## 4. Reliability and Availability Requirements

### NFR-REL-001: Error Handling
The application must handle:
- Invalid requests.
- Authentication failures.
- Authorization failures.
- Database errors.
- Network errors.
- Storage failures.
- External integration failures.

### NFR-REL-002: Transactions
Multi-step database operations must use appropriate transactions.

Incomplete operations must not leave inconsistent records.

### NFR-REL-003: Duplicate Prevention
Prevent unintended duplicate:
- Employee accounts.
- Team memberships.
- Project keys.
- Ticket IDs.
- Comments caused by repeated requests.
- Attachment storage records.
- GitHub mock activity records.

### NFR-REL-004: Concurrent Updates
Conflicting ticket or project changes must be detected and
handled consistently.

### NFR-REL-005: Failure Recovery
Where an external or storage operation fails, cleanup,
retry or recovery behavior must be defined.

### NFR-REL-006: Graceful Degradation
Failure of an optional service must not unnecessarily
make unrelated modules unavailable.

## 5. Data Integrity Requirements

### NFR-DATA-001: Primary Keys
Every persistent entity must have a valid primary key.

### NFR-DATA-002: Foreign Keys
Relationships between users, teams, projects, tickets,
comments and attachments must use valid references.

### NFR-DATA-003: Uniqueness
Apply unique constraints to values that must be unique,
including employee email and project key.

### NFR-DATA-004: Role Integrity
Exactly one valid role must be associated with each employee.

### NFR-DATA-005: Team Membership Integrity
A user may have multiple team memberships, but duplicate
active membership for the same team/user combination must
be prevented.

### NFR-DATA-006: Ticket Integrity
Ticket identifiers must be unique.

Ticket relationships must not create invalid references
or circular parent-child relationships.

### NFR-DATA-007: Historical Data
Removing an employee from a team or deactivating an employee
must not silently delete historical project and ticket activity.

### NFR-DATA-008: Timestamp Consistency
Store timestamps consistently in UTC and convert for
display when required.

### NFR-DATA-009: Database Migrations
Use database migrations for schema changes.

### NFR-DATA-010: Retention
Define soft deletion and retention behavior before implementing
permanent deletion of historical records.

## 6. Maintainability Requirements

### NFR-MAINT-001: Modular Frontend
- Use feature-based organization.
- Separate reusable UI components from feature logic.
- Keep API communication centralized.
- Avoid giant page components.
- Reuse shared types and validation schemas appropriately.

### NFR-MAINT-002: Modular Backend
Separate:
- Routers.
- Schemas.
- Services.
- Repositories.
- Models.
- Integrations.
- Shared infrastructure.

### NFR-MAINT-003: Code Quality
- Use consistent naming conventions.
- Avoid duplicated business logic.
- Avoid unnecessary dependencies.
- Use meaningful function and variable names.
- Add comments where business logic requires clarification.

### NFR-MAINT-004: Type Safety
Use TypeScript types in the frontend and Pydantic schemas
in the backend.

### NFR-MAINT-005: Configuration
Keep environment-specific configuration outside application code.

### NFR-MAINT-006: Documentation
Maintain README, setup instructions, API documentation,
architecture, ERD, testing reports and coding conventions.

### NFR-MAINT-007: Testability
Modules must be structured so business rules can be tested independently.

## 7. Usability and Accessibility Requirements

### NFR-UX-001: Consistency
Use consistent spacing, typography, colors, inputs,
buttons and components.

### NFR-UX-002: Responsive Design
Support desktop, tablet and mobile screen sizes.

### NFR-UX-003: Feedback
Provide:
- Field-level validation errors.
- Success and error messages.
- Loading states.
- Empty states.
- Confirmation before destructive actions.

### NFR-UX-004: Navigation
Display only relevant navigation options according
to authenticated user permissions.

### NFR-UX-005: Keyboard Accessibility
Provide suitable keyboard navigation and visible focus states.

### NFR-UX-006: Readability
Use appropriate font sizes, contrast and readable labels.

### NFR-UX-007: Authentication UI
Follow the supplied authentication reference image and
AgriBid WorkSphere branding.

### NFR-UX-008: Controlled Scope
Do not display excluded Notifications or Automate Pro controls.

The GitHub toolbar button must link to the configured
personal GitHub account URL.

## 8. Compatibility Requirements

### NFR-COMP-001: Browser Compatibility
The frontend should work in supported modern browsers.

The exact approved browser/version matrix requires confirmation.

### NFR-COMP-002: Operating Environment
The system must be runnable in the approved local development
environment.

### NFR-COMP-003: API Compatibility
Frontend/backend request and response contracts must remain
consistent and documented.

## 9. Integration Requirements

### NFR-INT-001: Email Mocking
- Use dummy company-style email addresses.
- Example: name@agribid.ai.
- Simulate email events during initial testing.
- Do not claim actual delivery through company infrastructure.

### NFR-INT-002: GitHub Mocking
- Use dummy repository, branch, commit and pull request data
  during initial development.
- Keep integration logic isolated from ticket business logic.
- Keep the toolbar GitHub URL configurable.

### NFR-INT-003: Future Integration Readiness
Design integration boundaries so company services can be
connected without rewriting core business modules.

## 10. Development and Source Control Requirements

### NFR-DEV-001: Git Usage
Use Git throughout development.

### NFR-DEV-002: Branching
Maintain:
- main.
- develop.
- feature/*.
- fix/*.
- hotfix/*.

### NFR-DEV-003: Commit Quality
Commit logical, reviewed changes using meaningful commit messages.

### NFR-DEV-004: Pull Requests
Use pull requests for completed features and fixes.

### NFR-DEV-005: Secret Protection
Never commit passwords, tokens, private keys or real company credentials.

### NFR-DEV-006: Documentation Updates
Requirement and technical documentation must be updated
when approved system behavior changes.

## 11. Testing and Quality Requirements

### NFR-TEST-001: Frontend Testing
Test forms, navigation, UI states, permissions-based visibility,
ticket operations and interactive components.

### NFR-TEST-002: Backend Testing
Test endpoint validation, authorization, business rules,
database relationships and errors.

### NFR-TEST-003: Integration Testing
Verify complete workflows across frontend, backend and database.

### NFR-TEST-004: Negative Testing
Test invalid input, unauthorized actions, missing resources,
expired credentials, oversized files and failed transactions.

### NFR-TEST-005: Regression Testing
Existing accepted functionality must continue working
after changes.

### NFR-TEST-006: Test Reporting
Record test cases, execution results, defects, severity
and resolution status.

## 12. Current Assignment Constraints

The following are current implementation scope constraints:

1. Invitation-only account creation.
2. One role per employee.
3. Multiple team memberships are allowed.
4. Maximum attachment count: five documents; exact scope TBD.
5. Maximum attachment size: 5 MB per individual document.
6. Dummy company email data.
7. Mock GitHub activity data.
8. Personal GitHub account link in the UI.
9. Notifications excluded.
10. Automate Pro excluded.
11. Production hosting and deployment excluded.

## 13. Out of Scope

- Production hosting and deployment.
- Notifications module and notification delivery.
- Automate Pro and automation features.
- Real company email delivery during mock development.
- Real GitHub Enterprise OAuth/webhook integration during
  the initial mock-data implementation.

## 14. Quality Acceptance Criteria

The application must demonstrate:

- Correct role authorization.
- Secure password handling.
- Valid project/ticket relationships.
- Correct status transition enforcement.
- Safe file uploads and downloads.
- Consistent database transactions.
- Proper frontend/backend error handling.
- Responsive and usable UI.
- Successful critical integration tests.
- Maintainable and documented source code.

Exact numerical performance and availability thresholds
must be confirmed before they can be treated as acceptance targets.

---
End of Document
