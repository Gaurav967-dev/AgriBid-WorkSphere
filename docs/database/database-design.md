# AgriBid WorkSphere
# Database Design Document

| Attribute | Details |
|---|---|
| Version | 1.0 |
| Date | 12 November 2026 |
| Database | PostgreSQL 18 |
| Status | Draft for Senior Review |
| Database Type | Relational Database |

## 1. Purpose

This document defines the proposed logical and physical database
design for AgriBid WorkSphere.

The design follows the database requirements in Module 15
of the original assignment and the senior-approved business rules.

The schema must be reviewed before database migrations are finalized.

## 2. Database Design Principles

1. Use normalized relational tables.
2. Use primary and foreign keys.
3. Enforce uniqueness where required.
4. Use database constraints.
5. Use indexes for frequently queried fields.
6. Use transactions for multi-step operations.
7. Store timestamps in UTC.
8. Define deletion and retention policies.
9. Prevent orphan records.
10. Avoid N+1 queries.
11. Use migrations for schema changes.
12. Store file binaries outside PostgreSQL.

## 3. Naming Conventions

- Table names: lowercase snake_case.
- Column names: lowercase snake_case.
- Primary keys: id.
- Foreign keys: referenced_entity_id.
- Timestamps: created_at, updated_at.
- Boolean fields: is_active, is_deleted where appropriate.
- Database identifiers: UUID is proposed for primary keys.

UUID is a technical proposal, not an explicit PDF requirement.

## 4. Identity and Access Management

### 4.1 users

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| role_id | UUID | FK, NOT NULL |
| full_name | VARCHAR(150) | NOT NULL |
| username | — | Not present in current SQLAlchemy User model |
| email | VARCHAR(320) | NOT NULL; unique case-insensitively via lower(email) index |
| password_hash | VARCHAR(255) | NOT NULL |
| employee_id | VARCHAR(50) | Nullable; current migration does not enforce uniqueness |
| profile_image_key | VARCHAR(500) | Nullable |
| is_active | BOOLEAN | NOT NULL |
| last_login_at | TIMESTAMPTZ | Nullable |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| deactivated_at | TIMESTAMPTZ | Nullable |

Business rule:
Every employee has exactly one role.

### 4.2 roles

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| code | VARCHAR(30) | UNIQUE, NOT NULL |
| name | VARCHAR(60) | NOT NULL |
| description | TEXT | Nullable |
| created_at | TIMESTAMPTZ | NOT NULL |

Seed roles:
- ADMIN
- PM
- DEVELOPER
- TESTER

### 4.3 permissions

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| code | VARCHAR(100) | UNIQUE, NOT NULL |
| resource | VARCHAR(60) | NOT NULL |
| action | VARCHAR(60) | NOT NULL |
| description | TEXT | Nullable |

### 4.4 role_permissions

| Column | Proposed Type | Constraint |
|---|---|---|
| role_id | UUID | PK, FK |
| permission_id | UUID | PK, FK |

A role can have multiple permissions.

A permission can be associated with multiple roles.

There is deliberately no user_roles table.

### 4.5 user_invitations

The currently implemented table is named user_invitations. Its current columns are:

| Column | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| email | VARCHAR(320) | NOT NULL; indexed |
| role_id | UUID | FK roles, NOT NULL |
| invited_by_user_id | UUID | FK users, NOT NULL |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL |
| expires_at | TIMESTAMPTZ | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| accepted_at | TIMESTAMPTZ | Nullable |
| revoked_at | TIMESTAMPTZ | Nullable |

Required User Management extension before invitation APIs:

| Column / relation | Proposed type | Constraint |
|---|---|---|
| full_name | VARCHAR(150) | NOT NULL |
| employee_id | VARCHAR(50) | Nullable; uniqueness subject to company policy |
| profile_image_key | VARCHAR(500) | Nullable |
| accepted_user_id | UUID | FK users, nullable; populated after successful acceptance |
| user_invitation_teams | Join table | invitation_id + team_id composite PK/FK |

Add a partial unique index on normalized email for invitations where accepted_at IS NULL and revoked_at IS NULL. Revoke an expired pending invitation before creating a replacement.

On acceptance, one transaction must validate invitation and selected teams, create the user with the submitted password hash, create selected team_members rows, set accepted_at and accepted_user_id, and commit. Any failure must roll back all of these changes. Invitation secrets are single-use and only their hashes are stored.

