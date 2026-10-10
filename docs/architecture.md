---
title: Architecture
description: What exists in agentgate-lab today, how it is organized, and where the planned design lives
ms.date: 2026-10-10
---

## Purpose

agentgate-lab will become an authorization gateway. It lets an AI agent act
for a user only through short-lived, one-use tickets that the user has approved.
Right now the repository holds the foundation only. No authentication,
Agent Control Specification (ACS) enforcement, grant, approval, or ticket
logic exists in the application services yet. The isolated ACS spike evaluates
synthetic fixtures but does not protect those services.

This page separates what is **implemented** (verified against code) from what
is **planned** (described in design docs only).

## Component map

| Component   | Path               | Kind                         | Status     |
|-------------|--------------------|------------------------------|------------|
| Portal      | `src/Portal`       | ASP.NET Core minimal API     | Foundation |
| Client      | `src/Client`       | React + Vite single-page app | Foundation |
| Gateway     | `src/Gateway`      | ASP.NET Core minimal API     | Foundation |
| AgentWorker | `src/AgentWorker`  | .NET generic host worker     | Foundation |
| AcsSpike    | `src/AcsSpike`     | .NET 10 console spike        | Native fixtures |
| ACS tests   | `tests/AcsSpike.Tests` | xUnit container integration | Allow/deny |
| Tests       | `tests/Portal.Tests` | xUnit host tests for Portal | Smoke only |

The solution file is `AgentGateLab.sln`.

## Implemented today

### Portal

* Local URLs: `http://localhost:5031` and `https://localhost:7264`.
* `GET /health` returns `{ "status": "ok", "service": "portal" }`.
* Serves the built React app from `src/Portal/wwwroot`.
* Requests under `/bff`, `/auth`, and `/api` return a ProblemDetails 404.
  These prefixes are reserved for future work.
* Any other GET or HEAD request returns `index.html`, which is the SPA
  fallback. Other methods return a ProblemDetails 404.

### Client

* Vite builds into `../Portal/wwwroot`, so the Portal serves the output.
  That folder is generated and gitignored.
* The dev server uses the Vite default port (5173).
* Tests use Vitest with jsdom (`src/Client/src/App.test.tsx`).

### Gateway

* Local URLs: `http://localhost:5077` and `https://localhost:7039`.
* `GET /health` returns `{ "status": "ok", "service": "gateway" }`.
* `GET /` returns a "foundation-only" message. No authorization or ticket
  operations exist.

### AgentWorker

* Runs a background service that logs one message and waits. It does no
  agent work.

### ACS spike

* `src/AcsSpike` runs in a Linux x64 container through Docker Compose.
* It validates its original manifest and Rego policy through the pinned
  native ACS artifact validator.
* The official .NET SDK loads its Linux x64 native payload and dispatches Rego
  to packaged OPA. `RunToolAsync` enforces pre-tool and post-tool verdicts.
* A permitted synthetic read executes once. Unpermitted reads and unknown
  tools deny without running a guarded delegate.
* Repeated fixture inputs reload the native runtime three times and expose
  stable verdict, action identity and transformed-target evidence. An original
  normalization fixture exercises a non-null native transform and passes the
  rewritten ticket ID to the delegate.
* Isolated failure fixtures cover malformed manifests, missing permission
  snapshot paths, unavailable native/OPA dependencies, and an undefined policy
  query. The native validator blocks startup or the runtime explicitly denies;
  tests require no guarded delegate execution. Dependencies are removed only
  inside disposable test containers.
* This is an isolated spike, not Gateway authorization or real task grants.
* Native intervention evidence covers pre/post allow, pre-tool denial before
  execution, and post-tool denial after an executed read. The latter withholds
  the result, not the side effect; no rollback is claimed. Blocking results
  retain their SDK intervention point, without inventing an earlier result.
* The built image evaluates the same fixtures without network access or mounted
  dependencies. Container tests inspect `none` networking and empty mounts,
  verify packaged managed artifacts, policies, notices and pinned native/OPA
  hashes, then compare the full output to the normal run. Network access is
  still required for build-time dependency downloads.

### Tests

* `tests/Portal.Tests` checks that deep links return the starter shell and
  that reserved routes return problems instead of HTML.
* No Gateway or AgentWorker tests exist yet.
* `tests/AcsSpike.Tests` builds and runs the Linux spike through Docker Compose.
  These tests require Docker, verify native allow/deny reasons and delegate
  counts, repeated-input stability, target transformation, and failure paths.
  They also verify result withholding after native post-tool denial and fail
  if the container cannot evaluate its fixtures. No custom runtime or dispatcher
  is supplied; dependency-removal tests reject fallback success.

## Planned target architecture

The full design is in
[research-and-build-plan.md](./research-and-build-plan.md). None of it is
built yet. In short:

```text
Browser (React + session cookie)
  -> Portal BFF (public, Entra ID sign-in)
  -> Azure API Management (APIM)
  -> Gateway (private: task broker, ACS, tool executor)
       -> Table Storage (tasks, grants, tickets, audit, outbox)
       -> Work queues
  <- Agent runner (Agent Framework + ACS) reads queues, calls APIM
```

Supporting services: Key Vault, Blob storage for auth keys, a Foundry model
behind APIM, and OpenTelemetry with Azure Monitor. Public and internal parts
run in separate Container Apps environments.

## Enforced boundaries

[check-architecture.sh](../scripts/check-architecture.sh) enforces these
rules. It runs first in `init.sh` and in CI, and fails the build on a
violation. Its regression tests cover multiline references and imports, plus
XML comments that contain inactive references.

* A service project under `src/` (Portal, Gateway, AgentWorker) must not
  reference another service project through a `ProjectReference`.
* Code in `src/Client` must not use relative imports that leave `src/Client`.

Projects under `tests/` may reference the services they test.

## Key boundaries

These rules come from the plan. They are design intent, not enforced code.

* The Portal BFF never gets ticket or grant access.
* The agent cannot write grants or approve its own requests.
* Tools start inside the Gateway process and may move out later.
* The current shell is not a security boundary. Do not treat it as one.

## Where to go next

* Current status and milestones: [progress.md](./progress.md)
* Build and test commands: [AGENTS.md](../AGENTS.md)
* Full design and milestones: [research-and-build-plan.md](./research-and-build-plan.md)
