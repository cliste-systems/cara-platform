# Operations environment variables

## Error monitoring

| Variable | Required | Notes |
|----------|----------|-------|
| `SENTRY_DSN` | Production | Server-side Sentry DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Client-side DSN (defaults to `SENTRY_DSN`) |

Configure Sentry alert rules for: Stripe webhook handler errors, `usage-sync` / `sms-usage-sync` `rowsFailed > 0`, voice webhook 5xx.

## Voice worker

| Variable | Required | Notes |
|----------|----------|-------|
| `CLISTE_VOICE_WEBHOOK_SECRET` | Yes | Shared with voice worker |

## Cron

| Variable | Required | Notes |
|----------|----------|-------|
| `CRON_SECRET` | Yes | Bearer token for `/api/cron/*` |

## Bot protection

| Variable | Required | Notes |
|----------|----------|-------|
| `TURNSTILE_SECRET_KEY` | Production | **Mandatory** for signup; also used on login when set |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Production | Widget site key |

## Admin email inbox

| Variable | Required | Notes |
|----------|----------|-------|
| `RESEND_API_KEY` | Production | Server-side Resend API key for receiving and sending mail |
| `RESEND_FROM_EMAIL` | Optional | General transactional sender; defaults to `hello@hellocara.ie` |
| `RESEND_FROM_NAME` | Optional | General sender name; defaults to `HelloCara` |
| `RESEND_HELLO_EMAIL` | Optional | Admin Hello mailbox; defaults to `hello@hellocara.ie` |
| `RESEND_HELLO_NAME` | Optional | Admin Hello sender name; defaults to `HelloCara` |
| `RESEND_BILLING_EMAIL` | Optional | Admin Billing mailbox; defaults to `billing@hellocara.ie` |
| `RESEND_BILLING_NAME` | Optional | Billing sender name; defaults to `HelloCara Billing` |
| `RESEND_WEBHOOK_SECRET` | Optional | Resend lifecycle webhook signing secret. If unset, the admin email webhook reads the service-role-only database config. |

Inbound email is untrusted data. The admin inbox renders a plain-text body and never
executes actions from received email content. The underlying Supabase table is
service-role only. The admin inbox exposes separate Hello and Billing views. New
messages send from the selected mailbox, and replies automatically use the
mailbox that originally received the customer's email.

## Signup email confirmation

| Variable | Required | Notes |
|----------|----------|-------|
| `RESEND_API_KEY` | Production | Resend API key with send permission |
| `RESEND_FROM_EMAIL` | Production | Verified sender on a Resend domain (e.g. `hello@hellocara.ie`) |
| `RESEND_FROM_NAME` | Optional | From name (defaults to HelloCara) |

Per-business owner notifications use `{org.slug}@hellocara.ie` when
`hellocara.ie` is verified in Resend. Verify with:

```bash
npx tsx scripts/verify-twilio-ie1-messaging.ts
```

| `TWILIO_SMS_FROM` | Production | Platform sender for owner alert SMS |
| `TWILIO_IE_SMS_URL` | Optional | Inbound SMS webhook on IE DIDs (not yet implemented) |

Caller-facing SMS during calls uses each org's assigned Irish DID via
`POST /api/voice/send-sms`. Pool numbers should have Twilio messaging region
`ie1` — configure on purchase and verify with:

```bash
npx tsx scripts/verify-twilio-ie1-messaging.ts --fix
```
| `NEXT_PUBLIC_APP_URL` | Production | `https://app.hellocara.ie` — used in confirmation links |

Production signups use `email_confirm: false` and email a confirmation link before onboarding.

## Admin provisioning

| Variable | Required | Notes |
|----------|----------|-------|
| `CLISTE_ENABLE_LIVEKIT_US_NUMBERS` | Optional | Set to `1` to show LiveKit US number assignment on non-retail admin org pages |

## Admin platform spend

Track internal vendor costs at **`/admin/payments/platform-spend`**.

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENROUTER_MANAGEMENT_KEY` | Optional | OpenRouter credits/analytics sync. Falls back to `OPENROUTER_API_KEY` if unset. |
| `PLATFORM_SPEND_USD_TO_EUR` | Optional | USD→EUR for API-synced vendors (default `0.92`, else `VOICE_COST_USD_TO_EUR`) |
| `VOICE_COST_USD_TO_EUR` | Optional | Fallback FX rate for platform spend display |

Manual vendors (Cursor, ChatGPT, Vercel, Supabase, etc.) are edited in the admin UI — no env vars required.

**Local `.env.local`:** pull Supabase keys from your hosted project (after `supabase login` or with `SUPABASE_ACCESS_TOKEN` set):

```bash
npm run reconnect:supabase
```

That writes `.env.local`, patches Auth redirect URLs, and smoke-tests the REST API. After unpause, confirm the project host resolves (`rtoebbwzwxcnscsxghww.supabase.co`) before running.

Or step-by-step:

```bash
npm run bootstrap:env
npx tsx scripts/patch-supabase-auth-urls.ts
```

**Supabase Auth URLs:** production site URL `https://app.hellocara.ie`, redirect `https://app.hellocara.ie/auth/callback`. Agent/script patch (not dashboard):

```bash
# After `supabase login` or with SUPABASE_ACCESS_TOKEN in .env.local
npx tsx scripts/patch-supabase-auth-urls.ts
```

## Supabase MCP (Cursor)

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_ACCESS_TOKEN` | For MCP + remote SQL | [Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens). Also used by `scripts/apply-remote-sql.ts`. |

If Supabase MCP disconnects or times out in Cursor, reconnect without OAuth:

```bash
# Add SUPABASE_ACCESS_TOKEN to .env.local first, or:
npm run supabase:mcp-reconnect -- --login

npm run supabase:mcp-reconnect
```

Then **Reload Window** in Cursor and toggle **supabase** under Settings → Tools & MCP.

## Stripe webhooks

| Variable | Required | Notes |
|----------|----------|-------|
| `STRIPE_WEBHOOK_SECRET` | Production | Signature verification |
| `CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS` | Dev only | Ignored when `NODE_ENV=production` |

## Rate limiting

Cloudflare edge rules: re-run `python3 scripts/cloudflare-harden.py` after deploy.
Slow brute-force uses `security_auth_events` (no extra env).
