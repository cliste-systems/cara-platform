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
        This DPA forms part of that agreement and covers customer personal data
        processed on the Controller&apos;s instructions. It must be accepted by an
        authorised representative, or otherwise agreed in writing, before that
        processing begins. Our own account administration and billing data are
        covered by the privacy notice.
      </p>

      <p className="text-[15px] leading-relaxed text-slate-700">
        The Controller is the legal business deciding the purposes and means of
        processing for the covered store(s). A billing organisation is not
        automatically the Controller for separate store companies. Where several
        legal businesses are covered, they and the representative&apos;s authority
        to act for each must be identified in the customer agreement or written
        processing instructions.
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
          assistant, Action Inbox, store enquiries, service notifications and the
          operator dashboard — for the duration of the customer agreement, plus
          the applicable retention periods set out in our{" "}
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
              "The Controller's customers, other callers (including suppliers and staff), contacts, and authorised store users where processed on the Controller's behalf",
            ],
            [
              "Personal data categories",
              "Name, phone number, email, store enquiry and action-item details, call metadata, voice call audio (30-day retention), call transcripts (30-day retention), and AI summaries (13-month retention)",
            ],
            [
              "Special category data",
              "Not intended for routine collection. Callers may volunteer sensitive information, including health or absence details. The Controller must identify any necessary processing and applicable Article 9 condition; both parties must minimise unnecessary sensitive data.",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Controller obligations">
        <p>The Controller warrants that:</p>
        <LegalList>
          <li>
            It has a lawful basis under Article 6 GDPR for every category of
            Personal Data shared with {CLISTE_COMPANY.legalName}, assessed for the
            actual purpose. Consent is not assumed merely because a caller
            telephones a store or a representative accepts this DPA.
          </li>
          <li>
            It provides appropriate transparency information to callers, contacts
            and staff under Articles 13 / 14 GDPR, including the purposes of any
            recording or transcription. The Processor remains responsible for
            its own transparency and other legal obligations.
          </li>
          <li>
            It will not instruct unnecessary sensitive-data collection and will
            identify an applicable Article 9 condition where special category
            data must be processed. It will keep instructions, authorised users
            and store access permissions current.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Processor obligations">
        <p>Cliste Systems Limited will:</p>
        <LegalList ordered>
          <li>
            <strong>Process only on documented instructions</strong> from the
            Controller, including for transfers, except where required by EU /
            Member State law. We will inform the Controller of such a legal
            requirement before processing unless the law prohibits doing so,
            and will inform it if an instruction appears to infringe applicable
            data-protection law.
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
            <strong>Notify</strong> the Controller without undue delay after
            becoming aware of a Personal Data breach affecting its data, and
            provide available information and assistance for its response.
            Information may be supplied in stages as it becomes available.
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
          Some service providers process data outside the EEA. The locations and
          processing activities are described in the{" "}
          <LegalInlineLink href="/legal/sub-processors">sub-processor information</LegalInlineLink>
          . A provider&apos;s EU establishment does not by itself mean all of its
          processing stays in the EEA.
        </p>
        <p>
          Transfers must comply with GDPR Chapter V, using an applicable adequacy
          decision or appropriate safeguards such as the European Commission&apos;s
          Standard Contractual Clauses. Reliance on the EU–US Data Privacy
          Framework requires the recipient and relevant processing to be covered
          by a valid certification. Where required, we must assess the transfer
          and implement supplementary measures. Information about applicable
          safeguards and how to obtain a copy is available from our privacy
          contact.
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
          or Member State law. Any data awaiting deletion from backups must
          remain protected and unavailable for ordinary use, and must be deleted
          through the applicable backup lifecycle. We will provide information
          about the applicable backup arrangements on request.
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
            ["Controller", "The legal customer business, or each separately identified store controller, as recorded in the customer agreement or written processing instructions"],
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
            ["Frequency", "As calls and service activity occur, for the duration of the customer agreement"],
            [
              "Storage location",
              "Primary business and caller records use EEA storage; processing by service providers may take place elsewhere. See Annex III and the applicable customer processing instructions.",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="Annex II — Technical & organisational measures">
        <LegalList>
          <li>
            <strong>Encryption</strong> — Encrypted application connections and
            managed encryption at rest for database and recording storage.
          </li>
          <li>
            <strong>Access control</strong> — Authenticated access, store
            permissions and database access policies; privileged credentials are
            restricted to server-side operations.
          </li>
          <li>
            <strong>Logging</strong> — Security audit log for privileged actions
            (admin actions, GDPR exports / erasures).
          </li>
          <li>
            <strong>Application protection</strong> — Request validation,
            authentication controls and rate limiting on sensitive endpoints.
          </li>
          <li>
            <strong>Operational security</strong> — Maintain measures appropriate
            to the processing risks, including availability, recovery and
            incident-response procedures, and review their effectiveness.
          </li>
          <li>
            <strong>Retention</strong> — Scheduled deletion or redaction for
            recordings, transcripts and other covered service data according to
            the privacy notice, together with tools for responding to erasure
            requests.
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
          (category summary). The current named list is shown below; changes are
          subject to Section 7.
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
          For a countersigned copy or to confirm separate store controllers
          before processing begins, email{" "}
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
