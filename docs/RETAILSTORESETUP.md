# Retail store setup (SuperValu pilot)

How a retail store gets stood up on Hello Cara: what Cliste does in `/admin`, what the store manager does in `/dashboard`, and what cara-voice-platform needs to know. Written for the SuperValu-style pilot — one physical store, staffed counters, a landline the public already dials.

Companion docs: [VOICE-WORKER-CONTRACT.md](./VOICE-WORKER-CONTRACT.md), [CARA-ROUTING-RULES.md](./CARA-ROUTING-RULES.md), [VERTICALS.md](./VERTICALS.md).

## 1. The split

Setup happens in two places and they must not overlap.

| Who | Where | What |
|-----|-------|------|
| Tech setup | Cliste, on site or after the visit | `/admin` — Numbers, divert, departments, people, store facts, call flow, greeting, go-live |
| Day-to-day | Store manager | `/dashboard` — Teach Cara, work the Action Inbox, keep hours right, upload files |

The rule: anything that can break the phone line lives in `/admin`. A duty manager should never be able to un-route a store's calls at 8am.

## 2. What the store actually is

```
account            = the owner-operator (a franchisee may hold 2–3 stores)
└── organization   = one store (already the "location" model, migration 058)
    ├── phone_numbers row  = the Cliste DID Cara answers
    ├── store_departments  = deli, butcher, off-licence, customer service…
    ├── store_contacts     = store manager, duty managers, back office
    └── profiles           = who can sign in to /dashboard
```

## 3. Admin store setup flow

The org detail page for retail orgs uses an ordered setup flow with a readiness rail. Steps:

1. Store identity — name, store_code, banner, address + eircode + county, account/group, timezone
2. Numbers & divert — Cliste DID, store_public_number, routing mode, carrier, divert instructions, divert verified
3. People — store_contacts editor, dashboard invites, alert targets
4. Departments — store_departments editor; saving regenerates transfer routes
5. Store facts — facilities, delivery, click & collect, loyalty, hard rules
6. Opening hours — admin-editable, bank holidays included
7. Call flow — retail route pack + department routes (read-only dept list)
8. Greeting & voice — composed greeting with legal disclosure
9. Prompt — read-only compiled prompt + recompile
10. Go-live — checklist, test call, is_active
11. Diagnostics — last calls, incidents, webhook health

## 4. Data model

See migrations `083_retail_store_identity.sql`, `084_store_departments.sql`, `085_store_contacts.sql`.

Key org fields: `store_code`, `retail_banner`, `store_public_number`, `divert_carrier`, `divert_verified_at`.

Address consolidation: write `agent_location_*` alongside legacy `address` / `storefront_eircode` — Cara reads `agent_location_*`.

## 5. Landline diverts

Irish retail stores forward landlines via carrier portal or feature codes — not GSM MMI `**21*` codes. Use `divert_carrier` + per-carrier instructions in admin step 2.

## 6. Voice worker contract

- `targetType: "phone"` is a first-class transfer action
- Report `outcome: "transferred"` when caller is connected to a human
- On no-answer / busy / closed department → Action Inbox, never drop caller
- Retail hard rules: never confirm live shelf stock from memory; SuperValu weekly offers may be quoted only via synced `search_weekly_offers`; stock/range questions use live `search_supervalu_products`; never take payment; off-licence hours are department hours

## 7. Dashboard trim (retail vertical)

Managers teach Cara via Training + FAQs. Hidden: call flow, locations, usage/billing, services catalog. Team is read-only. Settings phone/routing fields are read-only.

## 8. Build order

1. Contract fix — transfer + transferred outcome
2. Migrations 083–086
3. Admin store page steps 1–6
4. Departments → routes + retail route pack
5. Greeting/voice/prompt; remove AI Brain + LiveKit
6. Retail vertical pack; trim dashboard nav
7. Go-live + diagnostics
8. Remove salon-era admin surfaces

See [CARA-VOICE-PLATFORM-HANDOFF.md](./CARA-VOICE-PLATFORM-HANDOFF.md) for voice worker implementation checklist.
