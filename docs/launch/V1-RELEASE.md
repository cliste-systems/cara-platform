# HelloCara V1 release verification

The service dashboard launch requires the migrations and both application releases below. Local tests do not certify live infrastructure.

## Deployment order

1. Restore the configured Supabase project and verify it is the intended release environment.
2. Apply `20261104000000_protect_erased_call_content.sql` and `20261104000001_knowledge_delivery_retries.sql`. They add erasure guards, recording cleanup and knowledge notification retries. Apply these before deploying the dashboard or voice worker.
3. Deploy the dashboard and the adjacent `cara-voice-platform` worker together. The worker now persists pending knowledge gaps before webhook delivery.
4. Confirm the existing owner-call-alert scheduler calls `/api/cron/owner-call-alerts` every minute using its Vault-held secret. This endpoint now also processes recording cleanup, knowledge gaps and notifications. The analysis and retention schedulers must also execute successfully.
5. Confirm `NEXT_PUBLIC_SUPABASE_URL` points to the same project in the release build. CSP permits recording playback from that precise origin.

## Automated verification

Run `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build` in the dashboard repository. Run the voice worker's test, typecheck and build scripts too. The migration regression test uses embedded Postgres and exercises actual trigger/queue SQL; it does not replace a deployed migration check.

The repository currently has unrelated lint errors in admin, retail, older onboarding components and other existing files. Do not disable rules to label the release clean. Review those errors before release approval.

## Pilot acceptance

Use two separate real pilot businesses and test both desktop and mobile.

- Fresh signup, payment confirmation, business details, services, opening hours and phone forwarding can be completed without developer assistance.
- A real forwarded call reaches the correct business. Caller disclosure, greeting, services/prices, closed-hours behaviour and unknown-question handling match the configured information.
- An answered call, callback and unanswered knowledge question each appear once. Summary, transcript, duration and recording match the actual call. Open transcripts refresh after processing finishes.
- Search, date/outcome filters and pagination agree with counts. Recordings play and export in the production browser; transcripts scroll and copy completely.
- Complete a follow-up with a name, refresh, and reopen it. History reflects outstanding service callbacks. Completing a knowledge follow-up does not imply its answer was published.
- Publish an answer in Cara's knowledge and make another call to prove it is used.
- Notifications reach the configured recipient. Known failures retry; ambiguous provider sends are held for review rather than duplicated.
- Failed payment customers can open billing, support and legal routes; checkout failures never display success. Usage includes more than one API page of records.
- A new team member accepts their invitation with the right permissions. Revoked members lose access. Read-only users cannot make restricted changes.
- Direct identifiers cannot access the other business's calls, recordings, knowledge or settings.
- Block a caller and verify a subsequent real call. Erase a caller while post-processing is pending; wait for processing and cleanup, then verify content cannot return. Inspect linked knowledge context and recording storage, not only the screen.
- Confirm recording/transcript access expires server-side at 30 days. Run retention and verify successful deletion, including review-only transcripts.

## Operational ownership

Assign a person to monitor support, failed payments and processing/notification failures. Monitor pending knowledge gaps with five attempts, failed/unknown knowledge notifications and the age of `call_recording_cleanup` rows. An unknown send requires checking the provider before any manual resend. Do not put caller content or credentials into incident messages.

Configure business-specific services, service areas, hours/holidays, exclusions and escalation language. Keep plan entitlements, notification preferences, recording notices and privacy retention text aligned with actual behaviour. V1 promises approved answers, enquiry/callback capture and owner notification; unsupported booking or transfer promises must be omitted.

## Current infrastructure limitation

On 4 November 2026 the configured project was INACTIVE. Applying the erasure migration timed out while initialising migration history. Neither new migration is confirmed installed remotely. Do not claim the live system is fixed until the database is accessible, the changes are deployed and the acceptance checks pass.
