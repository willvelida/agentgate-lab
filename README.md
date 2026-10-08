---
title: AgentGate Lab
description: A credential-free repository foundation for an Entra Agent ID and ACS authorization gateway.
ms.date: 2026-10-08
---

## Overview

AgentGate Lab is a .NET and React foundation for an Entra Agent ID and ACS
authorization gateway with human approval and auditable tool execution.

Issue #1 establishes the reproducible repository baseline. The Portal, private
Gateway, Agent Worker, and React client are separate projects. The Portal
publishes the React assets from the same origin.

> [!IMPORTANT]
> Authentication, ACS enforcement, model access, task grants, human approval,
> and ticket operations are not implemented yet. The starter shell does not
> represent a security boundary.

## Repository layout

```text
src/
  AgentWorker/       Future agent job host
  Client/            React + TypeScript + Vite frontend
  Gateway/           Future private authorization gateway
  Portal/            ASP.NET Core BFF and published frontend host
tests/
  Portal.Tests/      Portal host smoke tests
docs/                Research, design, threat model, and acceptance criteria
```

## Prerequisites

* .NET SDK 10.0.101 or a later .NET 10 feature band
* Node.js 24 LTS
* npm 11

The .NET SDK baseline is pinned in [`global.json`](./global.json), which allows
later .NET 10 feature bands for compatibility with the dev container image.
Frontend dependencies are locked in
[`src/Client/package-lock.json`](./src/Client/package-lock.json).
Each .NET project has a `packages.lock.json` file for its direct and transitive
dependencies. Keep these lockfiles in source control.
Frontend downloads use the public npm registry; no registry login is required.

## Development container

Open the repository in VS Code and choose **Reopen in Container**. The
single dev container provides the .NET 10 SDK and Node.js 24, restores the
locked .NET dependencies, and installs the frontend dependencies at creation.
The Portal uses port 5031, the Gateway uses port 5077, and Vite uses port
5173.

## Restore and build

Run these commands from the repository root:

```powershell
dotnet restore .\AgentGateLab.sln --locked-mode
Push-Location .\src\Client
npm ci
npm run typecheck
npm test
npm run build
Pop-Location
dotnet build .\AgentGateLab.sln --no-restore --property:SkipClientBuild=true
```

`npm run build` writes the production frontend to
`src/Portal/wwwroot`. That folder is generated and ignored by Git. The Portal
project also builds the client automatically when `SkipClientBuild` is not set,
so `dotnet build .\AgentGateLab.sln` works from a fresh clone after Node and
npm are available.

## Run locally

Start the Portal:

```powershell
dotnet run --project .\src\Portal\Portal.csproj
```

Then open the URL printed by ASP.NET Core. The `/health` endpoint reports the
Portal foundation status, and a route such as `/tickets/TICKET-001` is served
by the React shell. Unknown `/bff`, `/auth`, and `/api` routes return a JSON
404 instead of being swallowed by the SPA fallback.

The Gateway can be started independently:

```powershell
dotnet run --project .\src\Gateway\Gateway.csproj
```

The Agent Worker is a separate host and currently waits without executing
agent jobs:

```powershell
dotnet run --project .\src\AgentWorker\AgentWorker.csproj
```

## Test and publish

Run the .NET smoke tests:

```powershell
dotnet test .\AgentGateLab.sln --no-restore --property:SkipClientBuild=true
```

Publish the Portal after building the client:

```powershell
dotnet publish .\src\Portal\Portal.csproj --configuration Release --no-restore --property:SkipClientBuild=true
```

The publish output contains the compiled React assets and supports the same
deep-link and reserved-route behavior as the development host.

## Continuous integration

The [`build.yml`](./.github/workflows/build.yml) workflow runs on pull
requests and pushes to `main`. It restores, type-checks, tests, and builds the
React client, then builds, tests, and publishes the .NET solution without
Azure login or cloud credentials.

## Updating dependencies

Locked restore fails when a .NET dependency change does not match its lockfile.
After an intentional package change, update and verify the lockfiles:

```powershell
dotnet restore .\AgentGateLab.sln --force-evaluate
dotnet restore .\AgentGateLab.sln --locked-mode
```

Use `npm install` in `src/Client` to update frontend dependencies and their
lockfile, then verify with `npm ci`. Review and commit the manifest and lockfile
changes together. CI uses locked .NET restore and `npm ci` to prevent
unintentional dependency changes.

## Design references

* [Research and build plan](./docs/research-and-build-plan.md)
* [UI and workflow design](./docs/ui-and-workflow-design.md)
* [Threat model](./docs/threat-model.md)
* [Acceptance tests](./docs/acceptance-tests.md)
* [Five-minute gateway demo](./docs/demo.md)
