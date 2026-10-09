---
title: Agent Instructions
description: Guidance for coding agents working in AgentGate Lab
ms.date: 2026-10-09
---

## Repository context

AgentGate Lab is a .NET and React foundation for an Entra Agent ID and ACS
authorization gateway. The main projects are the Portal, Gateway, Agent Worker,
and React client under `src/`. Read `README.md` and relevant design documents
before changing behavior.

Authentication, ACS enforcement, model access, task grants, human approval, and
ticket operations are not implemented. Do not treat the starter shell as a
security boundary or imply that these features are available.

## Change guidelines

* Keep changes focused and follow the conventions of the affected project.
* Add or update tests when behavior changes.
* Preserve dependency lockfiles. Update them only when intentionally changing
  dependencies, then verify locked restore or install succeeds.
* Check `.github/workflows/` for the CI checks relevant to your changes.
* Do not commit generated frontend output from `src/Portal/wwwroot`.

## Build and test

Run commands from the repository root. The documented baseline is .NET SDK
10.0.101 or later within the .NET 10 feature band, Node.js 24, and npm 11.

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
corresponding CI checks in `.github/workflows/build.yml` pass.
