# AgriBid WorkSphere — Test Plan

**Version:** 1.0  
**Prepared:** 17 November 2026  
**Target delivery:** 27 November 2026  
**Status:** Initial executable test plan — cases must be run and evidence recorded

## 1. Purpose

Define the verification approach for the current authentication foundation and the next User Management, Team Management and Project Management modules. This document is a plan, not proof that all listed tests have passed.

## 2. Test scope

### In scope
- Authentication: sign-in, ID-token verification, access verification, refresh rotation, logout, session revocation and authentication errors.
- User Management: invitation creation/acceptance, employee list/detail/update, role assignment, account activation/deactivation and validation.
- Team Management: create/update/archive, add/remove members, multiple memberships, duplicate prevention and history preservation.
- Project Management: create/update/archive, manager/team assignment, members, dates, project access and project data validation.
- Cross-cutting: API validation, authorization, database transactions, pagination, frontend loading/error/empty states, responsive behavior and integration.

### Explicit exclusions
- Notifications module and notification delivery.
- Automate Pro.
- Production deployment/hosting.
- Real company email delivery.
- Real GitHub Enterprise OAuth/webhooks. Mock activity remains in scope; personal GitHub toolbar link remains in scope.

## 3. Test levels and tools

| Test level | Purpose | Tool / approach |
|---|---|---|
| Backend unit tests | Services, validators, token utilities and business rules | pytest |
| Backend API tests | Routes, status codes, cookies, validation and authorization | FastAPI TestClient / HTTPX |
| Database/migration tests | Constraints, migrations, transactions and rollback | PostgreSQL + Alembic |
| Frontend static checks | TypeScript, lint and production compilation | npm run lint; npm run build |
| Frontend component tests | Forms, tables, filters, dialogs and states | Vitest + React Testing Library (when added) |
| Browser integration | Complete browser-to-API workflows and responsive UI | Playwright (when added); manual browser verification |
| Regression | Previously verified features continue to work | Re-run relevant suite before integration |

## 4. Environment and test data

- Development frontend: http://localhost:3000.
- Development backend: http://127.0.0.1:8000.
- Database: local PostgreSQL development database.
- Use dummy company-style addresses such as name@agribid.ai.
- Use non-production test accounts and generated credentials.
- Never place real secrets, passwords or token values in test reports or screenshots.
- Test all four roles: Admin, PM, Developer and Tester.
- Seed deterministic test records; clean up created records or isolate tests in transactions.

## 5. Authentication baseline — current evidence

The following checks were run on 16 November 2026:

| Check | Result | Evidence |
|---|---|---|
| Backend tests | Passed | 25 tests passed |
| Ruff lint | Passed | All checks passed |
| Ruff format check | Passed | 37 files already formatted |
| Frontend lint | Passed | npm run lint |
| Frontend production build | Passed | Next.js build and TypeScript checks completed |
| Alembic migration | Passed | alembic upgrade head; current revision 5f1c30688905 |
| Backend health | Passed | /api/v1/health and /api/v1/health/ready returned healthy responses |
| Sign-in and dashboard | Passed manually | Successful sign-in reached protected dashboard |
| Expired access refresh | Passed manually | verify 401 → refresh 200 → verify retry 200; access cookie renewed |

Two deprecation warnings appeared during pytest; they did not fail the test run and should be reviewed separately.

## 6. Authentication test cases

| ID | Test | Expected result | Status |
|---|---|---|---|
| AUTH-T-001 | Valid active employee signs in | 200; three HttpOnly cookies issued | Backend tests passed; browser sign-in verified |
| AUTH-T-002 | Unknown email or incorrect password | Generic 401; no session created | Backend tests passed |
| AUTH-T-003 | Inactive account signs in | 401; no session created | Backend tests passed |
| AUTH-T-004 | ID token verification | Valid identity/session returned; ID cookie cleared | Browser flow verified |
| AUTH-T-005 | ID token reused or invalid | 401 | Backend tests passed |
| AUTH-T-006 | Access token valid | Protected verification returns 200 | Browser flow verified |
| AUTH-T-007 | Access token expired, refresh valid | Refresh rotates session and returns 200 | Browser flow verified |
| AUTH-T-008 | Expired access, refresh, retry | 401 → 200 → 200 sequence | Browser flow verified |
| AUTH-T-009 | Refresh token reused after rotation | Active sessions revoked; 401 | Backend tests passed |
| AUTH-T-010 | Refresh token absent/invalid/expired | 401; no new credentials issued | Backend tests passed |
| AUTH-T-011 | Logout with refresh cookie | Session revoked and cookies cleared | Backend tests passed |
| AUTH-T-012 | Concurrent protected requests need refresh | One shared refresh operation; protected requests retry once | Frontend helper implemented; add automated browser test |
| AUTH-T-013 | Cookie path and flags | ID /api/v1/auth/id-token/verify; access /; refresh /api/v1/auth/refresh-token; HttpOnly; SameSite=Lax | Browser inspected |
| AUTH-T-014 | CORS origin not allowed | Request rejected by browser/server policy | Automated test pending |

