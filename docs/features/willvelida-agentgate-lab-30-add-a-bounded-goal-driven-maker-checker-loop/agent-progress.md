---
title: Issue 30 feature progress
description: Evidence log for the bounded goal-driven maker-checker loop.
ms.date: 2026-10-10
---

## Issue

* Repository: `willvelida/agentgate-lab`
* Number: 30
* Title: Add a bounded goal-driven maker-checker loop
* URL: <https://github.com/willvelida/agentgate-lab/issues/30>
* Feature list: `docs/features/willvelida-agentgate-lab-30-add-a-bounded-goal-driven-maker-checker-loop/features_list.json`

## Feature evidence

| ID | Description | Status | Verification | Evidence | Tested date |
| --- | --- | --- | --- | --- | --- |
| F001 | Versioned goal contract declares the loop goal and limits. | pass | `node --test scripts/goal-contract.test.mjs` | Fresh-session evaluator PASS: average 5.0, minimum 5, no required fixes. Final verification passed 3/3, exit 0, run `2026-10-10T09-26-09-834Z-f1040b4c-cbdb-46cc-82cf-d18443f072f8`. Final architecture passed, exit 0, run `2026-10-10T09-25-48-624Z-c7e14866-251f-4d8b-907e-2f32ba77b934`. | 2026-10-10 |
| F002 | Persisted loop state records rounds and supports resume. | pass | `node --test scripts/loop-state.test.mjs` | Fresh-session evaluator PASS: average 5.0, minimum 5, no required fixes. Final verification passed 4/4, exit 0, run `2026-10-10T09-43-04-551Z-29499005-62c8-4b6f-9560-967a17948b4b`. Final architecture passed, exit 0, run `2026-10-10T09-43-02-831Z-09238404-edb3-4973-98cb-2bc6e55f7c60`. | 2026-10-10 |
| F003 | Controller coordinates maker/checker rounds and bounded stops. | pass | `node --test scripts/maker-checker-loop.test.mjs` | Fresh-session evaluator PASS: average 4.8, minimum 4, no required fixes. Final verification passed 8/8, exit 0, run `2026-10-10T11-14-42-578Z-6f1deb30-5ae3-4f27-a286-fb1b9e6e0a50`. Final architecture passed, exit 0, run `2026-10-10T11-14-42-562Z-ea60abc5-4475-465f-8ef4-21c0755ed278`. | 2026-10-10 |
| F004 | Serial execution and publication/verification safety boundaries are enforced. | pass | `node --test scripts/maker-checker-safety.test.mjs` | Fresh-session evaluator PASS: average 5.0, minimum 5, no required fixes. Final safety tests passed 12/12, exit 0, run `2026-10-10T19-36-43-923Z-9a659e65-9327-4880-b599-64829a21ee77`. Final architecture passed, exit 0, run `2026-10-10T19-36-43-921Z-74ba3c44-81c3-4b4d-9810-77d5c76c6bb6`. | 2026-10-10 |
| F005 | Required loop outcomes are covered by automated tests. | not-started | `node --test scripts/maker-checker-loop.test.mjs scripts/loop-state.test.mjs` | Not yet implemented or verified | Not tested |
| F006 | Documentation, progress, and architecture decisions describe the loop. | not-started | `bash scripts/check-architecture.sh` | Not yet implemented or verified | Not tested |

## 2026-10-10 update

* Issue 30 was read from GitHub and split into six independently verifiable
  features.
* Node.js with JSON files was selected as the simplest implementation stack
  because the existing verification runner and tests already use Node.
* F001 is active. Baseline architecture verification passed with run
  `2026-10-10T08-26-13-761Z-99950568-ee0d-4905-8eaf-23dc92ab9baa`, exit 0.
  Baseline harness tests passed 9/9 with run
  `2026-10-10T08-27-08-195Z-47cb87cc-5779-4e41-b135-c4f849922498`, exit 0.
  The reviewed tree was clean before implementation.
