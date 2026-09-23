# Infrastructure costs & billing alerts

Platform costs (excluding per-call Twilio/ElevenLabs usage) for Cliste: Vercel, Supabase, LiveKit Cloud (voice worker + realtime), Resend, Sentry, Cloudflare.

## Billing alerts (set in each provider console)

These cannot be configured in-repo. Complete once per environment (production).

### Vercel

1. [Vercel dashboard](https://vercel.com) → Team → **Settings** → **Billing** → **Spend Management**
2. Enable spend notifications and set a monthly budget alert (suggested starting point: **€100/month** at pilot, **€300/month** at ~50 paying salons).
3. Confirm project is on **Pro** (required for 6 crons and 60s function timeouts in [`vercel.json`](../../vercel.json)).

### Supabase

1. [Supabase dashboard](https://supabase.com/dashboard) → Project → **Settings** → **Billing**
2. Enable **Spend cap** or usage alerts if on Pro/Team.
3. Watch **Database egress** and **API requests** — these rise with dashboard traffic before storage does.
4. Suggested alert threshold: **€50/month** overage on Pro at pilot scale.

### LiveKit Cloud (voice worker — `cliste-code-base-2`)

1. [LiveKit Cloud dashboard](https://cloud.livekit.io) → Project → **Billing** / **Usage**
2. Production agent runs in **`eu-central`** (Frankfurt) on the Ship plan — warm 24/7.
3. Set usage alerts alongside agent compute and inference minutes.

### Secondary services

| Service | Where to alert |
|---------|----------------|
| **Sentry** | Project → Settings → Subscription / Usage quotas |
| **Resend** | Dashboard → Usage |
| **LiveKit** | Cloud dashboard → Usage / billing |
| **OpenRouter** | Account → Limits / credits |

## Reviewing margin (admin dashboard)

After pilot traffic:

1. Open **`/admin`** (platform overview).
2. Set the metric range to **Last 7 days** or **Last 30 days**.
3. Compare **Est. voice infrastructure cost** (≈ EUR) to Stripe subscription revenue for the same period.
4. Expand **Cost breakdown** — check LiveKit, STT, LLM, TTS dominate; Supabase line should stay small per call.
5. Divide total est. cost by calls with estimates → **avg cost per call**. Compare to plan overage rates in [`src/lib/cliste-plans.data.ts`](../../src/lib/cliste-plans.data.ts) (€0.45–0.59/min).

**Platform fixed + variable spend (internal ops)**

Track Cliste’s own vendor bills (Cursor, ChatGPT, Vercel, Supabase, LiveKit, etc.) at **`/admin/payments/platform-spend`**. Enter manual subscription amounts and billing days; click **Refresh API data** for OpenRouter MTD usage. See [`ENV.md`](ENV.md) for `OPENROUTER_MANAGEMENT_KEY`.

**Healthy pilot signals**

- Avg est. voice cost per minute handled is **below** the customer's effective overage rate.
- Supabase share of breakdown is a **small fraction** of LiveKit + LLM.
- No sustained spike in Vercel/Supabase invoices without matching call volume.

**Tune when estimates drift**

- Worker env: `CALL_COST_*` rate constants (voice worker repo).
- App env: `VOICE_COST_USD_TO_EUR` for display on `/admin`.

Cost data is stored on `call_logs.cost_estimate` (JSON from the voice worker). If the admin card shows "Add the cost_estimate column", apply the worker migration first.

## Code-level cost controls (implemented)

| Control | Location |
|---------|----------|
| Call list without transcripts; detail on select | `dashboard/call-history/` |
| Paginated call list | `src/lib/dashboard-list-limits.ts` |
| Capped inbox/contacts queries | `action-inbox/page.tsx`, `clients/page.tsx` |
| Realtime-first dashboard refresh; polling only when Realtime unhealthy | `src/components/dashboard-live-refresh.tsx` |
| Transcript retention (30 days) | `/api/cron/data-retention` |

## Typical fixed platform burn (order of magnitude)

At pilot (5–20 paying salons): **~€150–400/month** fixed (Vercel Pro + Supabase Pro + LiveKit Ship + Sentry/Cloudflare/Resend). Variable costs scale with **call minutes** (metered to customers) and **active dashboard sessions** (Supabase egress).
