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

* Issue #30 F001-F004 are evaluator-PASS and committed. F005 is active as a
  focused test-only feature; F006 is not started.
* F008 signed and pushed as `f64c72729e6f337e62e5b24e34f1157dde07133f`;
  origin matches and tree was clean before F009. Exact-head CI has no runs.
* F009 passed independent evaluation (average 5.0, minimum 5), no required
  fixes. F001-F009 all pass; signed F009 commit
  `17f0cc33662532f55acbbc707665127c3fbfa8ff` is pushed and matches origin.
  Its exact-head CI query returned no runs; CI is unverified.
  Eleven sensitivity tests verify
  integration assertions reject altered native denial/dependency evidence.
  Exact tests passed 43/43 (13 Portal, 30 ACS), zero skipped; build and
  architecture passed. Runtime and dependencies remain unchanged.
* F007 signed publication succeeded as `0b50371adb38ca56f894711d3e88ba7c6ba64301`.
  Origin matches and the tree was clean before F008; exact-head CI has no runs.
* F008 passed independent evaluation (average 5.0, minimum 5). Packaging versions, Linux
  platform, published binary provenance (no source build), mutable base tags
  and preview limitations are documented. Full tests passed 32/32, zero skipped;
  architecture and documentation/pin/link checks passed.
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

* Issue #30 F004 is a local controller capability boundary, not an
  operating-system sandbox or authorization implementation. It removes shell,
  direct URL, Git metadata write, and MCP capabilities from loop sessions and
  detects protected repository transitions. It does not constrain processes
  started outside the controller.
* No gateway security, identity, storage, or agent logic exists yet. Do not
  treat any endpoint as protected.
* Issue #2 is complete: F001-F009 passed independent evaluation. The ACS spike
  is isolated synthetic evidence, not a Gateway authorization boundary; it
  does not implement production authorization, identity, or ticket operations.
* This network rejected nuget.org TLS during the container build. Local native
  tests used the explicit approved `ACS_NUGET_SOURCE` mirror override, without
  changing locked hashes or disabling TLS. Docker is now required for solution
  tests because ACS tests run the Linux container.
* Git Bash could not resolve Node.js when starting `bash init.sh` in this
  session. The PowerShell verification wrapper worked for focused checks.
* `docs-check.yml` only warns, and does not fail, when code changes without a
  `docs/progress.md` update.

## F005 evaluator and publication handoff (historical)

Replace this section at the end of every session so the next one can pick up
where you left off.

* Date: 2026-10-10
* Accomplished: independently evaluated F005 PASS (average 4.8, minimum 4)
  against `21d8d49c6b04d2918c6307e27997cbebbb174a1c` plus its uncommitted
  changes, recorded its verification evidence, and updated the checklist.
  At that handoff, F001-F005 had passed and F006-F009 had not started.
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

## F007 implementation handoff

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

## F008 implementation handoff

* Date: 2026-10-10
* Accomplished: synchronized F007's stale evidence row as requested by its
  evaluator, recorded PASS and signed/pushed
  `0b50371adb38ca56f894711d3e88ba7c6ba64301`. Origin matches; the tree was
  clean before F008. Documented and verified F008 only.
* Status: F001-F007 pass; F008 active pending fresh-session evaluation;
  F009 not-started. No evaluator was invoked here.
* Files modified: README, architecture, both progress logs and ignored feature
  checklist. Runtime, tests, images and lockfiles are unchanged.
