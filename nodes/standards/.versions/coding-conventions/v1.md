---
title: Coding Conventions
type: context
tags:
  - '#standards'
  - '#conventions'
  - '#code-quality'
priority: high
status: published
version: 1
updated_at: '2026-06-11T02:47:06.684Z'
checksum: 'sha256:6688b85c3b5ff0e1613e8b8c793a65cada17bd71b3461d77d1b610d4ed676810'
---

# Coding Conventions

## General Principles

- **Clarity over cleverness** — Write code that the next developer can understand without asking you
- **Consistency over preference** — Follow the existing patterns in the codebase
- **Small, focused changes** — PRs should do one thing well

## Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Variables | _camelCase / snake_case_ | |
| Functions | _camelCase / snake_case_ | |
| Classes | _PascalCase_ | |
| Constants | _UPPER_SNAKE_CASE_ | |
| Files | _kebab-case / snake_case_ | |

## Code Review Standards

### Every PR should:
- [ ] Have a clear description of what and why
- [ ] Include tests for new functionality
- [ ] Pass CI checks
- [ ] Be reviewed by at least one team member

### Reviewers should check:
- Does it do what the description says?
- Are there edge cases not handled?
- Is there unnecessary complexity?
- Are names clear and descriptive?

## Error Handling

_Document your team's error handling patterns here._

## Testing

| Type | When | Coverage Target |
|------|------|----------------|
| Unit | Every PR | _X%_ |
| Integration | Every PR | Key paths |
| E2E | Before release | Critical flows |

## Git Workflow

- Branch naming: `feature/`, `fix/`, `chore/`
- Commit messages: _Conventional commits / free-form / etc._
- Merge strategy: _Squash / rebase / merge commits_
