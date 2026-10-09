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
* Current increment: [Harness Implementer](./harness-agent.md) definition
  and usage guidance created. Focused static validation passed. The read-only
  trial stopped without looking up issue #2 or taking action; the user
  accepted the result. No application source or verification runner changed.
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
* Accomplished: agreed on a single custom implementer, one-feature approval
  followed by implementation and verification, and a stop before independent
  evaluation. Created its definition and usage guide, added the harness
  pointer, recorded D014, and passed focused static checks. In read-only
  trials, the agent did not edit files, run commands, look up issue #2, or
  take further action. It acknowledged #2 from earlier conversation after
  the prompt said no task was selected. The user accepted the stop as
  sufficient and clarified that "work on issue 2 using the harness" should
  select issue #2.
* Remains: CI for the new custom-agent changes. No feature evaluation has
  run. Static instruction assertions do not prove model behavior or picker
  discovery.
* Publication: user authorized commit, push, and PR #28 update. The PR records
  the resulting commit and its exact-head CI checks.
* Decisions: D014 in [decisions.md](./decisions.md).
* Files modified: `.github/agents/harness-implementer.agent.md`,
  `docs/harness-agent.md`, `AGENTS.md`, `docs/decisions.md`, `docs/progress.md`.
* Verification: static assertions through the PowerShell runner passed for
  the agent metadata, boundaries, 54 relative links across 5 Markdown files,
  architecture, whitespace, and unchanged application/test/runner/CI files
  (exit 0, run
  `2026-10-09T05-45-14-410Z-6b5d2f49-39ef-4692-b009-9f66a3721851`).
  After current-request-only issue selection was added, the focused guard,
  frontmatter, link, architecture, and whitespace check passed (exit 0, run
  `2026-10-09T05-56-51-832Z-994374bd-2155-42b7-a2f5-cb5c0f7f82f8`).
  The final pre-publication check passed (exit 0, run
  `2026-10-09T06-06-43-365Z-3521ce82-94d1-40ce-8dc3-f2efa4d0a60e`),
  confirming links, frontmatter, agent role and boundaries, architecture,
  and whitespace. Editor diagnostics found no errors. Static checks do not prove model
  behavior or custom-agent picker discovery. Both reports remain local.
* Validation correction: an intermediate prose assertion assumed LF line
  breaks, but Markdown uses CRLF (run
  `2026-10-09T05-44-49-948Z-4af1e131-5227-4677-b110-4bb902cc5960`,
  failed, exit 1). Normalizing whitespace fixed the assertion; no agent
  instruction or approval rule was weakened. The failed report remains local.
* Startup: not applicable; only agent instructions and documentation changed.
* Cleanup: no service or delegated agent was started. No task-owned temporary
  repository files were created. Existing local evidence is retained.
* Blockers: none.
* Next steps: review exact-head CI on PR #28; leave the PR open for review.
  Application runtime observability and benchmarking remain outside this
  increment.

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