* Verification on `0b50371` plus uncommitted F008 documentation:
  `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed 32/32, zero skipped, exit 0 (run
  `2026-10-10T06-41-18-952Z-8e6ce699-d98f-42db-8b7a-b4a9eb5407a2`).
  `bash scripts/check-architecture.sh` passed, exit 0 (run
  `2026-10-10T06-41-14-008Z-f0e9b398-5ae7-4407-9264-c92224284961`).
  Captured `node -e` documentation checks passed, exit 0 (run
  `2026-10-10T06-41-14-156Z-178d301c-27ae-4e93-8a57-66c5b190debf`):
  four Markdown files, 34 relative links/anchors and agreement with SDK,
  package/schema, native/OPA hashes, provenance, paths and preview limits.
* Decisions: no new architecture decision. F008's verification was unset;
  asked to use full tests plus documentation checks, but user unavailable.
  Explicitly recorded that choice without claiming approval or weakening checks.
* Runtime: separate startup/build not applicable to documentation-only change.
  Full tests built test targets and ran the unchanged native image fixtures.
* Cleanup: tests remove owned `agentgate-f003-<guid>` containers. No long-lived
  service or temporary source artifact was created; raw evidence, ignored rubric
  and Docker caches stay local. Unrelated processes remain untouched.
* Publication: F007 push succeeded; no workflow run for that exact head.
  CI is unverified. Four tracked documentation files remain uncommitted.
* Blockers: independent evaluation gates F008 completion and further work.
  Approved mirror tests passed; default nuget.org TLS restriction remains.
  Core checks passed; only evidence notes followed verification.
* Next step: open a fresh session in this checkout and run
  `/feature-evaluator Evaluate F008 in slug willvelida-agentgate-lab-2-prove-native-acs-net-policy-evaluation-and-linux-packaging`.
* F008 subsequently passed independent evaluation, average 5.0, minimum 5.
  Exact tests passed 32/32, zero skipped, exit 0 (run
  `2026-10-10T06-59-35-606Z-4cbbad55-3186-4b8d-8b54-d5d0e04a767e`);
  architecture passed, exit 0 (run
  `2026-10-10T06-59-34-899Z-92ae718a-3fef-4f23-a1d2-08b957d57476`).
  Reviewed `0b50371` plus four documentation files; only status/evidence edits
  followed. No required fixes. Next action is authorized F008 publication.
* Final handoff validation passed, exit 0 (run
  `2026-10-10T06-44-02-294Z-3d5b9d3c-61a4-4e80-a8a3-c3d53ac33ad9`):
  document links/anchors and pin agreement, completed reports, exact revision/
  origin, unique handoffs, feature states, ignored artifacts and no remaining
  test containers. Initial inline handoff validator failed with a duplicate
  variable name (run `2026-10-10T06-43-33-552Z-981cdd2e-82de-4e79-a1d4-f64e0011190d`,
  exit 1); correcting that local validator identifier passed. Runner and tests
  unchanged. Editor diagnostics found no errors; clean-state checklist is
  complete for handoff, with evaluation and publication pending.

## F009 implementation and publication record

* Date: 2026-10-10
* Accomplished: implemented and verified F009, recorded the independent
  evaluator PASS (average 5.0, minimum 5), then signed and published the
  feature and its handoff documentation.
* Status: F001-F009 pass; issue #2 is complete. PR #29 is open for review.
* Files modified: native tests, README, architecture, both progress logs and
  ignored feature checklist. Runtime, images and lockfiles unchanged.
* Verification on `f64c727` plus uncommitted F009 changes:
  `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed 43/43, zero skipped, exit 0 (run
  `2026-10-10T07-12-04-858Z-f23f5fbe-04e5-48d4-8868-c5657a095616`).
  Targeted sensitivity tests passed 11/11, zero skipped, exit 0 (run
  `2026-10-10T07-09-50-130Z-b3659a57-ee17-4d0a-b386-51de8b8814e6`).
  `dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true`
  passed with zero warnings/errors, exit 0 (run
  `2026-10-10T07-14-17-974Z-484df428-10d7-47cf-b1d6-499aab2e540c`).
  `bash scripts/check-architecture.sh` passed, exit 0 (run
  `2026-10-10T07-11-58-673Z-e10d3107-96d2-4e51-aa37-b3cc4f40a44b`).
* Evidence: shared integration assertions reject a count of one in copies of
  five actual native denial results and execution markers in either stream for
  three actual startup failures. Baselines must pass before mutation. No
  runtime bypass or mock engine was introduced; post-tool denial still means
  execution happened and the result was withheld.
* Runtime/cleanup: native initialization and offline image integration passed
  in the suite. Service startup path unchanged; separate startup not applicable
  to test-only changes. Existing cleanup removes owned containers.
  No long-lived service or temporary source file created. Keep local ignored
  reports, rubric and Docker caches; unrelated processes untouched.
* Publication: the F009 implementation and evidence are published. PR #29
  tracks the branch; review checks should be assessed on the latest PR head.
* Blockers: none for issue #2. The default NuGet source's TLS restriction
  remains environment-specific; verification succeeded with the documented
  approved mirror and unchanged locked hashes.
* Decisions: no new architectural decision; assertion mutation avoids adding
  unsafe bypass behavior to the spike.
* Next step: review and merge PR #29 when its required checks and approvals
  are satisfied.
* Final handoff validation passed, exit 0 (run
  `2026-10-10T07-16-07-859Z-7f4347a9-5eaf-4192-8ba8-97fad01d578d`):
  four Markdown files, 34 links/anchors, unique handoffs, feature states,
  shared assertion mutations, completed reports, exact revision/origin,
  unchanged runtime/locks/images and no remaining owned test containers.
  Editor diagnostics found no errors. Clean-state checklist complete for
  handoff with evaluation and publication pending; only evidence notes followed.

## Last session

* Date: 2026-10-10
* Accomplished: repaired the fresh evaluator FAIL for F004. The controller now
  removes shell access, denies direct URL access and Git metadata writes,
  enumerates and disables configured MCP servers, disables built-in MCP
  servers, and fails closed if MCP discovery fails.
* Scope: only F004 changed. F005's full scenario matrix was not started.
* Files modified: `scripts/maker-checker-loop.mjs`,
  `scripts/maker-checker-loop.test.mjs`,
  `scripts/maker-checker-safety.mjs`,
  `scripts/maker-checker-safety.test.mjs`, `docs/decisions.md`, this progress
  log, issue #30's retained progress log, and its ignored feature checklist.
* Failed evaluation: fresh evaluation scored average 3.4, minimum 2. It found
  the direct-command blacklist bypassable through alternate Git forms,
  `gh api`, HTTP clients, and configured non-built-in MCP servers.
