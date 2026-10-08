---
title: Gateway Acceptance and Attack Tests
description: Proposed automated evidence for identity binding, ACS enforcement, expiry, approval, audit, and Azure isolation.
ms.date: 2026-10-08
---

## Test status

Planned tests, not executed tests. The MVP is complete only when the relevant
checks run against the implemented system and the real Azure integration.

Every deny test must assert both the response/reason and zero tool handler
executions or mutations. A plausible HTTP response alone is insufficient.

## Identity and transport

| ID  | Scenario                                                | Required result                                             |
|-----|---------------------------------------------------------|-------------------------------------------------------------|
| A01 | Missing bearer token                                    | 401; no execution; identity recorded as unknown              |
| A02 | Invalid signature, issuer, tenant, audience, expiry      | Reject every variant; no trusted identity from rejected JWT  |
| A03 | Body/header claims another agent                        | Ignore forged identity; use validated principal             |
| A04 | Inject internal caller-token header                     | APIM overwrites it; backend rejects absent/invalid proof    |
| A05 | Normal app or blueprint principal calls agent route     | Deny unenrolled principal even if token format is valid     |
| A06 | User-controlled backend/model URL                       | Reject; tokens never forwarded outside fixed destinations   |
| A07 | Two real child identities acquire resource tokens       | Distinct validated principal/client IDs and narrow role     |

## Grants and scope

| ID  | Scenario                                                | Required result                                             |
|-----|---------------------------------------------------------|-------------------------------------------------------------|
| G01 | Valid Agent ID token without task grant                  | 403; default deny; handler count zero                       |
| G02 | Agent B presents agent A's grant                         | Deny principal mismatch                                    |
| G03 | Clock one tick before, at, and after `expires_at`         | Permit only strictly before expiry                         |
| G04 | Future start, invalid lifetime, or lifetime over 300 sec  | Broker rejects/clamps by documented policy; no broad grant  |
| G05 | Grant revoked while OAuth token remains valid            | Next call denied without waiting for OAuth expiry          |
| G06 | Change ticket, tool, priority, task, or argument digest   | Deny every mismatch                                        |
| G07 | Unknown tool, unexpected JSON field, malformed priority  | Reject typed schema; no alternate handler/URL/path          |
| G08 | Valid single-use read grant                              | Exactly one authorized read and durable outcome            |

Use an injected clock for fast expiry tests. Also run one real Azure expiry
test with a short grant lifetime and a still-valid Entra token.

## Human approval

| ID  | Scenario                                                | Required result                                             |
|-----|---------------------------------------------------------|-------------------------------------------------------------|
| H01 | Agent token issues grant or calls approval route         | Deny; only authorized human client/role accepted            |
| H02 | Agent passes `approved=true` or fabricated approver ID   | Ignore/reject; stored approval remains authoritative        |
| H03 | Reuse approval for changed action or resource version   | Deny; require new action-bound approval                     |
| H04 | ACS escalates with no approved resolver outcome          | Block/suspend; no tool execution                           |
| H05 | Authenticated human approves exact pending action        | One write after final grant/approval checks                |
| H06 | Approval expired, denied, revoked, or wrong human role    | Deny each case                                              |

## ACS and lifecycle

| ID  | Scenario                                                | Required result                                             |
|-----|---------------------------------------------------------|-------------------------------------------------------------|
| C01 | Missing/invalid manifest or native runtime               | Startup fails explicitly; readiness not reported healthy   |
| C02 | Missing OPA, policy exception, timeout, invalid verdict   | Deny/fail; no permissive fallback                           |
| C03 | Missing trusted fact or unknown tool in snapshot          | Deny                                                       |
| C04 | Exercise allow, warn, deny, escalate, transform           | Pinned contract respected; no verdict bypasses base checks |
| C05 | Caller injects approval/classification/history facts     | Trusted gateway snapshot overrides/rejects spoofed facts   |
| C06 | Skip agent-side pre-tool hook and call gateway directly  | Gateway still evaluates ACS and denies invalid request     |
| C07 | Result/output transform removes synthetic restricted tag| Actual released value redacted; not only logged value      |
| C08 | Transform changes previously approved write arguments    | Block and require new grant/approval                        |
| C09 | Post-tool deny after committed synthetic write            | Output blocked; committed state retained and audited       |
| C10 | Model proposes restricted output                         | No output released before post-model and output checks     |
| C11 | Real Agent Framework run executes one tool               | Applicable lifecycle points present in correlated evidence |
| C12 | Same bundle/snapshot through agent and direct ACS host    | Identical decision, reason, action identity, transformed value |
| C13 | `RunToolAsync` manifest omits post-tool policy             | Explicit fail-closed result; complete manifest works        |

