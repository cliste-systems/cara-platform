# Westport demo run sheet — Cabinet group / Kavanaghs pilot

**Audience:** Head office (may not be technical) + Gareth Ferry  
**Duration:** 30–45 minutes  
**Goal:** Show real shop value + enough trust to approve a **Donegal Town-only pilot**

Based on [`scripts/kavanaghs-five-part-demo-script.md`](../../../scripts/kavanaghs-five-part-demo-script.md).

---

## Before the meeting

### Environment

- [ ] Dashboard running (production or rehearsed demo org — Kavanaghs Donegal Town)
- [ ] Voice worker live on LiveKit Cloud with latest retail intake
- [ ] `npx tsx scripts/regenerate-kavanaghs-prompt.ts` if using Kavanaghs demo org
- [ ] National weekly offers synced if showing live offer quote (Part 3)
- [ ] `notification_phone` set for SMS demo (Part 5) or skip SMS and show ticket only
- [ ] LiveKit credits topped up
- [ ] Laptop + projector / screen share tested
- [ ] Print or PDF: `donegal-town-pilot-summary.md` for leave-behind

### Rehearsal (day before)

```bash
cd cara-platform
npx tsx scripts/rehearse-kavanaghs-demo.ts --manager-phone +353872715938 --probe-webhooks
npx tsx scripts/rehearse-kavanaghs-demo.ts --simulate-five-part --app-url https://app.hellocara.ie
```

---

## Agenda (5 parts · ~20 min demo + ~15 min Q&A)

| # | Say to Cara | Show | Talk track (plain English) |
|---|-------------|------|----------------------------|
| **1** | “What time do you close on Sunday?” · “Where is the bakery?” | Call History — answered, **no** department ticket | Most calls — answered and logged, **no staff interruption** |
| **2** | Birthday cake for Saturday — chocolate sponge, 12 people, message on icing, your name | **Departments → Bakery** — Order card with date / message | Bakery gets a **structured callback**, not a scribbled note |
| **3** | “Are Irish striploin steaks on offer this week?” | Call History transcript — quote from **national offers** | She checks **this week’s offers** — she’s **not making it up** |
| **4** | “10 sirloin steaks for collection tomorrow evening” + name | **Departments → Meat counter** — Order, When, etc. | Counter sees **exactly what they need** |
| **5** | “I need the store manager — my home delivery never arrived” + name | **Departments → Management** — Complaint + optional **SMS** to manager | Serious issues reach management **without you tied to the phone** for the other four |

**Close the demo:** “That’s one busy afternoon on the phone — Cara handled FAQs herself and only pulled staff in when it mattered.”

---

## Compliance talking points (if asked · keep short)

- Callers hear: **AI assistant + call may be recorded** before recording starts.
- Recordings deleted **automatically after 30 days**.
- Store/group owns caller data; we provide **DPA + privacy docs**.
- Links: app.hellocara.ie/legal/privacy · /legal/dpa

Do **not** lead with US AI vendors unless IT asks — offer detail then.

---

## Pilot ask (end of meeting)

1. Approval for **Donegal Town 6-week pilot** (conditions: signage, DPA, phone divert — whatever they need).
2. Intro to **phone / IT contact** if separate from systems lead.
3. Follow-up email with pilot summary attached.

---

## Backup swaps

| If this breaks | Swap to |
|----------------|---------|
| Offer tool empty | “Do you sell Skyr yogurt?” — product search + callback |
| Cake ticket slow | Narrate post-call while refreshing Bakery tab |
| SMS doesn’t arrive | Show Management ticket only; check `notification_phone` |
| Remote only | Zoom + screen share dashboard; one live call to demo line |

---

## After the meeting

- [ ] Email Gareth + head office contact with thank-you and `donegal-town-pilot-summary.md`
- [ ] Note any conditions they require (DPA signed, signage, IT divert window)
- [ ] Schedule pilot go-live only after written approval