* Baseline: exact safety tests passed 8/8, exit 0, run
  `2026-10-10T18-27-42-550Z-237b5f01-377a-4ab3-9bcf-7d629b8c9b83`.
  Controller regressions passed 12/12, exit 0, run
  `2026-10-10T18-27-42-550Z-57945e47-cf7b-4fd7-a9fa-bd882daa9d06`.
  Architecture passed, exit 0, run
  `2026-10-10T18-27-42-542Z-1acbc1d7-78ed-4621-8b01-03228eafd694`.
* Verification: final exact F004 safety tests passed 11/11, exit 0, run
  `2026-10-10T18-35-35-333Z-bbf0aa8c-edfc-4428-8d5a-acab02351a2e`.
  Controller and loop-state regressions passed 12/12, exit 0, run
  `2026-10-10T18-30-53-013Z-f81428dc-dca0-4ba1-a093-d753381bd27a`.
  Final architecture passed after the handoff updates, exit 0, run
  `2026-10-10T18-34-04-404Z-6a565960-0590-49fe-a6ae-8f91375ff66c`.
  Negative tests confirmed no local HEAD or ref change, remote ref change,
  merge state, or simulated pull-request mutation. Only the final architecture
  evidence reference changed afterward.
* Second failed evaluation: average 4.0, minimum 2. The evaluator found that
  MCP inventory parsing omitted the CLI's `(http)` protocol and did not reject
  unknown listing formats.
* Final parser repair: exact safety tests passed 12/12, exit 0, run
  `2026-10-10T18-52-31-585Z-014e8190-abda-4d24-96b7-633f77fb8a6d`.
  Architecture passed, exit 0, run
  `2026-10-10T18-52-30-189Z-886ef0a0-4b7a-4478-810b-8db383964148`.
  The parser now recognizes `(http)` and rejects unrecognized inventory lines.
* Reviewed revision and tree: commit
  `0fdcdcadf9994ed3cba03f703ecffe0cde7e345e` plus the uncommitted F004 files
  listed above. No unrelated pre-existing changes were present.
* Startup: not applicable. F004 changes finite local scripts and does not
  affect a service startup path.
* Cleanup: no live Copilot session or long-lived process was started. Node
  fixtures removed their temporary repositories and bare remotes. Named help,
  search, and diff captures in the system temporary directory were removed.
  Ignored verification reports were intentionally retained.
* Final evaluation: F004 passed with average and minimum 5.0 and no required
  fixes. Evaluator safety tests passed 12/12, exit 0, run
  `2026-10-10T18-56-03-418Z-b560b66b-db3c-458d-a3b6-d5d0ba62df50`;
  evaluator architecture passed, exit 0, run
  `2026-10-10T18-56-03-413Z-e486b866-4164-4562-8e6c-8ac5e1809d5c`.
* Final post-verdict checks: safety tests passed 12/12, exit 0, run
  `2026-10-10T19-36-43-923Z-9a659e65-9327-4880-b599-64829a21ee77`;
  architecture passed, exit 0, run
  `2026-10-10T19-36-43-921Z-74ba3c44-81c3-4b4d-9810-77d5c76c6bb6`.
* F004 was committed with sign-off as
  `e36bde0ad1ce16a4a20e038fa5270208a01081c3`. No push was performed.
* F005 started with user agreement to add only missing outcome-matrix tests.
  Existing tests already cover PASS, FAIL and retry, blocked work, exhausted
  limits, no progress, and stale checker results. The focused addition covers
  interruption and resume without repeating the completed maker round.
* F005 passed fresh evaluation with average and minimum 5.0 and no required
  fixes. Final outcome-matrix tests passed 13/13, exit 0, run
  `2026-10-10T22-21-47-831Z-b101da44-5b4d-4475-b264-137691629dc8`;
  architecture passed, exit 0, run
  `2026-10-10T22-21-50-614Z-389b6966-c3de-4ced-bfb3-9380a7dfaab3`.
* F005 was committed with sign-off as
  `11dd6bb5ccf65ff8a26d62807b7c8148eb41d6cf`. No push was performed.
* Blockers and next action: none for F005. Agree on F006.
* Result: no commit, push, pull-request operation, branch change, or merge was
  performed in the working repository.

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

## Completed milestone

### Native ACS Linux spike (Issue #2, F001-F009 pass)

* F001-F002 establish a runnable .NET 10 Linux x64 container spike and a
  repeatable verification command.
* F003-F004 prove native ACS/OPA allow and deny outcomes, stable repeated
  decisions, and a transformed ticket target.
* F005-F006 exercise dependency and policy failures, pre/post-tool checks, and
  withholding a result when post-tool evaluation denies an already-run read.
* F007 checks the packaged runtime works without network access or mounts.
* F008 documents verified versions, Linux paths, artifact provenance and
  preview limitations.
* F009 proves execution-safety assertions fail when copied native evidence is
  mutated. Its full tests passed 43/43 and independent evaluation passed
  (average 5.0, minimum 5).
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
