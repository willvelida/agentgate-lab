---
title: Clean-State Checklist
description: Checklist to complete before ending a session or a feature so the next session starts from a known good state.
ms.date: 2026-10-09
---

## Purpose

Run this checklist before you end a session or mark a feature `pass`. A clean
state means the next session can start work right away instead of repairing
leftovers. See [AGENTS.md](../AGENTS.md) for the clock-out routine that uses
this list.

## Build

* [ ] `bash init.sh`, or the focused checks for your change, passes.
* [ ] `bash scripts/check-architecture.sh` passes.
* [ ] No new build warnings or test failures were introduced.
* [ ] Dependency lockfiles changed only for an intentional update.
* [ ] Commands ran through the evidence runner in
      [verification guidance](./verification.md). Sanitized summaries include
      run IDs, exit codes, the reviewed commit, and dirty state.
* [ ] Failed, unavailable, or incomplete checks are recorded as such, not
      treated as a healthy handoff.

## Feature

* [ ] Only one feature was worked on this session.
* [ ] The feature meets its acceptance criterion.
* [ ] The feature's `verification` step ran and succeeded.
* [ ] Runtime evidence is recorded for behavior changes, such as a `/health`
      response or AgentWorker log output.
* [ ] The feature is marked `pass` only with recorded evidence and a tested
      date in `docs/features/<slug>/features_list.json` and
      `agent-progress.md`.
* [ ] A fresh-session evaluator PASS is recorded in `agent-progress.md` for
      the changes being marked `pass`.
* [ ] An unfinished feature stays `active` or becomes `blocked`, and the
      reason is recorded.
* [ ] No test was weakened, skipped, or deleted to make a check pass.

## Scope Control

* [ ] Changes stay within the chosen feature, and any small fix needed to
      get past a blocker is logged in `agent-progress.md`.
* [ ] No unrelated refactors, features, or files were added.
* [ ] Code lives in the project that owns it, as described in
      [architecture.md](./architecture.md).

## Code Quality

* [ ] Tests cover any behavior that changed.
* [ ] No debug code, commented-out code, or temporary files remain.
* [ ] No secrets, credentials, or generated output from `src/Portal/wwwroot`
      are staged.

## Startup and Cleanup

* [ ] For runtime changes, the affected service's documented startup path was
      checked and the observed result recorded. For documentation-only
      changes, startup checks are recorded as not applicable.
* [ ] Processes started by this session are identified by PID or tool session
      and stopped. The cleanup result is recorded; unrelated processes are
      left alone.
* [ ] Only named temporary files created by this session were removed.
      Intentionally retained local evidence is distinguished from leftovers.
* [ ] Pre-existing changes are preserved and remaining changes are explained.

## Documentation

* [ ] [progress.md](./progress.md) is updated, including Current State, Known
      Issues, and "Last session".
* [ ] New decisions are recorded in [decisions.md](./decisions.md).
* [ ] Affected docs are updated and their relative links resolve.
* [ ] "Last session" records verification run IDs and results, reviewed
      revision, startup evidence where applicable, cleanup, blockers, and
      the next action.
* [ ] Authorized commits use `git commit -s`. The resulting commit and final
      `git status --short` state are reported, including intentional leftovers.
* [ ] When publishing, CI evidence identifies the exact head. Pending or
      unchecked CI is not recorded as green.
