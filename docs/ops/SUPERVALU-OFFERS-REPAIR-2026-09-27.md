# SuperValu offers repair — 27 September 2026

Status: production activated following the user’s explicit “make it live” approval. First three-source publication verified; expansion and exhaustive catalogue refresh are running. See activation evidence below.

## Reproduced failure

A real call asked whether there were meat offers at the meat counter this week. The assistant could not give any. Read-only requests against the documented first-party production endpoint reproduced HTTP 200 with zero matches and no freshness warning for meat offers, the exact counter request, 3 for 10, and Super 7.

The database contained 2,044 weekly offers, all with `is_national=false`. They were written on 25 September by the legacy single-store importer, which deleted the prior national snapshot. National search correctly excluded every replacement row. All 77,512 raw promotions were dated 17–23 September and had expired. The catalogue had 16,790 products, 14,113 classified as national through cross-store observations, last observed 21 September. These counts do not establish completeness of SuperValu's authoritative national product master.

The production Vercel deployment still had the old Thursday 04:00 UTC and Friday 06:00 UTC import jobs. The local configuration had already removed them, but that configuration had not reached production. This discrepancy initially made the missing schedules look like the whole cause. The deployed Friday importer is the immediate destructive conflict.

## Prepared repair

- Voice offer intent accepts broad department questions, generic offers, named campaigns and multibuys. It preserves explicit counter/prepack scope and does not strip a failed bundle query into an unrelated product lookup.
- Backend offer browsing covers all service areas, retains exact promotion constraints and enforces start/end dates in Europe/Dublin. Every promotion requires its own non-future source observation no older than 48 hours; stale or unverified rows cannot be revived by a newer organization sync time. Both voice endpoints, stored promotions, structured RPC results and prompt compilation use this rule. National product search paginates beyond the old result window. The existing admin offers screen visibly warns when current offers are unverified and labels queued refreshes accurately.
- The source crawler reads product state as JSON data, including every promotion, source validity dates and pagination totals. It rejects missing/partial/error pages, resets pagination and retry counters and prioritises the complete promotions listing. Classification uses the true department breadcrumb.
- The legacy single-store national publisher is disabled; manual/cron refresh requests dispatch the durable multi-store crawler.
- The migration schedules a minute-by-minute worker dispatcher. Offers refresh every 15 minutes on Thursday, hourly otherwise. Full catalogue refresh is due at 20:00 Europe/Dublin daily. Work resumes from persisted pages and retries transient failures with bounded attempts. Due offer passes take precedence so repeatedly failing full categories do not starve current promotions. A running full crawl is completed before another crawl starts for that source store.
- Atomic finalization validates complete category coverage and credible product/promotion counts before retiring disappeared rows. Only completed source runs contribute promotion consensus, and a proposed snapshot below 70% of the still-current verified snapshot is held for investigation. A read-only health RPC exposes source completion and stale/failed jobs. Publication retains all mechanics per product, requires at least three agreeing source stores, and excludes future/expired offers. Missing agreed unit prices never become zero or a fabricated price. A bundle total remains a bundle total.
- Named campaigns are only returned when supported by source evidence. Current public featured-offer links include Real Rewards, meat/fish/poultry mix-and-match, household and baby offers; a Super 7 campaign was not identified on the current featured page during this audit. Do not invent current Super 7 membership.

## Validation completed

- Voice: 339 tests pass; production build passes. The direct Rewards lookup independently enforces the 48-hour observation window and current Dublin validity dates.
- Backend: 153 isolated-release search, price, scope, promotion, freshness and sync tests passed. After the final explicit-empty campaign-membership guard, all 72 affected campaign/search tests passed again. Affected-file lint is clean. Mechanic checks include BOGOF, buy/get, mix-and-match and points that must never become euro prices.
- Crawler and sync helpers: 23 tests pass after condition, campaign-membership and unsupported-channel reporting changes; Edge code bundles successfully. Actual public source pages validated, including 100 products on each of the first two promotion pages, 54 fresh-milk products, and 14 parent/leaf category pages across departments.
- Isolated application build on the exact deployed source revision succeeded. This avoids publishing unrelated local dashboard and email work.
- The repository enables `ignoreBuildErrors`; the successful Next.js build is not evidence of a clean whole-project typecheck. Existing unrelated type errors were identified; no new affected application-file errors were reported.

## Coverage still requiring an authoritative source

The public product importer does not certify all national promotion types. Separate coupon/voucher/cart-promotion/bundle-group and points channels exist in source state; empty anonymous samples are not proof that no campaigns exist. App/personalised coupons, basket spend/save offers and competition campaigns are not comprehensively imported by the product crawl. Public leaflet and featured-offer links now discover campaign product listings and import their verified SKU membership. Printed-only offers with no usable public product/listing source remain unverified. Detailed source conditions now reach searchable descriptions where their meaning is known; unknown nonempty channels are flagged, not silently treated as complete.

