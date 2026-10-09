---
title: Progress
description: Repository-level snapshot of what is built, what is in progress, and what is planned for AgentGate Lab.
ms.date: 2026-10-10
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

* Branch: `issue-2-native-acs-runtime`, created from `main` for issue #2.
* Harness changes from PR #28 merged into `main` on 2026-10-09; the earlier
  PR handoff below has been superseded.
* Current increment: F003 passed independent evaluation (average 4.4,
  minimum 4). The isolated Linux spike uses the official native ACS SDK and
  OPA to allow a permitted synthetic ticket read and deny an unpermitted read
  or unknown tool without executing their guarded delegates. All 17 tests
  passed (13 Portal and 4 native ACS container tests).
* F001 and F002 passed independent evaluation. F002's fresh-clone verification
  work was signed and pushed as `9769b78fa9ee66778f2b501751ce1876e4474c70`.
  F003 changes remain uncommitted; no further feature was started.
* F002 baseline on `bb2006ca1697ef377c4a36f531fb69e9ac1b84cc`: architecture,
  14 harness tests, locked restore, solution build (0 warnings/errors), and
  13 solution tests passed through the PowerShell verification wrapper.
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
* F003 is an isolated synthetic native ACS spike, not a Gateway authorization
  boundary. Determinism, dependency-failure coverage, and the remaining issue
  #2 acceptance criteria still await their own features and evaluation.
* This network rejected nuget.org TLS during the container build. Local native
  tests used the explicit approved `ACS_NUGET_SOURCE` mirror override, without
  changing locked hashes or disabling TLS. Docker is now required for solution
  tests because ACS tests run the Linux container.
* Git Bash could not resolve Node.js when starting `bash init.sh` in this
  session. The PowerShell verification wrapper worked for focused checks.
* `docs-check.yml` only warns, and does not fail, when code changes without a
  `docs/progress.md` update.

## Last session

Replace this section at the end of every session so the next one can pick up
where you left off.

* Date: 2026-10-10
* Accomplished: signed and pushed the existing F002 work as
  `9769b78fa9ee66778f2b501751ce1876e4474c70`, then implemented F003's native
  allow/deny fixtures and Linux container tests. Independent F003 evaluator
  PASS is now recorded (average 4.4, minimum 4); F004-F009 remain not-started.
* Files modified: solution, Dockerfile, Compose configuration, AcsSpike project,
  program and lockfile, original manifest/Rego fixtures, AcsSpike test project,
  tests and lockfile, README, architecture, decisions, and both progress logs.
  The local feature checklist remains intentionally ignored.
* Baseline: exact solution test command passed 13 tests on clean `9769b78`,
  exit 0 (run `2026-10-09T19-09-01-185Z-737bbf37-bbcb-4d48-88f5-c6612258ad6f`).
* Verification: `dotnet test AgentGateLab.sln --no-restore
  --property:SkipClientBuild=true` passed all 17 tests, exit 0 (run
  `2026-10-09T22-38-46-187Z-f3666a65-4189-463b-a581-e7f0a2ade5b8`).
  Solution build passed with zero warnings/errors (run
  `2026-10-09T22-34-18-556Z-7634e70f-8554-40af-8765-78f3d963b75d`).
  Linux startup passed (run
  `2026-10-09T22-37-17-175Z-407e39a2-c7cb-4a47-bb07-91a38782f0c4`):
  permitted read allowed and executed once; unpermitted read and unknown tool
  denied and executed zero delegates. Final locked restore passed (run
  `2026-10-09T22-40-51-127Z-e50534e0-bffc-42e3-b27b-6bd936a01fac`) and
  architecture passed (run
  `2026-10-09T22-40-57-527Z-0417b512-bf19-4c5e-9f2c-9cdb20fd25c2`).
  All completed checks above exited 0 and covered `9769b78` with uncommitted
  F003 changes. Only documentation/checklist updates followed tests.
  Final relative Markdown file links and `git diff --check` passed.
* Failed attempts: unavailable SDK 0.4.0-beta.0, nuget.org TLS handshake, and
  one Docker extraction snapshot error are recorded in the
  [feature evidence](./features/willvelida-agentgate-lab-2-prove-native-acs-net-policy-evaluation-and-linux-packaging/agent-progress.md).
  Available SDK 0.3.1-beta.1 restored successfully; the explicit approved
  mirror and a Docker retry produced the passing runs without weakening tests.
* Decision: [D015](./decisions.md#d015-f003-uses-the-published-native-acs-package)
  pins the matching published SDK/native payload, schema and OPA artifacts.
* Cleanup: stopped owned source probe container `a9c2975a66b2` (shell 400,
  interrupted exit 137), selected the prebuilt payload instead, and removed
  the named `.local/acs-f003` temporary directory. Tests removed their uniquely
  named containers; no owned process remains running. Docker caches and ignored
  `.local/verification/` reports are intentionally retained.
* Publication: F002 push succeeded. No CI run exists for `9769b78`; workflows
  trigger on pull requests and main, so CI remains unverified, not green.
  F003 is evaluator-PASS and ready for the authorized commit and push.
  Publication tests passed 17/17, exit 0 (run
  `2026-10-09T23-26-40-610Z-887d2017-fef0-458d-a71a-1dde3dc99974`);
  architecture passed, exit 0 (run
  `2026-10-09T23-26-35-200Z-c882ce12-7ca1-467a-a410-6ac790289bda`).
  Both reviewed `9769b78` plus evaluated F003 changes. Only documentation and
  local checklist reconciliation followed.
* Blockers: no local verification blocker with the approved mirror. Default
  nuget.org could not be validated successfully on this network.
* Next step: commit and push F003, then implement and verify F004.

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

### Agent harness (merged in PR #28)

* `AGENTS.md` defines clock-in/out, one-feature scope, verification, and
  evidence requirements.
* Issue skills create feature checklists and evidence logs; the evaluator
  records an independent fresh-session verdict.
* Bash and PowerShell wrappers capture verification metadata and raw output
  under ignored `.local/verification/` run directories.
* `scripts/check-architecture.sh` enforces service and Client boundaries.
  CI also checks relative Markdown links and reminds contributors to update
  this progress file when source changes start, complete, or block a milestone.
* The [Harness Implementer](./harness-agent.md) works on one agreed feature
  and stops before independent evaluation.

## In progress

### Native ACS Linux spike (Issue #2, F003 evaluator-PASS)

* F001 provides a runnable .NET 10 Linux x64 container scaffold.
* F002 adds a repeatable command for locked restore, container smoke, and
  solution tests; its evaluator-PASS work is committed and pushed.
* F003 adds real native ACS/OPA allow and deny fixtures, and four Linux
  container integration tests. It passed independent evaluation.
  The remaining acceptance criteria are not yet complete.
* See the [issue #2 feature evidence](./features/willvelida-agentgate-lab-2-prove-native-acs-net-policy-evaluation-and-linux-packaging/agent-progress.md).

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
