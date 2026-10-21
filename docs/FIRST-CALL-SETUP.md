# Customer first-call setup

New simple-signup owners complete eight sequential setup sections before entering the dashboard: email → approved business verification → business description → hours → services → greeting → assigned Cara number and first test call → call-forwarding guide. Later sections are disabled until earlier sections are complete. Billing, support and legal pages remain accessible while setup is pending. `?welcome=1` reopens setup for an authenticated customer.

## Progress

Progress combines authenticated email, approved verification, saved configuration and server-owned `completed_sections` receipts. Every configuration section must be reviewed and saved. Editing an earlier section invalidates later receipts before the write. The final test needs a connected real number and an answered non-engineer call longer than 10 seconds, created after the notification-section receipt. Failed/started calls, earlier calls and placeholders do not count. A recorded conversation is evidence of a conversation, not a quality approval. The final dashboard button records `forwarding` and `dashboard` receipts; switching Cara off later does not send a completed customer back through onboarding. Customers review the forwarding guide after the direct test and before opening the dashboard. Guide review does not verify that forwarding has been enabled with their provider.

## Business verification operations

1. Customer submits legal business name, type, registration number (companies), website, Irish address/Eircode and authorised contact. Existing details are prefilled. Submission creates one support ticket per business; revisions append to its history.
2. An admin with Customers and Support access reviews the submission under Customers → business → Phone-number business verification. Complete the appropriate Twilio end-user/bundle submission in Twilio. This application does **not** automatically create regulatory bundles or upload supporting documents. Requirements depend on number/end-user type; request additional evidence securely when needed.
3. To approve in Cara, enter the bundle SID, confirm it covers this business/address/intended number and provide a customer-facing note. The server fetches Twilio and requires `twilio-approved`. A pending/unavailable bundle cannot be approved. Stale reviews are rejected if the customer resubmitted.
4. Confirmed signup billing now automatically reserves a connected Twilio number from existing pool inventory. It never buys a number or allocates a manual placeholder. If inventory is empty, checkout still opens the workspace; the customer can retry availability. Check local prefix/address requirements before activation; reservation does not guarantee regulatory suitability. Approval does not turn Cara on or verify forwarding. New simple-signup accounts are blocked at the database from switching Cara on until a verified bundle is recorded and the assigned pool number matches the business's phone cache. Legacy managed customers retain existing activation behaviour.
5. Help the customer configure Cara, switch the prepared line on for testing, review the first call, then verify forwarding before customers use it. No browser voice simulator was added: the test step uses the actual assigned phone number and the usual plan allowance.

Reference checked 18 October 2026: https://www.twilio.com/en-us/guidelines/ie/regulatory

## Security and review

The progress table has RLS enabled and no anon/authenticated privileges. Owner-checked server actions derive business/user IDs from the session. Only service-role RPCs submit or review verification. Review notes are visible in the customer's support conversation. No ID-document uploads or new public preview bypasses were introduced. The protected admin preview never signs staff in as the customer. Navigation stays within the modal; editable drafts and email-status simulations are local to the tab and never submit customer changes.

## Validation

`npx tsx --test src/lib/first-call-setup*.test.ts src/lib/first-call-section-actions.test.ts src/lib/first-call-config.test.ts src/lib/first-call-review.test.ts`

`scripts/verify-first-call-setup.sql` checks database grants, submission deduplication, revision history, stale reviews and activation gating inside a rolled-back transaction. UI checked at mobile 390×844 and desktop 1280×720; the mobile checklist fits without inner scrolling at that size. Longer detail forms remain scrollable and usable.

## Preview-only test number

The Rooneys setup preview currently has an existing manual development placeholder assigned, marked `[smoke test]` and **not connected**. It is not a purchased/callable Twilio line. The customer UI labels it explicitly, omits calling and does not count it as a completed real-number step. A database trigger blocks switching any clearly marked development placeholder live. No number purchase was performed.

Verification deadlines, automated reservation expiry, subscription cancellation/pause and trial usage caps have **not** been implemented by this change. They require a coherent published policy and billing implementation; existing seven-day trial billing remains unchanged.

## Layout review

Verification uses three short sections (business, address and contact) with a fixed action footer and validation before continuing. The modal frame and header stay fixed across setup screens. Configuration rows fill the panel width. Payment confirmation and setup use the same transparent graphite-grey Cara artwork (`cara-welcome-grey.webp`). The protected admin preview also supports `?screen=confirmation`, whose dashboard button returns to the setup preview without customer authentication or a payment action.

## Irish forwarding guide

The guide appears after the direct first-call test. Customers choose iPhone, Android, landline or hosted/PBX, then an Irish provider; instructions open on a separate view. No command is automatically dialled and no outside carrier account is accessed. Free forwarding help creates a normal customer support ticket only when the customer submits the request; admin-preview requests stay local.

Official sources checked 19 October 2026:
- Apple iPhone: https://support.apple.com/guide/iphone/set-up-call-forwarding-iph7405291c4/ios
- Samsung Galaxy: https://www.samsung.com/uk/support/mobile-devices/how-do-i-use-the-call-functions-on-my-device/
- Vodafone Ireland mobile (conditional/all-call codes and cancellation): https://n.vodafone.ie/support/mobile/calls-texts-and-voicemail.html
- Virgin Media Ireland business phone (all-call forwarding, cancellation and hunt-group restriction): https://www.virginmedia.ie/business/faqs/phone
- Three Ireland: https://www.three.ie/business/support.html
- eir: https://www.eir.ie/helpandsupport/
- Vodafone fixed/hosted support: https://www.vodafone.ie/business/support/broadband

Only Vodafone mobile and Virgin Media business-landline codes are published in-app. No universal codes are assumed for eir, Three, other Android models, broadband phones or PBXs. Provider links and free help cover those cases. The guide states that network forwarding charges can apply and asks the customer to test their existing number after forwarding. In preview, templates contain the non-dialable `YOUR_CARA_NUMBER` token; the unconnected test number is never inserted into forwarding codes.

The Cara artwork uses an inset, `object-contain` image area on both desktop and mobile so the complete hand remains visible. The final test and forwarding screens are distinct from the section overview.

Protected admin review links: `setup-preview?screen=confirmation` and `setup-preview?screen=forwarding`. These visual review paths require Customers permission and do not unlock or submit any customer setup sections.


## Final test and forwarding flow

The final two sections are `test` (Try Cara) and `forwarding` (Set up call forwarding). The test page leads with the assigned Cara number and general topics: opening hours, services, messages and callbacks. It never inserts owner-entered service labels into example questions. The customer makes the call using a phone. This screen has one main action, Continue to call forwarding, and no browser-call, simulated-call or manual status-check controls. The live screen checks for a qualifying call automatically. The protected admin preview can open the forwarding page without recording or pretending that a call occurred.

A qualifying real test call unlocks the forwarding page. That page shows the same assigned number, phone/provider selection, one focused set of instructions, undo guidance, and the final dashboard button. Preview-only numbers cannot be dialled or copied into activation codes. Only reviewed provider/service combinations expose network codes; other combinations use manufacturer/provider guidance.

Opening the dashboard from this final page records `forwarding` and `dashboard` receipts together through the authenticated owner action. This records guide review, not verification that an external provider has enabled forwarding. It does not set `divert_verified_at`. Earlier configuration changes invalidate both final receipts. Previously unlocked accounts retain dashboard access.
