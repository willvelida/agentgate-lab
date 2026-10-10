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

* F006 signed publication succeeded as `ba55bf3aa7dbc7766215d0e9fd65aa714e6cbe16`.
  Origin matches and the tree was clean before F007; CI is unverified.
* F007 passed independent evaluation (average 4.8, minimum 4). Full tests passed
  32/32 (13 Portal, 19 ACS), zero skipped; build, architecture and offline
  native startup passed. The test checks packaged artifacts and evaluates
  the built image without network or mounted dependencies. Its previously
  unset verification command is explicitly defined as the existing full tests.
* F005 signed publication succeeded as `3deb0429f6aabe9f836a6f20a1315afd8bb44920`.
  Origin matches; the tree was clean before starting F006. CI is unverified.
* F006 passed independent evaluation (average 4.8, minimum
  4). Native pre/post allow, pre-tool deny and post-tool
  result withholding passed all 31 tests (13 Portal, 18 ACS), zero skipped.
  Build, architecture and native Linux startup passed.

* Branch: `issue-2-native-acs-runtime`, created from `main` for issue #2.
* Harness changes from PR #28 merged into `main` on 2026-10-09; the earlier
  PR handoff below has been superseded.
* F005 passed independent evaluation (average 4.8, minimum
  4). Six isolated native failure cases block startup or explicitly
  deny without executing delegates. All 28 tests passed (13 Portal and 15 ACS),
  zero skipped; build, architecture and native startup passed.
* F004 passed independent evaluation (average 4.8, minimum 4).
  Three fresh native runtimes per fixture return identical stable
  decisions, reasons, action identities and transformed targets. The native
  normalization fixture rewrites the guarded delegate's arguments.
* F003 passed independent evaluation (average 4.4, minimum 4). The isolated
  Linux spike allows a permitted synthetic read and denies an unpermitted read
  or unknown tool without executing their guarded delegates.
* F001 and F002 passed independent evaluation. F002's fresh-clone verification
  work was signed and pushed as `9769b78fa9ee66778f2b501751ce1876e4474c70`.
  F003 was signed and pushed as `75f56fd04eef96a6771e5145a0217cbd6a18c31e`.
  The working tree was clean before starting F004.
* F004 was signed and pushed as `21d8d49c6b04d2918c6307e27997cbebbb174a1c`.
  Its tree was clean before starting F005; CI for that head is unverified.
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
  boundary. F005 failure coverage passed independent evaluation; the remaining
  issue #2 criteria are not yet complete. F006 intervention coverage is verified
  locally and passed independent evaluation. F007 offline packaging checks
  passed locally and await fresh-session review; F008-F009 are not started.
* This network rejected nuget.org TLS during the container build. Local native
  tests used the explicit approved `ACS_NUGET_SOURCE` mirror override, without
  changing locked hashes or disabling TLS. Docker is now required for solution
  tests because ACS tests run the Linux container.
* Git Bash could not resolve Node.js when starting `bash init.sh` in this
  session. The PowerShell verification wrapper worked for focused checks.
* `docs-check.yml` only warns, and does not fail, when code changes without a
  `docs/progress.md` update.

## F005 evaluator and publication handoff

Replace this section at the end of every session so the next one can pick up
where you left off.

* Date: 2026-10-10
* Accomplished: independently evaluated F005 PASS (average 4.8, minimum 4)
  against `21d8d49c6b04d2918c6307e27997cbebbb174a1c` plus its uncommitted
  changes, recorded its verification evidence, and updated the checklist.
  F001-F005 are pass; F006-F009 remain not-started.
* Files modified: spike program, two failure YAML fixtures, native tests/shared
  container helper, README, architecture, both progress logs and ignored
  checklist. No lockfile or existing normal manifest/Rego fixture changed.
