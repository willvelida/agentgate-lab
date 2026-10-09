---
title: Decisions
description: Log of harness and repository decisions for AgentGate Lab, with the reasons behind them.
ms.date: 2026-10-09
---

## Purpose

This file records why the repository works the way it does. Chat history and
context compaction keep what changed but lose why. Read this file at the start
of a session so you do not undo a deliberate choice.

Add a new entry when you make a decision that a future session could reverse by
accident. Do not edit old entries. If a decision changes, add a new entry that
replaces it and say which entry it replaces.

Each entry records:

* Decision: what was chosen.
* Why: the reason for the choice.
* Alternatives rejected: other options and why they lost.
* Constraints: limits a future change must respect.

## D001: AGENTS.md is a router, and details live in docs

* Date: 2026-10-09
* Decision: keep [AGENTS.md](../AGENTS.md) short. It holds hard rules, session
  routines, and "Read when" links. Detailed guidance lives in `docs/`.
* Why: one large instruction file wastes context and buries the important
  rules. Small, linked files let an agent read only what a task needs.
* Alternatives rejected: a single long `AGENTS.md`, because it grows stale and
  is hard to scan.
* Constraints: add new guidance as a linked doc, not as a long section in
  `AGENTS.md`.

## D002: Feature lists and progress logs live in per-issue folders

* Date: 2026-10-09
* Decision: the `github-issue-to-features-list` skill writes
  `features_list.json` and `agent-progress.md` to
  `docs/features/<slug>/`. `features_list.json` is gitignored, and each
  slug's `agent-progress.md` is committed as the evidence log.
* Why: keeping each issue's checklist and evidence together makes them easy to
  find. Working state stays local, while the evidence is shared.
* Alternatives rejected: a single committed `docs/agent-progress.md` for all
  issues. It was the first plan but mixed unrelated issues in one file.
* Constraints: summarize feature progress in
  [progress.md](./progress.md). Commit only `agent-progress.md` from feature
  folders.

## D003: init.sh mirrors the CI sequence

* Date: 2026-10-09
* Decision: [init.sh](../init.sh) runs the same locked restore, typecheck,
  test, build, and publish steps as `.github/workflows/build.yml`.
* Why: one local command gives the same answer as CI, so an agent can confirm
  the repository is healthy before and after a change.
* Alternatives rejected: a lighter script that skipped steps, because it could
  pass locally and fail in CI.
* Constraints: when CI steps change, update `init.sh` in the same pull request.

## D004: Docs check runs in CI

* Date: 2026-10-09
* Decision: `.github/workflows/docs-check.yml` fails on broken relative
  Markdown links (lychee, offline) and warns when `src/` or `tests/` change
  without a `docs/progress.md` update.
* Why: the harness depends on docs that are accurate and linked. A machine
  check catches drift that people miss.
* Alternatives rejected: a hard failure for missing progress updates, because
  some code changes do not affect milestone progress.
* Constraints: keep doc links relative so the offline check can verify them.

## D005: Commits require a DCO sign-off

* Date: 2026-10-09
* Decision: every commit uses `git commit -s` to add a `Signed-off-by` line.
* Why: the repository's DCO check blocks pull requests with unsigned commits.
* Alternatives rejected: none; the check is required.
* Constraints: if a commit lacks a sign-off, amend or rebase it with `-s`
  before pushing.

## D006: Product doc and "Last session" handoff

* Date: 2026-10-09
* Decision: [product.md](./product.md) states what is being built, and
  [progress.md](./progress.md) has a "Last session" section that every session
  replaces before it ends.
* Why: a new session needs both the goal and the most recent state to resume
  quickly without rereading the whole history.
* Alternatives rejected: relying on pull request descriptions, because they are
  not in the repository and are easy to miss.
* Constraints: keep "Last session" short and current; remove stale content.

## D007: Session continuity routines and one feature at a time

* Date: 2026-10-09
* Decision: add clock-in and clock-out routines, a 60% context handoff rule,
  a one-feature-at-a-time hard rule, a
  [clean-state checklist](./clean-state-checklist.md), Current State and Known
  Issues sections in [progress.md](./progress.md), and an optional `dependsOn`
  field in feature lists.
* Why: long tasks lose continuity across sessions. Working on one verified
  feature at a time and leaving a clean, recorded state makes restarts cheap.
* Alternatives rejected: putting the clean-state checklist inside `AGENTS.md`,
  because it would make the router long.
* Constraints: mark a feature `pass` only with recorded evidence, and do not
  start a feature until its dependencies pass.

## D008: Feature states, verification, and sizing

* Date: 2026-10-09
* Decision: features use four states (`not-started`, `active`, `blocked`,
  `pass`) and a `verification` field that names the command or check proving
  the feature works. Each feature must fit in one session. This replaces the
  `in-progress` state from D007.
* Why: a named verification step and a `blocked` state stop an agent from
  declaring success early or quietly giving up. Small features finish cleanly.
* Alternatives rejected: a free-text status, because agents drift from it;
  a richer workflow with more states, because it adds bookkeeping without
  benefit at this size.
* Constraints: only one feature may be `active`. A feature with an unknown
  verification stays `not-started` until the user supplies one.

## D009: Task-boundary hard rules 11 to 13

* Date: 2026-10-09
* Decision: `AGENTS.md` adds three rules. Mark `pass` only after verification
  succeeds and evidence is recorded. Stay in scope, except for small, logged
  fixes needed to get past a blocker. Never weaken a test; mark the feature
  `blocked` and ask the user instead.
* Why: agents overreach by doing unrequested work and under-finish by
  declaring success without proof or by editing tests to pass.
* Alternatives rejected: leaving these as guidance only, because guidance is
  easier to skip than a numbered hard rule.
* Constraints: any out-of-scope fix must be recorded in the feature's
  `agent-progress.md`.

## D010: Architecture check and runtime evidence

* Date: 2026-10-09
* Decision: `scripts/check-architecture.sh` fails when a project under `src/`
  references another service project, or when Client code imports outside
  `src/Client`. It runs first in `init.sh` and in CI. Runtime evidence comes
  from each service's `/health` endpoint, or from logs for AgentWorker.
  `.gitattributes` forces LF line endings for `*.sh` files.
* Why: a script gives fast, mechanical feedback that agents cannot argue with,
  and runtime evidence proves the app runs, not only that it builds. Windows
  CRLF line endings break bash on Linux CI.
* Alternatives rejected: an analyzer package or architecture test library,
  because a short shell script covers today's two rules with no new
  dependency.
* Constraints: the script scans only `src/`, so tests may reference services.
  Extend the script when [architecture.md](./architecture.md) adds a boundary.
