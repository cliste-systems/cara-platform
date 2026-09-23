# Personal Data Breach Runbook

GDPR Article 33 requires the controller to notify the supervisory
authority (the Irish DPC) "without undue delay and, where feasible,
not later than 72 hours after having become aware" of a personal data
breach.

When Cliste is acting as **processor** (i.e. for salon-customer data),
Article 33(2) requires Cliste to notify the controller (the salon)
without undue delay.

This runbook is the operational playbook. It is intentionally short.

---

## 0. Severity at a glance

| Severity | Examples                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------- |
| P0       | Confirmed exfiltration of any production database table; service-role key leak with proven misuse.   |
| P1       | Stripe / Twilio / Supabase service-role key suspected compromised; unauthenticated cross-tenant data access proven; transcript dump from a sub-processor confirmed. |
| P2       | Misdirected SMS / email batch (wrong recipient); single salon's data visible to another salon UI.    |
| P3       | Self-reported low-impact issue (e.g. stale Cara conversation visible after sign-out); near-miss reported by researcher. |

P0 / P1 → Article 33 notification likely. P2 → assess case-by-case.
P3 → log, fix, no notification required.

---

## 1. T+0 — Detection

Detection sources:
- Security audit log alert (anomaly in `admin_*` events).
- Sentry / log alert (e.g. RLS errors, 500 spike on auth routes).
- Sub-processor advisory (e.g. Stripe / Twilio status page).
- Researcher email to `security@hellocara.ie`.
- Internal employee report.

**Action:** Anyone who notices a potential breach pages the privacy
lead via the Cliste internal channel within 1 hour. Do not act
publicly yet.

## 2. T+1h — Containment

Designate an **Incident Lead** (default: privacy lead).

- Snapshot relevant logs (Vercel, Supabase, Twilio, LiveKit) into a
  private Linear issue or Google Doc — **do not** put PII into Slack.
- If the cause is a leaked credential: rotate immediately
  (`docs/runbooks/rotate-secrets.md` if it exists; otherwise rotate
  in the relevant provider console + redeploy).
- If the cause is a code bug exposing data cross-tenant: roll back the
  offending deploy via Vercel / LiveKit agent rollback, or fast-forward a hotfix
  flag.
- If a sub-processor is the source: open a ticket with their security
  team and capture their reference number.

## 3. T+4h — Assessment

Document, for the breach record:

1. What data was affected — categories and approximate volume.
2. Which controllers (salons) are affected.
3. Which data subjects (count, residency).
4. Was it actually accessed, or merely exposed?
5. Has the exposure been stopped?
6. Likelihood and severity of harm to the data subject (financial,
   reputational, identity, special category).

Use the EDPB Guidelines 9/2022 examples to gauge severity.

## 4. T+24h — Decision

Convene a brief (15-minute) call with:
- Incident Lead
- Engineering lead
- Privacy lead

Decide:

- [ ] Article 33 notification to the DPC required? (Yes if
      "likely to result in a risk to the rights and freedoms of
      natural persons".)
- [ ] Article 34 notification to data subjects required? (Yes if
      "high risk".)
- [ ] Sub-processor notice required (DPA terms)?
- [ ] Customer (controller) notification — required even if not
      reportable to the DPC, where Cliste is acting as processor.

## 5. T+72h — Notify

If notification is required:

- **DPC** — submit via [www.dataprotection.ie](https://www.dataprotection.ie/en/organisations/data-security/breach-notification)
  using the breach notification form. Include: nature, categories &
  numbers, contact, likely consequences, measures taken.
- **Affected controllers (salons)** — email + dashboard banner.
  Template at end of this doc.
- **Affected data subjects** — only if high risk; coordinate wording
  with the controller (they are the visible face).

If notification is **not** required, document the reasoning in the
breach register (next section).

## 6. Breach register

We maintain an internal register (Article 33(5)) at
`docs/internal/breach-register.md` (private repo / encrypted store).
Every incident — even those not notified — gets a row:

```
| date | severity | summary | data | volume | notified? | closed |
```

## 7. Post-mortem

Within 14 days, publish an internal post-mortem covering:

1. Timeline (UTC).
2. Root cause.
3. Contributing factors.
4. Remediation actions taken.
5. Long-term prevention (code change, process change).
6. What was good about the response.

If a customer-facing summary is appropriate (P0 / P1), publish at
`status.hellocara.ie` once remediation is verified.

---

## Appendix A — Email template to controller

> Subject: Important security notice about your Cliste account
>
> Hi <salon name>,
>
> We are writing to let you know about a security incident affecting
> personal data we process on your behalf as your data processor.
>
> **What happened**
> <plain English description, 2-3 sentences>
>
> **What data was affected**
> <categories — names, phone numbers, transcripts, etc.>
>
> **What we have done**
> <containment + remediation, 2-3 sentences>
>
> **What we recommend you do**
> <if anything: e.g. notify your customers; reset your dashboard
> password; nothing further>
>
> Under Article 33(2) GDPR we are notifying you without undue delay
> so you can decide whether to notify the Data Protection Commission
> and your customers. Cliste is also <reporting / not reporting> to
> the DPC directly because <…>.
>
> Our incident reference is <ID>. Please reply to this email or
> contact privacy@hellocara.ie with any questions.
>
> — Cliste Systems Limited

## Appendix B — Indicators that should auto-page

- > 10 `admin_*` failure events from the same IP in 5 minutes.
- Any `gdpr_erasure` event without a corresponding ticket.
- Stripe webhook signature failures > 5/min.
- Cloudflare WAF rule "block" rate spike > 10x baseline.
- Sentry error containing "JWT expired" but with `service_role` actor.