In C12, compare the same intervention point and identical trusted facts.
Different caller inputs do not constitute a portability test.
Run policy/native fixtures in the target Linux container as well as the
development environment.

## Concurrency and retry

| ID  | Scenario                                                | Required result                                             |
|-----|---------------------------------------------------------|-------------------------------------------------------------|
| R01 | 20 simultaneous new invocations share one write grant   | Exactly one committed mutation and grant consumption        |
| R02 | Grant/ticket ETag changes before transaction commit      | Conflict denied/re-evaluated; no stale authorization commit  |
| R03 | Crash or cancellation around transaction boundary        | Either no commit, or committed outcome discoverable         |
| R04 | Repeat same scoped idempotency key after lost response    | Recorded result returned; mutation count remains one         |
| R05 | New key or changed arguments tries consumed grant        | Deny; not treated as an idempotent retry                    |

## Audit and publication

| ID  | Scenario                                                | Required result                                             |
|-----|---------------------------------------------------------|-------------------------------------------------------------|
| L01 | Durable audit/state storage unavailable                  | No mutation; explicit dependency failure                    |
| L02 | ACS or OpenTelemetry sink fails                          | Durable tool evidence still present; export failure visible |
| L03 | Inspect logs after tokens, grants, and marker data used   | No raw credentials, grant handles, prompts, or ticket text  |
| L04 | Inspect public repository/export                         | Only synthetic evidence; no protected PDF/private settings  |
| L05 | Correlate every attempted tool invocation                | Identity status, decision, scope, result, policy and trace  |

Denied unauthenticated requests have no verified agent identity.
Backend audit cannot cover an APIM rejection it never received; collect
the corresponding sanitized APIM rejection evidence separately.

## Real Azure controls

| ID  | Scenario                                                | Required result                                             |
|-----|---------------------------------------------------------|-------------------------------------------------------------|
| Z01 | Request private tool backend from outside VNet           | Not reachable; no public ingress                           |
| Z02 | VNet caller without APIM transport identity              | Backend rejects                                             |
| Z03 | Agent invokes backend with its own resource token        | Reject; APIM transport identity/role required               |
| Z04 | Disable child identity or apply scoped CA block           | New token acquisition fails; existing-token limits disclosed |
| Z05 | Agent identity accesses storage, vault, or grant control | Deny each privilege not assigned                            |
| Z06 | APIM forwards authenticated request to private backend   | DNS, TLS, transport identity, caller validation all succeed  |
| Z07 | APIM model route uses backend managed identity           | Real model response and attributable caller audit           |

Z04's Conditional Access variant is conditional on confirmed licensing and
report-only validation. It must not change tenant-wide policies for a demo.

## Execution strategy

### Browser, UI, and BFF checks

These add to the gateway tests; a working React mock is not evidence of real
Entra authentication, CSRF protection, or APIM enforcement.