Official evidence that these are separate channels: [Real Rewards Prices](https://supervalu.ie/rewards/real-rewards-prices) distinguishes product prices from vouchers and personalised coupons. The [September Scan to Win promotion](https://supervalu.ie/rewards/scan-to-win) is a competition with separate eligibility and terms. These marketing sources have not been integrated as a complete recurring promotion feed.

The user confirmed there is no SuperValu/Musgrave feed/export and instructed use of public SuperValu sources. Continue with public product, leaflet and featured-campaign sources; do not keep requesting a private feed. In-store-only and personalised coverage remains explicitly unverified. Production activation was explicitly approved and executed.

## Activation plan after explicit approval

1. Re-read and apply `supabase/migrations/20260927212500_supervalu_durable_refresh.sql` to HelloCara (`rtoebbwzwxcnscsxghww`). The attempted application was rejected before execution. The migration was further hardened after that rejection; always load the current file, not a cached earlier tool result.
2. Deploy `supabase/functions/supervalu-catalog-bootstrap/index.ts`, its `storefront.ts`, its **new `campaigns.ts`**, and existing `deno.json`. Retain the existing custom single-use capability authentication and existing `verify_jwt=false` configuration. Do not deploy the new Edge code before its supporting migration.
3. Configure the scheduler's first-party function URL and source-store set using the existing public storefront source IDs in the category queue. Reconcile historical abandoned running/failed jobs explicitly before starting a new run, without deleting the historical evidence.
4. Trigger an offers-only refresh and verify successful imports from at least three sources; then enable the durable dispatcher for the full existing source set. Observe national publication, coverage and failure status, not just HTTP success. Perform the full catalogue crawl and verify its completion and per-department coverage.
5. The final application release is staged as `dpl_8dRuzEs3WxLxuLAbbY9sZSScXB3s` at `https://cliste-code-base-1-i0us76ikg-clistes-projects.vercel.app`. It contains the final campaign guard and 32 selected files over the exact live baseline. Verify the source checksums before promotion; recopy/rebuild only if those files changed. Earlier staging builds are superseded and must not be promoted. Both voice endpoints now depend on the migration, so live endpoint validation follows the schema/import activation.
6. Verify the staged search endpoint using the existing webhook credential and documented public shop line as a routing identifier; do not use private caller information. Promote the checked application deployment, which removes the competing legacy Vercel schedules.
7. Deploy the voice worker while preserving the solved audio configuration and existing secrets. In particular retain Willow, the verified opening manifest, and the 200 ms prebuffer. Do not load the local `.env` into production.
8. Verify production responses for the exact failed counter question, broad meat, each source department, multibuys, 3 for 10, Rewards, named campaigns, and regular national range items. A missing source campaign must stay a truthful no-confirmed-match, never be filled from another offer.
9. Check scheduler execution and successful subsequent refreshes, then update this report with final counts, source coverage, deployment IDs and any remaining gaps.

## Deployment references

- Backend live revision at start: `35167b5b26ce391b4c20caf0aa75e3aea4c6de75`.
- Backend live deployment at start: `dpl_B2DgKGE8b3ygk9cpbaQpe29sRdBk`, primary domain `https://app.hellocara.ie`.
- Intermediate application build including non-price mechanics: `dpl_B8bdXkoTpn3JaSVZKcChm17P4egV` (Ready; predates final freshness guard and must not be promoted).
- Voice live agent: `CA_B35YRGc9r4Fh`, version at start `c95ezBW323HT`.
- Voice source: `/Users/brendanotoole/cara-voice-platform` (workspace alias `/Users/brendanotoole/cliste-code-base-2`).
- Backend source: `/Users/brendanotoole/cara-platform` (alias `/Users/brendanotoole/cliste-code-base-1`).

A public storefront consensus catalogue provides useful national range evidence, but cannot certify every in-store-only SKU or local unpublished counter promotion. The user explicitly chose public sources. Respect that constraint and report unpublished/personalised coverage honestly; do not replace it with a completeness claim based solely on a large row count.

## Public leaflet verification

The current official public leaflet page is https://supervalu.ie/offers/leaflet/614. Its `var manifest` JSON contains 30 pages and 59 external offer/campaign hotspots. The linked PDF was inspected, including a visual check of page 27. Leaflet-wide validity is 24 September–7 October 2026, but individual panels override this (Housekeepers Cut €11.38/kg is 24–30 September; striploin €22.77/kg begins 1 October). Never apply blanket leaflet dates to individual deals. The current produce campaign is Super Fresh 5, linked to `/super-stars-fruit-veg`, not evidence of a current Super 7 campaign. Other linked campaign pages include `/3-for-10-meats`, `/weekly-meat-offers`, `/fruit-and-veg-3-for-10`, and `/mix-match-meals-2-for-11`. Campaign discovery/membership integration is implemented and tested. The leaflet manifest is parsed as data, not executed. Discovery bounds and unresolved pages are recorded for coverage review.

Public campaign listing verification: the official storefront `settings.env.PUBLIC_API` points to `https://storefrontgateway.supervalu.ie/api`. Unauthenticated listing responses identify current SKU membership and pagination, including five Super Fresh 5 products. These gateway cards expose regular prices and empty promotion lists, even where the leaflet advertises a different Rewards price. They must be used for campaign membership only, joining fresh HTML-derived promotion terms/prices. Never replace verified promotion prices with those gateway values. The HTML CMS widget description can be older than the listing response name; use the current response.

## Final review evidence and pending activation

- Read-only production SQL fixtures passed campaign freshness, completed-run, three-distinct-store, sibling-campaign exclusion, regular-price-only rejection and safe cleanup checks. Search and health SQL syntax/type checks passed using typed placeholders for unapplied schema additions. The migration itself has not run in production.
- Actual campaign importer read-only checks passed 317 unique cupboard members over four pages, 35 meat multibuy members, and the same five Super Fresh 5 SKUs from stores 992, 1720 and 322. Gateway prices are discarded.
- Published campaign membership is separate from promotion prices. Weekly rows and structured search join only fresh, completed, three-store campaign evidence onto existing verified product promotions. Fresh5 eligibility cannot come from another widget sharing the same page URL.
- Health output now includes run and request coverage/discovery reports. Unsupported nonempty public channels and unresolved pages remain visible; `every_offer_type_verified` is not falsely set true.
- Latest read-only Vercel check still shows the original live application deployment and its eight cron definitions. No database migration, new scheduler activation, Edge deployment, voice deployment or primary-domain promotion has occurred.
- Automatic approval review rejected the attempted production migration because it changes persistent schema/publication cleanup and starts a recurring worker. That earlier block was resolved by the user’s subsequent explicit “make it live” instruction.

Prepared migration SHA-256: `d479efb02b11eec75c8e6303d825b4abc2547481b8393a408ba58c751750e031`. Always re-read the current file before applying.


## Production activation evidence (2026-09-27, 22:30 UTC)

- User explicitly approved production activation twice, including “make it live, and do not let it break”.
- Durable refresh migration applied successfully; fixed the PL/pgSQL CASE comparison parentheses before successful application.
- Edge refresh version 11 active with custom one-use capability authentication. Includes strict retired-listing sentinel handling, stable product write order and bounded retries for PostgreSQL deadlocks/serialization failures. Retry regression passes; other error codes are not silently retried.
- Voice worker CA_B35YRGc9r4Fh version ZpUkztgJjSkt running, 1/1 replicas. Willow, 200ms prebuffer and the existing Willow opening asset explicitly preserved. Production organization/routing/prompt smoke check passed without placing a customer call.
- First completed offer crawls: stores 992, 1720 and 322. Published 1,928 national offer rows; 14,193 national catalogue products searchable at the initial health check.
- Refresh enabled across all 27 existing source stores. Every-minute scheduler healthy; offer checks every 15 minutes on Thursday and hourly otherwise, exhaustive crawl due daily at 20:00 Europe/Dublin. Refresh completion takes time after source publication; this is not a guarantee of immediate source completeness.
- Wider rollout health: 24 further offer runs and 3 full runs running; 81 recent invocation responses HTTP 200, no failed category jobs in the recent queue sample. Exhaustive refresh still underway.
- Live authenticated product tool checks returned current meat, 3-for-10, all five Super Fresh 5, fish, deli, bakery, frozen, household and pet offers. Super 7 returned an honest unverified response, not unrelated offers. Ordinary milk queries returned catalogue products.
- Live testing found and corrected fixed-pack counter pricing wrongly spoken per kilo (600g marinated pork is €5 per pack, comparison €8.33/kg). Explicit each units now override counter heuristics; regression passed and live quote verified.
- Cross-department live checks also found bare dairy matching, baby-name contamination and wine-versus-all-alcohol matching; corrections passed search regressions (61 final weekly-offer tests, including dedicated dairy/baby/wine cases) and are live. Wine parent breadcrumb “Wine, Beer & Spirits” is excluded from subtype matching; production now returns wine categories only.
- Original rollback application: dpl_B2DgKGE8b3ygk9cpbaQpe29sRdBk. Original voice rollback: c95ezBW323HT. Application release built from exact previous production base in /private/tmp/cara-offers-deploy-20260927, avoiding unrelated local changes.
- Public-only limitations remain: no proof of the entire national assortment or private/personalised/printed-only offers, no proof of local store assortment or stock. Coverage warnings remain explicit. No live PSTN conversation was placed during verification.

Final application deployment: dpl_DT4XZkdTMCEPwHvpitZecmnjTRt3, promoted successfully to app.hellocara.ie. Final live dairy, baby and wine checks returned 16 correctly scoped results each. Latest refresh health had zero failed recent category jobs. Full refresh remains in progress; no claim of complete public or private national coverage.
