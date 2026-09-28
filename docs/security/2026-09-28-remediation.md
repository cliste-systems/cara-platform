# Security remediation — 28 September 2026

The seven findings from the two-codebase review are addressed in the working source:

- Privileged admin actions and APIs enforce MFA by default; enrollment remains an explicit AAL1 exception.
- Owner-only business mutations require both the protected profile role and current account membership. Restrictive database/storage policies also deny member writes without weakening tenant isolation.
- Fixed seed credentials and password logging are removed. Seed entrypoints require explicit local/test target acknowledgement and strong unique credentials. The three identified active seeded-account passwords were rotated through Supabase Auth; no matching sessions remained afterward.
- Website imports reject private/mapped IPs and pin the actual HTTP connection to validated DNS results. Redirects are revalidated; one deadline and compressed/decompressed response limits apply.
- Login identity buckets no longer depend on User-Agent. Database counters update atomically and fail closed; paid voice previews reserve verified-actor budgets before provider work.
- Caller email uses a trusted call room, shares the worker's three-message SMS/email budget, and requires a durable backend reservation. Backend limits are three emails per call and per recipient-hour, 60 per organization-hour, and 300 per organization-day. Retries use a stable provider idempotency key; budget records expire after 30 days.
- Worker quota totals are aggregated inside PostgreSQL, preventing REST row limits from hiding usage.

Both dependency audits report zero vulnerabilities. LiveKit stays on the 1.9.0 family. Deployment actions and the CLI installer are pinned; account seed safeguards run in CI. Type checking now blocks the web build and CI.

Applied database migration versions:

- `20260928202503_security_owner_writes_and_voice_budgets`
- `20260928204945_security_auth_rate_limits`

Rollback-only database tests cover owner/member/cross-tenant/storage permissions, 1,005 usage rows plus active/stale cases, room ownership, email duplicate/lease behavior and every quota. All passed and no test accounts or organizations remained. Authentication counter tests also passed with rollback. No test emails or calls were sent.

Before upstream integration, the web suite passed 860 tests; the voice suite passed 369 tests plus 13 demo tests. Both type checks and production builds passed. Native Deno checks passed independently of the Next compiler. Final integration verification is recorded in Git and the delivery message.

Deployment order: database first (done), updated web email endpoint, then voice worker. Pushing source alone is not proof that either application has deployed. Atomic call-admission reservation remains separate follow-up work; this change fixes the incomplete usage total and does not claim a strict concurrent-call spending cap.
