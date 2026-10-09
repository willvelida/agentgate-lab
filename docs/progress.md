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

## Current State

Update this section at clock-out so the next session knows the repository's
health before it changes anything.

* Branch: `feat/agent-init` (PR #28 open).
* Latest commit: see `git log -1`; the last verified head was `dcc7bd2`.
* `init.sh`: passing at the last verified head.
* CI: build, docs-check, and DCO checks green on PR #28.

## Known Issues

* No gateway security, identity, storage, or agent logic exists yet. Do not
  treat any endpoint as protected.
* `docs-check.yml` only warns, and does not fail, when code changes without a
  `docs/progress.md` update.

## Last session

Replace this section at the end of every session so the next one can pick up
where you left off.

* Date: 2026-10-09
* Accomplished: added `docs/decisions.md`, `docs/clean-state-checklist.md`,
  Current State and Known Issues in this file, clock-in and clock-out routines
  and a one-feature-at-a-time rule in `AGENTS.md`, and an optional `dependsOn`
  field in the `github-issue-to-features-list` skill.
* Remains: merge PR #28.
* Decisions: see D007 in [decisions.md](./decisions.md).
* Files modified: `AGENTS.md`, `docs/progress.md`, `docs/decisions.md`,
  `docs/clean-state-checklist.md`,
  `.github/skills/github-issue-to-features-list/SKILL.md`.
* Blockers: none.
* Next steps: start milestone M0 from a GitHub issue using the
  `github-issue-to-features-list` skill.

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
* PR template and hard rule 8: PRs that change behavior update this file.
* `.github/workflows/docs-check.yml`: fails on broken relative Markdown links
  and warns when code changes without a `docs/progress.md` update.
* `docs/product.md`: what the product is, its planned features, and its
  constraints.
* "Last session" handoff in this file, plus a session startup checklist and
  Definition of Done in `AGENTS.md`.
* `docs/decisions.md`: why the harness is shaped the way it is.
* `docs/clean-state-checklist.md`: checks to run before ending a session.
* Clock-in and clock-out routines, the 60% context handoff rule, and a
  one-feature-at-a-time rule in `AGENTS.md`.
* Optional `dependsOn` field in the skill's `features_list.json`.

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
4. At clock-out, update "Current State" and "Known Issues", then replace the
   "Last session" section.
5. Record any new design decision in [decisions.md](./decisions.md) and link
   it from "Last session".
6. Update `ms.date` in the frontmatter.
