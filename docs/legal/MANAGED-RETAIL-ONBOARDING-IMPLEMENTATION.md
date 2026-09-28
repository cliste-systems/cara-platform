# Managed retail client onboarding

Implemented 28 September 2026. Application changes are local; database migrations below are applied to the connected HelloCara project.

## Customer journey

1. Admin opens **Customers → New client**, enters store details and optionally assigns an available Irish number. Cara remains offline.
2. Admin creates a legal organisation or selects an active invoice organisation from live data. The organisation holds invoice contact, email, address and optional VAT number. Legacy retail setup markers are accepted; real card subscriptions are preserved.
3. Admin supplies the authorised client contact and sends the invitation. Access records are saved before email dispatch. Failed sends retain the store and expose a retry action.
4. New users choose a password. Existing users keep their credentials. Both must complete current agreements before customer data is available.
5. The client reviews Terms, DPA and Privacy notice, confirms authority and gives name/role. The server stores the organisation identity, document versions, timestamp and security context.
6. The group dashboard opens. The same user's acceptance covers stores in that organisation. Going live requires agreement acceptance as well as a phone number.

A billing group is not automatically the legal controller for separately incorporated stores. Check actual controller identity and signatory authority before adding stores to a shared account; the contact has access to every store in that account.

## Enforcement and maintenance

- Password state and managed onboarding are trusted Auth app metadata, not editable user metadata.
- Setup pages use a separate route group; protected dashboard pages/actions use the gated session helper.
- Database restrictions cover 30 customer-data tables, private business/recording files and support mutations. Existing tenant isolation remains in place. Profile access remains available for setup.
- Legal records belong to the parent account. Removing an individual store does not delete its group agreement evidence.
- When changing legal versions, update `src/lib/legal-documents.ts`, published document content/date, and the required versions in `private.managed_client_access_ready()` in a new migration together. Preserve historic document text in version control/release archives.
- Retrying a clicked invitation is supported while password or agreement setup remains incomplete.

Applied migrations:

- `20260928182300_managed_retail_client_onboarding.sql`
- `20260928182908_managed_client_data_gate.sql` — explicitly approved by the user before application.
- `20260928184417_managed_support_rpc_privileges.sql`
- `20260928185016_retain_group_agreements_on_store_removal.sql`

## Verification

- Focused tests cover account boundaries, invitation recovery, existing credentials, trusted metadata, password validation, agreement completeness/versioning, protected API access, support-cookie signatures and go-live requirements.
- Browser verified admin store → organisation → invitation review, live existing organisation options, invitation callback → password → agreements → dashboard, direct URL gating and group store access. Mobile layouts checked at 390px without horizontal overflow.
- Live disposable-account tests verified direct database reads are denied with an incomplete password or missing DPA, support RPCs cannot bypass the gates, current agreements restore access to both stores, and other accounts remain inaccessible.
- Confirmed three versioned agreement records with signatory identity and authority were saved by the real form.
- All clearly marked temporary test organisations, stores and auth users were removed. No real invitation email was sent. Email HTML/text and preparation were tested, including failure behavior; mailbox delivery was not exercised.
- Full project type checking reports existing errors in demo/text rehearsal, call history, Resend webhook typing, training and Supabase edge-function configuration. The changed onboarding files passed targeted lint/type inspection.

The database security advisor still reports pre-existing search-path, extension placement and internal RPC warnings, plus disabled leaked-password detection. Service-only invite/legal tables intentionally have no customer policies. The two modified support RPCs were separately verified to deny anonymous execution. Reference: [Supabase database security lints](https://supabase.com/docs/guides/database/database-linter), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Legal review

The updated documents are implementation-ready wording, not solicitor-approved legal advice. See [research and legal review checklist](MANAGED-RETAIL-ONBOARDING-REVIEW.md) for primary sources and outstanding company, controller, vendor, transfer, retention and commercial facts. The work creates invoice-based onboarding and shared billing details; it does not issue invoices or change existing commercial prices/payment deadlines.
