# Voice worker → dashboard contract (v1)

The LiveKit/voice worker reports each finished call to the Hello Cara app. This is
the single integration point between the worker and the dashboard. Keep the
worker aligned with this document.

**Worker mode (v1):** `code-base-2` is **Cara-only** — routing links, Action
Inbox webhooks, and dashboard SMS/email APIs. There is **no** in-worker native
salon booking, Stripe checkout, or direct Twilio SMS. Org resolution is by
dialed `phone_numbers.e164` first; AI disclosure is spoken **once** via
`organizations.greeting` (no separate disclosure line).

## Org status gate (mandatory)

Before answering a call, load `organizations.is_active` and account `status`. If the
org is suspended, churned, or `is_active = false`, **do not** start the LLM session —
play a short unavailable message and hang up. The dashboard API returns `403`
`org_suspended` if a webhook arrives for an inactive org.

## Blocklist gate (mandatory)

After the org status gate and **before** starting the LLM/TTS session, check whether
the caller should be blocked:

1. Normalize `caller_number` to E.164 (same rules as below). Withheld callers arrive
   as `+anonymous`.
2. Load `organizations.block_anonymous_callers` for the resolved org.
3. Query `blocked_callers` for a row matching `(organization_id, caller_e164)`.

Block when **either**:

- `caller_e164` is in `blocked_callers` for this org, **or**
- `caller_number` is `+anonymous` **and** `block_anonymous_callers = true`.

When blocked:

- Play a short message — **no** AI disclosure, **no** LLM session, **no** TTS
  beyond the clip. Use the business name from org config, e.g. “We're unable to
  put you through to {business}. This line is operated by Hello Cara on
  behalf of the business, and your number isn't authorised to connect. Goodbye.”
- Hang up.
- `POST /api/voice/call-complete` with `outcome: "blocked"`, `duration_seconds` near
  zero, no transcript fields. Do **not** call `action-ticket`, `send-sms`, or
  `increment_caller_abuse_hit`.

Example preflight SQL (service role):

```sql
select block_anonymous_callers from organizations where id = $org_id;

select 1 from blocked_callers
  where organization_id = $org_id and caller_e164 = $normalized_caller
  limit 1;
```

Example `call-complete` body for a blocked call:

```json
{
  "called_number": "+353…",
  "call_sid": "CA…",
  "caller_number": "+353871234567",
  "outcome": "blocked",
  "duration_seconds": 0
}
```

Blocked calls are logged in Call history for owner visibility but do **not** create
Action Inbox tickets and are excluded from Cara success metrics.

## Caller handling

- **E.164:** Normalize `caller_number` to E.164 before POST (the app re-normalizes).
- **Anonymous/withheld:** Send `caller_number: "+anonymous"`.
- **Landline / no SMS:** If the callee cannot receive SMS, do not promise a text —
  use `action_created`, read the link aloud, or take a message.

## Idempotent retries

`POST /api/voice/call-complete` is idempotent on `call_sid`. Retries with the same
`call_sid` return `200` with the existing `call_log_id`.

**Production requirement:** `call_sid` is mandatory in production (and when
`CLISTE_VOICE_REQUIRE_CALLED_NUMBER=1`). Requests without it return `400`. Every
worker build must send the stable Twilio/LiveKit call identifier.

## Compliance requirements (mandatory)

These settings are **not optional** — they implement GDPR transparency, EU AI Act
Art 50, and Hello Cara's DPA commitments.

1. **AI disclosure on first turn** — Speak the compiled greeting from
   `organizations.greeting`, which always includes the fixed legal segment from
   `voiceLegalDisclosure()` (`src/lib/voice-greeting.ts`). Never skip or paraphrase
   away the AI / recording-transcription notice.
2. **Call recording** — Twilio call recording OFF; LiveKit egress ON after spoken disclosure;
   MP3 uploaded to Supabase `call-recordings/{organization_id}/{call_log_id}.mp3`;
   retained **30 days** then deleted by cron and GDPR erasure.
3. **EU routing** — Deploy the voice worker on LiveKit Cloud Agents in **`eu-central`** (Frankfurt); prefer EU endpoints for
   ElevenLabs (`api.eu.residency.elevenlabs.io`) and OpenRouter (`eu.openrouter.ai`)
   when available. See `SUB_PROCESSOR_EU_MIGRATION_NOTES` in
   `src/lib/sub-processors.data.ts`.
