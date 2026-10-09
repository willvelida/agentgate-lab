---
title: Harness Implementer
description: Use the custom agent to implement one feature and hand off for independent evaluation.
ms.date: 2026-10-09
---

## What it does

The [Harness Implementer](../.github/agents/harness-implementer.agent.md)
follows the existing [harness rules](../AGENTS.md). It agrees on one feature,
implements it, records verification evidence, and leaves a clean handoff.
It does not approve its own work or automatically commit or publish.

This is a repository custom agent, not the application's planned AgentWorker
or a background service. Its instructions guide behavior; they do not enforce
permissions. Review tool approvals and diffs before accepting changes.

## Select the agent

Open this checkout in VS Code. Start a chat and select **Harness Implementer**
from the Agent picker. If it is missing, confirm that the agent definition is
present in the workspace and that your selected agent harness supports
workspace custom agents. See the
[VS Code custom-agent guidance](https://code.visualstudio.com/docs/agent-customization/custom-agents).

No model or tool list is pinned in the definition. Use your chosen model and
the tools available in your host. The agent needs repository read/edit access,
terminal access for Git and checks, and GitHub CLI access when reading an
issue. If a required capability is unavailable, it should report the blocker,
not claim the work was verified.

## Give it one task

Provide an issue number or URL:

```text
Work on issue #<number> using the harness. Propose one eligible feature,
agree on its scope with me, then implement and verify it.
```

Or resume an existing local checklist:

```text
Resume F001 in slug <generated-slug>. Read the existing evidence,
confirm the feature with me, and leave it ready for independent evaluation.
```

The agent uses only the issue or slug you provide in the current request. It
does not infer a task from earlier chat, progress notes, branches, or open
pull requests. If you provide no issue or slug, it asks and stops before
looking up issues or candidate checklists.

The agent follows clock-in, uses the
[issue-to-features skill](../.github/skills/github-issue-to-features-list/SKILL.md)
when needed, and asks before implementation. After agreement and a healthy
baseline, it works without routine approval prompts between phases. It still
asks about unclear requirements, scope changes, and blockers.

Feature checklists are ignored by Git. A new clone will not have them
automatically. Restore the local checklist with user approval; do not infer
completed status from issue text or overwrite an existing checklist.

## Review the handoff

Expect the agent to report the feature ID and slug, changed files,
verification results and run IDs, reviewed commit and uncommitted changes,
cleanup, blockers, and the next action. Check the sanitized progress log and
the local reports described in [verification guidance](./verification.md).

After successful verification, the feature remains `active`. Open a fresh
session in the same checkout and invoke:

```text
/feature-evaluator Evaluate F001 in slug <generated-slug>.
```

The [evaluator skill](../.github/skills/feature-evaluator/SKILL.md) reruns checks
and records a verdict without changing implementation or feature status.
Switching agents in the implementation chat is not a fresh-session review.

This first implementer version stops before evaluation. In a separate
follow-up, apply the recorded verdict: repair and reevaluate after FAIL, or
mark `pass` only after PASS covers the unchanged reviewed implementation.
Commit and publish only when explicitly approved, and confirm exact-head CI.

## Try it before relying on it

Static checks can verify links and agent metadata, not model behavior.
Start with a read-only trial:

```text
Read the harness and explain your workflow for issue #<number>.
Do not create files, run commands, or implement anything.
```

It should identify one-feature scope, feature approval, captured verification,
fresh-session evaluation, and the publication boundary. Then, with an agreed
small issue, try the real workflow. Confirm it asks before implementation,
records actual checks, leaves the feature `active`, writes the handoff, and
stops without evaluating, committing, publishing, or starting another feature.
