# Production pilot checklist

## Before deploy

- [ ] **Billing alerts** configured — see [INFRASTRUCTURE-COSTS.md](./INFRASTRUCTURE-COSTS.md) (Vercel spend cap, Supabase usage, LiveKit Cloud)
- [ ] Migrations `060`–`064` applied to production Supabase (064 revokes legacy anon storefront access)
- [ ] `SENTRY_DSN` set; alert rules configured
- [ ] `CRON_SECRET`, Stripe, **Resend** (signup confirmation email), **Turnstile** keys set on Vercel
- [ ] `STRIPE_WEBHOOK_SECRET` set; `CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS` unset in production
- [ ] `python3 scripts/cloudflare-harden.py` run (rate-limit paths updated)
- [ ] Voice worker deployed with `call_sid`, `is_active` gate, E.164 callers

## After deploy

- [ ] Run `npx tsx scripts/backfill-usage-sync.ts` once if pre-customer rows were marked synced
- [ ] Verify `POST /api/voice/call-complete` idempotent retry (same `call_sid` → same `call_log_id`); worker sends `call_sid` on every call
- [ ] Anon REST probe: `GET /rest/v1/organizations?select=id&limit=1` returns permission denied (migration 064)
- [ ] Check `/admin/security` for pipeline incidents + disclosure %
- [ ] Confirm usage alert email at 80%/100% (or dry-run cron locally)

## CI

- `npm run lint`, `tsc --noEmit`, `npm run build`, `npm test` must pass on PRs.
