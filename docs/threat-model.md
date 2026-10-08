---
title: Identity-Focused Gateway Threat Model
description: Design-time threats, trust boundaries, mitigations, and residual risks for the support-ticket MVP.
ms.date: 2026-10-08
---

## Status and assumptions

Design-time threat model, not a security assessment of implemented software.
All mitigations below are requirements to implement and test.

The model and agent process may make arbitrary tool requests, skip cooperative
hooks, repeat requests, or contain hostile instructions. The trusted gateway,
its deployment pipeline, policy bundle, Entra issuer, and grant/audit store
form the security boundary.

The demo is single-tenant, uses synthetic tickets, and has one permitted
write action. A malicious tenant administrator, compromised gateway host,
or compromised policy publisher is outside the prevention claim.

The React/BFF portal is a separate public workload. Browsers and submitted
form/JSON fields are untrusted. The BFF handles human sessions but cannot access
the ticket/grant Table, impersonate agents, publish work, or execute tools.
The confirmed demo allows requester self-approval, not agent self-approval.

## Assets and principals

| Asset or principal       | Protection requirement                                      |
|--------------------------|-------------------------------------------------------------|
| Child agent identity     | Distinct attribution and narrow API permission              |
| Blueprint credential/FIC | No reusable secret in source; constrain who can use it      |
| Human approver identity  | No agent impersonation or forged approval                    |
| Task grant               | Agent/action/resource binding, expiry, revocation, one use   |
| Approval                 | Bind to immutable action and resource version                |
| Synthetic ticket state   | Only authorized and audited changes                          |
| ACS policy bundle        | Versioned, deployment-owned, fail-closed loading             |
| Audit ledger             | Durable outcome evidence with restricted write access        |
| APIM managed identity    | Restricted backend audience and resource permissions         |
| Logs and repository      | No raw tokens, secrets, private data, or internal documents   |
| Browser session          | Cookie confidentiality, CSRF protection, account isolation   |
| BFF token cache/key ring | Server-only tokens and narrowly scoped key persistence       |
| Pending UI action        | Exact server action/version, with no optimistic mutation     |
| Task/outbox/work message | Durable intent, scoped claims, and idempotent stage handling  |

## Trust boundaries

1. Human login and administrative consent are separate from agent authentication.
1. Entra authenticates the principal; it does not approve a ticket operation.
1. The model/agent workload cannot issue grants or access the state store.
1. APIM authenticates the caller and itself to a private backend.
1. The backend validates caller proof, constructs trusted ACS facts, and enforces the verdict.
1. The tool executor commits state, grant consumption, and audit atomically.
1. Telemetry leaves the execution path only after sanitization.
1. React uses a session cookie; the BFF acquires delegated user tokens server-side.
1. Human-read/approval routes authorize the resource independently of agent tool grants.
1. A durable broker/outbox dispatches work without granting the BFF job-start privileges.
1. Agent jobs retrieve context as their own child principal, never using a human token.

## Threats and required mitigations

