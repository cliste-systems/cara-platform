# Signup and setup hardening — 25 October 2026

## Implemented

- Explicit no-website route into the existing business verification review; URLs are still validated when supplied.
- Pending completion says the number is not connected and the trial has not started. Connected completion has separate wording.
- The direct Cara test and the subsequent forwarding test are explained separately.
- Bank-holiday hours, out-of-hours preferences and SMS controls are optional. Existing saved values remain submitted when collapsed.
- Signup no longer returns internal database/provider error text. Password creation and all three current password-change paths use the server-side breached-password check; 128-character maximum enforced before hashing or lookup.
- Greeting moderation no longer rejects legitimate names such as Dickson and Cockburn merely because of a substring. Explicit and spaced profanity remains blocked; server review remains authoritative.
- Missing carrier forwarding metadata offers audited staff review; it does not automatically prove forwarding or activate billing. Twilio inbound trunking calls are supported.
- Database grants tightened for trigger RPCs and anonymous helpers; four mutable function search paths pinned. Authenticated ownership helpers remain available to RLS.
- Short valid Irish fixed-line numbers are accepted by the database constraint as well as the server validator.
- Voice-worker plan allowances corrected to published 150 / 400 / 800 / 2000 minutes.
- New signup holds expire after 30 days. Stripe also schedules automatic cancellation, including abandoned checkout before confirmation. Activation only clears the server's matching scheduled cancellation, never a customer cancellation.
- Pre-connection calls have a shared 15-minute test allowance, five-minute maximum per call, and one concurrent call. Database reservations serialize admission and retain their full cost on a crash. These test calls do not consume paid-plan minutes.
- Expiry cleanup is bounded and retried through the existing protected scheduler. It verifies Stripe ownership and paused state, never cancels activated subscriptions, disables the expired line, and quarantines the assigned number through the existing 30-day pool cooldown. No customer records are deleted.

Existing paying accounts are not enrolled by inferring billing status. The protected scheduler checks older signups in bounded batches and enrolls legacy paused setup holds only after positive Stripe verification. Existing paying accounts receive a non-restricted receipt.

## Verification

- 85 focused signup/setup/billing and moderation tests, 4 password tests and 4 worker quota tests passed.
- Both production builds and app TypeScript checks passed. Changed-component lint passed.
- Live database transaction tests passed for reservation, concurrent-call rejection, settlement, expiry and denied customer access; all synthetic rows rolled back.
- Mobile and desktop previews checked for no-website selection, optional preferences and pending completion. Artwork size and early voice preview preserved.
- No real customer payment was submitted and no live forwarded phone call was made during this verification.

## Still requires operational access/release

- Hosted Supabase Auth's native leaked-password protection remains disabled. The stored Management API credential returns 401; the connected database tool does not expose Auth configuration. Application-side password checks are implemented, but are not a substitute for enabling the provider-wide control.
- Deploy the app and voice worker together before treating the new worker admission limits as live. Database migrations have been applied; application changes are local until released.
- Remaining advisory warnings are the native Auth setting, two existing extensions in the public schema, and five intentionally authenticated ownership/support helpers. Server-only RLS tables intentionally have no customer policies.
