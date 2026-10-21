# Admin workspace · current behaviour (18 October 2026)

The six main destinations are Overview, Customers, Calls, Support, Billing and Settings & tools. Organisations remain reachable within Customers. Phone pool, demo calls, text rehearsal, team and security remain available through Settings & tools with their existing server-side capability checks. Inbox is reachable from Support for inbox-authorised staff; inbox-only staff retain their sidebar entry.

Overview now has three primary metrics: calls today, live calls and the selected attention queue total. Daily activity still uses Europe/Dublin. Attention uses the separate service-role-only `admin_attention_queue` RPC: retained unreviewed customer call issues, all open support tickets and unfinished customer readiness survive midnight. Explicit smoke-test records and test calls are excluded. Call evidence remains subject to the existing 30-day retention; support and customer readiness do not have a daily cutoff. Reviewed signatures still prevent duplicate call issues. Current provider reports are not suppressed merely because an incident began yesterday; unavailable checks remain disclosed in the provider report control.

Customer lists show the recorded plan, setup choice, actual Cara on/off flag, account status and a next action. Test records have an explicit opt-in toggle and are not deleted. Slugs are searchable internally but no longer dominate the table. Mobile uses customer and call cards. Account owner lookup uses current account membership, with an invited user accepted only when that user is still a member. Legal acceptances are checked against the resolved account contact, authority confirmation and current document versions. Account billing status never implies Cara is accepting calls.

Billing uses the service-role-only `admin_billing_totals` RPC for full synced-ledger totals, separated by currency and live/test mode. Net collected deducts recorded refunds. Recent invoice/payment lists are explicitly limited to the latest 50 records. Account setup bookings show their recorded schedule; the existing launch_status value is not interpreted as an engineer visit having been completed. No payment charging, refunds or subscription provisioning behaviour was changed.

## Earlier implementation history (superseded where stated above)

# Admin overview

The Overview uses charcoal navigation and a white canvas. Its six primary metrics are calls today, live calls, failed calls, failed reviews, post-call processing issues and open support tickets. Recorded minutes sit in the footer. Failed calls are recorded outcomes from today; failed reviews cover calls created today with completed Fail verdicts from the current checklist version. Open tickets cover open requests created today. Each metric labels its scope. Processing failures, partial results and pending processing older than five minutes stay separate from call outcomes. Metrics link to the corresponding filtered call directory or support list. The metric day is Europe/Dublin. All calls, including live calls, are restricted to calls started on the current Dublin calendar day. Minutes are recorded duration, not billable usage.

## Attention queue

The service-role-only `admin_operations_overview_for_version` RPC uses the original overview function to load metrics, SQL-paginated call activity, SQL-paginated issues and engineering evidence. The queue groups voice incidents, failed/partial or overdue post-call processing, incomplete transcript capture, completed Fail/Needs review results and exhausted analysis errors into one item per retained call. Automatic analysis retries are not treated as exhausted failures. Open support tickets also appear. Severity sorts first, then oldest call first. Call issues and support items cover today only and reset at Dublin midnight. Caller-erased records are excluded.

The check button marks a call issue reviewed after inspection. `/api/admin/overview/review` requires the existing owner MFA gate, validates request origin and input, and calls the service-role-only `admin_review_overview_issue`. Markers hold only call ID, evidence signature, reviewing user ID and timestamp. The server rejects stale signatures. New or changed evidence changes the signature and resurfaces the call; marking reviewed does not change a quality verdict or hide the underlying call evidence. Call deletion cascades to the marker.

## Engineering health

The main screen follows the preview: one metric rail, a full-width attention queue with All/Calls/Reviews/Support filters, and a recent activity table beneath it. Detailed call evidence stays in call analysis. The server filters the complete daily issue queue before pagination, including review reasons that are secondary to a processing issue. Missing evidence must never be interpreted as a pass.

## Provider reports

Provider incidents are displayed once in Needs attention. Inspect opens a native modal containing today’s reports from the eight configured providers: Supabase, Vercel, LiveKit, Twilio, OpenAI, Stripe, Resend and Cloudflare. Operational, unknown, maintenance, degradation and outage stay distinct. The existing product/region allowlists are preserved. Reports are official vendor statements, not direct account or customer-call probes.

