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
* Current increment: F004 passed independent evaluation (average 4.8, minimum
  4). Three fresh native runtimes per fixture return identical stable
  decisions, reasons, action identities and transformed targets. The native
  normalization fixture rewrites the guarded delegate's arguments.
  All 22 tests passed (13 Portal and 9 ACS container tests), with zero skipped.
* F003 passed independent evaluation (average 4.4, minimum 4). The isolated
  Linux spike allows a permitted synthetic read and denies an unpermitted read
  or unknown tool without executing their guarded delegates.
* F001 and F002 passed independent evaluation. F002's fresh-clone verification
  work was signed and pushed as `9769b78fa9ee66778f2b501751ce1876e4474c70`.
  F003 was signed and pushed as `75f56fd04eef96a6771e5145a0217cbd6a18c31e`.
  The working tree was clean before starting F004.
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
* The ACS spike is isolated synthetic evidence, not a Gateway authorization
  boundary. F004 determinism passed independent evaluation; dependency-failure
  coverage and the remaining issue #2 criteria are not yet complete.
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
* Accomplished: confirmed F003 evaluator PASS, reran publication checks,
  signed and pushed F003 as `75f56fd04eef96a6771e5145a0217cbd6a18c31e`, then
  implemented and verified F004. F004 now has independent evaluator PASS
  (average 4.8, minimum 4); F005-F009 remain not-started.
* Files modified for F004: spike program, original Rego fixture, native tests,
  README, architecture, decisions, and both progress logs. No lockfile changed;
  the local feature checklist remains ignored.
* Baseline/publication: exact solution tests passed 17/17, exit 0 (run
  `2026-10-09T23-26-40-610Z-887d2017-fef0-458d-a71a-1dde3dc99974`) and
  architecture passed, exit 0 (run
  `2026-10-09T23-26-35-200Z-c882ce12-7ca1-467a-a410-6ac790289bda`).
  Both reviewed `9769b78` with evaluated F003 changes; only documentation and
  local checklist reconciliation followed before commit.
* F004 verification: `dotnet test AgentGateLab.sln --no-restore
  --property:SkipClientBuild=true` passed 22 tests, zero failed/skipped, exit 0
  (run `2026-10-09T23-34-48-043Z-0019b6a6-748c-473a-a174-69ff83909715`).
  Build passed with zero warnings/errors, exit 0 (run
  `2026-10-09T23-35-28-467Z-fb834955-1eea-41bc-a343-595ed2f64028`).
  Architecture passed, exit 0 (run
  `2026-10-09T23-32-41-236Z-8131bf47-53e6-4999-ab83-cea7738a4c18`).
  Linux startup passed, exit 0 (run
  `2026-10-09T23-35-33-890Z-447b496e-6e32-4c85-8c72-1f3b80532a6c`):
  all four cases had three matching results, including native action identity
  and a non-null applied transform. The normalized delegate received `SYN-001`;
  both denies executed zero delegates. Checks covered `75f56fd` plus uncommitted
  F004 changes; only documentation and checklist updates followed.
  Final architecture passed, exit 0 (run
  `2026-10-09T23-38-46-052Z-7d8dd240-c803-49bf-9d20-461c957d54e9`).
  Documentation links, relevant anchors and frontmatter passed, exit 0 (run
  `2026-10-09T23-38-46-053Z-6f44f841-d86e-48d2-b59e-19bd0e1a1a27`);
  `git diff --check` passed. Clean-state checklist completed for handoff;
  independent F004 evaluator PASS and publication remain pending.
* Initial F004 tests passed but reported xUnit2013 (run
  `2026-10-09T23-32-48-698Z-69dc9a13-84ed-472c-80ff-c1685819d5b9`).
  Replacing a size assertion with `Assert.Single` removed the warning; the final
  tests and build above passed without warnings. No test was weakened.
* Decision: [D016](./decisions.md#d016-f004-compares-stable-native-results-across-fresh-runtimes)
  records the stable projection and non-null transformation evidence.
* Cleanup: startup container `agentgate-f004-startup-ae2e76a9` completed under
  shell 447 and `--rm` removed it. Tests removed their unique containers.
  No owned long-running process remains. No temporary source directory was
  created; ignored verification reports and Docker caches are retained.
* Publication: F003 push succeeded and the tree was clean afterward. No CI
  run exists for that exact head; CI remains unverified, not green.
  F004 is ready for authorized signed publication. Exact publication tests
  passed 22/22, exit 0 (run
  `2026-10-10T02-48-58-235Z-32c118c1-c2a1-4734-aaf1-81facc1d8349`);
  architecture passed, exit 0 (run
  `2026-10-10T02-48-52-905Z-57b94f87-4242-4734-a60c-99ce08c0f7b1`).
  Checks reviewed `75f56fd` with evaluated F004 changes; only status and evidence
  documentation followed.
* Blockers: no local blocker with the explicit approved NuGet mirror. The
  default nuget.org network restriction is unchanged.
* Next step: commit and push F004, then implement and verify F005.

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

### Native ACS Linux spike (Issue #2, F004 evaluator-PASS)

* F001 provides a runnable .NET 10 Linux x64 container scaffold.
* F002 adds a repeatable command for locked restore, container smoke, and
  solution tests; its evaluator-PASS work is committed and pushed.
* F003 adds real native ACS/OPA allow and deny fixtures, and four Linux
  container integration tests. It passed independent evaluation.
  The remaining acceptance criteria are not yet complete.
* F004 verifies repeated-input stability, including a native target transform.
  It passed independent evaluation.
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
