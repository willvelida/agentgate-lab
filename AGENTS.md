---
title: Agent Instructions
description: Guidance for coding agents working in AgentGate Lab
ms.date: 2026-10-09
---

## Hard rules

1. Authentication, ACS enforcement, model access, task grants, human approval,
   and ticket operations are not implemented. Do not treat the starter shell as
   a security boundary or claim these features exist.
2. Design documents describe planned behavior. Confirm what is implemented in
   code and tests before describing a feature as done.
3. Never commit secrets, credentials, or generated output from
   `src/Portal/wwwroot`.
4. Preserve dependency lockfiles. Change them only for intentional dependency
   updates, then verify locked restore or install succeeds.
5. Add or update tests when behavior changes.
6. Keep changes focused and follow the conventions of the affected project.
7. Record only verified results in progress logs and feature lists.
8. Update [`docs/progress.md`](./docs/progress.md) in the same pull request
   when a change starts, completes, or blocks milestone work.
9. Replace the "Last session" section of `docs/progress.md` before ending a
   session.
10. Work on one feature at a time. Pick only a feature whose `dependsOn`
    entries all `pass`, verify it, record evidence, and commit it before
    starting the next one.
11. Mark a feature `pass` only after its `verification` command succeeds and
    the evidence is recorded. Never move a feature from `pass` back to an
    earlier state.
12. Stay within the active feature's scope. If a small fix outside that scope
    is needed to get past a blocker, make only that fix and record it in the
    progress log.
13. Never weaken, skip, or quietly change a verification command or test to
    make it pass. If one is wrong, mark the feature `blocked` and ask the user.
14. Mark a feature `pass` only after the `feature-evaluator` skill gives it a
    PASS in a fresh session and records the verdict in the slug's
    `agent-progress.md`. The verdict must cover the changes being marked
    `pass`; request a new evaluation if those changes are modified.
15. Capture verification commands through the runner in
    [verification guidance](./docs/verification.md). Keep raw reports local
    and commit only sanitized summaries with run IDs, results, and the
    reviewed revision. An incomplete run is not a successful check.

## Repository context

AgentGate Lab is a .NET and React foundation for an Entra Agent ID and ACS
authorization gateway. The Portal, Gateway, Agent Worker, and React client are
separate projects under `src/`.

## Session startup (clock-in)

Follow these steps in order at the start of every session:

1. Read this file.
2. Read [`docs/architecture.md`](./docs/architecture.md) to learn where code
   belongs.
3. Read [`docs/product.md`](./docs/product.md) to learn what is being built.
4. Read [`docs/progress.md`](./docs/progress.md), starting with "Current
   State", "Known Issues", and "Last session".
5. Read [`docs/decisions.md`](./docs/decisions.md) so you do not reopen
   settled decisions.
6. If you are working from an issue, read its
   `docs/features/<slug>/features_list.json` and `agent-progress.md`.
7. Run `bash init.sh`, or the focused checks below, to confirm the repository
   is healthy before you change anything.
8. Continue from the "Next steps" in "Last session".

## Session end (clock-out)

Follow these steps in order before you stop working:

1. Run the relevant checks with evidence capture. For runtime changes,
   also verify the affected service's startup path. Record failed or
   unavailable checks explicitly; do not declare a healthy handoff.
2. Stop only processes this session owns and remove only its named temporary
   artifacts. Preserve unrelated changes and retained local evidence.
3. Update "Current State" and "Known Issues" in
   [`docs/progress.md`](./docs/progress.md).
4. Replace "Last session" with what you accomplished, what remains, decisions,
   files modified, blockers, next steps, verification run IDs and results,
   the reviewed commit and dirty state, and process or artifact cleanup.
5. Record any new design decision in
   [`docs/decisions.md`](./docs/decisions.md).
6. Work through [`docs/clean-state-checklist.md`](./docs/clean-state-checklist.md).
7. Commit with `git commit -s` when authorized, then inspect `git status --short`.
   Report the resulting commit and any remaining changes. When publishing,
   record CI results for that exact head; pending CI is not green CI.

Start clock-out when you have used about 60% of your context window, so the
handoff is written while you still have room to do it well.

## Definition of Done

A change is done only when all of these are true:

* The relevant checks in "Build and test" pass.
* Tests cover any behavior that changed.
* Feature list entries are marked `pass` only with recorded verification
  evidence and a fresh-session evaluator PASS for the reviewed changes.
