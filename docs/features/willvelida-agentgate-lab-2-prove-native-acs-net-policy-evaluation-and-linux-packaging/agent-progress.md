---
title: Issue #2 feature progress
description: Implementation and verification evidence for native ACS .NET policy evaluation and Linux packaging.
ms.date: 2026-10-09
---

## Issue

* Repository: `willvelida/agentgate-lab`
* Number: 2
* Title: Prove native ACS .NET policy evaluation and Linux packaging
* URL: https://github.com/willvelida/agentgate-lab/issues/2
* Feature list: [features_list.json](./features_list.json)

## Feature evidence

| ID | Description | Status | Verification | Evidence | Tested date |
|----|-------------|--------|--------------|----------|-------------|
| F001 | A small runnable .NET 10 spike targets Linux x64 and runs from Windows through a Linux container. | pass | `docker compose run --build --rm acs-spike` | Container smoke passed, run `2026-10-09T06-51-18-652Z-7e0c3b03-dc58-4383-a763-3ba8c317fa83`, exit 0; output confirmed .NET 10.0.12 on Linux x64. Independent evaluator reran the container command (run `2026-10-09T06-59-44-568Z-3236cc4d-d87f-4b36-8102-4bfb2537f527`) and architecture check (run `2026-10-09T06-59-44-630Z-ccc33071-c1bd-4fca-8cf9-a362d06e372f`), both passed, exit 0. Evaluator PASS, average 4.6, minimum 4. Solution build passed with 0 warnings/errors and all 13 tests passed. Reviewed commit `5bddd53f243d435e8c323adfbe8f4e26abdfe9c2`; implementation was uncommitted during verification. | 2026-10-09 |
| F002 | A documented command runs the containerized spike and its automated tests from a fresh clone after issue #1. | pass | `bash scripts/verify-acs-spike.sh` | Fresh-clone command restores the locked .NET and frontend dependencies, builds Portal assets, runs the Linux x64 container smoke, and passes all 13 solution tests. Independent evaluator PASS, average 5.0, minimum 5. | 2026-10-09 |
| F003 | A permitted synthetic ticket-read fixture returns allow; an unpermitted or unknown-tool fixture returns deny and executes no guarded tool delegate. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |
| F004 | Identical manifest and snapshot inputs produce the same decision, stable reason, action identity, and transformed target, excluding telemetry timings. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |
| F005 | Malformed manifests, missing required snapshot paths, missing native payload, unavailable OPA, and policy evaluation errors all block startup or explicitly deny execution. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |
| F006 | Pre-tool and post-tool checks are both exercised; successful evaluation never silently substitutes a custom or mock engine. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |
| F007 | The final image contains the required runtime artifacts and can evaluate fixtures without downloading dependencies at runtime. | not-started | TBD | Not yet implemented or verified | Not tested |
| F008 | Versions, Linux architecture, native and OPA packaging, source-build steps if used, and preview limitations are documented. | not-started | TBD | Not yet implemented or verified | Not tested |
| F009 | Tests fail when a guarded operation executes after a deny or dependency failure. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |

## Verification evidence

F001 runs used the PowerShell verification wrapper, reviewed commit
`5bddd53f243d435e8c323adfbe8f4e26abdfe9c2`, and included uncommitted changes.
F002 baseline runs use the PowerShell verification wrapper and reviewed commit
`bb2006ca1697ef377c4a36f531fb69e9ac1b84cc`, before F002 changes.