* F005 verification on `21d8d49` plus uncommitted F005 changes:
  `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed 28/28, zero skipped, exit 0 (run
  `2026-10-10T02-57-03-617Z-127d58e1-2c25-40ab-917b-0a216380e668`).
  `dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed with zero warnings/errors, exit 0 (run
  `2026-10-10T02-58-07-320Z-8c677711-26f5-4140-9b6f-3e73a85f0ff9`).
  `bash scripts/check-architecture.sh` passed, exit 0 (run
  `2026-10-10T02-56-59-984Z-ba62968b-c2c9-431e-bfbf-1891c6143fa2`).
* Runtime: normal native Linux startup passed, exit 0, using
  `docker compose run --build --rm --no-deps --name agentgate-f005-startup-ae2e76a9 acs-spike`
  (run `2026-10-10T02-58-11-351Z-085c053c-416d-46ff-8243-323b3c0cbbe9`).
  Native validation, original allow/deny results and repeated transforms are
  preserved. Failure tests use disposable containers and require specific
  startup diagnostics or native denial with zero delegate executions.
* Initial targeted tests failed 2/15, exit 1 (run
  `2026-10-10T02-53-43-806Z-c8e19ed4-7e4d-42c7-8902-fb73e322d885`):
  YAML returned `manifest_parse_error`, and missing OPA failed validation
  rather than returning a runtime deny. Native diagnostic probes confirmed
  both; final tests assert the exact errors. Probe reports remain failed as
  expected, not successful checks. Details are in the issue progress log.
* Cleanup: probes `agentgate-f005-malformed-probe`, `agentgate-f005-opa-probe`,
  `agentgate-f005-query-probe` (shells 472-474) and normal startup (shell 479)
  exited and were removed by `--rm`. Tests removed their unique
  `agentgate-f003-<guid>` containers; a final listing found no matching containers.
  No owned long-running process or temporary source directory remains.
  Ignored verification reports and Docker caches are retained.
* Publication: F004 push succeeded; no workflow run exists for that exact head.
  CI remains unverified, not green. F005 remains uncommitted.
* Blockers: no blocker for F005. Approved mirror validation passed; the default
  nuget.org restriction remains.
  No new architectural decision was needed. Only documentation/checklist
  evidence changed after successful implementation checks.
* Final `node -e` documentation/evidence validation passed, exit 0 (run
  `2026-10-10T03-01-07-275Z-f54fff8a-0339-4197-970b-3aa218889edc`):
  four Markdown files, 20 relative links, frontmatter, whitespace, unchanged
  locks, feature states, completed reports and normal native output.
  Editor diagnostics found no errors. Clean-state checklist completed for the
  handoff; F005 publication remains pending.
* Next step: complete the authorized F005 publication workflow before starting
  F006.
