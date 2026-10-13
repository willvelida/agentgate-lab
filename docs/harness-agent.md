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
session only after an authorized parent or user commits the verified work.
Confirm the working tree is clean and record the full commit SHA, then invoke:

```text
/feature-evaluator Evaluate F001 in slug <generated-slug> at commit <full-sha>.
```

Always pass the full commit SHA. The evaluator requires it as an input so a
fresh session verifies the intended post-verification commit rather than
whatever happens to be `HEAD`.

The [evaluator skill](../.github/skills/feature-evaluator/SKILL.md) reruns checks
and records a verdict without changing implementation or feature status. It
refuses an uncommitted or otherwise unclean working tree, records the full
starting commit SHA, and confirms the same commit is still checked out with a
clean tree before recording a verdict. If HEAD changes or `git status --short`
reports any entry during evaluation, the result is stale and the evaluator
records neither PASS nor FAIL. Switching agents in the implementation chat is
not a fresh-session review.

That clean-commit gate governs sessions you open for an authorized commit. The
bounded maker-checker loop forbids the maker to commit, so its checker
dispatch is exempt: the evaluator judges the controller-recorded round
fingerprint and evidence, and reports stale when that fingerprint no longer
matches.

This first implementer version stops before evaluation. In a separate
follow-up, apply the recorded verdict: repair and reevaluate after FAIL, or
mark `pass` only after PASS covers the unchanged reviewed implementation.
Commit and publish only when explicitly approved, and confirm exact-head CI.

## Review pull request feedback

Use live GitHub data as the source of truth for every pull request review
round. Do not infer review status from `docs/progress.md` or from inline
comments alone.

1. Refresh the pull request before making changes.
2. Read every unresolved inline review thread, including replies and outdated
   threads that remain unresolved.
3. Read the latest submitted review summary body. Inspect the raw body so
   findings inside collapsed `<details>` sections, such as "Previously
   missed", are included.
4. Combine both sources into one deduplicated checklist. Record which findings
   are in scope, which are deferred, and why.
5. Batch the approved fixes into one review round. After publishing the round,
   re-fetch both inline threads and review summary bodies before reporting that
   feedback is resolved.

Use the host's pull request tool when it returns review threads and submitted
review bodies. With GitHub CLI, query `reviewThreads` through `gh api graphql`
for inline thread resolution state, and query
`repos/{owner}/{repo}/pulls/{number}/reviews` for submitted review bodies.
Rendered or collapsed presentation must not hide text from the raw review
body. If either source cannot be read, record the review check as unavailable,
not complete.

## Run the bounded loop

The local controller can coordinate one agreed feature through alternating
maker and checker rounds. It uses the Harness Implementer for maker work and a
fresh Feature Evaluator process for each check. It persists completed rounds
outside chat context so an interrupted run can continue without repeating a
successful round. On resume, an interrupted actor that was safely recorded is
redispatched as the next action.

> [!IMPORTANT]
> The controller runs verification in a Docker sandbox with a read-only
> repository mount, no network, no host credentials, and no Docker socket.
> The Docker daemon, host kernel, and sandbox image remain trusted components;
> this is not protection against a container escape. The controller is not an
> application security boundary and does not implement authentication, ACS
> enforcement, model access, task grants, or human approval. Review its state
> and repository diff before accepting any result.

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

The controller requires Docker and a locally built verification image. Build
it before starting a live or dry run:

```sh
docker build -f scripts/verification-sandbox.Dockerfile \
  -t agentgate-verification:node24 scripts
```

The controller enforces the declared maximum rounds, elapsed time, and repeated
no-progress limit. It also stops for blocked or ambiguous work, stale checker
input, dispatch failure, protected changes, or work that needs human approval.
Elapsed time is one shared deadline: the controller recalculates the remaining
budget before each verification command and before agent dispatch.
Dispatch timeouts and controller interrupts trigger process-tree cleanup. If
cleanup fails, the controller reports the error and retries cleanup without
starting another round. Verification containers are tracked by Docker ID and
explicitly removed after success, timeout, or interruption. If container
removal fails, the ID file is retained for operator recovery. The controller
remains pending until process-tree termination succeeds and the child exits.
Cleanup can therefore outlast the dispatch and loop time limits. Do not
force-exit the controller or start another maker while cleanup is pending;
first confirm the child process tree and verification container have stopped.

### Start the loop

Run from the repository root and store state under the ignored `.local`
directory:

```sh
node scripts/maker-checker-loop.mjs \
  --goal path/to/goal.json \
  --state .local/maker-checker/F005-state.json
```

