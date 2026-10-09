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

1. Update "Current State" and "Known Issues" in
   [`docs/progress.md`](./docs/progress.md).
2. Replace "Last session" with what you accomplished, what remains, decisions,
   files modified, blockers, and next steps.
3. Record any new design decision in
   [`docs/decisions.md`](./docs/decisions.md).
4. Work through [`docs/clean-state-checklist.md`](./docs/clean-state-checklist.md).
5. Commit with `git commit -s`.

Start clock-out when you have used about 60% of your context window, so the
handoff is written while you still have room to do it well.

## Definition of Done

A change is done only when all of these are true:

* The relevant checks in "Build and test" pass.
* Tests cover any behavior that changed.
* Feature list entries are marked `pass` only with recorded evidence.
* Code stays in the project that owns it, as described in
  [`docs/architecture.md`](./docs/architecture.md).
* Affected docs and [`docs/progress.md`](./docs/progress.md) are updated,
  including "Last session".

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

## Build and test

Run commands from the repository root. The documented baseline is .NET SDK
10.0.101 or later within the .NET 10 feature band, Node.js 24, and npm 11.

Run `bash init.sh` to restore locked dependencies and execute the full CI build,
test, and publish sequence locally. For a focused change, run only the
relevant commands below.

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

Run the checks that cover your change. Before submitting, confirm the
corresponding CI checks in `.github/workflows/build.yml` pass. The
`.github/workflows/docs-check.yml` workflow fails on broken relative Markdown
links and warns when `src/` or `tests/` change without a `docs/progress.md`
update.