* Publication rerun on `21d8d49` plus evaluated F005 changes:
  `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed 28/28, zero skipped, exit 0 (run
  `2026-10-10T05-42-30-981Z-d2a05497-753f-4b5c-b72a-2ad4e7daf609`).
  `bash scripts/check-architecture.sh` passed, exit 0 (run
  `2026-10-10T05-42-26-314Z-86e31e8e-f4e1-40da-96a1-2ac9643bc965`).
  The explicit approved mirror was used; only evidence documentation followed.

## F006 implementation handoff

* Date: 2026-10-10
* Accomplished: published evaluator-PASS F005 as signed commit
  `3deb0429f6aabe9f836a6f20a1315afd8bb44920`, confirmed matching origin
  and clean tree, then implemented and verified F006.
  F001-F005 pass; F006 active pending evaluation; F007-F009 not-started.
* Files modified: spike program, three native intervention tests, README,
  architecture, both progress logs and ignored feature checklist. No dependency
  lockfile or manifest/Rego/failure fixture changed.
* Verification on `3deb042` plus uncommitted F006 changes:
  `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed 31/31, zero skipped, exit 0 (run
  `2026-10-10T05-49-52-386Z-6c616890-cfa1-4fca-8ab1-b4153d9d7bfc`).
  Targeted ACS tests passed 18/18, exit 0 (run
  `2026-10-10T05-47-51-401Z-8e20e6a7-c4b4-481d-a85a-a93bd191bb98`).
  `dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed with zero warnings/errors, exit 0 (run
  `2026-10-10T05-50-54-873Z-4af2cf54-a43f-447c-a073-f808b2ab07be`).
  `bash scripts/check-architecture.sh` passed, exit 0 (run
  `2026-10-10T05-49-47-835Z-6e0d52a5-eadf-495e-ac64-121c910671a3`).
* Runtime: `docker compose run --build --rm --no-deps --name
  agentgate-f006-startup-ae2e76a9 acs-spike` passed, exit 0 (run
  `2026-10-10T05-51-00-576Z-08d8f829-edf1-420c-8345-253571259be5`).
  Native pre/post allow returns a result; pre-tool denial executes zero
  delegates; post-tool denial executes one read and withholds its result.
  No rollback or earlier pre-tool result is fabricated. Default native runtime
  and OPA dispatcher remain in use; dependency-removal tests are preserved.
* Cleanup: startup container completed under shell 516 and `--rm` removed it.
  Tests removed their unique containers. No long-lived service or temporary
  source directory was created. Raw verification reports and Docker caches
  remain local and ignored; unrelated processes are untouched.
* Publication: F005 push succeeded; no workflow run exists for that head.
  CI is unverified. F006 remains uncommitted for independent review.
* Blockers: independent evaluation gates F006 completion and F007 work.
  Explicit approved mirror checks succeeded; default nuget.org TLS restriction
  remains. No new architectural decision was needed.
* Final `node -e` handoff validation passed, exit 0 (run
  `2026-10-10T05-53-31-378Z-ca410c89-27be-47d3-859b-69a7a2841092`):
  four Markdown files, 20 relative links, frontmatter, whitespace, unchanged
  locks, feature states, completed reports, native intervention output,
  default runtime path and owned-container cleanup. Clean-state checklist
  completed for handoff; evaluation and publication remain pending.
* Next step: open a fresh session in this checkout and run
  `/feature-evaluator Evaluate F006 in slug willvelida-agentgate-lab-2-prove-native-acs-net-policy-evaluation-and-linux-packaging`.
* F006 subsequently passed independent evaluation (average 4.8, minimum 4).
  Publication exact tests passed 31/31, zero skipped, exit 0 (run
  `2026-10-10T06-07-03-772Z-d47c6c97-ec41-46d1-a9bb-965108a554d2`).
  Architecture passed, exit 0 (run
  `2026-10-10T06-06-58-821Z-596a0971-178d-4b5f-8ba1-3327e384b315`).
  Reviewed `3deb042` with evaluated F006 changes; only evidence/status docs
  followed. Ready for authorized signed publication.

## Last session

* Date: 2026-10-10
* Accomplished: signed and pushed independently evaluated F006 as
  `ba55bf3aa7dbc7766215d0e9fd65aa714e6cbe16`, confirmed matching origin and
  clean tree, then implemented and verified F007.
* Status: F001-F007 pass; F008-F009 not-started. F007 is ready for authorized
  publication after independent evaluation.
* Files modified: native test/helper, README, architecture, decisions, both
  progress logs and ignored checklist. Runtime code, Dockerfile, fixture
  policies and lockfiles are unchanged.
* Verification on `ba55bf3` plus uncommitted F007 changes:
  `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed 32/32, zero skipped, exit 0 (run
  `2026-10-10T06-16-11-193Z-ec4f7235-f959-447c-a5d8-e1e015f70f44`).
  `dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed with zero warnings/errors, exit 0 (run
  `2026-10-10T06-18-08-847Z-bba2b8e0-5900-4ac5-8fa0-ab61c75871fb`).
  `bash scripts/check-architecture.sh` passed, exit 0 (run
  `2026-10-10T06-16-07-610Z-3ca48c77-1659-4fbb-978d-bf8658daccb4`).
* Runtime: `docker run --pull never --network none --rm --name
  agentgate-f007-startup-ae2e76a9 agentgate-lab-acs-spike` passed, exit 0 (run
  `2026-10-10T06-18-08-940Z-6fdebbbf-845f-4306-a3e4-43199d7dbb62`).
  Native validation and fixture/intervention outputs succeeded without network.
  The integration test additionally inspected no mounts, verified packaged
  artifacts and hashes, and required output equality and container exit 0.
* Failures: initial method placement caused a compile failure (run
  `2026-10-10T06-12-20-244Z-dd2bc3af-2444-4e46-b0e9-25c84cf6665e`).
  Retry failed on Windows line endings in the Linux shell (run
  `2026-10-10T06-13-53-275Z-879acfe1-71e4-4100-9367-fd4a3ddcfce5`).
  Targeted verification passed after normalizing those line endings (run
  `2026-10-10T06-15-16-518Z-3ac00e48-c7e8-49ed-aa55-c5e805b93461`).
  No existing test was weakened; failed reports remain recorded.
* Decision: [D017](./decisions.md#d017-f007-verifies-offline-runtime-separately-from-image-build)
  records the explicit full-test command selected for the previously unset
  F007 verification. The user was unavailable; approval is not claimed.
* Cleanup: tests remove only their named containers in `finally`; default
  startup exited under shell 546 and `--rm` removed its container.
  No long-running process or temporary source file was created. Raw reports
  and Docker caches stay local; unrelated processes are untouched.
* Publication: exact-head CI query found no runs for F006; CI is unverified.
  F007 publication must complete before F008 work.
  Explicit approved mirror checks passed; default nuget.org TLS remains blocked.
* Next step: publish F007 before starting F008.
* Final handoff validation passed, exit 0 (run
  `2026-10-10T06-21-26-093Z-2c16d9a0-684c-4fe8-8aa5-bc499777f396`):
  five Markdown files, 31 relative links, unique handoffs, feature states,
  unchanged locks, seven completed reports, offline native startup and no
  remaining test/startup containers. Editor diagnostics found no errors.
  The initial inline validator used a nonexistent report field (run
  `2026-10-10T06-20-47-686Z-3adf5532-940c-46cd-abbd-583aeac6c4c2`, failed,
  exit 1); retry used the recorded `before.workingTree` schema. Runner unchanged.
  Clean-state checklist is complete for handoff with evaluation and publication
  pending. Only this sanitized evidence note followed validation.
* F007 evaluator PASS subsequently recorded, average 4.8, minimum 4.
  Exact tests passed 32/32, zero skipped, exit 0 (run
  `2026-10-10T06-26-49-637Z-f841bbb2-5780-4c23-b41c-accf8818ae0f`);
  architecture passed, exit 0 (run
  `2026-10-10T06-26-47-352Z-df58f640-c4ce-472f-81d3-f613aab4df11`).
  Reviewed `ba55bf3` plus the six-file uncommitted diff. The evaluator-requested
  stale evidence row is synchronized; only status/evidence docs followed.

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

### Native ACS Linux spike (Issue #2, F007 active)

* F001 provides a runnable .NET 10 Linux x64 container scaffold.
* F002 adds a repeatable command for locked restore, container smoke, and
  solution tests; its evaluator-PASS work is committed and pushed.
* F003 adds real native ACS/OPA allow and deny fixtures, and four Linux
  container integration tests. It passed independent evaluation.
  The remaining acceptance criteria are not yet complete.
* F004 verifies repeated-input stability, including a native target transform.
  It passed independent evaluation.
* F005 verifies native failure paths in disposable Linux containers.
  It passed independent evaluation (average 4.8, minimum 4).
* F006 verifies native pre/post allow and denial, including withholding an
  executed read's rejected result. It passed independent evaluation and is
  signed and pushed.
* F007 verifies packaged runtime artifacts and native fixture evaluation
  without network or mounts. Its full tests and independent evaluation passed.
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