* F001 implementation adds `scripts/goal-contract.schema.json`,
  `scripts/goal-contract.mjs`, and `scripts/goal-contract.test.mjs`.
  JSON parsing and ignore-rule validation passed. F001 remains active until a
  fresh-session evaluator reviews the unchanged implementation.
* 2026-10-10: F001 evaluator verdict PASS (avg 5.0, min 5). See evaluator-rubric.md.
* F001 is now `pass`. F002 is unblocked but has not started.
* Final F001 handoff checks passed after the status update: goal-contract tests
  passed 3/3, exit 0, run
  `2026-10-10T09-26-09-834Z-f1040b4c-cbdb-46cc-82cf-d18443f072f8`;
  architecture passed, exit 0, run
  `2026-10-10T09-25-48-624Z-c7e14866-251f-4d8b-907e-2f32ba77b934`.
  One malformed wrapper invocation was rejected before the test launched; the
  corrected invocation produced the recorded passing run.
* F001 was committed with sign-off as
  `e84a6023f950fe5d0c4aa6b4e6bebd4dbe425249`. No push was performed.
* F002 started after F001 was committed. Its scope is limited to persisted loop
  state, complete per-round evidence, and resume decisions. Agent dispatch,
  retries, and limit enforcement remain in F003.
* F002 implementation adds `scripts/loop-state.mjs` and
  `scripts/loop-state.test.mjs`. It writes state atomically, validates loaded
  state, records complete round evidence, stops for pass, blocked work, or
  human intervention, and resumes with the next actor without repeating a
  completed round.
* F002 focused tests passed 4/4, exit 0, run
  `2026-10-10T09-31-49-190Z-b4e62f19-f53b-4913-9beb-5ea781cf2e74`.
  Architecture passed, exit 0, run
  `2026-10-10T09-32-12-168Z-a0c977bc-3161-4b45-bd3e-b0fed01b5f0f`.
  F001 regression tests passed 3/3, exit 0, run
  `2026-10-10T09-32-12-216Z-56e8bc35-076e-4188-b94a-545c56f82261`.
  F002 remains active pending fresh-session evaluation.
* 2026-10-10: F002 evaluator verdict PASS (avg 5.0, min 5). See evaluator-rubric.md.
* F002 is now `pass`. F003 is unblocked but has not started.
* Final F002 handoff checks passed after the status update: loop-state tests
  passed 4/4, exit 0, run
  `2026-10-10T09-43-04-551Z-29499005-62c8-4b6f-9560-967a17948b4b`;
  architecture passed, exit 0, run
  `2026-10-10T09-43-02-831Z-09238404-edb3-4973-98cb-2bc6e55f7c60`.
* F002 was committed with sign-off as
  `10d7027ca72147fa0a70023f1355aadc9e132dca`. No push was performed.
* F003 started with explicit approval to invoke the installed GitHub Copilot
  CLI for Harness Implementer maker sessions and fresh Feature Evaluator
  checker sessions. Deterministic tests will use an injectable dispatcher.
  F004 publication-safety enforcement remains out of scope.
* F003 baseline goal-contract and loop-state tests passed 7/7, exit 0, run
  `2026-10-10T10-46-25-175Z-d61b0eac-6a01-47c5-aadc-4db762bb2ac3`.
  Baseline architecture passed, exit 0, run
  `2026-10-10T10-46-25-143Z-dfd523cf-f3de-480a-b1e9-cf6d5676da1d`.
  Both runs reviewed commit `09b84c9ef03319536ba5a08c77d7252450be5ff6`
  with the pre-existing duplicate F002 evaluator line uncommitted.
* F003 adds a real `copilot` CLI dispatcher, selects the Harness Implementer
  custom agent for maker sessions, and starts each Feature Evaluator checker
  as a fresh process. The injectable scripted dispatcher supports deterministic
  tests and command-line dry runs.
