# Voice compliance operational checklist

**Purpose:** Verify production voice pipeline meets GDPR, EU AI Act Art 50, and Irish
transparency expectations. Run before go-live on each DID and quarterly thereafter.

**Last updated:** 2026-09-23

---

## 1. AI disclosure (EU AI Act Art 50)

- [ ] Place a test call to each live DID.
- [ ] Confirm the **first spoken turn** includes: AI self-identification **and**
      recording/transcription notice (matches `voiceLegalDisclosure()` in
      `src/lib/voice-greeting.ts`).
- [ ] Check worker logs for `disclosure_confirmed: true` on `POST /api/voice/call-complete`.
- [ ] If disclosure is missing, block the number until the worker greeting is fixed.

## 2. Recording & audio retention

**Code implemented (Sep 2026):** worker waits for spoken disclosure playout before egress; dashboard rejects `audio_storage_path` without `disclosure_confirmed`; 30-day cron + GDPR erasure delete Storage objects.

- [ ] Twilio: **Call Recording = OFF** on every Cliste SIP trunk / number (Cliste records via LiveKit egress instead).
- [ ] LiveKit: **Egress recording = ON** → Supabase `call-recordings` bucket (EU routing).
- [ ] Voice worker: starts egress **only after** spoken AI/recording disclosure (`disclosure_confirmed: true`).
- [ ] Confirm `call_logs.audio_storage_path` is set on test calls and playback works in Calls + View call details.
- [ ] Retention cron deletes recordings after **30 days** (`call_recordings.storage` step).

## 3. EU data routing (GDPR Chapter V)

| Vendor | Target configuration | Verified |
| ------ | -------------------- | -------- |
| LiveKit Cloud agent | `eu-central` (Frankfurt compute) | [ ] |
| LiveKit project data region | **EU (Frankfurt)** at project creation — observability/analytics | [ ] |
| LiveKit SIP | `{project_id}.eu.sip.livekit.cloud` on Twilio TwiML | [ ] |
| LiveKit inference | Inference region restriction enabled | [ ] |
| LiveKit WebRTC | Protocol region pinning `eu` (Scale+, via support) | [ ] |
| ElevenLabs TTS | `api.eu.residency.elevenlabs.io` + Zero Retention (Enterprise) | [ ] |
| OpenRouter LLM | `https://eu.openrouter.ai` (Enterprise) | [ ] |
| Resend | Verify `hellocara.ie` domain + DNS | [ ] |

Document actual routing in the sub-processor annex if any vendor remains on US endpoints
(SCCs / DPF must be on file).

## 4. Webhook security

- [ ] `CLISTE_VOICE_WEBHOOK_SECRET` set in app **and** worker (matching values).
- [ ] Worker sends `called_number` on every `call-complete` request.
- [ ] `CLISTE_VOICE_ALLOW_LEGACY_ORG_ID` is **unset** in production.

## 5. Caller SMS (transactional only)

Cliste caller-facing SMS is **service/transactional** (links, files, booking URLs
requested on an inbound call). It is **not** marketing. Legal disclosure (AI,
recording) is handled on the **voice call** and via salon **website/signage**
templates — not as boilerplate inside every text.

- [ ] Worker asks verbal permission before texting (Cara prompt + routing rules).
- [ ] Worker sets `caller_consented: true` on `POST /api/voice/send-sms` only
      after the caller agrees to receive the text on the confirmed mobile number.
- [ ] SMS body may be **just the content** (e.g. booking link URL); optional
      business-name prefix is applied server-side unless `skip_business_prefix`.
- [ ] Caller-facing SMS sends from the org's assigned Irish DID (`+353…`), not
      the platform `TWILIO_SMS_FROM` number.
- [ ] Twilio IE1 messaging region set on pool numbers (`scripts/verify-twilio-ie1-messaging.ts`).
- [ ] Landline destinations fall back to message-taking (`422 landline_destination`).
- [ ] Monthly SMS quota enforced (`429 sms_quota_exhausted`).
- [ ] **No marketing** SMS via Cliste (Terms §4; ePrivacy Reg 13).
- [ ] Outbound SMS body **not retained** server-side (metering only).

Owner alert SMS (Action Inbox, Cara Training) uses the platform sender and is
operational/transactional — no STOP footer required for current product scope.

## 6. Sign-off

| Role | Name | Date |
| ---- | ---- | ---- |
| Engineering | | |
| Privacy lead | | |

---

See also: `docs/VOICE-WORKER-CONTRACT.md`, `docs/legal/DPIA.md` §7, `docs/legal/GDPR-VOICE-AGENTS-IRELAND.md`.
