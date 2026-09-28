import {
  LegalList,
  LegalPageHeader,
  LegalSection,
} from "@/components/legal/legal-document";
import { LegalInlineLink } from "@/components/legal/legal-path-context";
import { CLISTE_COMPANY, companyRegistrationLine } from "@/lib/company-details";

export function TermsDocument() {
  return (
    <>
      <LegalPageHeader
        title="Terms of service"
        description={`These terms govern your business use of the Hello Cara platform operated by ${CLISTE_COMPANY.legalName}, registered in Ireland.`}
      />

      <p className="text-[15px] leading-relaxed text-slate-700">
        These Terms are accepted when an authorised representative expressly agrees
        to them for the customer business. Creating a password alone does not
        accept them. Any separately agreed written order or service agreement
        sets out the customer, covered stores and commercial arrangements; its
        specific terms take precedence over these Terms where they conflict.
      </p>

      <LegalSection title="1. The service">
        <p>
          Hello Cara provides a managed AI voice assistant for retail stores,
          together with a dashboard for calls, Action Inbox, contacts, routing and
          agent setup, and optional service notifications. We configure the
          service with you. The stores, features and service arrangements covered
          by your account are those agreed with us in writing.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <LegalList>
          <li>You must provide accurate signup details and keep them current.</li>
          <li>
            You are responsible for activity under your account, including team
            members. Keep credentials confidential.
          </li>
          <li>
            You must be at least 18 and authorised to accept these Terms for the
            named customer business. Tell us if that business or your authority
            changes.
          </li>
          <li>
            A billing organisation may cover several stores. Linking stores for
            invoicing does not by itself authorise access to every store&apos;s
            data or make separate store companies parties to the agreement.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Fees and invoice billing">
        <p>
          Managed retail accounts are billed by invoice to the agreed billing
          organisation or contact. A payment card is not required to activate a
          dashboard account. Fees, any usage charges, taxes, payment due dates,
          renewal and cancellation arrangements are those agreed in writing with
          you. Pay invoices using the instructions provided on them. If an invoice
          is incorrect or disputed, contact us promptly. We may suspend service
          for overdue, undisputed amounts after notice, subject to your agreement.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>You agree not to:</p>
        <LegalList>
          <li>Use the platform for unlawful, deceptive or abusive purposes.</li>
          <li>
            Attempt to break, probe or interfere with security (good-faith
            research is welcome where coordinated with us).
          </li>
          <li>
            Send unsolicited marketing SMS or email through Hello Cara. Transactional
            alerts you configure (e.g. Action Inbox) are permitted; bulk marketing
            is not.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Customer and caller data">
        <p>
          The business deciding how and why caller and contact data is used is
          its data controller. We process that data on its documented instructions
          under the Data Processing Agreement (DPA), which must be in place before
          processing starts. A group paying invoices is not automatically the
          controller for every store. Identify any separate store controllers and
          ensure your representative has authority to act for them. See our{" "}
          <LegalInlineLink href="/legal/privacy">privacy notice</LegalInlineLink>{" "}
          and <LegalInlineLink href="/legal/dpa">DPA</LegalInlineLink>.
        </p>
        <p>
          You must establish the appropriate lawful basis, give callers and staff
          the required privacy information, and only provide data necessary for
          the agreed service. Keep store information and escalation contacts
          accurate. Do not use the service to collect payment-card details or
          unnecessary sensitive information.
        </p>
      </LegalSection>

      <LegalSection title="6. AI voice agent">
        <p>
          The agent answers calls on your behalf and may create action items.
          AI can misunderstand callers or produce inaccurate information. Your
          team must review important requests and follow up appropriately. Do not
          rely on the service for emergencies, medical advice or decisions that
          require human judgment.
        </p>
        <p>
          The service must identify the assistant as AI at the start of the call
          and provide the applicable recording and transcription notice. Do not
          remove or bypass these disclosures. We remain responsible for our own
          legal obligations; your agreement does not replace information that must
          be provided directly to callers.
        </p>
      </LegalSection>

      <LegalSection title="7. Service levels">
        <p>
          Unless expressly agreed in writing, we do not offer a guaranteed
          availability level or response time. The service depends on telephony,
          hosting and other providers, and interruptions may occur. Keep an
          alternative way for customers to contact the store. Any agreed support
          or service-level commitments continue to apply.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property and confidentiality">
        <p>
          Cliste Systems Limited owns platform IP. You own your business data and grant us rights
          needed to operate the service for you.
        </p>
        <p>
          Each party must protect the other&apos;s confidential business
          information and use it only to perform the agreement, sharing it only
          with people who need it for that purpose and are bound to protect it,
          or where disclosure is required by law. The DPA governs personal data.
        </p>
      </LegalSection>

      <LegalSection title="9. Liability">
        <p>
          To the extent permitted by Irish law, Hello Cara’s aggregate liability
          in any 12-month period is capped at fees paid in that period. We exclude
          indirect or consequential loss except where law does not allow exclusion.
          Nothing in these Terms limits liability that cannot lawfully be limited
          or excludes either party&apos;s statutory data-protection obligations.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspension and termination">
        <p>
          We may suspend or terminate for material breach, non-payment, or risk to
          the platform or other customers. On termination we delete or return data
          within 30 days, subject to legal retention.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          Material changes will be notified by email and/or dashboard banner at
          least 30 days in advance where practicable.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law">
        <p>
          Irish law applies. Irish courts have exclusive jurisdiction, save that we
          may seek injunctive relief elsewhere where permitted.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>{companyRegistrationLine()}</p>
        <p>
          <strong>{CLISTE_COMPANY.helloEmail}</strong>
        </p>
      </LegalSection>
    </>
  );
}