### 4.6 password_reset_tokens

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK, NOT NULL |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL |
| expires_at | TIMESTAMPTZ | NOT NULL |
| used_at | TIMESTAMPTZ | Nullable |
| created_at | TIMESTAMPTZ | NOT NULL |

### 4.7 auth_sessions

Proposed persistent session storage.

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK, NOT NULL |
| session_token_hash | VARCHAR(255) | UNIQUE |
| expires_at | TIMESTAMPTZ | NOT NULL |
| revoked_at | TIMESTAMPTZ | Nullable |
| created_at | TIMESTAMPTZ | NOT NULL |
| last_used_at | TIMESTAMPTZ | Nullable |

Final session implementation depends on the approved authentication design.

## 5. Team Management

### 5.1 teams

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(150) | NOT NULL |
| description | TEXT | Nullable |
| lead_user_id | UUID | FK users |
| status | VARCHAR(30) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| archived_at | TIMESTAMPTZ | Nullable |

### 5.2 team_members

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| team_id | UUID | FK teams |
| user_id | UUID | FK users |
| designation | VARCHAR(100) | Nullable |
| joined_at | TIMESTAMPTZ | NOT NULL |
| removed_at | TIMESTAMPTZ | Nullable |

Constraints:
- One employee may belong to multiple teams.
- A team may contain multiple employees.
- Prevent duplicate active memberships.
- Preserve historical membership information.

## 6. Project Management

### 6.1 projects

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(200) | NOT NULL |
| project_key | VARCHAR(20) | UNIQUE, NOT NULL |
| description | TEXT | Nullable |
| icon_key | VARCHAR(500) | Nullable |
| manager_id | UUID | FK users |
| assigned_team_id | UUID | FK teams |
| start_date | DATE | Nullable |
| end_date | DATE | Nullable |
| status | VARCHAR(30) | NOT NULL |
| visibility | VARCHAR(30) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| archived_at | TIMESTAMPTZ | Nullable |
| deleted_at | TIMESTAMPTZ | Nullable |

Project statuses:
- PLANNING
- ACTIVE
- ON_HOLD
- COMPLETED
- ARCHIVED

### 6.2 project_members

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK projects |
| user_id | UUID | FK users |
| joined_at | TIMESTAMPTZ | NOT NULL |
| removed_at | TIMESTAMPTZ | Nullable |

Prevent duplicate active project membership.

## 7. Ticket Management

### 7.1 ticket_statuses

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| status_key | VARCHAR(50) | UNIQUE, NOT NULL |
| display_name | VARCHAR(100) | NOT NULL |
| description | TEXT | Nullable |
| is_active | BOOLEAN | NOT NULL |
| sort_order | INTEGER | NOT NULL |

Initial status keys:
- BACKLOG
- TODO
- IN_PROGRESS
- IN_REVIEW
- TESTING
- TESTING_DONE
- BUG_FIXED
- COMPLETED
- BLOCKED
- REOPENED
- CANCELLED

TESTING_DONE and COMPLETED must remain separate statuses.

BUG_FIXED must lead to COMPLETED according to the approved workflow.

### 7.2 tickets

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK projects, NOT NULL |
| sequence_number | BIGINT | NOT NULL |
| ticket_key | VARCHAR(50) | UNIQUE, NOT NULL |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | Nullable |
| ticket_type | VARCHAR(40) | NOT NULL |
| priority | VARCHAR(30) | NOT NULL |
| status_id | UUID | FK ticket_statuses |
| reporter_id | UUID | FK users |
| assignee_id | UUID | FK users, nullable |
| reviewer_id | UUID | FK users, nullable |
| tester_id | UUID | FK users, nullable |
| parent_ticket_id | UUID | Self-referencing FK |
| start_date | DATE | Nullable |
| due_date | DATE | Nullable |
| estimated_effort | NUMERIC(8,2) | Nullable |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| completed_at | TIMESTAMPTZ | Nullable |
| deleted_at | TIMESTAMPTZ | Nullable |

Ticket types:
- EPIC
- STORY
- TASK
- SUBTASK
- BUG
- IMPROVEMENT
- TECHNICAL_DEBT

Priorities:
- LOW
- MEDIUM
- HIGH
- CRITICAL