* The controller retries checker failures while limits permit. It stops on
  checker PASS, blocked or ambiguous work, stale reviewed content, repeated
  no-progress maker rounds, dispatch failure, or exhausted round or elapsed
  limits. Review fingerprints exclude only the evaluator's permitted progress
  and rubric outputs; overall dirty state remains recorded.
* Exact F003 verification passed 8/8, exit 0, run
  `2026-10-10T10-50-05-955Z-8e6213e1-4cfe-4fe4-a6c4-b29c5cce518f`.
  An earlier passing 8/8 run,
  `2026-10-10T10-49-08-492Z-5238a737-3a3f-4710-96b0-f8dafa38a76c`,
  preceded the revision-fingerprint fix and is not the final evidence.
* The command-line dry run completed one maker and checker round without
  source or publication changes, exit 0, run
  `2026-10-10T10-50-56-653Z-75c0763d-fd98-42fe-ab46-09b65c59c6c1`.
  Loop-state regression tests passed 4/4, exit 0, run
  `2026-10-10T10-51-19-441Z-6913049f-07a5-45c5-b1d6-95ea0d0b1c0a`.
  Architecture passed, exit 0, run
  `2026-10-10T10-51-19-441Z-8f8b3764-c31f-4acf-a8e1-9b5d1e0c2107`.
* All final runs reviewed commit
  `09b84c9ef03319536ba5a08c77d7252450be5ff6` plus uncommitted F003
  implementation and progress changes. F003 remains `active` pending a fresh
  independent evaluation. F004 remains `not-started`.
* Final post-handoff verification passed 8/8, exit 0, run
  `2026-10-10T10-53-41-776Z-b8c51005-22b5-4fff-97d9-dd719e5c3e3a`.
  Final post-handoff architecture passed, exit 0, run
  `2026-10-10T10-53-41-768Z-a085b03e-5821-48bc-84df-1208e4d3e33f`.
  Only these evidence references changed afterward.
* 2026-10-10: F003 evaluator verdict PASS (avg 4.8, min 4). See evaluator-rubric.md.
* F003 is now `pass`. F004 is unblocked but has not started.
* Final F003 handoff checks passed after the status update: controller tests
  passed 8/8, exit 0, run
  `2026-10-10T11-14-42-578Z-6f1deb30-5ae3-4f27-a286-fb1b9e6e0a50`;
  architecture passed, exit 0, run
  `2026-10-10T11-14-42-562Z-ea60abc5-4475-465f-8ef4-21c0755ed278`.
* F003 was committed with sign-off as
  `3acaba5c081b5b825894f17f8d66c92d0f91f725`. No push was performed.
* F004 started with the approved deny-by-default command policy and
  before/after repository checks. Its baseline controller tests passed 8/8,
  exit 0, run
  `2026-10-10T11-19-14-449Z-3bdc6a43-b0ae-4bc9-ae6a-28383252e961`;
  architecture passed, exit 0, run
  `2026-10-10T11-19-14-449Z-8f494370-34fa-41ae-99b0-c823998de974`.
  Both runs reviewed clean commit
  `0fdcdcadf9994ed3cba03f703ecffe0cde7e345e`.
* F004 adds a default-deny controller launcher, Copilot CLI permission denials,
  disabled built-in GitHub MCP tools, and before/after repository checks.
  Commits, branch changes, acceptance or verification changes, protected goal
  or verification-file changes, and changes to another feature stop the loop
  with `approval-required`. A checker may record PASS for the active feature.
  F005's scenario matrix remains `not-started`.
