---
name: conventional-commits
description: Use when writing a git commit message in this repository (ow-counterpick) — formats the subject/body as type(scope): summary with a body explaining why, instead of ad-hoc prose.
---

# Conventional Commits

## Overview

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
a machine- and human-readable prefix that says *what kind* of change this is,
plus a body that explains *why*.

## Format

```
<type>(<scope>): <subject>

<body — the why, not a restatement of the diff>
```

- **subject**: imperative mood, no trailing period, ideally ≤ 50 chars
- **scope**: optional, lowercase, names the affected area (`backend`, `frontend`, `docs`, `seed-data`, `skills`, …)
- **body**: optional but preferred for anything non-trivial — explain the reason for the change, not a line-by-line description of the diff (the diff already shows *what* changed)

## Types

| Type | When |
|---|---|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `docs` | Documentation only (specs, README, API 명세서 등) |
| `refactor` | Code change that isn't a fix or a feature |
| `test` | Adding or correcting tests only |
| `chore` | Tooling, config, dependency bumps, repo housekeeping |

## Quick Reference

```
docs(api): correct API spec to match implemented backend

design.md's API 명세 section described fields (tagline, enemy_team) and
a percentage formula that were never implemented. Rewrote it against the
actual models.py/scoring.py/config.py so the spec stops drifting from code.
```

```
feat(backend): add /api/meta endpoint for seed data version badge
```

```
fix(scoring): clamp percentage to 0-100 instead of allowing negative values
```

## Common Mistakes

- Vague subject ("update stuff", "fix bug") — name the actual change and area.
- Body that just re-describes the diff ("changed X to Y") instead of the reason.
- Missing type prefix — makes it hard to scan `git log --oneline` by kind of change.
- Mixing unrelated changes (e.g. a feature + a doc fix) in one commit — split them so each commit has one clear type/scope.
