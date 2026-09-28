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
        retail stores. Managed accounts are set up by our team and billed to the
        agreed organisation by invoice. Account activation does not require a
        payment card. Acknowledging this notice confirms that it has been provided
        to you; it is not consent to all processing.
      </LegalCallout>

      <LegalSection title="1. Who we are and our roles under GDPR">
        <p className="text-[14px] text-slate-600">{companyRegistrationLine()}</p>
        <LegalList>
          <li>
            <strong>The customer business</strong> deciding why and how its
            callers&rsquo; and contacts&rsquo; personal data is used is the{" "}
            <em>data controller</em>. The controller may differ from the group
            paying invoices where stores are operated by separate companies.
            Linking stores for billing does not itself authorise sharing their
            caller data.
          </li>
          <li>
            <strong>Hello Cara</strong> is your <em>data processor</em> for that
            data — we act on the controller&apos;s documented instructions under
            the{" "}
            <LegalInlineLink href="/legal/dpa">
              Data Processing Agreement
            </LegalInlineLink>
            .
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
              "Name, role, store and organisation details, email, phone, password credentials, and acceptance records",
              "You, your organisation's authorised administrator, or our team when setting up your account",
            ],
            [
              "Caller & contact data",
              "Caller ID, optional name, store enquiry details and action-inbox summaries",
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
              "Store service activity",
              "Enquiries, routing, requests and follow-up details; appointment details where that service is used",
              "Callers, store staff and configured integrations",
            ],
            [
              "Operational",
              "Logs, IP-derived metadata, error reports",
              "Web / server activity",
            ],
            [
              "Platform billing",
              <>
                Billing organisation, billing contact, invoice details and payment
                status. If an agreed payment method uses <strong>Stripe</strong>,
                Stripe handles its payment data; we do not store full card numbers.
              </>,
              "Your organisation, our invoicing records and any payment provider used",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Lawful bases (Article 6 GDPR)">
        <LegalList>
          <li>
            <strong>Contract</strong> (Art 6(1)(b)): providing services where
            necessary to perform a contract with you as an individual, or to take
            steps at your request before entering that contract.
          </li>
          <li>
            <strong>Legal obligation</strong> (Art 6(1)(c)): tax records,
            responding to lawful requests.
          </li>
          <li>
            <strong>Legitimate interests</strong> (Art 6(1)(f)): security, fraud
            prevention, administering relationships with corporate customers and
            their staff, service communications, and audit logging. We assess
            these interests against individuals&apos; rights.
          </li>
          <li>
            <strong>Consent</strong> (Art 6(1)(a)): only where required — e.g.
            non-essential cookies. You may withdraw consent without affecting
            processing already carried out.
          </li>
        </LegalList>
        <p>
          For caller data we process on a store&apos;s behalf, that controller must
          identify and explain its applicable lawful basis and purposes. Its
          representative accepting the DPA does not give consent on behalf of
          every caller. Account invitations and security messages concern the
          service; they do not enrol you in marketing.
        </p>
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
          Primary business and caller records use EEA storage. Some processing by
          voice, AI, email and other service providers may take place outside the
          EEA. The{" "}
          <LegalInlineLink href="/legal/sub-processors">sub-processor information</LegalInlineLink>
          {" "}describes providers, purposes and locations; an EU company address
          alone does not guarantee that all processing remains in the EEA.
        </p>
        <p>
          Transfers require an applicable adequacy decision or appropriate
          safeguards, such as the European Commission&apos;s Standard Contractual
          Clauses and any necessary supplementary measures. The EU–US Data Privacy
          Framework applies only where the recipient and processing are covered
          by a valid certification. Contact our privacy team for information about
          applicable safeguards and how to obtain a copy.
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
          The assistant identifies itself as AI at the start of the call and
          provides the applicable recording and transcription notice. Each store
          must also provide its caller privacy information. AI can misunderstand
          a request; important outcomes require staff review. Callers can ask for
          human follow-up using the store&apos;s available contact arrangements.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We encrypt data in transit (TLS) and at rest (managed database
          encryption). Production database access is restricted and logged.
          Stored transcripts use redaction controls to reduce exposure of card
          numbers, government IDs and certain sensitive information. Redaction
          cannot guarantee that all personal or sensitive information is removed
          and does not redact audio recordings. Recording and transcript retention
          is described below. Avoid giving the assistant unnecessary sensitive
          information.
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
            ["AI summary, caller number & action-item caller details", "13 months, then removed", "Store follow-up and reporting"],
            ["Contacts", "Anonymised after 24 months without updates", "Store contact management"],
            [
              "Appointments (if used)",
              "Account lifetime + 6 years where tax law requires",
              "Business records (Revenue)",
            ],
            [
              "Invoice and accounting records",
              "For the applicable statutory retention period",
              "Accounting and legal obligations",
            ],
            ["Security audit log", "24 months", "Incident investigation"],
            ["Business account & agreement records", "While the account is active and as needed afterwards for closure, legal obligations and establishing or defending claims", "Account administration and evidence of the agreement"],
          ]}
        />
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Contact <strong>{CLISTE_COMPANY.privacyEmail}</strong> about this notice
          or your data rights. Requests are handled without undue delay and within
          the applicable GDPR timeframe, generally one month, with any permitted
          extension explained to you. Where we act as processor, we assist the
          relevant store controller in responding.
        </p>
      </LegalSection>
    </>
  );
}