4. **Report disclosure delivery** — Set `disclosure_confirmed: true` on
   `POST /api/voice/call-complete` when the legal segment was spoken on the call.
   The app logs a warning when this field is absent or false.
5. **Review-first post-call text** — When a transcript exists, always send:
   - `transcript_review` — business-relevant narrative **without** repeating
     volunteered health, payment, or government-ID details. The dashboard shows
     this by default.
   - `ai_summary` — short operational summary (intent/outcome only); no special-category
     echo.
   - `transcript` — verbatim STT (the app redacts again server-side). Staff must
     expand “Show full transcript” to view it.

Operational verification checklist: `docs/legal/VOICE-COMPLIANCE-CHECKLIST.md`.

## Endpoint

```
POST /api/voice/call-complete
```

- Source of truth: `src/app/api/voice/call-complete/route.ts`
- `Content-Type: application/json`

## Auth

Send the shared secret on every request (either header works):

```
Authorization: Bearer <CLISTE_VOICE_WEBHOOK_SECRET>
# or
x-cliste-voice-secret: <CLISTE_VOICE_WEBHOOK_SECRET>
```

Set the same value in the app env (`CLISTE_VOICE_WEBHOOK_SECRET`) and in the
worker. If it is unset on the app side the route returns `503` (fail-closed).

## Payload

| Field                | Type            | Required | Notes |
|----------------------|-----------------|----------|-------|
| `called_number`      | string (E.164)  | yes¹     | The Hello Cara DID the caller dialled. Used to resolve the tenant — the secret alone must **not** decide the org. |
| `call_sid`           | string          | yes      | Stable Twilio/LiveKit call identifier. **Required** for idempotent `call-complete` retries. |
| `room_name`          | string \| null  | no       | LiveKit room name when available. |
| `caller_number`      | string          | yes      | Caller number in **E.164** when possible. Use `+anonymous` for withheld caller ID. |
| `caller_name`        | string \| null  | no       | Display name when known (optional; improves Contacts and call history). |
| `outcome`            | string          | yes      | Canonical value preferred (see below). Free text is accepted and normalized. |
| `duration_seconds`   | number          | no       | Whole seconds. Drives Home minutes used. |
| `transcript`         | string \| null  | no       | Verbatim STT text. Server-side redaction runs before storage. Hidden by default in dashboard. |
| `transcript_review`  | string \| null  | no       | **Required when `transcript` is sent.** Staff-facing narrative without sensitive echo — shown by default in Calls. |
| `ai_summary`         | string \| null  | no       | Short operational summary (intent/outcome). Must not repeat health, payment, or ID details. |
| `disclosure_confirmed` | boolean       | no       | `true` when the AI + recording/transcription disclosure was spoken on the call. Logged for compliance monitoring. |
| `audio_storage_path` | string \| null  | no       | Private Supabase Storage path (`{organization_id}/{call_log_id}.mp3`) when call recording was stored. Set on insert or idempotent follow-up. |
| `organization_id`    | string (uuid)   | no       | **Deprecated.** Legacy compat only; if sent it must match the `called_number` lookup or the request is rejected. |
| `knowledge_gaps`     | array           | no       | Topics Cara could not answer from current training. Each item creates a **Cara Training** queue entry for the owner. See below. |

¹ `called_number` is required unless `CLISTE_VOICE_ALLOW_LEGACY_ORG_ID=1` is set
for a temporary rollout, in which case `organization_id` may be sent instead.

> Note: the `booking` sub-object is legacy (native salon booking) and is not part
> of the v1 product. The worker should not send it.

### `knowledge_gaps` (Cara Training)

Optional array on `POST /api/voice/call-complete`. Send when post-call review
finds moments where Cara took a message or could not answer from FAQs, services,
or business rules. The app redacts `caller_context`, dedupes open items, notifies
the owner, and surfaces items at `/dashboard/cara-training`.

The worker may send `knowledge_gaps` on a **follow-up** POST with the same
`call_sid` after post-call LLM review; the route is idempotent and still ingests
gaps when the call log already exists.

Each element:

| Field               | Type   | Required | Notes |
|---------------------|--------|----------|-------|
| `topic`             | string | yes      | Short label, e.g. `"Emergency weekend callouts"`. |
| `caller_context`    | string | no       | Staff-facing excerpt (no health/payment/ID echo). |
| `cara_question`     | string | no       | Plain-English question for the business owner. If omitted, the app generates one from `topic`. |
| `suggested_section` | string | no       | Hint only: `faq`, `services`, `services_not_offered`, `business_rules`. |