Design note:
A single primary assignee is proposed, with separate optional
reviewer and tester references. Multiple-assignee support
requires confirmation before finalizing this design.

### 7.3 workflow_transitions

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| from_status_id | UUID | FK ticket_statuses |
| to_status_id | UUID | FK ticket_statuses |
| role_id | UUID | FK roles |
| is_active | BOOLEAN | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

This table represents configurable workflow permissions.

The BUG_FIXED-to-COMPLETED transition actor remains subject to senior confirmation.

### 7.4 ticket_assignments

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| ticket_id | UUID | FK tickets |
| previous_user_id | UUID | FK users, nullable |
| new_user_id | UUID | FK users |
| assignment_type | VARCHAR(30) | NOT NULL |
| assigned_by | UUID | FK users |
| assigned_at | TIMESTAMPTZ | NOT NULL |

Records assignment history.

### 7.5 labels

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK projects |
| name | VARCHAR(100) | NOT NULL |
| color | VARCHAR(20) | Nullable |
| created_at | TIMESTAMPTZ | NOT NULL |

### 7.6 ticket_labels

| Column | Proposed Type | Constraint |
|---|---|---|
| ticket_id | UUID | PK, FK tickets |
| label_id | UUID | PK, FK labels |

### 7.7 ticket_relationships

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| source_ticket_id | UUID | FK tickets |
| target_ticket_id | UUID | FK tickets |
| relationship_type | VARCHAR(40) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

Prevent self-referencing and invalid circular relationships
where the relationship type prohibits cycles.

## 8. Comments and Collaboration

### 8.1 ticket_comments

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| ticket_id | UUID | FK tickets |
| author_id | UUID | FK users |
| parent_comment_id | UUID | Self-referencing FK, nullable |
| body | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| deleted_at | TIMESTAMPTZ | Nullable |

### 8.2 comment_mentions

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| comment_id | UUID | FK ticket_comments |
| mentioned_user_id | UUID | FK users |
| created_at | TIMESTAMPTZ | NOT NULL |

Mentions remain supported.

Notification delivery is excluded.

## 9. Attachment Management

### 9.1 attachments

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK projects, nullable |
| ticket_id | UUID | FK tickets, nullable |
| uploaded_by | UUID | FK users |
| original_filename | VARCHAR(255) | NOT NULL |
| storage_key | VARCHAR(500) | UNIQUE, NOT NULL |
| size_bytes | BIGINT | NOT NULL |
| mime_type | VARCHAR(150) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| deleted_at | TIMESTAMPTZ | Nullable |

Business constraints:
- Maximum 5 MB per individual file.
- Maximum 5 documents.
- Supported formats follow the assignment.
- File binaries are stored outside PostgreSQL.
- Exactly one parent resource (project or ticket) must be linked.

The scope of the five-document count requires confirmation.

## 10. Sprint Management

### 10.1 sprints

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK projects |
| name | VARCHAR(150) | NOT NULL |
| goal | TEXT | Nullable |
| start_date | DATE | NOT NULL |
| end_date | DATE | NOT NULL |
| status | VARCHAR(30) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

### 10.2 sprint_tickets

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| sprint_id | UUID | FK sprints |
| ticket_id | UUID | FK tickets |
| added_at | TIMESTAMPTZ | NOT NULL |
| removed_at | TIMESTAMPTZ | Nullable |

Sprint membership history should be preserved.

## 11. Ticket Activity

### 11.1 ticket_activities

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| ticket_id | UUID | FK tickets |
| actor_id | UUID | FK users, nullable for system |
| action | VARCHAR(100) | NOT NULL |
| old_value | JSONB | Nullable |
| new_value | JSONB | Nullable |
| metadata | JSONB | Nullable |
| created_at | TIMESTAMPTZ | NOT NULL |

This records ticket-level activity.

## 12. GitHub Mock Integration

### 12.1 github_repositories

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK projects |
| repository_name | VARCHAR(200) | NOT NULL |
| repository_url | VARCHAR(500) | NOT NULL |
| owner | VARCHAR(150) | NOT NULL |
| is_active | BOOLEAN | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

### 12.2 github_branches

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| repository_id | UUID | FK github_repositories |
| branch_name | VARCHAR(255) | NOT NULL |
| last_seen_at | TIMESTAMPTZ | Nullable |

