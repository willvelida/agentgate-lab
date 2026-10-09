---
title: Architecture
description: What exists in agentgate-lab today, how it is organized, and where the planned design lives
ms.date: 2026-10-09
---

## Purpose

agentgate-lab will become an authorization gateway. It lets an AI agent act
for a user only through short-lived, one-use tickets that the user has approved.
Right now the repository holds the foundation only. No auth, Agent Credential
Service (ACS), grant, approval, or ticket logic exists yet.

This page separates what is **implemented** (verified against code) from what
is **planned** (described in design docs only).

## Component map

| Component   | Path               | Kind                         | Status     |
|-------------|--------------------|------------------------------|------------|
| Portal      | `src/Portal`       | ASP.NET Core minimal API     | Foundation |
| Client      | `src/Client`       | React + Vite single-page app | Foundation |
| Gateway     | `src/Gateway`      | ASP.NET Core minimal API     | Foundation |
| AgentWorker | `src/AgentWorker`  | .NET generic host worker     | Foundation |
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

### Tests

* `tests/Portal.Tests` checks that deep links return the starter shell and
  that reserved routes return problems instead of HTML.
* No Gateway or AgentWorker tests exist yet.

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
violation.

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