| Threat                                   | Required mitigation                                                       | Test evidence |
|------------------------------------------|---------------------------------------------------------------------------|---------------|
| Forged agent ID in a header/body          | Derive identity from a valid Entra JWT; overwrite internal headers          | A01-A04       |
| Ordinary app presented as an agent        | Require enrolled child principal plus the correct API role                 | A05           |
| Sibling agent uses another agent's grant  | Bind grant to validated tenant/principal, not parent blueprint             | G02           |
| Prompt requests grant creation           | Broker accepts only authorized human client/role; agent token denied       | H01           |
| Model claims approval was granted         | Load human approval from trusted storage, never prompt/body                | H02-H04       |
| Token remains valid after task expiry     | Check task clock and grant state on each invocation                        | G03-G04       |
| Identity disabled but token still cached  | Revoke local grants immediately; test new token issuance separately        | G05, Z04      |
| Grant handle stolen                       | Bind it to authenticated principal and exact arguments                    | G02, G06      |
| Approval reused for different arguments   | Canonical argument digest and resource version binding                     | H03, G06      |
| Grant replay or concurrent duplicate      | One-use state, ETags, transactional mutation, scoped idempotency            | R01-R04       |
| Decision/execution time-of-check gap       | Final trusted check immediately before atomic consumption and mutation     | R02-R03       |
| Direct backend bypass                     | Private ingress plus APIM managed identity/role validation                 | Z01-Z03       |
| APIM becomes a confused deputy            | Fixed backend/route; no user-controlled URL; least-privilege MI              | A06, Z03      |
| Caller injects trusted snapshot facts     | Construct gateway snapshot from verified claims and stored records         | C05           |
| ACS removed from agent host               | Independent gateway ACS decision before all tool handlers                  | C06           |
| Policy engine or native library fails     | Block startup or deny request; expose dependency error without execution    | C01-C03       |
| Escalation treated as permission          | Suspend/block until authenticated action-bound approval and re-evaluation   | H04, C04      |
| Transform diverges from actual execution  | Apply validated result/output transforms; block write-argument transforms   | C07-C08       |
| Post-tool denial misrepresented as undo   | Authorize writes before commit; disclose committed-but-output-blocked state | C09           |
| Sensitive output streamed before checks   | Buffered output; no unchecked streaming in MVP                              | C10           |
| Audit write fails but tool still executes | Make durable audit part of the execution transaction                       | L01           |
| Best-effort ACS/OTel drops evidence        | Separate durable audit from telemetry; visible export failure              | L02           |
| Token or grant leaked into logs/GitHub     | Redaction, allowlisted fields, sanitized exports, secret scanning            | L03-L04       |
| Shared blueprint credential abused         | Trusted host isolation, narrow child enrollment, MI/FIC, provisioning split  | A05, Z05      |
| Policy editor elevates APIM permissions    | Treat policy edit as privileged access; review grants and changes           | Z05           |
| Arbitrary tools/URLs/paths become available | Fixed tool registry and typed argument schema; reject unknown inputs        | G07           |
| Browser forges role, identity, or scope     | Human delegated token, server roles/resource checks, reject privileged fields | U03, U08-U09 |
| Cookie session used for a forged approval | Explicit antiforgery validation on every unsafe BFF request                  | U02           |
| Ticket/model content injects browser script| Text rendering, CSP, no untrusted HTML, server-only bearer tokens             | U04-U05       |
| BFF turns into a generic credential proxy | Fixed route map, validated local redirects, no browser-controlled upstream    | U06, U10      |
| UI bypasses the gateway to edit priority | No direct human mutation API or Table access; preserve agent approval path    | U07, U15      |
| Stale approval or optimistic UI lies      | Server action/version binding and authoritative committed result             | U11-U13       |
| Cached data leaks after switching accounts| Clear frontend caches, no-store responses, backend resource authorization     | U09, U14      |
| Cache loss triggers replay of a mutation | Explicit re-sign-in and durable request/idempotency lookup                    | U16-U17       |
| Public portal accidentally exposes executor| Separate environments, correct ingress, no environment-route backdoor         | U15, Z01-Z03  |
| Queue duplicate or crash loses task state| Same-partition outbox, versioned stage claim, leases, idempotent execution      | Q01-Q04       |
| Browser/job-start rights expose worker MI| No portal ARM job-start rights; fixed privileged job configuration             | Q05           |
| Approval wait preserves stale permission | Persistent pending action; original deadline; new explicit task after expiry  | Q06           |
| Worker reports a fake execution success  | UI execution truth derives from gateway ledger, not progress messages         | Q07           |

## Failure behavior

Authentication failure returns an authentication error and never executes a
tool. Authorization failure returns a stable deny reason. Pending approval
is a blocked action, not a successful tool result.

Infrastructure failure, policy evaluation failure, and malformed policy are
explicit failures. They must not be converted into an allow, an empty successful
response, or a "best effort" mutation.

If a transaction committed but the response was lost, retrieve the recorded
outcome instead of retrying the mutation blindly. If output policy blocks a
committed write's response, retain the real committed outcome in the audit.

## Residual risks and limitations

* ACS lifecycle adapters are cooperative hooks, not process sandboxing.
* A compromised blueprint host can impersonate child identities permitted by its trust relationship.
* Bearer token theft remains possible; task binding reduces but does not eliminate impact.
* Entra token caching and permission propagation affect disable/consent experiments.
* Table Storage audit records are not immutable against a privileged administrator.
* Post-execution policy cannot undo external side effects.
* Network and identity controls do not guarantee prompt-injection detection.
* Developer tier and a single gateway/partition provide no production availability guarantee.
* ACS preview API, native binary, and policy changes require pinned conformance tests.
* Requester self-approval is a demo convenience and does not provide separation of duties.
* The single-replica in-memory user-token cache requires re-sign-in after restart.
* A compromised BFF can act within cached human permissions; API checks and scope remain necessary.
* Queue delivery is at least once; durable outbox publishing can duplicate messages.
* A distributed transaction cannot atomically commit a Table write and a Queue publish.

## Public evidence

Publish a synthetic trust-boundary diagram, selected sanitized denial records,
attack/deny test results, and documented limitations. Do not publish tenant
configuration, raw token claims, confidential tickets, or internal adaptations.

See the [test plan](./acceptance-tests.md) for measurable checks and the
[research plan](./research-and-build-plan.md) for technical sources.

See the [UI and workflow design](./ui-and-workflow-design.md) for browser,
human identity, hosting, and dispatch boundaries.
