# Contributing to AgriBid WorkSphere

## 1. Branch strategy

| Branch | Purpose |
|---|---|
| `main` | Stable and reviewed project state |
| `develop` | Integration branch |
| `feature/*` | New feature work |
| `fix/*` | Bug fixes |
| `hotfix/*` | Urgent corrections |

Examples:

- `feature/authentication`
- `feature/project-management`
- `feature/ticket-management`
- `fix/ticket-status-validation`
- `hotfix/critical-auth-issue`

## 2. Development workflow

1. Start from the latest `develop`.
2. Create a feature or fix branch.
3. Implement a focused change.
4. Run relevant tests, lint and type checks.
5. Review the diff before committing.
6. Commit with a meaningful message.
7. Push the branch.
8. Open a pull request into `develop`.
9. Include a summary, screenshots where UI changes exist, and test results.
10. Review before merging.

Do not merge unreviewed work directly into `main`.

## 3. Commit convention

Use Conventional Commits.

Examples:

- `feat(auth): add invitation-based login`
- `feat(tickets): implement status transition service`
- `fix(tickets): reject unauthorized transitions`
- `docs(api): update ticket workflow contract`
- `test(auth): add invitation validation tests`
- `chore(git): configure root monorepo`

Use ticket IDs in branch names, commit messages and pull requests when ticket IDs are available.

## 4. Pull request expectations

Each pull request should include:

- Summary of the change.
- Related requirement or ticket IDs.
- Files/modules affected.
- Tests executed and their results.
- Screenshots for user interface changes.
- Any known limitation or follow-up item.

## 5. Quality and security

- Do not commit secrets or local `.env` files.
- Keep environment examples updated.
- Validate user input in the backend.
- Enforce authorization on the server.
- Add tests for business rules and edge cases.
- Keep dependency changes justified and documented.
- Do not implement features excluded by the approved scope.

## 6. Documentation updates

When a requirement, API contract, workflow, schema or architecture decision changes, update the corresponding Markdown documentation and RTM.
