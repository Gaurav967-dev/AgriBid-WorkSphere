# AgriBid WorkSphere
# Project Overview and Scope

## 1. Document Information

| Attribute | Details |
|---|---|
| Project Name | AgriBid WorkSphere |
| Project Type | Internal Project Management and Team Collaboration Platform |
| Assignment For | Gaurav |
| Document | Project Overview and Scope |
| Version | 1.0 |
| Date | 11 November 2026 |
| Status | Draft for Senior Review |
| Primary Requirement Source | AgriBid WorkSphere Complete Project Development Assignment and Technical Specification |

## 2. Project Background

AgriBid WorkSphere is an internal project management and team collaboration platform designed to manage company projects, teams, developers, testers, tasks, bugs, deadlines, files and development activities.

The platform aims to centralize the company's software development lifecycle within a single application.

Its intended functionality is comparable to project management platforms such as Jira, Linear and ClickUp.

## 3. Project Objectives

The primary objectives are:

1. Centralize project and team management.
2. Allow authorized users to create and manage projects.
3. Manage tasks, tickets, bugs and assignments.
4. Track development and testing progress.
5. Support communication through comments and mentions.
6. Manage project documents and attachments.
7. Track deadlines and notifications.
8. Monitor project and team performance.
9. Display GitHub development activities.
10. Provide role-specific dashboards and reports.
11. Maintain activity history and audit records.
12. Enforce secure authentication and authorization.

## 4. Stakeholders

| Stakeholder | Responsibility |
|---|---|
| Admin | Manage users, roles, teams, projects, settings and system activity |
| Project Manager | Manage assigned projects, tickets, assignments, deadlines and sprints |
| Developer | Work on assigned development tickets and update development progress |
| Tester / QA | Test assigned tickets, report bugs and record testing outcomes |
| Project Senior | Clarify business requirements, review implementation and approve deliverables |
| Developer | Analyze, design, implement, test and document the application |

## 5. User Roles

The application supports four primary roles.

### 5.1 Admin

Admin has system-level access.

Responsibilities:
- Create, update and deactivate employees.
- Assign exactly one role to each employee.
- Create and manage teams.
- Create and manage projects.
- Assign project managers.
- View and manage tickets.
- Manage global settings and workflows.
- View dashboards, reports and audit logs.
- Manage integration configuration.

### 5.2 Project Manager

PM manages assigned projects.

Responsibilities:
- Create projects when permitted.
- Edit assigned project information.
- Add and remove project members.
- Create and assign tickets.
- Set priorities and deadlines.
- Manage ticket statuses according to the confirmed permission rules.
- Manage sprints.
- Review development progress.
- View project reports.
- Comment and upload project files.

PM must not access unrelated projects unless explicitly granted permission.

### 5.3 Developer

Developer works on assigned development tickets.

Responsibilities:
- View assigned projects and tickets.
- View ticket requirements.
- Update permitted ticket statuses.
- Add comments and attachments.
- Update development progress.
- Link branches, commits and pull requests.
- View deadlines and notifications.

Developers cannot modify system settings, roles or unrelated project data.

### 5.4 Tester / QA

Tester manages assigned testing activities.

Responsibilities:
- View assigned testing tickets.
- Review ticket requirements.
- Add testing comments.
- Upload screenshots and bug evidence.
- Report bugs.
- Perform testing.
- Record testing outcomes.
- Return tickets for development fixes.
- View testing dashboard and notifications.

## 6. Project Scope

### 6.1 Included Scope

The complete assignment specification includes:

1. Authentication and Authorization.
2. Team Management.
3. Project Management.
4. Ticket and Task Management.
5. Comments and Collaboration.
6. File and Attachment Management.
7. Notification System.
8. Dashboards and Multiple Views.
9. Sprint and Backlog Management.
10. Search, Filters and Sorting.
11. Reports and Analytics.
12. GitHub Integration and Development Activity.
13. Audit Logs and Activity Tracking.
14. UI/UX and Design.
15. Backend API and Architecture.
16. Security and Production Readiness.
17. Performance and Optimization.
18. Testing and Quality Assurance.
19. GitHub Repository and Development Maintenance.

### 6.2 Current Assignment Boundaries

- Production hosting and deployment are excluded for now.
- Company email integration will initially use dummy test data.
- GitHub Enterprise integration will initially use dummy data.
- The assignment source code may be maintained in the developer's own GitHub repository.
- Production credentials will not be used during local development.

## 7. Technology Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Motion
- TanStack Query
- React Hook Form
- Zod
- Zustand where necessary

### Backend

- Python
- FastAPI
- Pydantic

### Database

- PostgreSQL

### Optional Infrastructure

- Redis only where caching or background processing provides a justified benefit.

No unnecessary libraries should be introduced without technical justification and approval.

## 8. Company-Confirmed Business Rules