The controller acquires an exclusive `<state-file>.lock` directory before it
loads or writes state and holds the lock until the loop returns. A second
controller using the same resolved state path fails without dispatching an
agent. Normal completion removes the lock. If a crash leaves it behind, do not
infer that it is stale from the recorded PID alone. Confirm that the controller
and every dispatched child process have stopped, then remove that specific
lock directory manually. Never remove it while process-tree cleanup is pending.

A live run requires Docker, the verification image, the GitHub Copilot CLI,
and the repository custom agents.
The dispatcher removes shell access, denies direct URL and `.git` metadata
writes (including every descendant below `.git`), disables built-in MCP servers,
and discovers then disables every
configured local, remote, or HTTP MCP server. Dispatch fails closed if MCP
inventory cannot be read or contains an unknown format.
Every dispatch also denies writes to the active state file, its atomic-save
temporary files, and its lock directory and owner record. Keep state under the
ignored `.local` directory; agents retain workspace write access elsewhere.
The controller protects the goal contract, the feature verification files,
and `scripts/check-architecture.sh` from changes during a round. It validates
those transitions even when agent dispatch fails or times out.

Verification contracts use explicit, supported command forms. Node tests must
name `.test.mjs` or `.spec.mjs` files; implicit `node --test` discovery,
dynamic imports/requires, dynamic code execution with `eval` or `Function`,
reflective `constructor`, `Reflect`, or `Proxy` access, `node:vm`, and imports
from non-built-in packages are rejected. Computed property access on global
objects and `Object` is also rejected so code cannot hide a dynamic loader
behind a computed key. Static imports are traversed through protected test
roots so helpers imported by protected helpers are also protected. Subprocess,
cluster, and worker-thread loaders are rejected outside the protected
`scripts/` tree.
The complete `scripts/` or conventional test-project tree is protected, as are
statically imported local test helpers outside that tree. Files under `src/`
remain mutable as implementation under test. Bash verification is limited to
the explicit sandbox-compatible allowlist, currently
`scripts/check-architecture.sh`; other scripts require a deliberate review
before being added. The sandbox image provides Node.js, Bash, and Git only, so
scripts needing .NET, Docker, or other unavailable tools are rejected before
dispatch. Unsupported command forms fail closed rather than running with
untracked verification inputs.

Because agents have no shell, the controller runs the goal's
`verificationCommand` itself through the
[evidence runner](./verification.md) after each completed maker round, then
runs the repository architecture check the same way, and records the command,
status, run ID, exit code, and report path for each as a list on that round.
The runner executes both commands in the prebuilt Docker image. The repository
is mounted read-only; the container has no network, receives no host
environment variables or credentials, and has no Docker socket. Its writable
`/tmp`, home directory, and `.local` path are temporary container filesystems.
The image includes Node.js 24, Bash, and Git; verification commands must use
those tools and dependencies already readable from the repository. Paths in
the verification command must be relative to the repository root. The
container mounts the repository at a different location, so absolute paths
are rejected before any agent is dispatched. The
evidence runner on the host writes reports and output outside the container.
A missing Docker image or unavailable daemon stops the controller before it
dispatches an agent.
The checker is dispatched only when every recorded result passes; a failed run
sends the work back to the maker with the failure in its feedback, and a runner
that cannot start stops the loop for human intervention. A resumed round that
lacks a passing record for every required command (the goal's verification
command and the architecture check), including state written before this
evidence existed, is verified again before the checker runs. Schema version 1 state
written while `verification` was a single record is migrated to a one-entry
list when loaded. Each agent prompt carries the goal, numbered constraints,
and verification command, and states that the agent must not claim to have run
verification. The checker prompt also receives the structured verification
records, including command, status, run ID, exit code, and report path. If
controller verification is interrupted, either after a maker round or at the
resumed-checker gate, the loop records an interrupted round whose next action
is the checker. On resume, verification runs again before the checker is
dispatched, without requiring human intervention.

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
state file instead. Legacy dirty revisions without a working-tree fingerprint
are treated as stale because the controller cannot prove their files are
unchanged. Clean legacy revisions remain comparable by commit.

### Stop safely

Stop the local controller process with your terminal's interrupt command.
Completed rounds and an interrupted actor after its safety-transition check
are resumable. Before restarting, confirm that the prior controller and all
dispatched child processes have stopped. Inspect the state file and working
tree for partial work from an interrupted agent process.

Terminal results such as `pass`, `blocked`, `ambiguous`, `stale`, `stalled`,
`limit-exhausted`, and `approval-required` require no hidden automatic action.
A dispatch exception is persisted and returned as `blocked` with human
intervention required. Resolve the reported condition or revise the goal with
human approval before starting another run. The controller itself does not
commit, push, create or edit a pull request, or merge. Dispatched agents are
denied those capabilities. Verification code cannot write to the mounted host
repository or reach external network services through the configured sandbox;
container-runtime and host-kernel escapes remain outside the guarantee.

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
