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
* PR #28 is the source of truth for the latest commit and exact-head CI status;
  confirm all checks before merge.
* Current increment: addressing four review comments on PR #28. Checklist
  recreation now stops when a progress log exists without its ignored JSON;
  architecture scans cover multiline references/imports and ignore commented
  XML; architecture wording expands ACS correctly. Focused checks passed;
  changes are uncommitted and unpublished.
* `init.sh`: passed the full sequence on Windows through Git Bash
  (2026-10-09, exit 0). All 10 steps produced finalized, ignored reports.
  Commands and run IDs are recorded below.
* Focused validation (2026-10-09): `node --test
  scripts/run-verification.test.mjs` passed all 9 tests on Windows, including
  Bash and PowerShell wrappers, failed commands, argument boundaries, and
  Windows command shims.
* Wrapper validation: Bash syntax and PowerShell parsing passed.
  `Invoke-ScriptAnalyzer -Path scripts/Invoke-Verification.ps1 -Severity
  Error,Warning` reported no findings. ShellCheck is unavailable locally.
* `git check-ignore -v` confirmed `.local/verification/` reports and raw output
  are ignored. A captured architecture check passed after integration
  (exit 0, run `2026-10-09T05-15-48-848Z-ce6d8a08-7876-4e4e-a0bd-2a6d39946997`,
  reviewed commit `bb08840` plus uncommitted runner and harness changes).
* Integration: frontend type-check, test (1 passed), build, .NET build
  (0 warnings and errors), tests (13 passed), and Portal publish passed.
  Relative links (51 across 7 changed Markdown files), frontmatter presence,
  Node and Bash syntax, PowerShell lint, and whitespace checks passed.
* Initial initialization stopped at `npm ci` with Windows `EPERM`.
  Retrying succeeded without manual deletion or stopping unrelated processes;
  the next complete initialization passed. The original report remains failed.

### Verification evidence

These runs checked `bb08840` plus uncommitted runner and harness changes on
2026-10-09. Each full-initialization command below passed with exit 0.
Raw output stays local; these summaries are not an independent feature PASS.

