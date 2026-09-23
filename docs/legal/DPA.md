# Data Processing Agreement (DPA)

> **Note:** The authoritative customer-facing DPA is published in the app at
> `/legal/dpa` (`src/content/legal/dpa-document.tsx`). This file is an internal
> mirror for ops and may lag slightly — prefer the in-app version for legal text.

**Cliste Systems Limited** ("Processor") and the customer business ("Controller") agree
the following with respect to processing of personal data carried out by
Cliste Systems Limited on behalf of the customer under the Hello Cara platform Terms of
Service.

This DPA forms part of the agreement between the parties and applies to all
processing of personal data carried out by Cliste under the agreement.

---

## 1. Definitions

Capitalised terms not defined here have the meaning given in the GDPR
(Regulation (EU) 2016/679).

- **GDPR** — Regulation (EU) 2016/679.
- **Personal data**, **processing**, **controller**, **processor**,
  **data subject**, **special categories of personal data** — as defined
  in Article 4 GDPR.
- **Sub-processor** — any third party engaged by Cliste that processes
  Personal Data on the Controller's behalf.

## 2. Subject matter and duration

Cliste Systems Limited processes Personal Data to provide the Hello Cara platform — AI voice
receptionist, Action Inbox, optional appointments, SMS / email notifications,
and the operator dashboard — for the duration of the customer's subscription,
plus the retention periods set out in `RETENTION.md`.

## 3. Nature, purpose and categories

| Item                          | Detail                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Nature of processing          | Storage, structuring, transmission, transcription, summarisation, retrieval                     |
| Purpose                       | Operating the salon's appointment book, voice receptionist, and payment notifications           |
| Data subject categories       | The Controller's customers, their staff users (operators)                                       |
| Personal data categories      | Name, mobile phone number, email, appointment metadata, voice call audio (up to 30 days in private storage), call transcripts (30 days), AI summaries (13 months), pseudonymised payment metadata |
| Special category data         | None intended. Customers may volunteer health-related context during a call (e.g. "I'm pregnant"). Controller is responsible for not soliciting it. |

## 4. Controller obligations

The Controller (salon) warrants that:

- It has a lawful basis under Article 6 GDPR for every category of
  Personal Data shared with Cliste — typically performance of a
  contract (Art 6(1)(b)) for booking, and legitimate interests
  (Art 6(1)(f)) for repeat-customer recognition.
- It has provided appropriate transparency information to its customers
  under Articles 13 / 14 GDPR, including disclosure of the AI voice
  assistant.
- It will not upload special category data unless it has the relevant
  Article 9 condition.

## 5. Processor obligations

Cliste will:

1. **Process only on documented instructions** from the Controller,
   except where required by EU / Member State law.
2. Ensure persons authorised to process Personal Data are bound by
   confidentiality.
3. Implement appropriate **technical and organisational measures**
   (Article 32) — see Annex II.
4. Engage **sub-processors** only with the Controller's authorisation
   (Section 7) and impose equivalent data-protection obligations on
   them.
5. Taking into account the nature of the processing, **assist the
   Controller** by appropriate technical and organisational measures
   to fulfil its obligation to respond to data-subject requests
   (Articles 12-23 GDPR). The Controller's primary self-service tools
   are at `/dashboard/legal/data-requests`.
6. **Assist the Controller** in ensuring compliance with Articles 32-36
   (security, breach notification, DPIA).
7. **Notify** the Controller without undue delay (and in any event within
   72 hours of becoming aware) of any Personal Data breach affecting
   the Controller's data — see `BREACH-RUNBOOK.md`.
8. At the end of the agreement, **delete or return** all Personal Data
   to the Controller (see Section 9).
9. Make available to the Controller all information necessary to
   demonstrate compliance with Article 28 obligations and allow for
   reasonable audits.

## 6. International transfers