| Command | Result | Run ID |
|---------|--------|--------|
| `docker compose run --build --rm acs-spike` | Passed, exit 0; .NET 10.0.12 on Linux x64 | `2026-10-09T06-51-18-652Z-7e0c3b03-dc58-4383-a763-3ba8c317fa83` |
| `bash scripts/check-architecture.sh` | Passed, exit 0 | `2026-10-09T06-52-21-476Z-3a90d43d-234c-4409-a175-0dd6555035f2` |
| `dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Passed, exit 0; 0 warnings and errors | `2026-10-09T06-52-21-460Z-61be0d6b-3c7a-4a43-bc64-b42373448c9c` |
| `dotnet test AgentGateLab.sln --no-build --no-restore --property:SkipClientBuild=true` | Passed, exit 0; 13 tests | `2026-10-09T06-52-41-919Z-412f2bbd-e5dd-4348-a727-bb8278a0011a` |
| F002 baseline: `bash scripts/check-architecture.sh` | Passed, exit 0 | `2026-10-09T07-27-10-863Z-02b99954-2948-49c6-a3b5-ff529700f672` |
| F002 baseline: `node --test scripts/run-verification.test.mjs scripts/check-architecture.test.mjs` | Passed, exit 0; 14 tests | `2026-10-09T07-27-36-200Z-9ad01455-59da-4fab-8cce-19304c41af9f` |
| F002 baseline: `dotnet restore AgentGateLab.sln --locked-mode` | Passed, exit 0 | `2026-10-09T07-27-36-134Z-5d949738-86d0-4267-8a93-7c420db1b419` |
| F002 baseline: `dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Passed, exit 0; 0 warnings and errors | `2026-10-09T07-28-37-986Z-7a48ce1e-915c-4f0b-b93e-5801549bd133` |
| F002 baseline: `dotnet test AgentGateLab.sln --no-build --no-restore --property:SkipClientBuild=true` | Passed, exit 0; 13 tests | `2026-10-09T07-28-57-893Z-ce17307c-a0ae-4f75-9339-f548eea7f6f4` |
| Initial F002 Bash syntax check | Failed, exit 1; CRLF line endings were rejected | `2026-10-09T07-32-11-275Z-caba3306-f157-4f71-8420-48e35ec99c26` |
| Initial F002 command | Failed, exit 1; CRLF line endings were rejected | `2026-10-09T07-32-11-258Z-6590b95f-e217-41b9-b5bf-147c3612b4ee` |
| F002 architecture check | Passed, exit 0 | `2026-10-09T07-32-11-286Z-62851f34-c0ed-4180-aad6-6ee278d9d583` |
| F002 Bash syntax check after LF normalization | Passed, exit 0 | `2026-10-09T07-32-53-155Z-26f7bd02-9e71-448c-9d78-db97c797db03` |
| F002 command before Windows CLI compatibility fix | Failed, exit 1; WSL Bash found `dotnet.exe` but not `dotnet` | `2026-10-09T07-32-53-228Z-9cc6fa17-0cec-4ebe-a946-261b56b08087` |
| F002 command in existing checkout | Passed, exit 0; container smoke passed and 13 tests passed | `2026-10-09T07-34-17-339Z-079f5abf-4dec-4ccb-83b1-9eb22f2c77fb` |
| F002 architecture check after edits | Passed, exit 0 | `2026-10-09T07-34-17-425Z-8f643fa5-29fb-4088-8cd3-213b26c02f08` |
| F002 fresh-clone command | Failed, exit 1; restore and container smoke passed, tests failed 1/13 because the React assets were absent | `2026-10-09T07-36-05-302Z-36fdee11-2d07-4d46-9407-898af620edfb` |
| F002 fresh-clone command with frontend restore/build | Passed, exit 0; locked restores, frontend build, Linux x64 smoke, and all 13 tests passed | `2026-10-09T11-35-18-553Z-d449c9df-515e-4250-925f-347494cddad8` |

For F001, documentation-only updates clarified the scaffold status after its
implementation checks. The F002 baseline runs above precede F002 changes.
The initial fresh-clone failure identified a missing frontend build step; the
updated script builds the assets before tests.

## F002 implementation notes

* Date: 2026-10-09
* Accomplished: implemented F002's documented fresh-clone command,
  `bash scripts/verify-acs-spike.sh`, which restores locked .NET and frontend
  dependencies, builds Portal assets, runs the Linux x64 container smoke,
  and runs the solution tests.
