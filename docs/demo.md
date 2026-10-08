---
title: Five-Minute Gateway Demo
description: Proposed public demonstration of real agent identity, expiring grants, ACS decisions, human approval, and audit.
ms.date: 2026-10-08
---

## Preconditions

The application and Azure integration must be implemented and tested first.
The React portal, BFF, worker flow, and diagnostic harness are not yet available.

Provision and warm the environment before recording. Use two real child
Agent IDs, a synthetic ticket, the authenticated React/BFF portal,
a pinned ACS policy bundle, and a sanitized history screen.

Assign the demo user viewer, operator, approver, and audit permissions.
Requester self-approval is enabled for this single-user demo and must be
labeled as human confirmation, not separation of duties.
Keep the portal and trusted dispatcher warm and time the event-driven jobs
before recording; job startup is not the same as the UI polling interval.

Never show bearer tokens, grant handles, real tenant configuration, or private
ticket contents. Use display aliases in the recording. Keep real evidence
private and generate a separate sanitized export.

## Demo sequence

| Time      | Action                                                         | Visible proof                                      |
|-----------|----------------------------------------------------------------|----------------------------------------------------|
| 0:00-0:35 | Sign in, browse tickets, select the synthetic ticket           | React UI, human identity, and distinct agent aliases |
| 0:35-1:05 | Use trusted harness for agent read without grant; open history| Default deny, real record, zero handler executions   |
| 1:05-1:40 | Submit a read task for agent A from ticket detail               | Durable acceptance, scoped grant, recorded read      |
| 1:40-2:10 | Use harness for cross-agent grant misuse; inspect UI history    | Agent B principal mismatch, separate fresh grant     |
| 2:10-3:05 | Submit priority-change task and review pending approval        | Exact old/new values, deadline, no early mutation     |
| 3:05-3:35 | Confirm self-approval in UI; wait for resumed execution         | One committed change and authentic human approval   |
| 3:35-4:05 | Replay/expiry harness cases; reopen the task timeline           | Stable denial reasons and no duplicate mutation      |
| 4:05-4:35 | Show output redaction and verified private-backend rejection   | Actual redacted result and recorded bypass test      |
| 4:35-5:00 | Inspect sanitized history and summarize boundaries             | Identity, decision, scope, result, policy, correlation |

Use separate grants for the successful read, cross-agent misuse, approved
write, and expiry example so one scenario does not hide another's cause.
Issue the short-expiry grant near the start and use the intervening approval
step to allow it to expire naturally.

Negative cases use a separate trusted diagnostic harness with real agent tokens,
not a browser endpoint accepting arbitrary tool calls or job templates.
If tests are run before recording, label their evidence as recorded tests rather
than pretending the UI executed them live.

Task acceptance and human approval are not execution success. Wait for the
gateway's committed result before showing the new priority.

## Closing message

Entra identifies the agent. APIM protects ingress and private backend access.
The broker constrains permission to a task. ACS supplies portable deterministic
policy decisions. The trusted host enforces those decisions, human approval,
expiry, and audit before execution.

A valid OAuth token or a persuasive prompt is not permission to use a tool.

## Recording checklist

* Demonstrate real Agent ID and APIM, not only mocks.
* Show denials before successful operations.
* Show the human authentication and exact approval binding.
* Show the requester self-approval label and avoid a separation-of-duties claim.
* Demonstrate the browser workflow, not only CLI calls.
* Keep tokens and grant handles out of browser data and the recording.
* Show the private backend and the attempted bypass denial.
* Publish synthetic evidence and clear preview/Developer-tier limitations.
* Record a successful dry run within five minutes before publication.

See the [acceptance tests](./acceptance-tests.md) for the evidence required
before the demo can be advertised as working.