* Code stays in the project that owns it, as described in
  [`docs/architecture.md`](./docs/architecture.md), and
  `bash scripts/check-architecture.sh` passes.
* Runtime evidence is recorded when a change affects how a service runs. See
  "Runtime evidence".
* Affected docs and [`docs/progress.md`](./docs/progress.md) are updated,
  including "Last session".
* The clean-state checklist is complete, with verification evidence,
  applicable startup checks, and owned-process and artifact cleanup recorded.

## Read when

* [`README.md`](./README.md): read when you need the repository layout,
  prerequisites, or commands to run each project.
* [`docs/architecture.md`](./docs/architecture.md): read when you need to know
  how the projects fit together and where a change belongs.
* [`docs/product.md`](./docs/product.md): read when you need the product goal,
  planned features, constraints, or non-goals.
* [`docs/progress.md`](./docs/progress.md): read at the start of a session to
  learn what is built, in progress, and planned.
* [`docs/decisions.md`](./docs/decisions.md): read when you need to know why
  the repository or harness is shaped a certain way, or before changing it.
* [`docs/clean-state-checklist.md`](./docs/clean-state-checklist.md): read
  before ending a session or opening a pull request.
* [`docs/research-and-build-plan.md`](./docs/research-and-build-plan.md): read
  when you need scope, architecture research, or milestone details.
* [`docs/ui-and-workflow-design.md`](./docs/ui-and-workflow-design.md): read
  when changing the portal or task, approval, and history workflows.
* [`docs/threat-model.md`](./docs/threat-model.md): read when touching trust
  boundaries, identity, authorization, or tool execution.
* [`docs/acceptance-tests.md`](./docs/acceptance-tests.md): read when adding
  acceptance or attack tests.
* [`docs/demo.md`](./docs/demo.md): read when changing the demo flow.
* `docs/features/<slug>/features_list.json` and `agent-progress.md`: read when
  working from a GitHub issue that has a generated feature list. Treat the
  feature list as the acceptance checklist and the progress log as evidence.
* [Feature evaluator skill](./.github/skills/feature-evaluator/SKILL.md): read
  after a feature's verification succeeds, before marking it `pass`. Run the
  evaluation in a fresh session, not the session that built the feature.
* [Verification guidance](./docs/verification.md): read before running checks
  or writing the verification and cleanup evidence for a handoff.

## Runtime evidence

Passing tests is not enough when a change affects how a service starts or
responds. Run the affected service and record what it did.

| Service | Run command | Evidence |
| --- | --- | --- |
| Portal | `dotnet run --project src/Portal/Portal.csproj` | `curl http://localhost:5031/health` returns `{"status":"ok","service":"portal"}` |
| Gateway | `dotnet run --project src/Gateway/Gateway.csproj` | `curl http://localhost:5077/health` returns `{"status":"ok","service":"gateway"}` |
| AgentWorker | `dotnet run --project src/AgentWorker/AgentWorker.csproj` | Startup log lines show the worker started without errors |

Record the command, the output, and the date in the slug's `agent-progress.md`
or in [`docs/progress.md`](./docs/progress.md). Record the PID or tool session
that owns the service, then stop only that process when done and record the
result. Do not run a long-lived service through the finite-command runner.

## Build and test

Run commands from the repository root. The documented baseline is .NET SDK
10.0.101 or later within the .NET 10 feature band, Node.js 24, and npm 11.

Run `bash init.sh` to restore locked dependencies and execute the full CI build,
test, and publish sequence locally. Each step writes its own local evidence
report. For a focused change, run only the relevant commands below through
the Bash or PowerShell wrapper in [verification guidance](./docs/verification.md).

Restore dependencies when needed:

```sh
dotnet restore AgentGateLab.sln --locked-mode
npm ci --prefix src/Client
```

Validate the React client:

```sh
npm run typecheck --prefix src/Client
npm test --prefix src/Client
npm run build --prefix src/Client
```

Build and test the .NET solution without rebuilding the client:

```sh
dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true
dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true
```

Check project boundaries:

```sh
bash scripts/check-architecture.sh
```

Run the checks that cover your change. Before submitting, confirm the
corresponding CI checks in `.github/workflows/build.yml` pass. The
`.github/workflows/docs-check.yml` workflow fails on broken relative Markdown
links and warns when `src/` or `tests/` change without a `docs/progress.md`
update.
