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

## Documentation

* [ ] [progress.md](./progress.md) is updated, including Current State, Known
      Issues, and "Last session".
* [ ] New decisions are recorded in [decisions.md](./decisions.md).
* [ ] Affected docs are updated and their relative links resolve.
* [ ] Work is committed with `git commit -s`.
