---
title: "Issue #32 feature progress"
description: "Implementation evidence for reducing review churn in the maker-checker workflow."
ms.date: 2026-10-12
---

# Issue #32: harness: reduce review churn in the maker-checker workflow

* Repository: `willvelida/agentgate-lab`
* Issue: [#32](https://github.com/willvelida/agentgate-lab/issues/32)
* Feature list: local ignored `features_list.json`

| Feature | Description | Status | Verification | Evidence | Tested |
| --- | --- | --- | --- | --- | --- |
| F001 | The verification boundary no longer depends on parsing JavaScript imports. | pass | `node --test scripts/maker-checker-safety.test.mjs` | Implementation run `2026-10-12T00-14-41-029Z-a6cc54dc-7da2-4f48-9695-efdafa062a5a`, pass, 33/33; evaluator run `2026-10-12T00-47-01-722Z-23042c86-f079-4afe-b274-3e546a889f96`, pass, 33/33 | 2026-10-12, evaluator PASS |
| F002 | The PR-comment workflow documents and checks both inline threads and review summary bodies. | pass | `node --test scripts/maker-checker-loop.test.mjs` | Implementation run `2026-10-12T02-30-01-141Z-2c06eb3d-27d8-4a03-b684-b2b340d9392c`, pass, 32/32; evaluator run `2026-10-12T02-42-45-062Z-0299532f-212b-46ff-ab4b-9e705ded694e`, pass, 32/32 | 2026-10-12, evaluator PASS |
| F003 | The evaluator workflow requires a committed, unchanged revision. | pass | `node --test scripts/maker-checker-loop.test.mjs` | Implementation run `2026-10-12T02-53-49-924Z-344036fa-b9e4-4d59-862d-928637ef5dc9`, pass, 33/33; evaluator run `2026-10-12T03-07-18-984Z-70b71ec6-f4cf-4933-946e-91a982600961`, pass, 33/33; architecture evaluator run `2026-10-12T03-07-18-975Z-91b42c2c-7921-4bae-8493-b6acfd8ff3a5`, pass; fresh-session verdict PASS at clean commit `ae5b78aab789429cfacc41700e8741558acba0ab` | 2026-10-12, evaluator PASS |
| F004 | A decision records the loop's accepted limits. | pass | `bash scripts/check-architecture.sh` | Implementation architecture run `2026-10-12T03-17-12-148Z-be826fb4-16d2-4cf5-91a6-be894c14547f`, pass; evaluator exact verification run `2026-10-12T03-33-29-444Z-e7ec9fba-e06b-437f-9c52-0525824fcbbb`, pass; independent architecture run `2026-10-12T03-33-29-564Z-0f591fb9-0bd6-4a5a-b558-5b640d4d8f6d`, pass; fresh-session verdict PASS at clean commit `06b2d99bf6e15bb60bb1e5f562c003286e35847a` | 2026-10-12, evaluator PASS |

## Updates

### 2026-10-12

Created the issue-specific feature checklist from the four explicit acceptance
criteria in issue #32.

Implemented F001 on branch `feat/harness-reduce-review-churn`. The verification
boundary in `scripts/maker-checker-safety.mjs` no longer derives its protected
path set by parsing JavaScript imports. The node branch of `verificationPaths()`
now protects whole roots by content hash: `scripts/` and `tests/` recursively,
plus repository-root files individually, with `bin/` and `obj/` directories
skipped during hashing.

The import walker was kept as an adversarial screen only. It was renamed to
`assertVerificationImportsAllowed()`, its path-accumulation set was removed, and
it is now called for side effects so that dynamic, reflective, subprocess, and
worker loaders in verification inputs are still rejected. No test file was
modified.

Accepted limit: the protected set deliberately excludes `.git/`, `.local/`,
`docs/`, `src/`, and other root directories as recursive roots, because each of
those mutates during a normal round and would report a boundary violation every
time. Repository-root files are covered individually so a helper beside the
solution file stays protected without that recursion.

Verification and regression results, all captured through
[Invoke-Verification.ps1](../../../scripts/Invoke-Verification.ps1):

| Command | Result | Run ID |
| --- | --- | --- |
| `node --test scripts/maker-checker-safety.test.mjs` | pass, 33/33, exit 0 | `2026-10-12T00-14-41-029Z-a6cc54dc-7da2-4f48-9695-efdafa062a5a` |
| `node --test scripts/maker-checker-loop.test.mjs` | pass, 31/31, exit 0 | `2026-10-12T00-15-11-978Z-33054bd1-f5af-4a3d-92a1-96d49277eeb0` |
| `bash scripts/check-architecture.sh` | pass, exit 0 | `2026-10-12T00-16-58-022Z-095b34a8-727d-44e9-9f03-06c24b56f5b8` |

Verified at revision `93c5e1ffaddafb3ce2b9827d239a01dc7d57a8a9` with the F001
change applied to the working tree. The change is now committed as
`14d811f46b108171c54db1bc79c3b67675b2a0cc` on branch
`feat/harness-reduce-review-churn`, with a clean working tree. Evaluate that
commit.

Fresh-session evaluation reviewed
`f6dacbeb5c936a234ae53bcdfa7510a800242cfa` with a clean working tree.
The exact verification passed 33/33 (run
`2026-10-12T00-47-01-722Z-23042c86-f079-4afe-b274-3e546a889f96`), and the
architecture check passed (run
`2026-10-12T00-47-01-741Z-14d138f4-efa9-4db8-b1ba-16f0233d7259`).
All five rubric dimensions scored 5/5. The evaluator changed no source or test
file and recorded PASS in signed commit
`12363e3ae10c52946cf3539ab8a8c54e3b2694a8`. F001 is `pass`.

Clock-out checks also passed through the verification runner: architecture
(run `2026-10-12T02-24-06-818Z-797311d7-c7b3-49b6-8200-90fc54082b92`)
and whitespace validation (run
`2026-10-12T02-24-08-342Z-59c2c336-6f5e-4d84-8ed1-6157dce87fe6`).

F002 started after no response was available for the next-feature choice. The
recommended issue-order option was selected. The harness now requires every
pull request feedback round to inspect live unresolved inline review threads
and the latest submitted review summary bodies, including raw text inside
collapsed sections. The detailed workflow explains the GitHub GraphQL and REST
sources, requires one deduplicated checklist, and requires both sources to be
re-fetched before completion is reported.

A contract test in `scripts/maker-checker-loop.test.mjs` checks that the hard
rule and detailed workflow continue to name both sources, their GitHub data
paths, collapsed content, and the fail-closed unavailable state.

Verification and regression results, captured through
[Invoke-Verification.ps1](../../../scripts/Invoke-Verification.ps1):

| Command | Result | Run ID |
| --- | --- | --- |
| `node --test scripts/maker-checker-loop.test.mjs` | pass, 32/32, exit 0 | `2026-10-12T02-30-01-141Z-2c06eb3d-27d8-4a03-b684-b2b340d9392c` |
| `bash scripts/check-architecture.sh` | pass, exit 0 | `2026-10-12T02-30-01-582Z-5053d61e-11e5-476f-a65b-6179319d2e05` |

Verified at revision `fefd62beb1da1bbfb8cc66e65d73645c7db83837` with the
F002 change applied to the working tree. The unchanged implementation is
committed as `5179163dce37353482c7317b2f968a97e3e9408b` on
`feat/harness-reduce-review-churn`. F002 stays `active` until a fresh-session
evaluator records PASS.

Fresh-session evaluation reviewed clean commit
`f129f861e823fc29e1f2841e0e494636bf2970ab`. Exact verification passed
32/32 (run
`2026-10-12T02-42-45-062Z-0299532f-212b-46ff-ab4b-9e705ded694e`) and
architecture passed (run
`2026-10-12T02-42-45-290Z-80b792b2-57d0-4243-bfe9-b245007dd348`).
All five rubric dimensions scored 5/5. The evaluator changed no implementation
or test file. F002 is `pass`.

F003 is active. The evaluator workflow now refuses uncommitted or dirty input,
records the full named commit SHA before checks, and confirms that the same
commit is still checked out with a clean tracked tree before recording a
verdict. A changed HEAD or dirty tracked tree makes the evaluation stale, with
neither PASS nor FAIL recorded. The implementer and harness handoffs now
require an authorized parent or user to commit verified work before opening
the fresh evaluator session. A focused contract test preserves these entry,
exit, and stale-result requirements.

Verification results, captured through
[Invoke-Verification.ps1](../../../scripts/Invoke-Verification.ps1):

| Command | Result | Run ID |
| --- | --- | --- |
| `node --test scripts/maker-checker-loop.test.mjs` | pass, 33/33, exit 0 | `2026-10-12T02-53-49-924Z-344036fa-b9e4-4d59-862d-928637ef5dc9` |
| `bash scripts/check-architecture.sh` | pass, exit 0 | `2026-10-12T02-53-50-129Z-b2c23210-53b8-4e4d-b493-1e2f6ac1c987` |

Both runs reviewed revision
`d23dba1169967d53b9b71b5d3257f22756c6c4dd` plus the F003 working-tree
changes. Runtime startup is not applicable because F003 changes only the
harness workflow and its contract test. No long-lived process was started.
Raw reports remain under ignored `.local/verification/`.
* 2026-10-12: F003 evaluator verdict PASS (avg 5.0, min 5). See evaluator-rubric.md.

Fresh-session evaluation reviewed clean commit
`ae5b78aab789429cfacc41700e8741558acba0ab`. Exact verification passed 33/33
(run `2026-10-12T03-07-18-984Z-70b71ec6-f4cf-4933-946e-91a982600961`) and
architecture passed (run
`2026-10-12T03-07-18-975Z-91b42c2c-7921-4bae-8493-b6acfd8ff3a5`). Entry and
exit HEAD and tracked status were unchanged and clean. All five rubric
dimensions scored 5/5. F003 is `pass`.

F004 is pass. The accepted-limits decision is recorded as D036 in
`docs/decisions.md`. It covers the trusted host and Docker boundary, the
Node.js/Bash/Git-only sandbox, bounded productive loop limits, the
clean-commit evaluator gate, and fail-closed unbounded cleanup retries while
process-tree termination is pending.

Verification result, captured through
[Invoke-Verification.ps1](../../../scripts/Invoke-Verification.ps1):

| Command | Result | Run ID |
| --- | --- | --- |
| `bash scripts/check-architecture.sh` | pass, exit 0 | `2026-10-12T03-17-12-148Z-be826fb4-16d2-4cf5-91a6-be894c14547f` |

The architecture check reviewed the F004 working-tree change. Runtime startup
is not applicable because F004 changes documentation only. No long-lived
process was started, and raw reports remain under ignored
`.local/verification/`.

* 2026-10-12: F004 evaluator verdict PASS (avg 5.0, min 5). See evaluator-rubric.md.

F004 passed fresh evaluation with average 5.0 and minimum 5. The evaluator
reviewed clean commit `06b2d99bf6e15bb60bb1e5f562c003286e35847a`, confirmed
clean entry and exit state, and verified the exact architecture command and an
independent architecture check. Issue #32 is complete.
