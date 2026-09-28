# Dashboard screenshot — Murphy's SuperValu Killarney

Fill the tenant `/dashboard` with realistic Irish supermarket phone-call data for demos and screenshots.

## Prerequisites

- Hosted dev or local Supabase with `.env.local` configured
- Retail demo org seeded: `npx tsx scripts/seed-retail-demo-user.ts`
- Train Cara complete (optional but recommended): `npx tsx scripts/complete-retail-train-cara.ts --go-live`
- `DASHBOARD_HOME_MOCK` must be **unset** (off)

## Screenshot workflow

Run this **immediately before** capturing the screen — the home page defaults to **Today** (Dublin midnight), so stale timestamps show empty panels.

```bash
npx tsx scripts/seed-retail-dashboard-activity.ts --email shop@cliste.test --screenshot
```

Then:

1. Log in as `shop@cliste.test` / `[use the unique test credential from your password manager]`
2. Open `/dashboard` (range defaults to **Today**)
3. Hard refresh (Ctrl+Shift+R)
4. Use viewport **≥1024px** — bottom chart row is hidden below `lg` breakpoint

## What gets seeded

| Surface | Data |
|---------|------|
| Hero stats | ~33 calls, 16 enquiries, callbacks, 5 open tickets, ~85 billable minutes |
| Live activity | Recent Real Rewards, Click & Collect, transfer calls |
| Needs attention | Open deli platter, callback, catering, delivery enquiries |
| Cara training | 6 knowledge gaps (Real Rewards fuel, turkey pre-order, EV charging, etc.) |
| Charts | Mixed outcomes, Cara performance, **When customers call** (busiest hours) |

All copy is realistic SuperValu Killarney retail wording — **no `[smoke test]` prefix** in the UI.

## Cleanup

Re-running the script wipes all `call_logs`, `action_tickets`, and `cara_training_items` for the demo org and re-inserts fresh rows with current timestamps.

## Fallback

If you cannot re-seed: `/dashboard?range=7d` shows older data, but hero copy will say “last 7 days” instead of “today”.