Example:

```json
"knowledge_gaps": [{
  "topic": "Emergency weekend callouts",
  "caller_context": "Caller asked if a plumber was available on Sunday.",
  "cara_question": "Do you offer emergency or weekend callouts? What should I tell callers?",
  "suggested_section": "faq"
}]
```

Unclear or follow-up **Action Inbox** tickets (`POST /api/voice/action-ticket`)
also create Cara Training items automatically — you do not need to duplicate
those in `knowledge_gaps` when an action ticket was already created for the same
gap.

## Canonical outcomes (preferred)

Send one of these exact strings as `outcome`. They are the stable v1 set the
dashboard reads for every metric (defined in `src/lib/call-history-types.ts`):

| Outcome                  | Meaning |
|--------------------------|---------|
| `answered`               | Handled on the call, nothing else needed. |
| `link_sent`              | Agent sent/read out a routing link. |
| `callback_requested`     | Caller wants a person to ring them back. |
| `action_created`         | Something needs follow-up (lands in the Action Inbox). |
| `failed`                 | Caller hung up / dropped / call incomplete. |
| `voicemail_or_no_speech` | No usable speech (voicemail, silence, no answer). |
| `spam_or_abuse`          | Robocall / spam / abusive caller. |
| `blocked`                | Rejected by owner blocklist before Cara started (preflight gate). |
| `transferred`            | Caller was connected to a human (department line or fallback number). |

## Transfer (`targetType: phone`)

When a matched route has `targetType: "phone"`:

1. Announce where the caller is going (`transferLabel` when set, otherwise a sensible name from the route trigger).
2. Dial `url` (E.164 department or store line). If `url` is empty, use `organizations.fallback_number`.
3. Respect `transferDuringHoursOnly`: when `true` and the destination is outside its hours, do **not** dial — take a message and report `action_created`.
4. Respect `call_routing_mode`: human transfer is only allowed when mode is `cliste_number` (see `callRoutingAllowsHumanTransfer`).
5. On no-answer, busy, or failed connect: take a message, create an Action Inbox ticket, report `action_created`. **Never drop the caller.**
6. On successful connect: report `outcome: "transferred"`.

### `transferred` payload (required metadata)

When reporting `outcome: "transferred"`, include in the JSON body (top-level or under `metadata`):

| Field | Type | Meaning |
|-------|------|---------|
| `transfer_department` | string | Department label the caller asked for (e.g. `Deli counter`). |
| `transfer_target` | string | E.164 or PBX extension actually dialled. |
| `transfer_connected` | boolean | `true` only when the human answered; `false` when the dial was attempted but no human answered (same call — fall back to message-taking, report `action_created` for the fallback, not `transferred`). |
| `verification_call` | boolean | `true` when this call is a staff-initiated transfer verification test (set `transfer_connected` accurately). On success, the app stamps `store_phone_systems.transfer_verified_at`. |

On the first verified successful transfer for an org, the dashboard may set `store_phone_systems.transfer_verified_at` (staff cannot set this manually).

Retail org metadata (`store_code`, `retail_banner`) may be attached to Action Inbox tickets for support — never spoken to callers.

## Retail hard rules (prompt-enforced)

For `niche: retail` orgs, Cara must **never**:

- Confirm whether an item is in stock (offer to take a message for the department).
- Quote a price unless `quote_prices_on_calls` is enabled.
- Take payment or card details over the phone.
- Discuss a prescription or a named customer's order with a third party.
- Promise a delivery slot.

Off-licence hours follow department hours, not general store hours.

## Normalization

The route normalizes `outcome` before writing `call_logs.outcome`, and the
dashboard normalizes again on read, so:

- **Sending a canonical string is preferred** (cleanest, future-proof).
- Free text still works — e.g. `"sent them the booking link"` → `link_sent`,
  `"customer hung up"` → `failed`, `"left a voicemail"` →
  `voicemail_or_no_speech`. Mapping lives in `normalizeCallOutcome`.
- Do **not** rely on free-text summaries for metrics; only `outcome` drives
  counts.

## Example

```bash
curl -sS -X POST "$APP_URL/api/voice/call-complete" \
  -H "Authorization: Bearer $CLISTE_VOICE_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "called_number": "+353749389378",
    "call_sid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "caller_number": "+353871234567",
    "duration_seconds": 142,
    "outcome": "link_sent",
    "ai_summary": "Caller wanted to book; sent the booking link by SMS.",
    "transcript_review": "..."
  }'
```

