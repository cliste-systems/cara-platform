
import {
  LegalList,
  LegalPageHeader,
  LegalSection,
  LegalTable,
} from "@/components/legal/legal-document";
import { LegalInlineLink } from "@/components/legal/legal-path-context";
import { CLISTE_COMPANY } from "@/lib/company-details";
import { SUB_PROCESSORS } from "@/lib/sub-processors.data";

export function DpaDocument() {
  return (
    <>
      <LegalPageHeader
        title="Data Processing Agreement (DPA)"
        description={`GDPR Article 28 agreement between ${CLISTE_COMPANY.legalName} (processor) and your business (controller) for caller and contact data processed through the Hello Cara platform.`}
      />

      <p className="text-[15px] leading-relaxed text-slate-700">
        <strong>{CLISTE_COMPANY.legalName}</strong> (&ldquo;Processor&rdquo;) and the customer
        business (&ldquo;Controller&rdquo;) agree the following with respect to
        processing of personal data carried out by {CLISTE_COMPANY.legalName} on behalf of
        the Controller under the Hello Cara platform{" "}
        <LegalInlineLink href="/legal/terms">Terms of Service</LegalInlineLink>.
        This DPA forms part of the agreement between the parties and applies to
        all processing of personal data carried out by Cliste Systems Limited under the
        agreement.
      </p>

      <LegalSection title="1. Definitions">
        <p>
          Capitalised terms not defined here have the meaning given in the GDPR
          (Regulation (EU) 2016/679).
        </p>
        <LegalList>
          <li>
            <strong>GDPR</strong> — Regulation (EU) 2016/679.
          </li>
          <li>
            <strong>Personal data</strong>, <strong>processing</strong>,{" "}
            <strong>controller</strong>, <strong>processor</strong>,{" "}
            <strong>data subject</strong>,{" "}
            <strong>special categories of personal data</strong> — as defined in
            Article 4 GDPR.
          </li>
          <li>
            <strong>Sub-processor</strong> — any third party engaged by {CLISTE_COMPANY.legalName}
            that processes Personal Data on the Controller&apos;s behalf.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. Subject matter and duration">
        <p>
          Cliste Systems Limited processes Personal Data to provide the Hello Cara platform — AI voice
          receptionist, Action Inbox, optional appointments, SMS / email
          notifications, and the operator dashboard — for the duration of the
          customer&apos;s subscription, plus the retention periods set out in our{" "}
          <LegalInlineLink href="/legal/privacy#retention">
            privacy notice
          </LegalInlineLink>
          .
        </p>
      </LegalSection>

      <LegalSection title="3. Nature, purpose and categories">
        <LegalTable
          headers={["Item", "Detail"]}
          rows={[
            [
              "Nature of processing",
              "Storage, structuring, transmission, transcription, summarisation, retrieval",
            ],
            [
              "Purpose",
              "Operating the business voice receptionist, Action Inbox, and related notifications",
            ],
            [
              "Data subject categories",
              "The Controller's customers and staff users (operators)",
            ],
            [
              "Personal data categories",
              "Name, mobile phone number, email, appointment metadata, voice call audio (up to 30 days in private storage), call transcripts (30 days), AI summaries (13 months)",
            ],
            [
              "Special category data",
              "None intended. Customers may volunteer health-related context during a call. Controller is responsible for not soliciting it.",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Controller obligations">
        <p>The Controller warrants that:</p>
        <LegalList>
          <li>
            It has a lawful basis under Article 6 GDPR for every category of
            Personal Data shared with {CLISTE_COMPANY.legalName} — typically performance of a
            contract (Art 6(1)(b)) for booking, and legitimate interests
            (Art 6(1)(f)) for repeat-customer recognition.
          </li>
          <li>
            It has provided appropriate transparency information to its customers
            under Articles 13 / 14 GDPR, including disclosure of the AI voice
            assistant.
          </li>
          <li>
            It will not upload special category data unless it has the relevant
            Article 9 condition.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Processor obligations">
        <p>Cliste Systems Limited will:</p>
        <LegalList ordered>
          <li>
            <strong>Process only on documented instructions</strong> from the
            Controller, except where required by EU / Member State law.
          </li>
          <li>
            Ensure persons authorised to process Personal Data are bound by
            confidentiality.
          </li>
          <li>
            Implement appropriate <strong>technical and organisational measures</strong>{" "}
            (Article 32) — see Annex II.
          </li>
          <li>
            Engage <strong>sub-processors</strong> only with the Controller&apos;s
            authorisation (Section 7) and impose equivalent data-protection
            obligations on them.
          </li>
          <li>
            Assist the Controller with data-subject requests (Articles 12–23 GDPR)
            using{" "}
            <LegalInlineLink href="/dashboard/legal/data-requests">
              Data request tools
            </LegalInlineLink>{" "}
            in the dashboard.
          </li>
          <li>
            Assist the Controller in ensuring compliance with Articles 32–36
            (security, breach notification, DPIA).
          </li>
          <li>
            <strong>Notify</strong> the Controller without undue delay (and in any
            event within 72 hours where feasible) of any Personal Data breach
            affecting the Controller&apos;s data.
          </li>
          <li>
            At the end of the agreement, <strong>delete or return</strong> all
            Personal Data to the Controller (see Section 9).
          </li>
          <li>
            Make available to the Controller all information necessary to
            demonstrate compliance with Article 28 obligations and allow for
            reasonable audits.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="6. International transfers">
        <p>
          Several sub-processors are located in or transfer data to the United
          States (see{" "}
          <LegalInlineLink href="/legal/sub-processors">Sub-processors</LegalInlineLink>
          ). Cliste Systems Limited relies on the <strong>EU-U.S. Data Privacy Framework</strong>{" "}
          where the sub-processor is certified, and the EU Commission&apos;s{" "}
          <strong>Standard Contractual Clauses</strong> (Module 3:
          processor-to-processor) elsewhere, supplemented by the technical and
          organisational measures in Annex II.
        </p>
        <p>
          Cliste Systems Limited has completed a <strong>transfer impact assessment</strong> for
          US transfers under Schrems II, documenting supplementary measures
          including TLS in transit, private EU-hosted storage for call recordings
          (30-day retention), transcript redaction, provider zero-data-retention
          options where available, and automated retention deletion via our daily
          data-retention cron.
        </p>
      </LegalSection>

      <LegalSection title="7. Sub-processors">
        <p>
          The current list of sub-processors is published at{" "}
          <LegalInlineLink href="/legal/sub-processors">
            /legal/sub-processors
          </LegalInlineLink>
          . The Controller provides general written authorisation for {CLISTE_COMPANY.legalName} to
          engage these and future sub-processors. Cliste Systems Limited will give at least{" "}
          <strong>30 days&apos; notice</strong> of any new or replaced
          sub-processor by updating that page and notifying the Controller&apos;s
          primary admin user by email. The Controller may object on reasonable
          grounds within that notice period; if {CLISTE_COMPANY.legalName} cannot accommodate the
          objection, the Controller may terminate the agreement.
        </p>
      </LegalSection>

      <LegalSection title="8. Data subject rights">
        <p>
          The Controller&apos;s dashboard provides self-service tools at{" "}
          <LegalInlineLink href="/dashboard/legal/data-requests">
            Data requests
          </LegalInlineLink>{" "}
          for handling Article 15 (access) and Article 17 (erasure) requests. For
          Articles 18, 20, 21 and 22 requests, or where data spans multiple
          controllers, the Controller may request assistance by emailing{" "}
          <a
            href={`mailto:${CLISTE_COMPANY.supportEmail}`}
            className="font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            {CLISTE_COMPANY.supportEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Deletion / return">
        <p>
          Within 30 days of the termination or expiry of the agreement, {CLISTE_COMPANY.legalName}
          will, at the Controller&apos;s choice, delete or return all Personal Data
          processed on its behalf, except where retention is required by Union
          or Member State law. Backups are overwritten within the standard backup
          rotation (35 days at the time of writing).
        </p>
      </LegalSection>

      <LegalSection title="10. Liability">
        <p>Liability is governed by the underlying agreement between the parties.</p>
      </LegalSection>

      <LegalSection title="11. Governing law">
        <p>
          This DPA is governed by the laws of Ireland and the courts of Ireland
          have exclusive jurisdiction.
        </p>
      </LegalSection>

      <LegalSection title="Annex I — Processing details">
        <LegalTable
          headers={["Field", "Value"]}
          rows={[
            ["Controller", "The customer business (account holder of the Hello Cara account)"],
            ["Processor", `${CLISTE_COMPANY.legalName}, Ireland`],
            [
              "Processor contact",
              <>
                <a
                  href={`mailto:${CLISTE_COMPANY.privacyEmail}`}
                  className="font-medium text-emerald-800 underline-offset-2 hover:underline"
                >
                  {CLISTE_COMPANY.privacyEmail}
                </a>
              </>,
            ],
            ["Frequency", "Continuous, for the duration of the subscription"],
            [
              "Storage location",
              "EEA — Supabase AWS eu-west-1 (Ireland); Vercel dub1 (Dublin); LiveKit Cloud EU (Frankfurt); see Annex III",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="Annex II — Technical & organisational measures">
        <LegalList>
          <li>
            <strong>Encryption</strong> — TLS 1.2+ in transit, AES-256 at rest
            (Postgres, object storage).
          </li>
          <li>
            <strong>Access control</strong> — Row-level security on every tenant
            table; service role keys held only on the server.
          </li>
          <li>
            <strong>Logging</strong> — Security audit log for privileged actions
            (admin actions, GDPR exports / erasures).
          </li>
          <li>
            <strong>Network</strong> — Production behind Cloudflare WAF +
            Turnstile bot protection.
          </li>
          <li>
            <strong>Backup</strong> — Supabase managed point-in-time recovery,
            35-day window.
          </li>
          <li>
            <strong>Retention</strong> — Daily cron at{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              /api/cron/data-retention
            </code>
            .
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Annex III — Sub-processors and locations">
        <p>
          The authoritative named list with country, transfer mechanism and
          purpose is in the customer dashboard (
          <LegalInlineLink href="/dashboard/legal/sub-processors">
            Legal &amp; privacy → Sub-processors
          </LegalInlineLink>
          ) and at{" "}
          <LegalInlineLink href="/legal/sub-processors">
            /legal/sub-processors
          </LegalInlineLink>{" "}
          (category summary). Snapshot as of the date this DPA is accepted:
        </p>
        <LegalTable
          headers={["Sub-processor", "Location", "Transfer mechanism"]}
          rows={SUB_PROCESSORS.map((sp) => [
            sp.name,
            sp.location,
            sp.transferMechanism,
          ])}
        />
        <p className="text-[13px] text-slate-600">
          For a countersigned copy before your first paid subscription, email{" "}
          <a
            href={`mailto:${CLISTE_COMPANY.privacyEmail}`}
            className="font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            {CLISTE_COMPANY.privacyEmail}
          </a>
          .
        </p>
      </LegalSection>
    </>
  );
}
