---
name: feature-evaluator
description: Independently scores a feature from a feature list against a five-part rubric and records a PASS or FAIL verdict.
---

# Feature Evaluator

## Overview

Use this skill after an implementer reports that a feature's verification
passed. The evaluator acts as an independent reviewer. It decides whether the
feature can move to `pass` in `features_list.json`.

## Inputs

* The feature slug, for example `issue-12-token-exchange`.
* The feature ID, for example `F001`.

Ask for either value if it is missing.

## Requirements

* Run in a fresh session, not the session that built the feature.
* Read only the repository, the slug files in `docs/features/<slug>/`, and the
  diff. Treat the implementer's evidence as claims to check, not as proof.
* Evaluate only a named commit with a clean working tree. Do not evaluate an
  uncommitted diff. Record the full starting commit SHA.
* Do not edit source code, tests, `features_list.json`, or the feature status.
  Author only `evaluator-rubric.md` and one verdict line in `agent-progress.md`.
  Verification commands may produce ignored build output and local evidence.
* Run the feature's `verification` command exactly as written through the
  evidence runner described in `docs/verification.md`. Keep raw output local.
  When dispatched by the bounded maker-checker loop, shell access is disabled
  and the loop controller records the verification command and the repository
  architecture check as round evidence. In that case, judge the recorded
  controller evidence and never claim to have run the command yourself.
* Cite evidence (a file path, command output, or line) for every score.
* Before recording a verdict, confirm that the starting commit is still
  checked out and the working tree is clean. If HEAD changed or
  `git status --short` reports any entry, report `STALE` and do not record
  PASS or FAIL.
* Do not commit. Leave committing to the user or the implementer.

## Rubric

Score each dimension from 1 to 5.

| Dimension                    | What to check                                                                                               |
|------------------------------|-------------------------------------------------------------------------------------------------------------|
| Acceptance criteria met      | Every acceptance criterion for the feature is implemented and observable.                                  |
| Verification evidence        | The `verification` command passes when rerun. Static, runtime, and system checks fit the change.           |
| Scope discipline             | The diff touches only what the feature needs. No unrelated edits or extra features.                        |
| Architecture and code quality | `scripts/check-architecture.sh` passes. The code follows `docs/architecture.md` and project patterns.     |
| Tests not weakened           | No tests were deleted, skipped, or loosened to make checks pass. New behavior has tests where practical.   |

Scale:

* 5: fully meets the expectation, with clear evidence.
* 4: meets the expectation, with minor gaps.
* 3: acceptable, with noticeable gaps that do not block the feature.
* 2: significant gaps; the feature is not ready.
* 1: missing, broken, or unverifiable.

## PASS rule

The verdict is PASS only when every dimension scores at least 3 **and** the
average is at least 4. Otherwise the verdict is FAIL.

## Workflow

1. Resolve the repository root. Read `AGENTS.md`, `docs/architecture.md`, and
   the slug's `features_list.json` and `agent-progress.md`.
2. Find the feature by ID. Stop and report if it is missing or its
   `verification` is `TBD`.
3. Run `git status --short` and stop without evaluating if it reports any
   entry. Untracked files change module resolution and verification inputs, so
   treat them as a dirty tree. Resolve the full commit SHA named for
   evaluation, confirm it is the current `HEAD`, and record it as the starting
   revision.
4. Collect the committed diff for the named revision and report the range you
   reviewed. Do not fall back to an uncommitted working-tree diff.
5. Run the `verification` command and `bash scripts/check-architecture.sh`
   through the evidence runner. Record their run IDs, results and exit codes,
   reviewed commit, and clean starting state in the rubric. Sanitize output
   summaries.
   If the change affects how a service runs, also follow the runtime evidence
   table in `AGENTS.md`, then stop only the service process this session owns.
   When dispatched by the bounded maker-checker loop, shell access is
   disabled; the controller records both the `verification` command and
   `bash scripts/check-architecture.sh` as evidence on the round. Judge that
   recorded evidence instead of rerunning the commands.
6. Score each dimension with evidence.
7. Re-run `git status --short`, resolve `HEAD`, and compare it with the
   starting revision. If the command reports any entry or HEAD differs, report
   `STALE`, do not write a verdict, and require a fresh evaluation of the new
   clean commit.
8. Append the result to `docs/features/<slug>/evaluator-rubric.md`:

   ```markdown
   ## F001 evaluation (YYYY-MM-DD)

   Reviewed range: <commit range or diff base>
   Verification: <command, run ID, result, exit code>
   Architecture: <command, run ID, result, exit code>
   Reviewed commit and working tree: <SHA, clean at entry and exit>

   | Dimension | Score | Evidence | Defects |
   |-----------|-------|----------|---------|
   | ...       | ...   | ...      | ...     |

   Average: 4.4. Minimum: 4.
   Verdict: PASS

   Required fixes: none
   ```

9. Append one verdict line to `docs/features/<slug>/agent-progress.md`:

   ```markdown
   * YYYY-MM-DD: F001 evaluator verdict PASS (avg 4.4, min 4). See evaluator-rubric.md.
   ```

10. Confirm the rubric file is ignored with
   `git check-ignore docs/features/<slug>/evaluator-rubric.md`, then report the
   verdict and any required fixes.

## On FAIL

The implementer fixes the listed defects, reruns verification, and requests a
new evaluation in a fresh session. Never lower the threshold to get a PASS.

## Troubleshooting

* A required tool is missing: score Verification evidence as 1 and return FAIL.
* The named revision is missing or the tree is dirty: stop and request a clean
  committed revision.
* The diff is unclear: ask the user for the commit range.
* The slug files are missing: run the `github-issue-to-features-list` skill
  first.

> Brought to you by willvelida/agentgate-lab