## 7. User Management test cases — planned

| ID | Test | Expected result |
|---|---|---|
| USER-T-001 | Admin creates invitation with name, email, one role and multiple teams | Invitation stored with all pending details |
| USER-T-002 | Non-Admin creates invitation | 403 |
| USER-T-003 | Duplicate employee email (case-insensitive) | 409 or documented validation error |
| USER-T-004 | Duplicate active pending invitation | Rejected or explicit revoke/resend handling |
| USER-T-005 | Invalid role/team ID | Rejected; no partial data |
| USER-T-006 | Invitation token invalid/expired/revoked | Acceptance denied |
| USER-T-007 | Valid invitation accepted | User and selected memberships created; account activated |
| USER-T-008 | Password confirmation mismatch/weak password | Rejected; invitation remains unused |
| USER-T-009 | Invitation accepted twice | Second attempt rejected; no duplicates |
| USER-T-010 | Acceptance transaction fails | User, memberships and accepted state all rolled back |
| USER-T-011 | Employee list search/filter/pagination | Correct authorized records and stable paging |
| USER-T-012 | Admin edits employee details | Only allowed fields updated |
| USER-T-013 | Invalid/missing required fields | 422 with field-level validation |
| USER-T-014 | Assign a second role to one employee | Rejected; exactly one role preserved |
| USER-T-015 | Admin deactivates employee | New sign-in denied; existing sessions no longer authorize |
| USER-T-016 | Deactivated employee historical assignments displayed | Historical work remains intact |
| USER-T-017 | Non-Admin lists/manages employees | 403 |
| USER-T-018 | Admin changes role | Effective permissions use the new single role |

## 8. Team Management test cases — planned

| ID | Test | Expected result |
|---|---|---|
| TEAM-T-001 | Create team with valid name and lead | Team created |
| TEAM-T-002 | Duplicate team name (case-insensitive) | Rejected |
| TEAM-T-003 | Missing name or invalid lead | Rejected |
| TEAM-T-004 | Add active employee to team | Membership created |
| TEAM-T-005 | Add same employee twice | Duplicate active membership prevented |
| TEAM-T-006 | Add one employee to multiple teams | Allowed |
| TEAM-T-007 | Remove employee from team | Membership end timestamp recorded |
| TEAM-T-008 | Re-add previously removed employee | New active membership; old history retained |
| TEAM-T-009 | Remove/replace team lead | Apply approved lead policy; prevent invalid team state |
| TEAM-T-010 | Archive team with historical projects/memberships | History preserved; no silent cascade deletion |
| TEAM-T-011 | Non-Admin manages teams | 403 unless permission is explicitly approved |
| TEAM-T-012 | Inactive employee added to team | Rejected unless a documented rule permits it |

## 9. Project Management test cases — planned

| ID | Test | Expected result |
|---|---|---|
| PROJ-T-001 | Create valid project with unique key | Project created |
| PROJ-T-002 | Duplicate project key | Rejected |
| PROJ-T-003 | Missing name/key or invalid key format | Rejected |
| PROJ-T-004 | Start date after end date | Rejected |
| PROJ-T-005 | Assign existing manager and team | Valid relationships stored |
| PROJ-T-006 | Nonexistent/inactive manager or team | Rejected |
| PROJ-T-007 | Update project details/status | Only permitted fields changed |
| PROJ-T-008 | Archive project with tickets | Historical tickets preserved |
| PROJ-T-009 | PM accesses assigned project | Allowed |
| PROJ-T-010 | PM accesses unrelated project | 403/404 according to concealment policy |
| PROJ-T-011 | Developer/Tester access outside project membership | Denied |
| PROJ-T-012 | Paginated project list and filters | Correct records and stable paging |

## 10. Cross-cutting acceptance checks

- Backend authorization is enforced independently of frontend visibility.
- All multi-step operations use database transactions.
- Unique constraints back up application validation.
- Error responses do not expose secrets, SQL statements or stack traces.
- Deactivated users cannot use existing sessions.
- Team membership, ticket and audit history are retained.
- Pagination has validated page size limits.
- UI supports loading, empty, validation, error and success states.
- Responsive behavior is verified at desktop, tablet and mobile widths.
- No .env, tokens, passwords or production credentials are committed.

## 11. Test execution and defect reporting

For each test execution, record:
- Test ID and requirement ID.
- Build/commit SHA and environment.
- Test data identifier (never passwords/tokens).
- Actual result and expected result.
- Pass/Fail/Blocked status.
- Evidence path or automated test name.
- Defect reference and retest result.

Use conventional commit messages:
- test(auth): cover refresh token reuse
- test(users): validate invitation acceptance
- fix(users): prevent duplicate employee invitations

A test is Verified only after it has been executed successfully against the relevant integrated code.
