---
title: Verification Evidence
description: Capture local command results without committing raw output.
ms.date: 2026-10-09
---

## Run a focused check

Run one finite, noninteractive command through the verification wrapper.
Node.js and Git must be on PATH. Windows also requires PowerShell 7.
The PowerShell wrapper requires PowerShell 7 on any platform.

From Bash:

```bash
bash scripts/run-verification.sh --label "Client tests" -- npm test --prefix src/Client
```

From PowerShell:

```powershell
.\scripts\Invoke-Verification.ps1 -Label 'Client tests' -Command npm -CommandArguments @('test', '--prefix', 'src/Client')
```

The [Bash wrapper](../scripts/run-verification.sh) and
[PowerShell wrapper](../scripts/Invoke-Verification.ps1) use the same
[Node.js runner](../scripts/run-verification.mjs). Commands run from the
repository root even if the wrapper is invoked from another directory.
Arguments are passed separately, not evaluated as a shell expression.
Windows uses PowerShell to launch native commands and command shims such as
npm. Standard input is disabled; do not use the runner for interactive tools
or background services.

[init.sh](../init.sh) uses the Bash wrapper for each initialization step,
including the runner's tests. It stops on the first failed step. A complete
initialization requires every step to succeed; one successful report does
not prove the whole sequence passed. The CI build also runs the runner's
tests, without uploading local reports or raw output as artifacts.

## Read the evidence

Each invocation prints a report path under
`.local/verification/<run-id>/`. Existing ignore rules cover this folder.
Each run has its own directory and never overwrites another run.

* `report.json` records the schema version, run ID, label, command and argument
  array, working directory, start and finish times, duration in milliseconds,
  status, exit code, signal, and output file names.
* `before` and `after` record the commit, branch, and Git porcelain
  working-tree status. A dirty tree means the commit alone does not identify
  the exact code that was verified.
* `stdout.log` and `stderr.log` contain the command's raw output. The same
  output is displayed in the terminal. Their relative ordering across streams
  is not recorded.

The report starts with status `running`. A completed command with exit code 0
becomes `passed`; a nonzero code becomes `failed`. Signal termination becomes
`interrupted` when exposed by the process launcher. Evidence-capture or
launch failures become `error` and are reported explicitly. An abruptly
stopped runner may leave `running`; treat it as incomplete, never as PASS.

The wrapper preserves a nonzero command exit code. Capture failures and
interruptions without a positive exit code return 1. A `passed` report proves
only that the recorded command succeeded, not that a feature has earned an
evaluator PASS.

Windows may expose native exit codes as unsigned 32-bit values; Bash may
expose only their low eight bits. Use the report's recorded exit code when
comparing results, rather than assuming every failure returns 1.

## Keep raw output local

Raw output and command arguments can contain sensitive values. Do not pass
secrets on command lines, force-add evidence files, or publish these files as
CI artifacts. The runner does not redact output or export telemetry.

Commit a short, sanitized summary in the existing progress log instead.
Record the command, run ID, date, result and exit code, relevant observations,
and reviewed commit. Mention uncommitted changes when present. A local path
is a locator, not evidence available to someone in another clone.

## Leave a clean handoff

Use the [clean-state checklist](./clean-state-checklist.md) before stopping.
Include these details in the existing "Last session" handoff:

* Verification commands, run IDs, date, status and exit codes.
* Reviewed commit, uncommitted changes included, and any later changes not
  covered by those checks.
* Startup and health evidence for runtime changes, or "not applicable" for
  documentation-only changes.
* Processes started by this session, their PID or tool-session identifier,
  and the result of stopping them.
* Named temporary files removed, local evidence intentionally retained,
  and any unresolved cleanup.
* Remaining work, blockers, and the next action.
* Resulting commit and final working-tree state when a commit is authorized.
  Preserve and explain unrelated or intentional remaining changes.

Do not claim a healthy handoff if required checks failed or never completed.
Record a blocker so the next session knows what to repair. Do not roll back
unrelated work, kill processes by name, or automatically delete evidence.
When publishing, confirm CI for the exact pushed head and record that result
in the PR. Until confirmed, leave CI marked pending or unverified.

## Check the runner

Use Node's built-in test runner; no additional packages are required:

```bash
node --test scripts/run-verification.test.mjs
```

The tests exercise both wrappers, so Bash and PowerShell 7 must be available.
On Windows the Bash tests use Git Bash from the standard Program Files
installation. Tests use isolated, temporary Git repositories and remove only
their own fixtures.
