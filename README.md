---
title: AgentGate Lab
description: A credential-free repository foundation for an Entra Agent ID and ACS authorization gateway.
ms.date: 2026-10-10
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
  AcsSpike/          Linux x64 native ACS ticket-read fixtures
  Client/            React + TypeScript + Vite frontend
  Gateway/           Future private authorization gateway
  Portal/            ASP.NET Core BFF and published frontend host
tests/
  AcsSpike.Tests/    Native ACS container integration tests
  Portal.Tests/      Portal host smoke tests
docs/                Research, design, threat model, and acceptance criteria
```

## Prerequisites

* .NET SDK 10.0.101 or a later .NET 10 feature band
* Node.js 24 LTS, version 24.15.0 or later within Node 24
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

## Native ACS Linux spike

Build and run the .NET 10 spike from Windows using Docker Desktop with Linux
containers enabled:

```sh
docker compose run --build --rm acs-spike
```

The service is constrained to Linux x64 and exits with an error on a different
operating system or architecture. It validates the original manifest and Rego
fixtures with the pinned ACS validator, then uses `AgentControl.FromPath` and
`RunToolAsync` with the native runtime and bundled OPA dispatcher. No custom
runtime or dispatcher is supplied.

The JSON output reports three synthetic fixtures: a permitted `tickets.read`
allows and executes its delegate once; an unpermitted read and an unknown
`tickets.delete` deny and execute no delegate. The successful read also passes
the post-tool policy. These fixture facts are not real identity or task grants,
and this isolated spike does not protect the Gateway.

The `determinism` array repeats each fixture three times, reloading the same
manifest into a fresh native runtime each time with identical snapshot and
tool-call inputs. A fourth case normalizes `syn-001` to `SYN-001` through a
native Rego transform. Its guarded delegate receives the transformed arguments.
Each attempt reports native pre-tool and post-tool decision, reason, action
identity, transformed target, and whether the transform was applied. The tests
compare all these stable fields, not telemetry timings. The pinned runtime
rejects unknown tools before policy evaluation and returns no action identity;
that absence must also remain stable rather than inventing a synthetic identity.

Failure fixtures run individually with `--failure-fixture <name>`:

| Name | Expected native outcome |
|------|-------------------------|
| `malformed-manifest` | Startup exits nonzero with `manifest_parse_error` |
| `missing-task`, `missing-permission` | Missing snapshot path denies with `ticket_read_not_permitted` |
| `policy-evaluation-error` | An undefined Rego verdict query denies with `runtime_error:policy_invocation_failed` |
| `missing-native-payload` | Startup exits nonzero with `DllNotFoundException` after the test removes the Linux x64 payload |
| `unavailable-opa` | Startup validation exits nonzero with `opa_execution_error` after the test removes OPA |

For example, `docker compose run --rm acs-spike --failure-fixture missing-task`
reports a native deny and zero delegate executions. The dependency-removal
cases require the test harness: it removes one dependency only inside a
disposable container, then starts the same spike. Running those names alone
does not remove dependencies. Tests assert explicit failure diagnostics or
native denial and no delegate execution. An undefined query passes artifact
validation but fails native policy invocation; it is not an ordinary policy deny.
These tests do not change the host, the shared image, or the default fixture run.

The SDK is `AgentControlSpecification` 0.3.1-beta.1 (MIT), with its bundled
`libagent_control_specification_core.so` Linux x64 payload and manifest schema
`0.3.1-beta`. Package metadata identifies upstream revision
`c57d9d9a4849556a3c5347d359012d7a85bc3dfb`. The package lockfile pins its
content hash. The native payload SHA-256 is
`2deb429ec7bf5ea902e23717b1e991ad3b78a22a5ebcd26ca0682d5d2c424839`.
OPA 1.4.2 uses the Linux amd64 static binary, checked during the image build
against SHA-256
`2c0ccdbbe0b8e2a5d12d9c42d92f1f34f494ffb32d1f3c4ddc36101be637d66f`.
The final image includes upstream license texts under `/app/notices`.
These are preview artifacts, not a production authorization boundary.

The container build uses nuget.org by default. If your network requires an
approved NuGet mirror, set `ACS_NUGET_SOURCE` to its service-index URL before
running Compose or the tests. The override remains subject to locked restore
and content-hash validation; TLS validation is not disabled. Do not put feed
credentials in this variable or in build arguments.

To restore dependencies, run the Linux container smoke, and execute the .NET
solution tests from a fresh clone, use Bash, the .NET 10 SDK, Node.js 24.15.0
or later within Node 24, npm 11, and Docker with Linux containers enabled:

```sh
bash scripts/verify-acs-spike.sh
```

The script restores locked dependencies, installs the locked frontend
packages, builds the Portal assets required by its tests, builds and runs the
container, then runs `dotnet test` for the solution. It does not require Azure
credentials or start a long-running service.

## Restore and build

Run these commands from the repository root in PowerShell or the dev
container's Bash shell:

```sh
dotnet restore AgentGateLab.sln --locked-mode
npm ci --prefix src/Client
npm run typecheck --prefix src/Client
npm test --prefix src/Client
npm run build --prefix src/Client
dotnet build AgentGateLab.sln --no-restore --property:SkipClientBuild=true
```

`npm run build` writes the production frontend to
`src/Portal/wwwroot`. That folder is generated and ignored by Git. The Portal
project also builds the client automatically when `SkipClientBuild` is not set,
so `dotnet build AgentGateLab.sln` works from a fresh clone after Node and
npm are available.

## Run locally

Start the Portal:

```sh
dotnet run --project src/Portal/Portal.csproj
```

Then open the URL printed by ASP.NET Core. The `/health` endpoint reports the
Portal foundation status, and a route such as `/tickets/TICKET-001` is served
by the React shell. Unknown `/bff`, `/auth`, and `/api` routes return a JSON
404 instead of being swallowed by the SPA fallback.

The Gateway can be started independently:

```sh
dotnet run --project src/Gateway/Gateway.csproj
```

The Agent Worker is a separate host and currently waits without executing
agent jobs:

```sh
dotnet run --project src/AgentWorker/AgentWorker.csproj
```

## Test and publish

Run the .NET smoke and native ACS integration tests with Docker and Linux
containers available. The ACS tests build and run the real container, validate
its fixture decisions and delegate counts, and remove their named container:

```sh
dotnet test AgentGateLab.sln --no-restore --property:SkipClientBuild=true
```

Publish the Portal after building the client:

```sh
dotnet publish src/Portal/Portal.csproj --configuration Release --no-restore --property:SkipClientBuild=true
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

```sh
dotnet restore AgentGateLab.sln --force-evaluate
dotnet restore AgentGateLab.sln --locked-mode
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