### 12.3 github_commits

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| repository_id | UUID | FK github_repositories |
| ticket_id | UUID | FK tickets, nullable |
| commit_sha | VARCHAR(100) | NOT NULL |
| author_name | VARCHAR(150) | Nullable |
| message | TEXT | Nullable |
| committed_at | TIMESTAMPTZ | Nullable |

### 12.4 github_pull_requests

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| repository_id | UUID | FK github_repositories |
| ticket_id | UUID | FK tickets, nullable |
| pr_number | INTEGER | NOT NULL |
| title | VARCHAR(255) | NOT NULL |
| url | VARCHAR(500) | NOT NULL |
| state | VARCHAR(30) | NOT NULL |
| author_name | VARCHAR(150) | Nullable |
| created_at | TIMESTAMPTZ | Nullable |
| merged_at | TIMESTAMPTZ | Nullable |
| review_status | VARCHAR(50) | Nullable |

Initial records are mock data.

Real GitHub webhook event storage is not required for the current mock integration scope.

## 13. System Audit Logs

### 13.1 audit_logs

| Column | Proposed Type | Constraint |
|---|---|---|
| id | UUID | PK |
| actor_id | UUID | FK users, nullable |
| action | VARCHAR(100) | NOT NULL |
| resource_type | VARCHAR(100) | NOT NULL |
| resource_id | UUID | Nullable |
| metadata | JSONB | Nullable |
| request_id | VARCHAR(100) | Nullable |
| created_at | TIMESTAMPTZ | NOT NULL |

Audit logs must not be editable by normal application users.

Do not store passwords, tokens or secrets in metadata.

## 14. Explicitly Excluded Database Entities

Do not create the following for the current assignment:
- notifications
- notification_preferences
- notification_delivery_jobs
- github_webhook_events for the mock-only integration

Notifications and Automate Pro are excluded.

## 15. Important Database Constraints

### Uniqueness
- users.email
- users.username when applicable
- roles.role_key
- permissions.permission_key
- projects.project_key
- tickets.ticket_key
- (tickets.project_id, tickets.sequence_number)
- (team_members.team_id, team_members.user_id) for active memberships
- (project_members.project_id, project_members.user_id) for active memberships
- (sprint_tickets.sprint_id, sprint_tickets.ticket_id) where applicable
- (github_commits.repository_id, github_commits.commit_sha)
- (github_pull_requests.repository_id, github_pull_requests.pr_number)

### Referential integrity
Every foreign key must reference an existing record.

### Date validation
- Project start date must not exceed end date.
- Sprint start date must not exceed end date.
- Ticket start date must not exceed due date.

### Ticket integrity
- A ticket cannot be its own parent.
- Parent and child relationships must follow project rules.
- Ticket sequence numbers must be unique within a project.

### Attachment integrity
- size_bytes must be positive.
- File size must not exceed the approved limit.
- Exactly one parent resource must be specified.

## 16. Index Strategy

Proposed indexes:

- users(email)
- users(role_id, is_active)
- team_members(team_id, user_id)
- team_members(user_id, team_id)
- project_members(project_id, user_id)
- project_members(user_id, project_id)
- tickets(project_id, status_id)
- tickets(project_id, assignee_id)
- tickets(project_id, priority)
- tickets(project_id, due_date)
- tickets(reporter_id)
- tickets(updated_at)
- ticket_comments(ticket_id, created_at)
- ticket_activities(ticket_id, created_at)
- attachments(ticket_id)
- attachments(project_id)
- sprints(project_id, status)
- audit_logs(created_at)
- github_commits(repository_id, committed_at)

Final indexes must be reviewed against actual query patterns.

## 17. Deletion and Retention Strategy

- Users: deactivate rather than immediately delete.
- Teams: archive when historical relationships exist.
- Projects: archive or soft-delete according to retention policy.
- Tickets: soft-delete by default.
- Comments: preserve required activity history.
- Attachments: use controlled deletion and storage cleanup.
- Audit logs: append-only for normal users.

Retention duration and permanent deletion rules require approval.

## 18. Database Migration Strategy

Use a migration tool such as Alembic if approved.

Migration workflow:
1. Update SQLAlchemy models.
2. Generate migration.
3. Review generated SQL.
4. Test migration on development database.
5. Verify constraints and indexes.
6. Apply migration.
7. Test rollback strategy.
8. Document the migration.

