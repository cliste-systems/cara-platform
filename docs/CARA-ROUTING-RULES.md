# Cara routing rules (voice agent spec)

How Cara decides what to do when a caller speaks. This is the authoritative
behaviour spec for the voice worker (cara-voice-platform). The dashboard "Call Flow"
page produces the data described here; the worker must implement the matching
and edge-case behaviour exactly as written.

Companion doc: [`VOICE-WORKER-CONTRACT.md`](./VOICE-WORKER-CONTRACT.md) (transport,
payloads, and the raw `routing_links` shape).

## The model

A call is always:

1. Cara greets (`organizations.greeting`).
2. The caller says what they want.
3. Cara matches their words to **one** saved route and does that route's **one**
   action.
4. If nothing matches, Cara takes a message (the "Anything else" fallback).

Design rules that make this reliable:

- **One route = one trigger = one action = one destination.** A business with
  several links (e.g. "book online" and "apply for finance") has several routes,
  each with its own trigger. There is never more than one link inside a route,
  so there is never ambiguity about which link a caller wants.
- **Matching is semantic, on the trigger.** Cara matches the meaning of what the
  caller says to a route's trigger phrase. No keyword lists; no exact-match.
- **Triggers are unique** (enforced on save), so a matched trigger maps to
  exactly one action.

## Inputs the worker reads

| Source | What it gives Cara |
|--------|--------------------|
| `organizations.custom_prompt` | The compiled call-handling prompt. The app builds an explicit routing section into it: a `If they ask about <trigger>, <action>` line per route, the fallback instruction, and the matching protocol below. **Treat this as Cara's instructions.** |
| `organizations.routing_links` | The structured execution data. After Cara picks a route, look it up here (by `label`/`intent`, which equal the trigger) to get the `url` / `businessFileId` / email / WhatsApp to actually use. |

The app keeps these in sync: `custom_prompt` is recompiled every time the call
flow is saved (and on Cara Setup / Settings / onboarding changes). The prompt
holds the **matching rules**; `routing_links` holds the **destinations**. Never
read raw URLs out of the prompt — always execute from `routing_links`.

> Caveat: if a business has written a manual prompt in Cara Setup, that manual
> text is `custom_prompt`. Saving the call flow recompiles `custom_prompt`, so a
> manual prompt is replaced by the generated one. This is intentional — the call
> flow is the source of truth for routing.

## Matching protocol

1. Understand what the caller wants in plain terms.
2. Compare that meaning to each route's trigger. Pick the single best match.
3. **Only act when confident.** A loose, surface-level word overlap is not a
   match.
4. **Disambiguation:** if two routes are both plausible, ask **one** short
   clarifying question, then act on the answer. Never guess between two routes.
5. **No match → fallback.** Use the "Anything else" route: take a message.
6. Never invent a link, file, price, hour, service, or policy you were not given.

## Actions (`targetType` in `routing_links`)

| Action | `targetType` | What Cara does |
|--------|--------------|----------------|
| Send a link | `link` | Confirm the caller's mobile number, SMS the route's `url`, confirm it has been sent. |
| Send a file | `form` + `businessFileId` | Only if the `business_files` row has `send_enabled = true`. Deliver a short-lived **signed URL** from the private `business-files` bucket; send `file_name` + `mime_type`. Never expose `storage_path`. |
| Take a message | `callback` | Capture the details in the route's `url` note (defaults to name, number, what they need). Create an Action Inbox ticket (`POST /api/voice/action-ticket`) and report `outcome: action_created`. |
| **Transfer** | `phone` | Announce the transfer (`transferLabel` when set). Dial `url` (E.164). On connect, report `outcome: transferred`. On no-answer, busy, closed hours (`transferDuringHoursOnly`), or failed connect — take a message and report `action_created`. Never drop the caller. |
| Email the team | `email` | Collect the caller's details, send to the address in `url`. |
| WhatsApp | `whatsapp` | Follow up via the number/link in `url`. |

Routes with `active: false` are ignored.

### Uploaded menus and price lists

When callers ask about a specific item or price in an uploaded file, use
`searchBusinessFile` to query the full stored document. Quote only what matches
their question — never read the whole menu aloud. If nothing matches, offer to
send the file (when `send_enabled`) or take a message with `takeCallbackMessage`.

### Booking routes (`presetId: booking-inquiry`)

The dashboard lets owners pick how booking is fulfilled:

| Method | `targetType` | Worker behaviour |
|--------|--------------|----------------|
| Text a link | `link` | Offer and send the booking `url` (SMS/email per `linkDelivery`). Report `link_sent`. No Action Inbox ticket. |
| Team rings back | `callback` | Capture structured booking fields listed in the route `url` note. Create Action Inbox ticket. **Do not confirm slots or deposits.** |
| Both | `link` + `description` | Send the booking link **and** capture backup details for Action Inbox (see `description` for capture list). |

**Action Inbox ticket format** for booking callback / backup paths — use this exact structure in `summary` when posting `POST /api/voice/action-ticket`:

```
Booking request — callback needed

Name: Jane Smith
Phone: +353 87 123 4567
Preferred service: Balayage (UNCONFIRMED)
Preferred day: Saturday (UNCONFIRMED)
```

- First line is the header (dashboard classifies this as a booking request).
- Each captured field is `Label: value` on its own line.
- Append `(UNCONFIRMED)` for preferences that are not confirmed appointments.
- Name and phone may omit `(UNCONFIRMED)` when clearly stated on the call.

## The fallback ("Anything else")

- Always present and locked in the dashboard; always serialized into
  `routing_links` with `intent: "anything else"`, `targetType: "callback"`, and
  the capture instructions in `url`.
- Used whenever no specific route matches.
- Behaviour: take a message (name, phone number, what they need), create an
  Action Inbox ticket, report `outcome: action_created`. Nothing is dropped.

## Edge cases

| Situation | Cara's behaviour |
|-----------|------------------|
| Caller asks for a person / department | Match the department transfer route when configured (`targetType: phone`). Announce and dial. On failure, take a message. Report `transferred` on connect. |
| Caller asks for several things | Handle the primary request, then offer the others ("I can also text you the booking link — would that help?"). |
| Matched route's destination is missing/invalid | Do not invent one. Fall back to taking a message and flag it. |
| Caller asks about something the business does NOT offer (`agent_services_not_offered`) | Politely say it is not offered; offer to take a message. |
| Out of hours | Still take a message (fallback). |
| Voicemail / silence / no usable speech | `outcome: voicemail_or_no_speech`. |
| Robocall / spam / abuse | `outcome: spam_or_abuse`. |
| Ambiguous between two routes | One short clarifying question, then act. |
| Caller asks a factual question (hours, location, services) | Answer from Cara Setup knowledge — that is not a routing action. |

## Outcomes to report

Use the canonical `outcome` values from `VOICE-WORKER-CONTRACT.md`
(`answered`, `link_sent`, `callback_requested`, `action_created`, `transferred`,
`failed`, `voicemail_or_no_speech`, `spam_or_abuse`, `blocked`). `outcome` drives every dashboard
metric — send a canonical string.
