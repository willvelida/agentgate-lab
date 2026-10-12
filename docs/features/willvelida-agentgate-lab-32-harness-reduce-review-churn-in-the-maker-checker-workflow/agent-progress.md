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
| F001 | The verification boundary no longer depends on parsing JavaScript imports. | active | `node --test scripts/maker-checker-safety.test.mjs` | Run `2026-10-12T00-14-41-029Z-a6cc54dc-7da2-4f48-9695-efdafa062a5a`, pass, 33/33 | Tested, awaiting evaluator |
| F002 | The PR-comment workflow documents and checks both inline threads and review summary bodies. | not-started | `node --test scripts/maker-checker-loop.test.mjs` | Not yet implemented or verified | Not tested |
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

F001 stays `active`. It must not be marked `pass` until a fresh-session
`feature-evaluator` run records a PASS verdict here.
