---
title: Harness Implementer
description: Use the custom agent directly or through the bounded maker-checker controller.
ms.date: 2026-10-11
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

## Run the bounded loop

The local controller can coordinate one agreed feature through alternating
maker and checker rounds. It uses the Harness Implementer for maker work and a
fresh Feature Evaluator process for each check. It persists completed rounds
outside chat context so an interrupted run can continue without repeating a
successful round.

> [!IMPORTANT]
> The controller is a local capability boundary, not an operating-system
> sandbox or an application security boundary. It does not implement
> authentication, ACS enforcement, model access, task grants, or human
> approval. Review its state and repository diff before accepting any result.

### Define the goal

Create a JSON goal file that follows
[`goal-contract.schema.json`](../scripts/goal-contract.schema.json). Keep the
active feature ID, slug, exact verification command, constraints, and finite
limits explicit:

```json
{
  "schemaVersion": 1,
  "issue": 30,
  "featureSlug": "willvelida-agentgate-lab-30-add-a-bounded-goal-driven-maker-checker-loop",
  "featureId": "F005",
  "goal": "Cover every required maker-checker loop outcome.",
  "verificationCommand": "node --test scripts/maker-checker-loop.test.mjs scripts/loop-state.test.mjs",
  "constraints": [
    "Work on F005 only.",
    "Do not commit or publish."
  ],
  "limits": {
    "maxRounds": 6,
    "maxElapsedTimeMs": 600000,
    "noProgressLimit": 2
  }
}
```

The controller validates the contract before its first dispatch. The focused
validator tests are available with `node --test scripts/goal-contract.test.mjs`.

The controller enforces the declared maximum rounds, elapsed time, and repeated
no-progress limit. It also stops for blocked or ambiguous work, stale checker
input, dispatch failure, protected changes, or work that needs human approval.

### Start the loop

Run from the repository root and store state under the ignored `.local`
directory:

```sh
node scripts/maker-checker-loop.mjs \
  --goal path/to/goal.json \
  --state .local/maker-checker/F005-state.json
```

A live run requires the GitHub Copilot CLI and the repository custom agents.
The dispatcher removes shell access, denies direct URL and `.git` metadata
writes, disables built-in MCP servers, and discovers then disables every
configured local, remote, or HTTP MCP server. Dispatch fails closed if MCP
inventory cannot be read or contains an unknown format.

Because agents have no shell, the controller runs the goal's
`verificationCommand` itself through the
[evidence runner](./verification.md) after each completed maker round, and
records the command, status, run ID, exit code, and report path in that
round. The checker is dispatched only when that verification passes; a
failed run sends the work back to the maker with the failure in its
feedback, and a runner that cannot start stops the loop for human
intervention. Each agent prompt carries the goal, numbered constraints, and
verification command, and states that the agent must not claim to have run
verification.

Use a scripted dry run to exercise controller behavior without starting
Copilot sessions. The fixture is a JSON array of actor results:

```json
[
  { "outcome": "completed", "feedback": "fixture maker completed" },
  { "outcome": "pass", "feedback": "fixture checker passed" }
]
```

```sh
node scripts/maker-checker-loop.mjs \
  --goal path/to/goal.json \
  --state .local/maker-checker/F005-dry-run-state.json \
  --dry-run path/to/fixture.json
```

### Observe and resume

The command prints the final result as JSON. During or after a run, inspect the
state file for each round's actor, timestamps, reviewed commit and dirty state,
outcome, feedback, next action, and human-intervention reason. Inspect the Git
diff separately because persisted state is evidence, not approval.

To resume, run the same start command with the same goal and state paths. The
controller reads the persisted state and selects the next actor. For example,
a completed maker round resumes at the checker; a recorded checker PASS remains
stopped instead of dispatching another round. Resuming with a goal contract
that differs from the one recorded in the state file is refused; start a new
state file instead.

### Stop safely

Stop the local controller process with your terminal's interrupt command. Only
completed persisted rounds are resumable. Before restarting, inspect the state
file and working tree for partial work from an interrupted agent process.

Terminal results such as `pass`, `blocked`, `ambiguous`, `stale`, `stalled`,
`limit-exhausted`, and `approval-required` require no hidden automatic action.
A dispatch exception is persisted and returned as `blocked` with human
intervention required. Resolve the reported condition or revise the goal with human
approval before starting another run. The controller cannot commit, push,
create or edit a pull request, merge, weaken verification, change acceptance
criteria, or start another feature without explicit human approval.

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