| ID  | Scenario                                                 | Required result                                              |
|-----|----------------------------------------------------------|--------------------------------------------------------------|
| U01 | Load protected BFF data without a session                 | JSON 401; no ticket data and no login HTML inside API response |
| U02 | Missing/invalid CSRF token on submit/approve/reject/cancel/logout | Reject all variants; no state change                       |
| U03 | Modify browser capabilities, requester, role, expiry, or grant fields | API ignores/rejects spoofed privilege; correct human audited |
| U04 | Inspect frontend bundles/storage/BFF responses            | No access/refresh token, client secret, or agent grant handle  |
| U05 | Ticket/model text contains HTML/script and hostile links  | Render inert text; no script execution or unsafe navigation   |
| U06 | Spoof forwarded host or external login return URL         | Reject unsafe redirect; registered callback remains correct   |
| U07 | Human tries direct ticket-priority mutation               | No bypass route; only the authorized agent workflow mutates    |
| U08 | Agent app-only token calls human/approval routes           | Deny; no human role or authenticated human approval implied    |
| U09 | Guess another task/action ID without resource permission  | No unauthorized detail, approval, history, or cancellation     |
| U10 | Supply generic upstream URL or unknown `/bff` route       | No proxying; no SPA fallback masquerading as a successful API  |
| U11 | Approve action after ticket/action version changes        | Conflict; user must review current exact action               |
| U12 | Approved or accepted task is not yet committed            | UI keeps requested/approved distinct from ticket state        |
| U13 | Expiry/cancellation races with execution commit           | Show authoritative outcome; never claim rollback after commit |
| U14 | Sign out or switch accounts                              | Clear cached data; old account's UI data not displayed        |
| U15 | Portal identity accesses ticket Table or private transport API | Deny; public portal does not expose the private gateway    |
| U16 | Restart portal with persistent cookie but empty token cache | Explicit re-sign-in; tasks/approvals still retrievable       |
| U17 | Lose submit/approval response and repeat action           | Same request key recovers one outcome; no duplicate task/write|
| U18 | API fails, throttles, or denies while polling             | Visible distinct error; bounded retry; no empty success list   |
| U19 | Task reaches terminal state or page becomes hidden       | Stop polling; polling never renews a grant                    |
| U20 | Requester with both roles approves own pending action    | Allowed only by server-owned demo policy; self-approval labeled |
| U21 | Requester without approver role attempts self-approval   | Deny; convenience mode does not bypass role enforcement        |
| U22 | Portal key ring used by agent or unauthorized workload   | Deny; cookie keys scoped to BFF storage/key identity            |
| U23 | Keyboard-only dashboard and approval dialog interaction  | Reachable controls, labeled fields, focus return, text statuses |
| U24 | Run published React build from ASP.NET Core origin       | Deep links work; assets load; auth/API paths are not swallowed  |

Use isolated test identities/providers for ordinary browser tests, not a
deployed authentication-bypass switch. Put real browser auth state, screenshots,
and raw traces under ignored `.local` paths. Run the real Entra/APIM browser
flow separately with authorized credentials; do not publish the raw trace.

### Durable workflow checks

| ID  | Scenario                                                 | Required result                                              |
|-----|----------------------------------------------------------|--------------------------------------------------------------|
| Q01 | Crash after task/outbox commit before queue publish       | Task remains recoverable; dispatcher eventually publishes     |
| Q02 | Crash after publish before marking outbox dispatched      | Duplicate delivery causes no duplicate stage/mutation         |
| Q03 | Two workers claim same task version/stage                 | One valid lease; unauthorized/stale claim rejected             |
| Q04 | Job exits waiting for approval; approve and resume        | Durable context reused; no repeat of consumed read/mutation     |
| Q05 | Browser/BFF submits job template or writes work queue      | No job-start/queue permissions or generic execution endpoint   |
| Q06 | Approval arrives after original task deadline             | Expired task denied; no silent grant renewal                   |
| Q07 | Worker reports success without gateway execution record  | UI/audit do not classify the write as committed               |

Queue tests must include duplicate messages, lease expiry, poison work, and
visible terminal failures after bounded retries. Queue visibility timeout and
job execution timeout are not authorization expiry.

### Runner layers

* Use unit tests with a fake clock for grant/approval boundaries and trusted snapshot building.
* Use policy fixtures plus the real native ACS runtime for verdict and transform conformance.
* Use isolated storage integration tests for ETags, transactions, and retries.
* Use API integration tests for transport and caller-token validation.
* Use React type/component tests for forms, pending states, errors, and cache isolation.
* Use Playwright against the published BFF-hosted frontend for browser/security flows.
* Use job/outbox integration tests for recoverability and idempotent dispatch.
* Run real Azure tests manually with trusted credentials and synthetic data.
* Keep untrusted pull requests away from cloud credentials and deployment permissions.

Proposed demo performance target: non-model tool invocations have warm p95
latency below one second across 100 requests, including policy and audit work.
Record failures and actual measurements; this is a target, not a benchmark
claim. Separate cold-start, model, approval, and infrastructure deployment time.

Proposed warm UI target: ticket list/detail API p95 below one second across 100
reads, and a committed task-state change visible within five seconds with the
two-second polling design. Measure queue start and model time separately;
job scale intervals/cold starts must fit the 300-second deadline and demo timing.
These are acceptance targets, not measured results.

No production availability or broad prompt-injection prevention claim is made.