| ID | Business Rule |
|---|---|
| BR-001 | Employee account creation must be invitation-only. |
| BR-002 | Each employee must have exactly one role. |
| BR-003 | An employee may belong to multiple teams. |
| BR-004 | Admin can change any ticket to any configured status. |
| BR-005 | PM can create, assign and move tickets to any configured status. |
| BR-006 | Developer can move tickets from TODO to IN_PROGRESS or IN_REVIEW. |
| BR-007 | Tester can move tickets from TESTING to TESTING_DONE or BUG_FIXED. |
| BR-008 | Maximum attachment count is five documents; exact count scope requires clarification. |
| BR-009 | Working interpretation: maximum 5 MB per document; confirmation of the limit's scope is pending. |
| BR-010 | Dummy company email addresses such as name@agribid.ai will be used during development. |
| BR-011 | Dummy GitHub Enterprise data will be used during development. |
| BR-012 | Developer may maintain the assignment source code in their own GitHub repository. |
| BR-013 | Hosting and production deployment are excluded from the current task. |

## 9. External Integrations

### Email

The application will eventually use the company's approved email service.

During development:
- Use dummy employee email addresses.
- Simulate invitation delivery.
- Simulate password reset delivery.
- Do not claim an actual email has been sent.

### GitHub Enterprise

The assignment requires GitHub integration.

During development:
- Use dummy repository data.
- Use dummy branches, commits and pull requests.
- Keep integration logic separate from business logic.
- Prepare the application for the company's GitHub Enterprise integration.

### Source Code Management

- Maintain the assignment in GitHub.
- Use feature, fix, develop and main branches.
- Commit completed work using meaningful messages.
- Maintain README, .gitignore, .env.example and contribution instructions.
- Follow pull request review practices.

## 10. Project Timeline

The senior has specified a three-week development plan.

| Phase | Planned Responsibility |
|---|---|
| Week 1 | Authentication and frontend UI setup |
| Week 2 | Backend API development |
| Week 3 | Frontend and backend integration |

The agreed target completion date is 27 November 2026.

The adjusted working calendar provides 14 working days from 11 November through 27 November, excluding the specified holidays.

The delivery scope and acceptance of any deferred PDF requirements must be reviewed with the senior.

## 11. Major Deliverables

### Documentation
- Project Overview.
- Software Requirements Specification.
- Functional Requirements.
- Non-functional Requirements.
- Use Case Documentation.
- Business Rules.
- Role-Permission Matrix.
- Scenario and Edge Case Catalogue.
- Validation Specification.
- System Architecture.
- Database Design and ERD.
- API Specification.
- Testing Plan and Report.
- GitHub Workflow Documentation.
- Environment Setup Instructions.

### Application
- Working frontend.
- Working backend.
- PostgreSQL database.
- Authentication and authorization.
- Project and team management.
- Ticket management.
- Other modules specified in the assignment.
- Automated and integration tests.

## 12. Project Success Criteria

The project will be evaluated against the following:

1. Requirements are documented and reviewed.
2. The frontend follows the supplied UI references.
3. The backend implements the approved business rules.
4. Database relationships and constraints are correct.
5. Each user can perform only authorized actions.
6. Ticket workflows respect role permissions.
7. Data is validated by the backend.
8. Critical user workflows function end to end.
9. Test results and known limitations are documented.
10. Source code follows the company's expected conventions.

## 13. Assumptions and Open Decisions

The following require further clarification:

- Exact ticket transition rules for all statuses.
- Whether TESTING_DONE is separate from COMPLETED.
- The allowed transition following BUG_FIXED.
- Whether five attachments is a limit per ticket, project or upload operation.
- Final approved file-size interpretation.
- Company email provider configuration.
- GitHub Enterprise API and webhook configuration.
- Final review and acceptance criteria.

All decisions must be recorded before the affected implementation is finalized.

---
End of Document

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


## Current implementation decisions - 12 November 2026

Use `../workflows/ticket-workflow.md` for the authoritative status catalogue and transition rules.

Use `../architecture/technology-decisions.md` for selected implementation tools and `../project-plan/development-plan-to-27-nov-2026.md` for the delivery milestones leading to 27 November 2026.


## Authoritative workflow update — 12 November 2026

The latest workflow is defined in `../workflows/ticket-workflow.md`.

Follow the original PDF's default path:

`BACKLOG` → `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `TESTING` → `COMPLETED`.

Developer moves `TODO` to `IN_PROGRESS`, then `IN_PROGRESS` to `IN_REVIEW`. Do not use the earlier draft's direct `TODO` to `IN_REVIEW` permission.

Tester may return failed testing to `IN_PROGRESS` or `REOPENED` with a comment. Tester can mark `REOPENED`; the ticket can return to Developer work in `IN_PROGRESS`.

Admin and PM can manage `BLOCKED`, `REOPENED` and `CANCELLED` and retain their any-status authority.

`BUG_FIXED` proceeds to `COMPLETED`. `TESTING_DONE` remains distinct from `COMPLETED`.
