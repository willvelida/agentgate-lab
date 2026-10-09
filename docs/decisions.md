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

## D011: Independent evaluation gates feature completion

* Date: 2026-10-09
* Decision: the [feature-evaluator skill](../.github/skills/feature-evaluator/SKILL.md)
  evaluates one feature in a fresh session after its verification succeeds.
  It scores acceptance criteria, verification evidence, scope discipline,
  architecture and code quality, and tests not weakened from 1 to 5.
  PASS requires every score to be at least 3 and the average to be at least 4.
  This adds an evaluator gate to the completion rules in D007 to D009.
* Why: independent review checks the implementer's claims against the
  repository and rerun checks before the feature is declared complete.
* Alternatives rejected: self-review in the implementation session, because
  it reuses the builder's assumptions; a checklist without scores, because
  it does not expose gaps across the five dimensions.
* Constraints: the evaluator reads only the repository, slug files, and diff.
  It writes only the gitignored `docs/features/<slug>/evaluator-rubric.md`
  and one verdict line in the committed `agent-progress.md`. It does not
  change source, tests, feature status, or commit. The implementer may mark
  `pass` only after a recorded evaluator PASS for the reviewed changes.
  Modified changes need a new evaluation; a FAIL never lowers the threshold.

## D012: Capture verification runs and require an evidenced handoff

* Date: 2026-10-09
* Decision: a shared Node.js runner with Bash and PowerShell wrappers records
  finite verification commands under ignored `.local/verification/<run-id>/`.
  Reports include command arguments, times, duration, exit status, output
  locations, and repository state before and after the command. `init.sh`
  captures each step; focused checks use the same wrappers.
* Why: consistent evidence makes failed checks explainable and identifies
  what revision was tested. A restart should not depend on terminal history.
* Alternatives rejected: capturing only initialization, because focused
  checks would remain opaque; committing raw reports, because output can
  contain sensitive data and generate noisy diffs; separate implementations,
  because their report formats and failure handling could drift.
* Constraints: preserve verification arguments and nonzero exit codes.
  Running, interrupted, or capture-error reports are not successful checks.
  Commit only sanitized summaries in existing progress logs. No telemetry
  export, automatic evidence deletion, or CI artifact upload is introduced.

## D013: Clean handoffs use focused checks and owned cleanup

* Date: 2026-10-09
* Decision: clock-out records verification run IDs and results, reviewed
  revision and dirty state, remaining work, and owned-process and artifact
  cleanup. Runtime changes require the affected startup path to be checked;
  documentation-only changes do not require launching services.
* Why: explicit evidence makes the next session restartable without requiring
  an expensive full application startup for every documentation change.
* Alternatives rejected: full initialization and all service startups at
  every exit, because focused checks cover smaller changes without unrelated
  work; relying on a clean Git tree alone, because it does not prove health.
* Constraints: preserve unrelated changes and processes. Remove only named,
  session-owned temporary artifacts; retain local evidence intentionally.
  Failed or unavailable checks must be visible as blockers. Authorized
  commits and CI reports identify the resulting head and remaining changes.

## D014: A custom implementer stops before independent evaluation

* Date: 2026-10-09
* Decision: the [Harness Implementer](../.github/agents/harness-implementer.agent.md)
  routes to AGENTS.md and the existing skills rather than duplicating them.
  It accepts an issue or feature slug, agrees on one feature with the user,
  then implements and verifies without routine phase-by-phase approvals.
  It leaves the feature `active`, records a clean handoff, and stops with
  instructions for a fresh-session evaluator.
* Why: a reusable role reduces repeated prompting while keeping the builder
  separate from the reviewer and preserving the repository as the record.
* Alternatives rejected: adding an evaluator custom agent or coordinator in
  this increment, because the existing evaluator skill covers independent
  review; automatic evaluator handoffs, because a same-chat transition does
  not establish a fresh session.
* Constraints: no self-evaluation, feature PASS, next-feature work, or
  automatic commit, branch change, or publication. Scope changes and blockers
  require user input. Evaluation-result handling belongs to a separate
  follow-up. Model and tools are not pinned; instructions are not a
  permission boundary. A real agent trial remains necessary to check behavior.

## D015: F003 uses the published native ACS package

* Date: 2026-10-09
* Decision: use `AgentControlSpecification` 0.3.1-beta.1, its bundled Linux
  x64 native payload, the matching `0.3.1-beta` manifest schema, and OPA 1.4.2.
  Fixtures call the official validator and `RunToolAsync` without overriding
  the runtime or policy dispatcher. Windows-hosted tests run the Linux
  container rather than claiming native Windows support.
* Why: this available package provides matching managed and native artifacts.
  The researched 0.4.0-beta.0 package could not be restored from the configured
  feed. The published package avoids an unnecessary source build.
* Alternatives rejected: a custom dispatcher or mock engine, because neither
  proves native ACS evaluation; mixing the newer schema with the older
  payload, because manifest and ABI compatibility must be verified together.
* Constraints: keep package content hashes locked, checksum the OPA download,
  retain upstream license texts, and require explicit failures rather than a
  fallback engine. An optional build-time `ACS_NUGET_SOURCE` selects an approved
  mirror when nuget.org is unreachable, without disabling TLS or locked restore.
  The spike remains credential-free and separate from Gateway authorization.