### Action Inbox ticket + owner notification

```bash
curl -sS -X POST "$APP_URL/api/voice/action-ticket" \
  -H "Authorization: Bearer $CLISTE_VOICE_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "called_number": "+353749389378",
    "caller_number": "+353871234567",
    "caller_name": "Mary",
    "summary": "Caller asked for colour consultation callback tomorrow."
  }'
```

### Caller SMS (from the org's assigned Irish DID)

Send booking links, routing links, or files to the caller's mobile. Uses the
org's assigned `phone_numbers.e164` as the Twilio `from` address. The body may
be **just the link or short content** — no AI/privacy legal boilerplate is
required in the text (disclosure happens on the call and via salon notices).

**Before calling this endpoint**, Cara must ask on the call and set
`caller_consented: true` (required in production). The API may prefix the
business name unless `skip_business_prefix: true`.

Returns `400 caller_consent_required`, `429 sms_quota_exhausted`, or
`422 landline_destination` when applicable.

```bash
curl -sS -X POST "$APP_URL/api/voice/send-sms" \
  -H "Authorization: Bearer $CLISTE_VOICE_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "called_number": "+353749389378",
    "to": "+353871234567",
    "body": "Here is your booking link: https://example.com/book",
    "purpose": "routing_link",
    "caller_consented": true
  }'
```

Owner notification SMS (Action Inbox, Cara Training) still uses the platform
`TWILIO_SMS_FROM` number — only caller-facing texts use the assigned DID.

### Caller email (directions / maps links)

Email a caller-facing message (e.g. directions with a maps URL). Requires
`caller_consented: true` in production. Used by `sendDirectionsLink` on location
routes when the business chose email or text-or-email delivery.

```bash
curl -sS -X POST "$APP_URL/api/voice/send-caller-email" \
  -H "Authorization: Bearer $CLISTE_VOICE_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "called_number": "+353749389378",
    "to": "caller@example.com",
    "subject": "Directions",
    "body": "Here are directions: https://maps.google.com/…",
    "caller_consented": true
  }'
```

### Business file lookup (menus / price lists)

Search uploaded business files for relevant excerpts during a call. Use this
when the caller asks about a specific item, service, or price in an uploaded
menu or price list — **do not read the whole document aloud**.

Large files are indexed in `custom_prompt`; the full extracted text lives in
`business_files.extracted_text` and is queried through this endpoint.

Optional filters: `file_id` (uuid), `document_kind` (`price_list`, `menu`,
`brochure`, `stock_sheet`, `service_sheet`, `faq_doc`, `other`).

Returns `{ ok: true, matches: [] }` when nothing relevant matches — offer to
text the file (if `send_enabled` on a route) or take a message.

```bash
curl -sS -X POST "$APP_URL/api/voice/search-business-file" \
  -H "Authorization: Bearer $CLISTE_VOICE_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "called_number": "+353749389378",
    "query": "gel manicure price",
    "document_kind": "price_list"
  }'
```

Example response:

```json
{
  "ok": true,
  "matches": [
    {
      "file_id": "…",
      "file_name": "menu.pdf",
      "document_kind": "price_list",
      "excerpts": [
        {
          "text": "Gel manicure — €45\nGel pedicure — €55",
          "score": 0.82,
          "start_line": 42,
          "end_line": 43
        }
      ]
    }
  ]
}
```

**Worker tool:** register `searchBusinessFile` (see code-base-2
`src/lib/cara_tools.ts`). Invoke silently when the caller asks about menu or
price details; quote only the returned excerpt.

## What updates where

- `call_logs` row is created → **Calls** page + **Home** "Recent activity".
- Home metrics (calls answered, routing links sent, AI minutes) read `call_logs`
  directly and update immediately.
- **Contacts** groups by `caller_number`.
- The **Usage** page bills from `usage_records`, which the `usage-sync` cron
  populates separately (per-minute billable usage) — it is not written by this
  route.
- When `outcome` is `action_created`, the app notifies the business owner
  (SMS/email from Settings) using `ai_summary` or transcript text.
- **Action Inbox tickets:** POST to `/api/voice/action-ticket` (same auth as
  this route) to create `action_tickets` and send owner notifications. Prefer
  this over writing `action_tickets` directly in Postgres.
- If Cara cannot complete the call, fall back to `organizations.fallback_number`
  (E.164) when set, or carrier voicemail — never drop the caller silently.

## Tenant config the worker should load (Cara Setup + Routing)

