---
title: Progress
description: Repository-level snapshot of what is built, what is in progress, and what is planned for AgentGate Lab.
ms.date: 2026-10-09
---

## Purpose

This file answers "where are we now?" for a new session. Read it after
[AGENTS.md](../AGENTS.md) and [architecture.md](./architecture.md).

Update this file when a milestone, issue, or harness change lands. A stale
progress file is worse than none, so remove entries that are no longer true.

Feature-level evidence lives in `docs/features/<slug>/agent-progress.md`. The
`github-issue-to-features-list` skill creates those folders from GitHub issues.
This file only summarizes them.

## Built

### Foundation (Issue #1, merged in PR #27)

* .NET 10 solution `AgentGateLab.sln` with three projects:
  * Portal: ASP.NET Core host with `/health` and an SPA fallback.
  * Gateway: ASP.NET Core host with `/health` and a foundation-only root
    endpoint.
  * AgentWorker: a worker that logs a message and waits.
* React client in `src/Client`, built with Vite into `src/Portal/wwwroot`.
* Tests: `tests/Portal.Tests` (.NET) and Vitest tests in `src/Client`.

No gateway security, identity, storage, or agent logic exists yet. The code is
before milestone M0.

### Harness basics (committed on `feat/agent-init`, not yet merged)

* `AGENTS.md`: entry point for agents, with hard rules and links to docs.
* `init.sh`: one command to restore, build, and test the repository.

## In progress

### Harness expansion (branch `feat/agent-init`, PR #28)

* `AGENTS.md` rewritten as a short router with a "Hard rules" list.
* `docs/architecture.md`: implemented components versus the planned target.
* `docs/progress.md`: this file.
* `github-issue-to-features-list` skill: turns a GitHub issue's acceptance
  criteria into `docs/features/<slug>/features_list.json` (gitignored) and
  `docs/features/<slug>/agent-progress.md` (committed).

## Planned

The milestones below come from
[research-and-build-plan.md](./research-and-build-plan.md). Read that file for
the full scope and exit criteria of each one.

| Milestone | Focus                        | Status      |
|-----------|------------------------------|-------------|
| M0        | Identity path                | Not started |
| M1        | Deterministic security core  | Not started |
| M2        | Storage and private ingress  | Not started |
| M3        | Lifecycle and the real agent | Not started |
| M4        | Ticket UI and approval       | Not started |
| M5        | Public release               | Not started |

## How to update this file

1. Move an item from "In progress" to "Built" when its PR merges.
2. Change a milestone status to "In progress" when work on it starts, and to
   "Done" when its exit criteria are met.
3. Link the matching `docs/features/<slug>/agent-progress.md` for detailed
   evidence instead of copying it here.
4. Update `ms.date` in the frontmatter.