* Verification: the exact command passed from a fresh local clone, including
  all 13 .NET tests (run
  `2026-10-09T11-35-18-553Z-d449c9df-515e-4250-925f-347494cddad8`).
  Final architecture check passed (run
  `2026-10-09T11-41-08-523Z-b9e4f43c-5458-4f1e-b57e-bfcebae1d558`) and final
  Bash syntax check passed (run
  `2026-10-09T11-41-08-521Z-156e2a22-f578-4095-87a2-dfb5e8bdd56e`).
  Reviewed commit `bb2006ca1697ef377c4a36f531fb69e9ac1b84cc`; the successful
  check included the F002 working-tree changes.
* Failed attempts: initial checks exposed CRLF line endings, WSL's
  `dotnet.exe`/`npm.cmd` command names, and the Portal tests' dependency on
  generated React assets. These are recorded above; later successful runs
  used LF, native Windows tool dispatch from Bash, and a frontend build.
* Cleanup: the temporary fresh clone and its Docker image/network were
  removed. Verification reports are preserved under ignored
  `.local/verification/`; ShellCheck is unavailable.
* Blockers: none. Independent evaluation recorded PASS (average 5.0, minimum
  5). The ignored local feature checklist records F002 as pass. No commit or
  push has been made yet.
* Next steps: commit and push the F002 changes, then begin F003.

## Last session

* Date: 2026-10-09
* Accomplished: implemented F002's fresh-clone workflow and README guidance on
  `issue-2-native-acs-runtime`. F001 is already evaluator-PASS and committed as
  `bb2006ca1697ef377c4a36f531fb69e9ac1b84cc`. F002 received independent
  evaluator PASS (average 5.0, minimum 5); the local feature checklist is
  marked pass.
* Verification: `bash scripts/verify-acs-spike.sh` passed in a fresh clone
  (run `2026-10-09T11-35-18-553Z-d449c9df-515e-4250-925f-347494cddad8`,
  exit 0, all 13 solution tests); final architecture check passed (run
  `2026-10-09T11-41-08-523Z-b9e4f43c-5458-4f1e-b57e-bfcebae1d558`, exit 0);
  final Bash syntax check passed (run
  `2026-10-09T11-41-08-521Z-156e2a22-f578-4095-87a2-dfb5e8bdd56e`, exit 0).
  Evaluator reran the workflow successfully with all tests passing (run
  `2026-10-09T11-44-42-106Z-d5ae2373-3e5c-4a0f-9cee-b34b21d74b02`) and the
  architecture check passed (run
  `2026-10-09T11-44-42-097Z-8af40cd0-ccac-44a5-a503-ee6ec3def56c`).
  Checks reviewed commit `bb2006ca1697ef377c4a36f531fb69e9ac1b84cc` with
  uncommitted F002 changes. Final documentation/checklist edits followed the
  fresh-clone run; no implementation code changed afterward.
* Cleanup: the temporary clone no longer exists, no Compose containers remain,
  and verification reports are retained under ignored `.local/verification/`.
  ShellCheck is unavailable.
* Publication verification: `bash scripts/verify-acs-spike.sh` passed,
  exit 0, with Linux x64 startup and all 13 tests (run
  `2026-10-09T19-02-57-945Z-772d9287-b679-44e5-8c33-f9cc7a014b95`).
  Architecture check passed, exit 0 (run
  `2026-10-09T19-02-57-732Z-28a4d028-6fa8-424b-90f1-327853e284c1`).
  Both reviewed `bb2006ca1697ef377c4a36f531fb69e9ac1b84cc` with the pending
  F002 changes. Only evidence documentation changed after these checks.
* Blockers: none. F002 passed independent evaluation. The intended F002
  changes are ready for the authorized signed commit and push; CI for the
  resulting head is not yet verified.
* Next steps: publish F002, then implement F003. Stop before independent
  evaluation of F003 rather than marking it pass in this implementation session.

* 2026-10-09: F001 evaluator verdict PASS (avg 4.6, min 4). See evaluator-rubric.md.
* 2026-10-09: F002 evaluator verdict PASS (avg 5.0, min 5). See evaluator-rubric.md.