* Exact F004 verification passed 8/8, exit 0, run
  `2026-10-10T11-28-10-613Z-3ca3cc16-37ca-4210-b24c-2319daabf25a`.
  Controller and loop-state regressions passed 12/12, exit 0, run
  `2026-10-10T11-28-10-697Z-4b1bfe40-c47c-4a28-9500-21b410a25ecb`.
  Architecture passed, exit 0, run
  `2026-10-10T11-28-10-686Z-5fa08a2b-2acb-4422-a45d-4acb9c27a2da`.
  All final runs reviewed commit
  `0fdcdcadf9994ed3cba03f703ecffe0cde7e345e` plus uncommitted F004
  changes. Only these evidence references changed afterward. F004 remains
  `active` pending fresh-session evaluation.
* 2026-10-10: F004 evaluator verdict FAIL (avg 3.4, min 2). See evaluator-rubric.md.
* F004 repair replaced the bypassable direct-command blacklist with a
  capability boundary. Loop sessions cannot use the shell or direct URL
  capability, cannot write Git metadata, and cannot access built-in or
  configured MCP servers. Configured server discovery fails closed.
* Negative tests attempt Git aliases, plumbing commands, push and merge forms,
  `gh api`, direct GitHub URL access, a configured MCP mutation, and a direct
  `.git` write. The test checks that local HEAD and refs, bare-remote refs,
  merge state, and simulated pull-request mutations remain unchanged.
* Pre-repair exact tests passed 8/8, exit 0, run
  `2026-10-10T18-27-42-550Z-237b5f01-377a-4ab3-9bcf-7d629b8c9b83`.
  Pre-repair controller regressions passed 12/12, exit 0, run
  `2026-10-10T18-27-42-550Z-57945e47-cf7b-4fd7-a9fa-bd882daa9d06`.
  Pre-repair architecture passed, exit 0, run
  `2026-10-10T18-27-42-542Z-1acbc1d7-78ed-4621-8b01-03228eafd694`.
* Final repaired exact F004 tests passed 11/11, exit 0, run
  `2026-10-10T18-35-35-333Z-bbf0aa8c-edfc-4428-8d5a-acab02351a2e`.
  Controller and loop-state regressions passed 12/12, exit 0, run
  `2026-10-10T18-30-53-013Z-f81428dc-dca0-4ba1-a093-d753381bd27a`.
  Final architecture passed after the handoff updates, exit 0, run
  `2026-10-10T18-34-04-404Z-6a565960-0590-49fe-a6ae-8f91375ff66c`.
  All runs reviewed commit
  `0fdcdcadf9994ed3cba03f703ecffe0cde7e345e` plus uncommitted F004
  changes. Only the final architecture evidence reference changed afterward.
  F004 remains `active`; F005 remains `not-started`.
* 2026-10-11: F004 evaluator verdict FAIL (avg 4.0, min 2). MCP listing parsing silently omits unrecognized protocol entries such as `(http)`; require fail-closed discovery and test dispatch arguments. See evaluator-rubric.md.
* F004 MCP inventory repair recognizes `(http)` servers and rejects every
  unrecognized non-heading inventory line. Exact safety tests passed 12/12,
  exit 0, run
  `2026-10-10T18-52-31-585Z-014e8190-abda-4d24-96b7-633f77fb8a6d`;
  architecture passed, exit 0, run
  `2026-10-10T18-52-30-189Z-886ef0a0-4b7a-4478-810b-8db383964148`.
  F004 remains `active` pending a fresh evaluation of the repaired parser.
* 2026-10-11: F004 evaluator verdict PASS (avg 5.0, min 5). See evaluator-rubric.md.
* F004 is now `pass`. F005 is unblocked but has not started.
* Final F004 post-verdict checks passed: safety tests 12/12, exit 0, run
  `2026-10-10T19-36-43-923Z-9a659e65-9327-4880-b599-64829a21ee77`;
  architecture, exit 0, run
  `2026-10-10T19-36-43-921Z-74ba3c44-81c3-4b4d-9810-77d5c76c6bb6`.
* F004 was committed with sign-off as
  `e36bde020d2a86083c35759808b985dbce312e8bc`. No push was performed.