| Command | Run ID |
|---------|--------|
| `bash scripts/check-architecture.sh` | `2026-10-09T05-19-41-925Z-663698a6-55dd-4378-8bb0-e6ef015b8d72` |
| `node --test scripts/run-verification.test.mjs` | `2026-10-09T05-19-46-427Z-fe80d233-960e-4391-9f35-05a9129aa116` |
| `dotnet restore AgentGateLab.sln --locked-mode` | `2026-10-09T05-20-13-185Z-2af0fa1d-b46e-46c7-a726-4e5cacd0e4ab` |
| `npm ci --prefix src/Client` | `2026-10-09T05-20-18-508Z-14a9f854-7128-4f31-839c-65df87e8c070` |
| `npm run typecheck --prefix src/Client` | `2026-10-09T05-20-46-562Z-1682dea9-75fc-4f6b-a240-dafcdbb625da` |
| `npm test --prefix src/Client` | `2026-10-09T05-20-55-488Z-4b8c4574-a361-4b7e-85c7-845be803681d` |
| `npm run build --prefix src/Client` | `2026-10-09T05-21-08-112Z-56c8f09d-83bf-49ec-b84c-aa17a3a3ba9d` |
| `dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | `2026-10-09T05-21-17-662Z-70e01981-9e0f-4257-a6ed-6e88c1f4808c` |
| `dotnet test AgentGateLab.sln --no-build --no-restore --property:SkipClientBuild=true` | `2026-10-09T05-21-35-175Z-2acc6d7c-91a0-430e-bb68-3e314db5820d` |
| `dotnet publish src/Portal/Portal.csproj --configuration Release --no-restore --property:SkipClientBuild=true` | `2026-10-09T05-21-44-659Z-dffe6b83-98df-4b16-84fb-39f508b01b1f` |

The failed `npm ci --prefix src/Client` run was
`2026-10-09T05-17-56-710Z-d005bb91-d60b-434a-add6-eaafc9df8e51`
(status `failed`, recorded Windows exit code `4294963248`, `EPERM`).
The standalone retry was
`2026-10-09T05-18-51-498Z-616924aa-cf01-4592-9b89-79ad1a5a58c2`
(passed, exit 0).

An inline report validation initially assumed that failure returned 1
(run `2026-10-09T05-22-44-666Z-4a0f8167-60ce-4018-8d5e-94c30d63b887`,
failed, exit 1). After inspecting the original report, validation checked
the actual native Windows exit code instead
(run `2026-10-09T05-23-38-364Z-571383f8-dc5d-4746-b5ef-7958e3cb2d29`,
passed, exit 0). It confirmed all 10 successful reports' timing, arguments,
revision, dirty state, output files, and Git ignore coverage. The runner and
its tests were not changed to hide either failure.

Final static checks (`node -e` with inline link, frontmatter, script syntax,
PowerShell parsing and lint, and whitespace validation) passed with exit 0
in run `2026-10-09T05-25-09-441Z-cb4ef885-cf33-4df8-b2ca-30f59e9b56a7`.
Editor diagnostics reported no errors in the changed documents and scripts.
Only evidence and publication handoff text changed after those checks;
final link and whitespace checks were repeated before commit.

## Known Issues

* No gateway security, identity, storage, or agent logic exists yet. Do not
  treat any endpoint as protected.
* `docs-check.yml` only warns, and does not fail, when code changes without a
  `docs/progress.md` update.

## Last session

Replace this section at the end of every session so the next one can pick up
where you left off.

* Date: 2026-10-09
* Accomplished: addressed four Copilot review comments on PR #28. The issue
  skill now asks before recreating a missing feature list when its progress log
  exists. The architecture checker removes XML comments before scanning
  complete, multiline project-reference tags and flattens source files before
  checking imports across line breaks. Added regression tests for multiline
  service references, commented references, and multiline dynamic imports.
  Corrected ACS to Agent Control Specification.
* Files modified: `.github/skills/github-issue-to-features-list/SKILL.md`,
  `.github/workflows/build.yml`, `docs/architecture.md`, `docs/progress.md`,
  `init.sh`, `scripts/check-architecture.sh`,
  `scripts/check-architecture.test.mjs`.
* Verification: `node --test scripts/check-architecture.test.mjs
  scripts/run-verification.test.mjs` passed, 14 tests (exit 0, run
  `2026-10-09T06-29-57-434Z-c7394d3e-a81c-4a2f-b530-92557304d8c3`).
  `bash scripts/check-architecture.sh` passed against the repository (exit 0,
  run `2026-10-09T06-29-57-586Z-e81b85ea-02ec-4acc-af0d-bda3360be873`).
  `bash -n` for the checker and `init.sh`, `git diff --check`, and a
  frontmatter/relative-link scan (10 links across 3 Markdown files) passed.
* Validation correction: an intermediate implementation tried to invoke Node
  from non-login Git Bash, where Node was not on `PATH`; it was replaced with
  a self-contained Bash/awk implementation. The first XML regression run also
  exposed an awk helper naming conflict and then an expected-message mismatch;
  both were fixed, and the final captured suite passed.
* Startup: not applicable; application source and tests were unchanged.
* Cleanup: regression fixtures removed themselves. Captured verification
  reports remain in ignored `.local/verification/`; no services were started.
* Publication: no commit or push was requested. PR #28 still points to
  `1e95964`; review threads remain open until these changes are published.
* Blockers: none.
* Next steps: review the diff; after approval, commit and push, then confirm
  exact-head CI and resolve the addressed PR threads.

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
* Feature states `not-started`, `active`, `blocked`, and `pass`, a
  `verification` field, and a one-session sizing rule in the skill.
* Hard rules 11 to 13 (evidence before `pass`, stay in scope, never weaken a
  test) and a "Runtime evidence" section in `AGENTS.md`.
* `scripts/check-architecture.sh`: enforces service and Client boundaries,
  runs in `init.sh` and CI.
* `.gitattributes`: LF line endings for `*.sh` files.
* `feature-evaluator` skill: independent five-part scoring in a fresh session.
  Every score must be at least 3 and the average at least 4 for PASS.
  Full rubrics stay gitignored; verdict lines go in committed progress logs.
* Hard rule 14 and the feature workflow require a recorded evaluator PASS
  before a feature becomes `pass`.
* Verification evidence runner: records command
  results and repository state under ignored `.local/verification/` run directories.
  Bash and PowerShell wrappers share the same report format. Initialization,
  feature checks, and evaluator checks use capture; clock-out records the
  reviewed state, results, and owned cleanup.
* [Harness Implementer](./harness-agent.md): custom agent that
  follows the existing harness for one agreed feature and stops before
  independent evaluation. Static checks passed; the user accepted the
  read-only trial's stop behavior. Picker discovery remains unverified.

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
