# Signup and setup hardening — 25 October 2026

## Changes in this review

- Payment submission uses a synchronous lock to prevent rapid duplicate submissions before React updates the button. Recoverable failures release the lock; successful confirmation retains it during navigation. The success timer is cleared on unmount.
- Stripe requests have a 20-second request timeout and two network retries. Existing idempotency keys remain authoritative.
- Signup billing requires a valid, stable hold expiry before creating Stripe resources. Canceled and expired subscriptions cannot yield a usable checkout result.
- Billing logs record error type, code and status rather than entire provider error objects.
- AI greeting review has a 12-second deadline. Custom greetings still fail closed; the previously validated standard greeting remains available during provider outages.
- The Supabase password-protection maintenance script now runs correctly under the repository's TypeScript runner.

## Verification

- Full application suite: 1,427 tests passed, zero failures.
- TypeScript checking and linting of changed files passed.
- Production dependency audit: zero known vulnerabilities reported.
- Live database security smoke checks passed inside a rolled-back transaction: duplicate billing, authoritative offers, fixed trials, suspended accounts, webhook leases, stale lease recovery, fraud suspension, connection activation and privileged billing permissions.

## Outstanding release verification

- Supabase native breached-password protection is still disabled. The management request returns HTTP 401 and requires renewed management access. Application-side password screening is present, but does not replace this provider setting.
- This review did not deploy the application or make a real customer payment. Verify payment authentication, declines, retries and webhook delivery in the release environment.
- Verify a real forwarded call from the supported network/device combinations, including pending connection, help requested and trial activation.
- Passing automated checks is evidence for the covered behavior, not a guarantee against all production failures.
