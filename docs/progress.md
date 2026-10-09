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

* Branch: `issue-2-native-acs-runtime`, created from `main` for issue #2.
* Harness changes from PR #28 merged into `main` on 2026-10-09; the earlier
  PR handoff below has been superseded.
* Current increment: F002 passed independent evaluation (average 5.0,
  minimum 5). It adds one documented fresh-clone
  command to restore locked .NET and frontend dependencies, build Portal
  assets, run the Linux x64 container smoke, and execute the solution tests.
  The command passed from a fresh clone and was independently rerun with all
  13 tests. F001 also passed independent evaluation (average 4.6, minimum 4).
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
* Issue #2's ACS spike is still only a container startup scaffold. Native ACS
  policy evaluation, fixtures, and packaged native runtime dependencies remain
  unimplemented.
* Git Bash could not resolve Node.js when starting `bash init.sh` in this
  session. The PowerShell verification wrapper worked for focused checks.
* `docs-check.yml` only warns, and does not fail, when code changes without a
  `docs/progress.md` update.

## Last session

Replace this section at the end of every session so the next one can pick up
where you left off.

* Date: 2026-10-09
* Accomplished: implemented F002 on `issue-2-native-acs-runtime` after F001
  evaluator PASS and commit `bb2006ca1697ef377c4a36f531fb69e9ac1b84cc`.
  Added a one-shot fresh-clone workflow for locked .NET and frontend
  dependency restore, frontend build, Linux x64 container smoke, and tests.
* Files modified: `scripts/verify-acs-spike.sh`, `README.md`,
  `docs/features/willvelida-agentgate-lab-2-prove-native-acs-net-policy-evaluation-and-linux-packaging/agent-progress.md`,
  and `docs/progress.md`. The local `features_list.json` is intentionally
  ignored by Git.
* Baseline verification passed on reviewed commit
  `bb2006ca1697ef377c4a36f531fb69e9ac1b84cc`, before F002 changes:
  architecture check (run
  `2026-10-09T07-27-10-863Z-02b99954-2948-49c6-a3b5-ff529700f672`),
  14 harness tests (run
  `2026-10-09T07-27-36-200Z-9ad01455-59da-4fab-8cce-19304c41af9f`),
  locked restore (run
  `2026-10-09T07-27-36-134Z-5d949738-86d0-4267-8a93-7c420db1b419`),
  build with 0 warnings/errors (run
  `2026-10-09T07-28-37-986Z-7a48ce1e-915c-4f0b-b93e-5801549bd133`), and
  13 solution tests (run
  `2026-10-09T07-28-57-893Z-ce17307c-a0ae-4f75-9339-f548eea7f6f4`).
* F002 verification: `bash scripts/verify-acs-spike.sh` passed from a fresh
  local clone, running locked restore, frontend install/build, Linux x64
  container smoke, and all 13 solution tests (run
  `2026-10-09T11-35-18-553Z-d449c9df-515e-4250-925f-347494cddad8`).
  Independent evaluator rerun passed with all 13 tests (run
  `2026-10-09T11-44-42-106Z-d5ae2373-3e5c-4a0f-9cee-b34b21d74b02`).
  Evaluator architecture check passed (run
  `2026-10-09T11-44-42-097Z-8af40cd0-ccac-44a5-a503-ee6ec3def56c`).
  Evaluator verdict: PASS, average 5.0, minimum 5; see the ignored local
  rubric.
  Final Bash syntax check passed (run
  `2026-10-09T11-41-08-521Z-156e2a22-f578-4095-87a2-dfb5e8bdd56e`), final
  architecture check passed (run
  `2026-10-09T11-41-08-523Z-b9e4f43c-5458-4f1e-b57e-bfcebae1d558`), and
  `git diff --check` passed. Reviewed commit
  `bb2006ca1697ef377c4a36f531fb69e9ac1b84cc` plus uncommitted F002 changes.
* Cleanup: temporary fresh clone and its Docker image/network were removed.
  Verification reports remain in ignored `.local/verification/`. No
  long-running process was started.
* Publication checks: the F002 command passed again with Linux x64 startup
  and all 13 tests, exit 0 (run
  `2026-10-09T19-02-57-945Z-772d9287-b679-44e5-8c33-f9cc7a014b95`).
  Architecture passed, exit 0 (run
  `2026-10-09T19-02-57-732Z-28a4d028-6fa8-424b-90f1-327853e284c1`).
  Checks covered `bb2006ca1697ef377c4a36f531fb69e9ac1b84cc` with pending
  F002 changes; only documentation was updated afterward. Publication is
  authorized; CI for the resulting head remains unverified.
* Blockers: none. The gitignored local feature checklist records F002 as pass;
  no feature status file is included in the commit.
* Next steps: begin F003 after the F002 commit is pushed.

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

### Native ACS Linux spike (Issue #2, F002 evaluator-PASS)

* F001 provides a runnable .NET 10 Linux x64 container scaffold.
* F002 adds a repeatable command for locked restore, container smoke, and
  solution tests. Native ACS evaluation and policy fixtures remain future
  work.
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
