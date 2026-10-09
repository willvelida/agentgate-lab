---
title: Product
description: What AgentGate Lab is, who it is for, its planned features, and its constraints.
ms.date: 2026-10-09
---

## What it is

AgentGate Lab is a learning and demo project. It builds an authorization
gateway that sits between autonomous AI agents and the tools they call. The
gateway checks each tool call with Microsoft Entra Agent ID and Agent Control
Specification (ACS) policies, asks a human to approve risky actions, and
records an auditable decision history.

## Who it is for

* People studying how to secure agent tool calls with Entra Agent ID and ACS.
* Reviewers who want to see a working, inspectable demo of approval and audit
  for agent actions.

## Core features (planned)

None of these are implemented yet. See [progress.md](./progress.md) for the
current state.

* Two autonomous agents with distinct Entra Agent ID identities.
* Two synthetic ticket tools: `tickets.read` and `tickets.set_priority`.
* A gateway that enforces task-scoped permissions and ACS policy verdicts.
* Human approval before a risky tool call runs.
* A React ticket dashboard for browsing tickets, submitting agent tasks,
  approving requests, and viewing sanitized decision history.
* Correlated evidence through OpenTelemetry and Azure Monitor.

## Constraints

* The model is never the authorizer. The gateway decides.
* Tools change synthetic tickets only, never real customer or cloud resources.
* Prefer managed identity and federation. Do not introduce API keys.
* Tests that use identity fixtures are not evidence that real Entra
  integration works.

## Non-goals

* Full ticket CRUD or a chat-first interface.
* Multiple agent frameworks, AKS, MCP, or a standalone production policy
  service in the first MVP.

## Where to read more

* [research-and-build-plan.md](./research-and-build-plan.md): full scope,
  technology choices, and milestones.
* [architecture.md](./architecture.md): implemented components versus the
  planned target.
