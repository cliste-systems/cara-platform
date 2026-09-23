
import {
    LegalCallout,
  LegalList,
  LegalPageHeader,
  LegalSection,
  LegalTable,
} from "@/components/legal/legal-document";
import { LegalInlineLink } from "@/components/legal/legal-path-context";
import { CLISTE_COMPANY, companyRegistrationLine } from "@/lib/company-details";


export function PrivacyNoticeDocument() {
  return (
    <>
      <LegalPageHeader
        title="Privacy notice"
        description={`How ${CLISTE_COMPANY.legalName} processes personal data when you use our platform as a business customer, when your team uses the dashboard, and when people call your Hello Cara number.`}
      />

      <LegalCallout variant="info">
        Hello Cara is an <strong>AI voice receptionist and Action Inbox</strong> for
        local businesses. We do not host public online booking storefronts or
        take card payments from your customers on your behalf. Subscription
        billing for your Hello Cara account is handled by Stripe separately.
      </LegalCallout>

      <LegalSection title="1. Who we are and our roles under GDPR">
        <p className="text-[14px] text-slate-600">{companyRegistrationLine()}</p>
        <LegalList>
          <li>
            <strong>You, the business owner</strong>, are the{" "}
            <em>data controller</em> for your callers&rsquo; and contacts&rsquo;
            personal data (name, phone, call history, action-inbox items). You
            decide why and how that data is used.
          </li>
          <li>
            <strong>Hello Cara</strong> is your <em>data processor</em> for that
            data — we act only on your documented instructions (this notice and
            the{" "}
            <LegalInlineLink href="/legal/dpa">
              Data Processing Agreement
            </LegalInlineLink>
            ).
          </li>
          <li>
            <strong>Hello Cara</strong> is the <em>controller</em> for our own
            account data (your email, dashboard activity, platform billing
            records).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. What data we process">
        <LegalTable
          headers={["Category", "Examples", "Source"]}
          rows={[
            [
              "Business account",
              "Name, business name, email, phone, password hash",
              "You at signup / settings",
            ],
            [
              "Caller & contact data",
              "Caller ID, optional name, action-inbox summaries",
              "Inbound calls, dashboard contacts",
            ],
            [
              "Voice call data",
              <>
                Caller number, duration, redacted transcript, AI summary, and call
                recording (MP3 audio). Recordings are stored in our EU-hosted
                storage for up to <strong>30 days</strong>, then deleted automatically.
              </>,
              "Calls to your Hello Cara number",
            ],
            [
              "Appointments (optional)",
              "If your voice agent books through Hello Cara, service, time, reference",
              "AI call flow / legacy data",
            ],
            [
              "Operational",
              "Logs, IP-derived metadata, error reports",
              "Web / server activity",
            ],
            [
              "Platform billing",
              <>
                Card data is handled by <strong>Stripe</strong>; we store
                subscription and customer ids, not full card numbers.
              </>,
              "Stripe Billing / Customer Portal",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Lawful bases (Article 6 GDPR)">
        <LegalList>
          <li>
            <strong>Contract</strong> (Art 6(1)(b)): operating your account,
            answering calls, Action Inbox notifications you configure.
          </li>
          <li>
            <strong>Legal obligation</strong> (Art 6(1)(c)): tax records,
            responding to lawful requests.
          </li>
          <li>
            <strong>Legitimate interests</strong> (Art 6(1)(f)): security, fraud
            prevention, service improvement that does not single out
            individuals, audit logging.
          </li>
          <li>
            <strong>Consent</strong> (Art 6(1)(a)): only where required — e.g.
            non-essential cookies. You may withdraw consent without affecting
            processing already carried out.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Retention">
        <p>
          See{" "}
          <LegalInlineLink href="/legal/privacy#retention">
            section 11
          </LegalInlineLink>{" "}
          for our retention schedule. A daily cron job enforces automatic
          deletion or redaction where stated.
        </p>
      </LegalSection>

      <LegalSection title="5. International transfers">
        <p>
          Your business and caller records are stored in the{" "}
          <strong>EEA</strong> (Ireland). Dashboard hosting runs in{" "}
          <strong>Dublin (dub1)</strong>, and the voice agent on{" "}
          <strong>LiveKit Cloud</strong> (EU SIP and agent runtime in Frankfurt).
          Some processing
          — mainly{" "}
          <strong>text-to-speech and LLM routing</strong> (ElevenLabs, OpenRouter)
          and transactional email — may still use US-based sub-processors under the
          EU&ndash;US Data Privacy Framework and/or Standard Contractual Clauses.
          Audio recordings and transcripts are retained for up to 30 days; see{" "}
          <LegalInlineLink href="/legal/sub-processors">sub-processors</LegalInlineLink>.
        </p>
      </LegalSection>

      <LegalSection title="6. Your rights (Articles 15–22 GDPR)">
        <p>
          Callers and contacts should normally exercise rights with you as
          controller. We assist you via dashboard GDPR tools and{" "}
          <strong>{CLISTE_COMPANY.privacyEmail}</strong>.
        </p>
        <LegalList>
          <li>Access, rectification, erasure, restriction, portability</li>
          <li>Object to processing (including direct marketing — we do not market to your lists)</li>
          <li>
            Complain to the Irish{" "}
            <LegalInlineLink href="https://www.dataprotection.ie" external>
              Data Protection Commission
            </LegalInlineLink>
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="7. Automated decision-making">
        <p>
          The AI voice agent handles routine calls and may create action items or
          optional appointments. It does not make legal or similarly significant
          decisions about callers without human oversight — your team reviews
          outcomes in the dashboard.
        </p>
      </LegalSection>

      <LegalSection title="8. AI transparency">
        <p>
          Calls to your Hello Cara number are answered by an AI agent that identifies
          itself as AI where required. Callers may ask for a callback or use your
          direct line.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We encrypt data in transit (TLS) and at rest (managed database
          encryption). Production database access is restricted and logged.
          Voice calls are transcribed for up to 30 days; transcripts are redacted
          for card numbers, government IDs, and obvious volunteered sensitive
          phrases before storage. Call recordings are kept for up to 30 days for
          quality review and dispute handling, then deleted automatically.
        </p>
      </LegalSection>

      <LegalSection title="10. Sub-processors">
        <p>
          A <strong>category summary</strong> is at{" "}
          <LegalInlineLink href="/legal/sub-processors">
            /legal/sub-processors
          </LegalInlineLink>
          . <strong>Business customers</strong> receive the named vendor annex in
          the dashboard (Legal &amp; privacy) and in the DPA. We notify you before
          material additions where required by contract.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="11. Retention schedule">
        <LegalTable
          headers={["Data", "Retention", "Why"]}
          rows={[
            [
              "Voice call audio (recording)",
              "30 days, then deleted",
              "Quality review, dispute handling, staff playback in dashboard",
            ],
            [
              "Call transcript & review text",
              "30 days, then nulled",
              "Quality review; summary kept for trends",
            ],
            ["AI summary & caller number", "13 months, then nulled", "Reporting window"],
            [
              "Appointments (if used)",
              "Account lifetime + 6 years where tax law requires",
              "Business records (Revenue)",
            ],
            [
              "Legacy public-booking security rows",
              "Purged by cron (30 min / 14 days)",
              "Leftover tables from retired feature; no new writes",
            ],
            ["Security audit log", "24 months", "Incident investigation"],
            ["Business account", "Account lifetime + 30 days", "Closure handling"],
          ]}
        />
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          <strong>{CLISTE_COMPANY.privacyEmail}</strong> — we aim to acknowledge within
          5 working days and respond within 30 days (extendable for complex
          requests, with notice).
        </p>
      </LegalSection>
    </>
  );
}
