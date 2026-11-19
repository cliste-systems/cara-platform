# Connection-gated setup and trial

New embedded public signup subscriptions carry `cliste_trial_activation=forwarded_call`.
They are created with a long setup hold and immediately put on Stripe's indefinite
`pause_collection.behavior=void` hold before the SetupIntent is returned. If applying
the hold fails, the new subscription is cancelled. No paid setup invoice item is
created until connection is confirmed. The customer-facing seven days begin only
when a verified forwarded call has completed. Existing subscriptions retain their
agreed schedule; this change does not retrospectively move customer billing dates.

The temporary Stripe trial is a setup hold, not the advertised trial. Customer
billing views hide its deadline and show Connection pending. Be aware that Stripe's
own Dashboard/portal can display this technical hold date. Any future portal
subscription-editing configuration must preserve the connection hold; operators
must not manually resume collection before the connection is confirmed.

Evidence is stored in the service-role-only `customer_phone_connections` table.
Authenticated owner actions can save the existing business number and device/provider
but cannot set verified status. Verification reads the corresponding call directly
from Twilio's authenticated Call API. It requires an inbound completed call, more
than ten seconds, the assigned Cara destination, the saved business forwarding
source, and a call made after the connection request. A direct Cara call fails.
Worker call-close processing checks after calls; an open checking screen also checks
every twenty seconds. If a carrier omits `forwardedFrom`, stay pending and route to
Support. Do not infer forwarding solely from a successful direct test or a client flag.

A verified timestamp fixes the seven-day trial deadline. Stripe mutations use stable
idempotency keys; the durable activation receipt is written only after Stripe succeeds.
A failed activation leaves the line pending and can retry through the connection check.
The existing call-analysis scheduler also retries up to two verified activations per run; no new recurring job is added.
Setup fees use a separate idempotency key and join the invoice at trial end.

Dashboard access is independent of connection completion after the prerequisites/test.
The persistent Connection pending card reopens step 06. Support requests store the
saved phone/provider context in the existing support ticket system. Preview states
are development-only and never make phone calls, send tickets or activate billing.

Verification: TypeScript, ESLint and 53 focused tests passed. A Stripe sandbox smoke
test confirmed a saved card while held, followed by a seven-day trial with collection
unpaused and zero due immediately. Disposable sandbox customer/subscription removed.
Database RLS and no anon/authenticated table grants verified. No real forwarded
carrier call has been tested, and this app change has not been deployed publicly.

## Number confirmation

Connection entry uses pinned libphonenumber-js metadata restricted to Ireland
(`scripts/build-irish-phone-metadata.cjs` regenerates the 1.2 KB metadata file).
Accepts domestic and international +353/00353 forms, an optional domestic (0),
and common spacing/punctuation. Rejects incomplete/unallocated ranges,
non-Irish numbers, service/premium numbers, extensions, assigned Cara destination,
and mobile/landline selection mismatches on both client and save action.

The owner's authenticated number-inspection action makes one bounded, rate-limited
Twilio Basic Lookup with no paid Fields. Unknown/timeout responses are explicitly
unavailable, never invalid. The confirmation dialog shows the national and E.164
number plus metadata-derived line type. It never claims active service, carrier,
company identity, or ownership. Local previews only perform format checks.
Edit/Close cancels preparation and preserves inputs; confirmation precedes saving
and instruction display. Forwarded-call evidence remains the only automatic
connection proof. Forty-seven relevant checks passed, including unavailable
lookup handling, input formats and selection mismatches.

## Security and recovery hardening

Applied migration `20261025003916_setup_recovery_hardening` adds a private
activation lease, retry schedule, setup invoice-item receipt and assisted-review
attribution. All new RPCs are service-role-only. Configuration is compiled first,
then saved with progress in one version-checked transaction; opening the dashboard
merges its receipt under the same organization lock. Failed compilation leaves the
previous configuration untouched.

Activation workers reconcile Stripe's connection metadata before retrying mutations,
and search existing setup items if a remote success lost its local receipt. A worker
lease prevents concurrent activation. Failed records move fifteen minutes into the
future so the bounded two-item recovery batch can process other accounts. A prolonged
outage that would consume the entire unstarted trial grants seven days from recovery;
its chosen deadline is persisted. Existing activated trials retain their deadline.
Disabled lines cannot activate. Failed Twilio call reads no longer hide other evidence.

Support ticket creation/linking is atomic and deduplicated; a closed ticket permits a
fresh request. Staff can use the customer Phone & routing panel to review a specific
Twilio call and attest that they witnessed forwarding when carrier metadata is absent.
The server checks tenant, assigned destination, request time, completion and duration;
the decision and reviewer note are audited. Legacy mark-verified cannot bypass this.

Pending subscriptions cannot open the generic Stripe subscription portal. They can
open the payment-method update flow or explicitly cancel setup immediately, without
proration or invoicing. The customer must confirm cancellation. Stripe's underlying
technical hold still exists for operators; it is not an advertised customer trial.

Greeting safety timeouts and invalid model responses now block saving with a retry
message. Successful callback/action/transfer outcomes count for the direct test call.

Verification: 72 focused tests passed, including lost receipts, concurrent worker
exclusion, delayed recovery, disabled lines and unavailable moderation. A rolled-back
SQL smoke test verified atomic saves, stale-write rejection, dashboard prerequisites,
lease exclusion and support deduplication. No smoke data retained. TypeScript and
focused ESLint passed. Waiting/help states checked at 390px mobile and short 1280x720
desktop; neither desktop state needs inner scrolling. Real carrier calls and live
Stripe billing were not exercised by these tests. Application changes remain local.