Several sub-processors are located in or transfer data to the United
States (see `/legal/sub-processors`). Cliste relies on the **EU-U.S.
Data Privacy Framework** where the sub-processor is certified, and the
EU Commission's **Standard Contractual Clauses** (Module 3:
processor-to-processor) elsewhere, supplemented by the technical and
organisational measures in Annex II.

## 7. Sub-processors

The current list of sub-processors is published at
`https://app.hellocara.ie/legal/sub-processors`. The Controller
provides general written authorisation for Cliste to engage these and
future sub-processors. Cliste will give at least **30 days' notice** of
any new or replaced sub-processor by updating that page and notifying
the Controller's primary admin user by email. The Controller may
object on reasonable grounds within that notice period; if Cliste
cannot accommodate the objection, the Controller may terminate the
agreement.

## 8. Data subject rights

The Controller's dashboard provides self-service tools at
`/dashboard/legal/data-requests` for handling Article 15 (access) and Article 17
(erasure) requests. For Articles 18, 20, 21 and 22 requests, or where
data spans multiple controllers, the Controller may request assistance
by emailing **support@hellocara.ie**.

## 9. Deletion / return

Within 30 days of the termination or expiry of the agreement, Cliste
will, at the Controller's choice, delete or return all Personal Data
processed on its behalf, except where retention is required by Union
or Member State law. Backups are overwritten within the standard backup
rotation (35 days at the time of writing).

## 10. Liability

Liability is governed by the underlying agreement between the parties.

## 11. Governing law

This DPA is governed by the laws of Ireland and the courts of Ireland
have exclusive jurisdiction.

---

## Annex I — Processing details

| Field                  | Value                                                       |
| ---------------------- | ----------------------------------------------------------- |
| Controller             | The customer salon (Account holder of the Cliste account)   |
| Processor              | Cliste Systems, Ireland                                     |
| Processor contact      | privacy@hellocara.ie                                    |
| Frequency              | Continuous, for the duration of the subscription            |
| Storage location       | EEA — Supabase AWS eu-west-1 (Ireland); Vercel dub1 (Dublin); LiveKit Cloud EU (Frankfurt); see Annex III |

## Annex II — Technical & organisational measures

- **Encryption** — TLS 1.2+ in transit, AES-256 at rest (Postgres,
  object storage).
- **Access control** — Row-level security on every tenant table; service
  role keys held only on the server; SSO + 2FA for engineering access.
- **Logging** — Security audit log table (`security_auth_events`) for
  privileged actions (admin actions, refunds, GDPR exports / erasures).
- **Network** — Production behind Cloudflare WAF + Turnstile bot
  protection on public booking endpoints.
- **Backup** — Supabase managed point-in-time recovery, 35-day window.
- **Incident response** — See `BREACH-RUNBOOK.md`.
- **Pen testing / review** — Internal security review on every release;
  external review on request.
- **Retention** — Daily cron at `/api/cron/data-retention`.

## Annex III — Sub-processors and locations

The authoritative named list with country, transfer mechanism and purpose is
in the customer dashboard (**Legal & privacy → Sub-processors**) and at
`/legal/sub-processors` (category summary). Snapshot as of the date this DPA
is signed:

- Supabase — EEA (AWS eu-west-1, Ireland); primary database
- Vercel — EEA (dub1 Dublin); dashboard & APIs
- LiveKit Cloud (LiveKit, Inc.) — EU (Frankfurt); voice agent runtime, EU SIP for inbound; WebRTC global until protocol pinning; DPF / SCCs
- Stripe Payments Europe Ltd (Ireland)
- Twilio Ireland (Ireland; SIP/SMS may route globally)
- ElevenLabs Inc. (US; EU residency on Enterprise — DPF / SCCs; transient TTS)
- OpenRouter Inc. (US; EU in-region routing on Enterprise — SCCs; LLM routing)
- Resend (US global API — SCCs)
- Google Ireland Ltd (optional geocoding — SCCs)
- Cloudflare Ireland (Ireland; global edge)

---

_Last updated: 2026-06-12._
