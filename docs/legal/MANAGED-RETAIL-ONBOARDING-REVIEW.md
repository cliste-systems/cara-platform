# Managed retail onboarding: legal review brief

Research date: 28 September 2026. Scope: Irish business customers using HelloCara's managed inbound AI telephone service, with stores linked to an invoiced organisation. This is an implementation research brief, not a solicitor's opinion or a certification of compliance. Final commercial terms and the factual processing schedules need review by an Irish solicitor/privacy adviser.

## Recommended acceptance screen

Show the invited email, store name, legal customer name, billing organisation and invoice billing description before acceptance. Use the actual legal entity name, not merely “SuperValu” or a group brand. A group paying the bills is not automatically the controller of each store's caller data; establish the contracting entity and controller(s) separately where ownership structures differ. Controller/processor status depends on actual decisions and activities. [DPC: controller and processor relationships](https://dataprotection.ie/en/organisations/know-your-obligations/controller-and-processor-relationships)

Use distinct, initially unchecked controls:

1. **Terms and authority:** “I am authorised to act for **[legal customer name]** and agree to the **Terms of service** on its behalf.”
2. **DPA:** “On behalf of **[legal customer name]**, I accept the **Data Processing Agreement** for the store(s) covered by this account.” Name any distinct store controllers in the applicable agreement before using a group signatory.
3. **Privacy acknowledgment:** “I acknowledge the **Privacy notice** explaining how HelloCara handles account and service data.” This is acknowledgment that information has been provided; it is not consent to all processing or a waiver of rights. A separate acknowledgment is a product evidence choice, not itself a GDPR requirement. Consent is one of several lawful bases and is not universally necessary. [DPC: lawful processing](https://www.dataprotection.ie/en/organisations/know-your-obligations/lawful-processing), [DPC: is consent required?](https://www.dataprotection.ie/en/faqs/general/my-consent-required-my-data-be-processed)

Keep the document links accessible before acceptance, show document versions, and offer a clear support route if the recipient cannot sign for the business. Button: **Agree and open dashboard**. Password creation should not silently count as agreement. An electronic offer/acceptance can form a contract, but proof of who accepted what remains useful; a checkbox does not determine enforceability of every clause. [Electronic Commerce Act 2000, section 19](https://www.irishstatutebook.ie/eli/2000/act/27/section/19/enacted/en/html)

Do not add a mandatory marketing opt-in. The invitation/password emails should remain account-service messages. If marketing is added later, assess ePrivacy separately and provide an independent, optional consent/objection mechanism as appropriate. [DPC: electronic marketing consent](https://dataprotection.ie/en/faqs/direct-marketing/consent-explicitly-required-all-cases-electronic-direct-marketing)

## Agreement content

The Terms should describe the actual managed service, customer responsibilities, authorised users, permitted use, confidentiality, intellectual property, suspension/termination, service limitations, agreed fees, dispute handling and governing law. This is recommended contract coverage rather than a statutory checklist of required checkboxes. A signed order/proposal should identify stores, fees, usage charges, VAT treatment, invoice recipient, payment terms, contract duration and cancellation arrangements. Do not invent a payment period or claim cancellation is available in a Stripe portal if the customer uses an invoiced managed agreement.

Include clear AI limitations: outputs may be inaccurate; staff remain responsible for checking and following up on important requests; the service is not an emergency line. Store staff should approve the operating information and escalation contacts supplied to the agent. Avoid promising that a disclaimer eliminates liability. Solicitor review is particularly important for liability caps/exclusions, indemnities, service commitments, termination and group authority.

The Article 28 DPA must be binding **before caller/contact processing starts**, independently of when the dashboard opens. It needs specific processing scope, duration, purpose, data types and subjects, documented instructions, confidentiality, security, subprocessors/objections, assistance with rights and breaches, deletion/return and audit provisions. It must identify actual controllers, not assume the billing group has that role. A dashboard gate alone does not stop an already-live phone number processing callers. [DPC: mandatory processor contract provisions](https://dataprotection.ie/en/faqs/responsibilities-data-controllers/what-should-be-contained-contract-between-data-controller-and-data-processor)

## Caller notices and operational duties

Tell callers clearly at the start that they are speaking with an AI assistant. The Commission's current guidance says Article 50 applies from **2 August 2026** and notification is due at the start of the first interaction. This is an operational duty; making the store owner tick a box does not fulfil it for callers. The Article 50(1) obligation is framed for providers and cannot simply be reassigned to customers in a DPA. The separate synthetic-content marking requirements need assessment by the service provider as applicable. [European Commission: Article 50 guidance FAQ, updated 24 July 2026](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)

Provide timely information about transcription/recording, purposes, lawful basis, retention, recipients/transfers and rights. Recording needs an assessed lawful basis and proportionate retention; neither store acceptance nor “by continuing you consent” is a universal solution. A layered spoken notice can point to accessible full information. [DPC: transparency](https://dataprotection.ie/en/organisations/know-your-obligations/transparency)

Review the retail processing risks, including volunteered health/allergy information, staff absence/HR content, delivery requests and callers who may be vulnerable. Do not ask the customer to certify a DPIA is always unnecessary. Evaluate whether a DPIA is required for the actual deployment and scale. [DPC: AI and data protection](https://dataprotection.ie/en/dpc-guidance/blogs/AI-LLMs-and-Data-Protection), [DPC: DPIAs](https://www.dataprotection.ie/en/organisations/know-your-obligations/data-protection-impact-assessments)

## Evidence and access controls

Recommended product evidence: authenticated user ID/email, legal customer ID/name at acceptance, applicable store/controller scope, authority confirmation, exact document versions (with preserved text), server timestamp and proportionate security metadata. Record privacy acknowledgment distinctly in presentation even if the legacy table calls all records “acceptances”. Preserve historic document content when bumping versions. Consider an acceptance receipt/download after saving. These are evidence and product recommendations; the cited laws do not prescribe this exact database schema.

Enforce password completion and legal requirements on the server for protected pages, data APIs and actions; allow legal documents, support and sign-out. An administrator assigning a store to a billing group must not automatically expose unrelated stores' caller data to that group's users. Any shared access requires the correct membership/permissions and controller authority.

## Existing repository facts requiring review

Baseline findings before the accompanying document edits; these are not independently verified operational claims:

- `src/lib/company-details.ts` names **Cliste Systems Limited**. Its CRO number is optional configuration; its fallback registered office is only “Dublin, Ireland”. Confirm the actual registered details before relying on the published company line.
- Existing Terms say account creation is agreement and assume Stripe subscription/portal cancellation. Align these with explicit acceptance and managed invoice arrangements.
- Existing DPA/privacy content promises 30-day recordings/transcripts, 13-month summaries, particular EU regions, redaction, transfer mechanisms and some provider zero-retention options. The DPA states a transfer impact assessment has been completed and gives a 35-day backup rotation. Verify each promise against contracts and current operations; do not copy them into new customer-specific promises without evidence.
- `src/lib/sub-processors.data.ts` contains two LiveKit entries with different routing descriptions. Reconcile the actual use, locations, agreements and any underlying model providers. Customer-facing schedules must reflect reality.
- `docs/legal/DPIA.md` still describes salons and appointments, contains unverified checklist items, and uses a rough 50-salon review trigger. Adapt the factual assessment to retail; a store count alone is not the legal test for large-scale processing.
- Existing acceptance rows have user, organisation, type, version, timestamp, hashed IP and user agent, but no preserved organisation-name/scope or signatory-authority snapshot. Existing `orgNeedsDpaAcceptance` depends on active/subscription/onboarding-step state; ensure managed customer processing cannot start before a binding DPA.
- Current liability exclusions, data deletion timelines and breach wording should be checked by the solicitor. The DPA's reference to 72 hours must not obscure the processor's duty to inform the controller without undue delay.

This brief supports implementing the flow immediately. It does not state that the existing or revised legal documents have been approved by a solicitor.


## Changes made alongside this review

The Terms, DPA and privacy notice now describe managed retail accounts, invoice billing without card entry for activation, explicit authorised acceptance, and the distinction between a billing group and separate legal controllers. They explain caller AI disclosure and human review, keep privacy acknowledgment separate from consent, and avoid treating the account holder's agreement as caller consent.

The DPA no longer claims an already-completed transfer impact assessment, a 35-day backup/PITR configuration, Cloudflare coverage for all production traffic, or that the live subprocessor list is an immutable acceptance-date snapshot. It now states transfer obligations without purporting to verify signed safeguards, and requires processor breach notification without undue delay. The privacy contact wording uses the GDPR's usual one-month period rather than an imprecise 30-day period. [DPC: international transfer safeguards](https://www.dataprotection.ie/en/organisations/international-transfers/transfers-personal-data-third-countries-or-international-organisations), [DPC: rights-request timelines](https://www.dataprotection.ie/en/individuals/exercising-your-rights/how-long-will-it-take)

The existing 30-day recording/transcript, 13-month caller-summary/action-item, and 24-month audit/contact schedules have corresponding deletion or redaction steps in `src/app/api/cron/data-retention/route.ts`. This confirms code exists, not that every scheduled production run succeeds. The published schedules and EEA primary-storage description still require operational verification. No customer payment period, VAT amount, SLA, new company identity or specific provider contract was invented.

Items still requiring evidence and professional review are the actual company registration/address, group/store controller identities and signatory authority, current vendor locations and signed safeguards, backup lifecycle and recovery configuration, operation of retention/deletion jobs, liability and commercial clauses, and a retail-specific DPIA/ROPA. The generic security annex should be supplemented with any customer-specific agreed measures once verified. Updating legal wording does not itself complete these operational controls.

Validation of the edited components: targeted ESLint and `git diff --check` passed. Framework guidance and the React checklist were reviewed; these edits only alter rendered document content and introduce no new hooks, actions or data access.