Never modify the schema manually without a corresponding migration.

## 19. Pending Database Decisions

1. Multiple ticket assignees or one primary assignee?
2. Exact five-document count scope?
3. Final storage provider?
4. Permanent deletion and retention periods?
5. Team lead reassignment policy?
6. Sprint membership history policy?
7. Final BUG_FIXED-to-COMPLETED transition actor?
8. Whether workflow statuses can be configured by Admin at runtime?

These must be reviewed before final migrations.

## 20. Approval

This is the proposed database design baseline.

The final physical schema must be reviewed against the original assignment,
approved business rules, architecture and senior clarifications.

---
End of Document


## Schema clarification - 12 November 2026

The ticket status catalogue must use `COMPLETED` instead of the former `DONE` key. `TESTING_DONE` remains distinct.

The `ticket_statuses` and `workflow_transitions` structures must represent the canonical rules in `../workflows/ticket-workflow.md`.

Add or confirm:
- `auth_sessions` for hashed refresh-token/session lifecycle, expiry and revocation.
- `user_invitations` for invitation-only employee onboarding.

Do not create notification tables because that module is excluded by senior clarification. Use Alembic migrations to apply schema changes.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.

## 21. Implemented identity schema and invitation extension — 17 November 2026

The current SQLAlchemy models and applied Alembic migrations use these implemented table/column names:

| Entity | Implemented table | Important implementation names |
|---|---|---|
| Role | `roles` | `code`, `name` |
| Permission | `permissions` | `code`, `resource`, `action` |
| User | `users` | `role_id`, `full_name`, `email`, `password_hash`, `is_active` |
| Role permissions | `role_permissions` | `role_id`, `permission_id` |
| Team | `teams` | `name`, `lead_user_id`, `status` |
| Team membership | `team_members` | `team_id`, `user_id`, `joined_at`, `removed_at` |
| Refresh session | `auth_sessions` | `token_hash`, `expires_at`, `revoked_at`, `replaced_by_session_id` |
| Invitation | `user_invitations` | `email`, `role_id`, `invited_by_user_id`, `token_hash`, `expires_at`, `accepted_at`, `revoked_at` |
| Password reset | `password_reset_tokens` | `user_id`, `token_hash`, `expires_at`, `used_at` |

This table records implemented names and supersedes the earlier illustrative names `role_key`, `permission_key`, `session_token_hash` and `invitations` where they differ. The existing implementation has a one-role-per-user foreign key and a partial unique index preventing duplicate active team memberships.

### Required pending invitation schema enhancement

Before implementing User Management invitation APIs, extend `user_invitations` to preserve pending employee data:

- `full_name` — required, trimmed.
- `employee_id` — optional; uniqueness must follow the agreed company employee-ID policy.
- `profile_image_key` — optional storage reference when an image is supplied.

Create a partial unique index on normalized invitation email for non-accepted, non-revoked invitations. Expired invitations should be explicitly revoked before a replacement is created; this avoids ambiguous simultaneous pending invitations. Keep the user email unique case-insensitively.
- Existing normalized `email`, `role_id`, inviter, token hash, expiry and lifecycle timestamps.
- Add `user_invitation_teams` with invitation ID and team ID, using a composite unique key and foreign keys.

Do not create a placeholder user or store a placeholder password at invitation creation. On acceptance, use one transaction to validate invitation and teams, create the user with the submitted Argon2 password hash, create the selected `team_members` rows, and mark the invitation accepted. Roll back the whole operation on failure. Revoke/expire invitations without deleting audit-relevant history.

The current SQLAlchemy model and database migration do not yet include these pending profile/team fields. This is planned work, not implemented functionality.

### Clarified invitation lifecycle

1. Admin submits name, company-style email, one role, optional employee ID and zero or more team IDs.
2. Backend validates Admin permission, email uniqueness against users and pending invitations, role existence, active team IDs and duplicate invitation rules.
3. Generate a cryptographically random invitation secret; persist only its hash and expiry.
4. Simulate email delivery using development data. Do not claim a real email was sent.
5. Invited employee validates the token and sets/confirms a password.
6. In one transaction create the user, team memberships and accepted invitation state.
7. The token cannot be reused after acceptance, revocation or expiry.
