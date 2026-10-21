# Self-service business classification

`src/lib/business-classification.ts` is the versioned industry → speciality catalogue. It excludes retail and e-commerce; retail remains team-provisioned. A selection records `{version, categoryId, specialtyIds}` in `organizations.business_classification`. The first speciality remains the legacy vertical-mapping anchor; the picker does not label a customer choice as Primary. The server validates membership, version, uniqueness and the eight-speciality limit. The migration is nullable and does not backfill or reclassify existing customers.

Classification is distinct from vertical capabilities. The catalogue maps to existing `OrganizationNiche` values and vertical packs; adding a catalogue entry does not add integrations, booking behaviour, certifications or verified services. Labels are presentation, stable IDs are storage. Do not rename IDs without a data migration and backwards-compatible parser.

First-call setup and the owner-controlled dashboard business profile share the picker. Classification changes preserve existing services and exclusions. Dashboard edits rebuild the prompt and restore the previous classification on compilation failure, using optimistic timestamps. Retail writes are rejected server-side, and retail prompt construction ignores this classification field.

Services are suggested, never enabled from a classification alone. Clicking a suggestion explicitly adds its label to the existing confirmed services field; custom services remain possible. Exact offered/excluded conflicts are rejected. The optional business-notes field is not shown in first-call setup. First-call readiness is based on a saved profile receipt and business type, not a mandatory prose description.

The live prompt and dashboard prompt preview both receive trusted scope guidance derived from validated catalogue IDs. Clearly unrelated work can be declined unless explicitly offered. Plausible unconfirmed work remains unknown, routed only through configured enquiry actions. Explicit service exclusions take precedence. The classification must not imply price, availability, regulated credentials, emergency cover or booking capability.

When adding categories or specialities, update catalogue data and relevant service suggestions, then run classification, first-call action, prompt compilation and vertical guardrail tests. Keep retail exclusion and legacy prompt behaviour covered.

## Launch admission and service starters (20 October 2026)

Historical `BUSINESS_CATEGORIES` retains 111 IDs for stored records. The shared picker uses `SETUP_BUSINESS_CATEGORIES`: 92 entries across 16 categories, comprising 91 supported starter recipes and Other/manual review. Nineteen medical, care, professional-advice and other excluded specialities are withheld from self-service admission. First-call and dashboard classification actions enforce the boundary, and the authenticated database update trigger rejects excluded, unknown and mismatched IDs. Existing historical classifications are not deleted or deactivated.

`business-service-catalogue.data.ts` supplies shared draft recipes. Thirty have direct cores and 61 require explicit activity profiles. The services step offers recommended suggestions or a separate fresh draft. Confirmed services, custom additions, exclusions and explicit removals are preserved. Suggestions cannot activate a phone line or grant a professional capability. Other and explicit out-of-scope services use setup help for review.

`organizations.service_starter_state` stores mode, profile choices and removals. Only `agent_services_departments` and `agent_services_not_offered` supply confirmed services to Cara. The customer save action rejects stale configuration versions and restores both service fields and metadata if prompt compilation fails.

See `docs/SERVICE-STARTER-VERIFICATION.md` for executed checks and their limits.