Resolve the org from `called_number`, then read configuration from Postgres
(service role). Do not trust client-supplied org ids.

### Cara Setup (`organizations` + `business_files`)

| Source | Field / table | Use on calls |
|--------|----------------|--------------|
| Greeting | `organizations.greeting`, `assistant_display_name` | Opening line — must identify as AI and mention recording if custom |
| Blocklist | `organizations.block_anonymous_callers`, `blocked_callers` | Preflight gate — reject before LLM (see Blocklist gate) |
| Instructions | `organizations.custom_prompt` | Call handling |
| Business text | `agent_business_type`, `business_knowledge_summary`, `agent_opening_hours`, `agent_service_area`, `agent_extra_notes`, `agent_location_address`, `agent_location_eircode` | Spoken context |
| FAQs | `organizations.agent_faqs` (jsonb `[{question, answer}]`) | Answer during call |
| Knowledge files | `business_files` where `answer_enabled = true` and `extracted_text` is non-empty | Ground answers (static upload; may be stale). **Large files:** prompt contains a short index only — call `POST /api/voice/search-business-file` to look up specific items during the call. |

`business_files` columns: `file_name`, `file_type`, `mime_type`, `storage_path`,
`extracted_text`, `processing_status` (`ready` | `processing` | `needs_processing`).
Skip rows with `needs_processing` or empty `extracted_text` for answering.

### Routing (`organizations.routing_links` jsonb)

**Matching is owned by the prompt.** The app compiles the routing/matching spec
(trigger → action per route, plus the fallback) into `organizations.custom_prompt`
and recompiles it whenever the call flow is saved. The worker matches the caller's
meaning to a route's trigger using that prompt, then **executes** the action using
the structured `routing_links` row below. See
[`CARA-ROUTING-RULES.md`](./CARA-ROUTING-RULES.md) for the full matching protocol
and edge-case behaviour.

Each route is **one trigger → one action → one destination** (one flat row).
Multiple links are modelled as separate routes, so there is never more than one
destination per row and never ambiguity about which link a caller wants.

| Field | Type | Notes |
|-------|------|-------|
| `presetId` | string (optional) | Template id (`booking-inquiry`, `location`, `brochure`, …) |
| `intent` | string | The route's trigger (lowercased) — what callers ask about |
| `label` | string | The route's trigger (display case); equals `intent` |
| `targetType` | string | `link`, `form`, `email`, `callback`, `whatsapp`, **`phone`** (transfer). `note` is legacy — treat as `callback`. |
| `url` | string | Link URL, email, WhatsApp, E.164 transfer destination, or message-capture instructions |
| `transferLabel` | string (optional) | Spoken name for transfer target, e.g. "the deli counter" — use when announcing a transfer |
| `transferDuringHoursOnly` | boolean (optional) | When `true` and the destination is closed, do **not** transfer — take a message and report `action_created` |
| `businessFileId` | uuid (optional) | When `targetType` is `form` — **send file** action |
| `active` | boolean | Inactive routes are ignored |

> Legacy rows may still carry `links` / `urls` arrays from the old multi-link
> model. New saves never write them, and the dashboard flattens any legacy
> multi-link route into separate single-destination routes on load. If you
> encounter `links[]`, treat each entry as its own sendable link.

**Send file (`targetType: form` + `businessFileId`):**

1. Load `business_files` row for that id and org; require `send_enabled = true`.
2. Do **not** expose raw `storage_path` to callers.
3. Create a **signed URL** from bucket `business-files` (private) for delivery.
4. Pass to the caller channel: `file_name`, `mime_type`, signed URL (short TTL).

**Text them a link (`targetType: link`):** the row is one sendable link. Once the
prompt has matched the caller to this route, confirm the mobile number and SMS
`url`. FAQs and business facts come from Cara Setup, not routing.

**No match:** use the "Anything else" fallback row (`intent: "anything else"`,
`targetType: callback`) — take a message, create an Action Inbox ticket, report
`action_created`. Never drop the caller.

Uploaded spreadsheets/PDFs used for answering are **static** until the business
re-uploads; do not imply live inventory sync.

**Large menus and price lists:** the compiled prompt may include only a short
index for oversized files. When a caller asks about a specific item or price,
invoke `searchBusinessFile` (see [`VOICE-WORKER-CONTRACT.md`](./VOICE-WORKER-CONTRACT.md))
to query the full stored text. Quote only the matching excerpt — never read the
whole document aloud. If search returns no match, offer to text the file (when
`send_enabled`) or take a message.
