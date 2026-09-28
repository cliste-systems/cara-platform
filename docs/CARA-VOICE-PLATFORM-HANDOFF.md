# cara-voice-platform handoff — retail transfers

Voice worker changes required after Hello Cara dashboard contract update.

## Transfer execution

When a matched `routing_links` row has `targetType: "phone"`:

1. Read `url` (E.164). Fall back to `organizations.fallback_number` if empty.
2. Announce using `transferLabel` when set.
3. Respect `transferDuringHoursOnly` — if destination closed, take message → `action_created`.
4. Respect `organizations.call_routing_mode` — only transfer when mode is `cliste_number`.
5. Dial the destination. On connect → `POST /api/voice/call-complete` with `outcome: "transferred"`.
6. On no-answer / busy / failed connect → Action Inbox ticket → `action_created`. Never hang up silently.

## Outcome

Report canonical `outcome: "transferred"` (not `answered`) when caller reaches a human.

See [`VOICE-WORKER-CONTRACT.md`](./VOICE-WORKER-CONTRACT.md) and [`CARA-ROUTING-RULES.md`](./CARA-ROUTING-RULES.md).

## Org metadata for tickets

Attach to Action Inbox payloads (never spoken):

- `organizations.store_code`
- `organizations.retail_banner`
- `organizations.store_public_number`

## Retail ticket templates

Use structured summaries for: complaint, lost property, special order, supplier/rep, recruitment, stock enquiry.

## Verification checklist

- [ ] Department transfer route dials `url`
- [ ] Closed department with `transferDuringHoursOnly` takes message
- [ ] Successful transfer reports `transferred`
- [ ] Failed transfer creates inbox item, caller not dropped
- [ ] `forward_all` / `forward_missed` modes do not loop transfers
