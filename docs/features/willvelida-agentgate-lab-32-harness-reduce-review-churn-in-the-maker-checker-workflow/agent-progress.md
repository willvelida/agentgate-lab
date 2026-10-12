---
title: "Issue #32 feature progress"
description: "Implementation evidence for reducing review churn in the maker-checker workflow."
ms.date: 2026-10-12
---

# Issue #32: harness: reduce review churn in the maker-checker workflow

* Repository: `willvelida/agentgate-lab`
* Issue: [#32](https://github.com/willvelida/agentgate-lab/issues/32)
* Feature list: [features_list.json](./features_list.json)

| Feature | Description | Status | Verification | Evidence | Tested |
| --- | --- | --- | --- | --- | --- |
| F001 | The verification boundary no longer depends on parsing JavaScript imports. | pass | `node --test scripts/maker-checker-safety.test.mjs` | Implementation run `2026-10-12T00-14-41-029Z-a6cc54dc-7da2-4f48-9695-efdafa062a5a`, pass, 33/33; evaluator run `2026-10-12T00-47-01-722Z-23042c86-f079-4afe-b274-3e546a889f96`, pass, 33/33 | 2026-10-12, evaluator PASS |
| F002 | The PR-comment workflow documents and checks both inline threads and review summary bodies. | active | `node --test scripts/maker-checker-loop.test.mjs` | Run `2026-10-12T02-30-01-141Z-2c06eb3d-27d8-4a03-b684-b2b340d9392c`, pass, 32/32 | Tested, awaiting evaluator |
| F003 | The evaluator workflow requires a committed, unchanged revision. | not-started | `node --test scripts/maker-checker-loop.test.mjs` | Not yet implemented or verified | Not tested |
| F004 | A decision records the loop's accepted limits. | not-started | `bash scripts/check-architecture.sh` | Not yet implemented or verified | Not tested |

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
