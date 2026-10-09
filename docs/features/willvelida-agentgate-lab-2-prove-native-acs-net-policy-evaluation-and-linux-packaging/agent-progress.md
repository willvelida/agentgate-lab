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
| F002 | A documented command runs the containerized spike and its automated tests from a fresh clone after issue #1. | not-started | TBD | Not yet implemented or verified | Not tested |
| F003 | A permitted synthetic ticket-read fixture returns allow; an unpermitted or unknown-tool fixture returns deny and executes no guarded tool delegate. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |
| F004 | Identical manifest and snapshot inputs produce the same decision, stable reason, action identity, and transformed target, excluding telemetry timings. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |
| F005 | Malformed manifests, missing required snapshot paths, missing native payload, unavailable OPA, and policy evaluation errors all block startup or explicitly deny execution. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |
| F006 | Pre-tool and post-tool checks are both exercised; successful evaluation never silently substitutes a custom or mock engine. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |
| F007 | The final image contains the required runtime artifacts and can evaluate fixtures without downloading dependencies at runtime. | not-started | TBD | Not yet implemented or verified | Not tested |
| F008 | Versions, Linux architecture, native and OPA packaging, source-build steps if used, and preview limitations are documented. | not-started | TBD | Not yet implemented or verified | Not tested |
| F009 | Tests fail when a guarded operation executes after a deny or dependency failure. | not-started | `dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Not yet implemented or verified | Not tested |

## Verification evidence

All captured runs used the PowerShell verification wrapper, reviewed commit
`5bddd53f243d435e8c323adfbe8f4e26abdfe9c2`, and included uncommitted changes.

| Command | Result | Run ID |
|---------|--------|--------|
| `docker compose run --build --rm acs-spike` | Passed, exit 0; .NET 10.0.12 on Linux x64 | `2026-10-09T06-51-18-652Z-7e0c3b03-dc58-4383-a763-3ba8c317fa83` |
| `bash scripts/check-architecture.sh` | Passed, exit 0 | `2026-10-09T06-52-21-476Z-3a90d43d-234c-4409-a175-0dd6555035f2` |
| `dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true` | Passed, exit 0; 0 warnings and errors | `2026-10-09T06-52-21-460Z-61be0d6b-3c7a-4a43-bc64-b42373448c9c` |
| `dotnet test AgentGateLab.sln --no-build --no-restore --property:SkipClientBuild=true` | Passed, exit 0; 13 tests | `2026-10-09T06-52-41-919Z-412f2bbd-e5dd-4348-a727-bb8278a0011a` |

After these runs, documentation-only updates clarified the scaffold status in
the README, architecture page, and repository progress log. No implementation
code changed after verification.

## Last session

* Date: 2026-10-09
* Accomplished: implemented the F001 Linux x64 .NET 10 container spike and documented its run command.
* Startup: `docker compose run --build --rm acs-spike` exited 0 and reported .NET 10.0.12 on Linux x64. Native ACS policy evaluation remains unimplemented.
* Cleanup: the container was removed by `--rm`; `docker compose down --rmi local` removed the project network and local image. Verification reports remain in ignored `.local/verification/`.
* Blockers: none for F001. The full `bash init.sh` entry point could not start because Git Bash could not resolve Node.js; focused baseline checks passed through the PowerShell wrapper.
* Next steps: start F002 in a separate feature workflow. Its verification command is still TBD and must be agreed before F002 becomes active.

* 2026-10-09: F001 evaluator verdict PASS (avg 4.6, min 4). See evaluator-rubric.md.