Reports refresh every minute; operational data refreshes on call invalidations, every ten seconds as fallback, and on focus/visibility changes. The SSE relay contains invalidation events only, retains the existing MFA gate and reconnects after 55 seconds. No credentials, transcripts or raw incident messages enter the event stream. A failed refresh retains the last successful snapshot and displays an error.

## Presence

Customer presence is drawn from unfinished usage records and deduplicated against completed call logs by room/call SID. Non-billable demo presence comes from `admin_live_call_sessions`, never billing records. Heartbeats expire after 90 seconds and terminal sessions cannot be reopened. Completed records replace matching presence rows.

## UI behaviour

The sidebar is grouped into Operations, Conversations, Payments and Administration with existing permission checks. The profile and toolbar use the staff display name. Support and account controls link to their actual pages; the redundant workspace box has been removed. Recent activity shows time, call/customer, processing status and review status, with customer links to inspection. Overview has no global search, unwired date-range filters, audio player, repeated service monitor or shortcut grid. Overview lists have independent three-row pagination inside bounded sections. The desktop sidebar stays fixed without scrolling. Every admin page shares title sizing, spacing, neutral controls and table styling. Customer details use section tabs; training uses a section navigation with one visible editor while keeping every editor mounted. Long conversations and editors scroll inside their panels. Call analysis, support and phone numbers use server pagination; customer and organisation directories use searchable pages sized to the available height. This overhaul targets desktop.

## Directory data

`admin_call_directory` filters the full retained 30-day call population before pagination, rather than filtering the latest 200 rows in memory. It excludes caller-erased records and the placeholder caller number. Date filters use Ireland time; call types and review state stay distinct. It returns summaries and status metadata, without transcripts or diagnostic bundles. The function uses SECURITY INVOKER, with execution restricted to service_role; the loader preserves existing MFA and calls permission checks. Apply the metrics, review-backlog, review-version and retained-review-failures and today-only migrations after the original overview migration. The version wrapper receives the application’s checklist version; Overview counts today’s failures, while the directory follows its selected date filter. The original function remains available to existing callers.

## Verification

Targeted model, permissions, request-origin and provider-parser regression tests pass. TypeScript checking and the production build pass. `scripts/verify-admin-overview.sql` exercises older issues being excluded after midnight, reviewed-item removal, stale-signature rejection, changed-issue resurfacing, partial transcript evidence, erasure, today-only demo presence and heartbeat expiry. Fixtures roll back in the same transaction. Unauthenticated overview/review HTTP requests return 401. The new table has RLS and no anon/authenticated access; the new functions use SECURITY INVOKER and are executable only by service_role. The security advisor returned no finding referencing the new objects.


## Deleting call history

Call analysis provides Delete in each row and on the detail page. The confirmation names the call and explains permanent removal. The server action requires the existing calls permission and MFA, removes the private recording through the Storage API, then invokes service-role-only `admin_delete_call_history`. The database transaction deletes linked call notes, tickets, events, diagnostics and live-session records; foreign keys cascade reviews, transcript events, test reports and overview markers. Active calls are blocked. A changed recording path or an object still present in Storage blocks database deletion. Storage failure leaves the call record available for retry. Customer setup, account configuration and billing records remain intact.

On 5 October 2026, the authorized reset removed calls created before 00:00 Europe/Dublin (`2026-10-04T23:00:00Z`), including 905 call logs and 59 recording objects. Older orphan transcript captures, test reports and transport/live-session metadata were cleared too. The cutoff is a one-time cleanup, not a permanent filter; future calls appear normally. Provider announcements reported before today are excluded from Overview; checks without an announcement use their check timestamp.


## Live state verification

Realtime invalidations cover calls, live sessions, usage, reviews, support tickets, transcript capture changes and voice incidents. The SSE relay sends event names only, then the browser fetches the authorized daily overview. A ten-second poll and focus/visibility refresh remain as fallback; provider checks run once per minute. Aborted requests cannot replace newer state. Background updates preserve the selected activity page and do not flash the pagination controls into a disabled style.

Verified with temporary metadata fixtures: empty screen, live session arrival, transition to a completed failed call, incoming completed review, several calls and a support ticket, and deletion back to empty. Realtime notifications arrived approximately 0.3–0.7 seconds after the test writes; the browser updated without manual reload. Temporary fixtures were removed and database counts returned to zero. The Unresolved badge was removed, provider reports moved to the section heading, and section heights adjusted so three activity rows fit in the desktop layout.
