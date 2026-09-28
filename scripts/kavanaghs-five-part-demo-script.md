# Kavanaghs 5-call demo — script card

**Line:** +353749759508
**Dashboard:** kavanaghs@cliste.test / [use the unique test credential from your password manager]
**URL:** http://localhost:3001/dashboard

Run readiness:

```bash
cd cara-platform
npx tsx scripts/rehearse-kavanaghs-demo.ts --manager-phone +353872715938 --probe-webhooks
npx tsx scripts/regenerate-kavanaghs-prompt.ts
npx tsx scripts/rehearse-kavanaghs-demo.ts --simulate-five-part --app-url http://localhost:3001
```

---

## Before Garreth arrives

1. `npm run dev -- -p 3001` (cara-platform dashboard + voice webhooks)
2. Voice worker deployed on LiveKit Cloud (cara-voice-platform) with latest intake changes
3. `npx tsx scripts/regenerate-kavanaghs-prompt.ts` — SuperValu + Real Rewards in compiled prompt
4. Confirm `notification_phone` = your test mobile (SMS on complaint ticket)
5. National offers synced (`retail_weekly_offers` — 2000+ rows)
6. Top up **LiveKit inference credits**
7. Hard refresh dashboard; wide screen (≥1024px)

Optional remote demo: `ngrok http 3001` → `npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --ngrok-url https://….ngrok-free.app`

---

## Part 1 — FAQ → Call History (~2 min)

**Say:** “What time do you close on Sunday?” → “Where is the bakery?”

**Show:** Call History — **Answered**, no Action Inbox ticket

**Talk track:** Most calls — answered and logged, no staff time.

---

## Part 2 — Cake → Bakery department (~4 min)

**Say:** Birthday cake for Saturday, chocolate sponge, 12 people, “Happy 8th Birthday Jamie”, your name — answer any follow-up (date, icing)

**Show:** `/dashboard/departments/bakery` — list card **Order**, detail with For / Date / Message

**Talk track:** Bakery gets a structured callback ticket, not a scribbled message.

---

## Part 3 — Live offer quote → Call History (~3 min)

**Say:** “Are Irish striploin steaks on offer this week?” (fallback: “quick fry steak on special”)

**Show:** Call History transcript — she quoted from **searchSuperValuProducts** / national weekly offers sync

**Talk track:** She checks this week’s national SuperValu offers live — she’s not making it up.

---

## Part 4 — Butcher pre-order → Meat counter (~4 min)

**Say:** “I need 10 sirloin steaks for collection tomorrow evening” + your name — let her ask one follow-up (time / size / bags)

**Show:** `/dashboard/departments/meat-counter` — **Order**, **When**, etc.

**Talk track:** She asks the one question that matters; your counter sees exactly what they need.

---

## Part 5 — Manager complaint → Management + SMS (~4 min)

**Say:** “I need to speak to the store manager — my home delivery never arrived yesterday” + your name — confirm when she summarises

**Hang up** — SMS fires to `notification_phone` via post-call processing (~10–15s)

**Show:** `/dashboard/departments/management` — **Complaint** ticket + phone buzzes

**Talk track:** When it’s serious, you get the text after the call — you weren’t tied to the phone for the other four.

---

## After the demo

`npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --restore`

---

## Backup swaps

| If this breaks | Swap to |
|----------------|---------|
| Offer tool empty | “Do you sell Skyr yogurt?” — product search + callback |
| Cake ticket slow | Narrate post-call while refreshing bakery tab |
| SMS doesn’t arrive | Show Management ticket; check `notification_phone` + Twilio |
| Real Rewards question | Lost card → Helpdesk **0818 220 088** + pick up replacement in store |
