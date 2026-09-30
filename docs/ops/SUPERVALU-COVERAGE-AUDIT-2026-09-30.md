# SuperValu public range and promotions audit — 30 September 2026

Verified snapshot: 2026-09-30T16:59:39.876Z. These are database observations, not SuperValu-certified national totals. Counts change as validated source runs publish.

## Answer

We cannot certify every national product or every national offer from public sources. The user has chosen public sources and has no national feed. Cara has 14,419 products with evidence in at least three public store catalogues and 2,281 date-current, fresh offer rows at this audit. All 18 departments in the official public navigation have products. Deli Counter and Newsagent & Tobacconist have no confirmed current offer rows; that does not establish that no offers exist there. Four configured sources still lacked a completed full crawl at the initial final audit. Two source category pages were still short of their own published totals.

The audit explicitly keeps `authoritative_national_range_complete=false` and `every_offer_type_verified=false`. Product presence is separate from local stock, a confirmed national master, an agreed price, and promotions.

## Department coverage

A product can carry several mechanics. Multibuy/Rewards columns overlap and count product-offer rows, not distinct national campaigns. This table includes counter and packaged products under their actual department breadcrumbs. The full JSON also records counter counts and percentage/half-price rows.

| Public department | Cross-store products | Fresh offers | Multibuy rows | Rewards rows |
|---|---:|---:|---:|---:|
| Fruit & Vegetables | 502 | 48 | 43 | 5 |
| Bakery | 608 | 28 | 13 | 12 |
| Meat & Poultry | 557 | 104 | 51 | 45 |
| Fish & Seafood | 130 | 28 | 16 | 4 |
| Deli Counter | 35 | 0 | 0 | 0 |
| Cheese | 359 | 35 | 0 | 35 |
| Milk, Yogurt, Butter & Eggs | 766 | 119 | 53 | 66 |
| Health & Wellness | 970 | 55 | 10 | 51 |
| Chilled Food | 637 | 155 | 133 | 22 |
| Food Cupboard | 4170 | 739 | 218 | 555 |
| Frozen Foods | 612 | 89 | 23 | 66 |
| Drinks | 760 | 126 | 60 | 88 |
| Beauty & Personal Care | 1126 | 200 | 32 | 168 |
| Baby | 481 | 84 | 42 | 43 |
| Household & Cleaning | 987 | 144 | 22 | 131 |
| Pets | 252 | 54 | 14 | 40 |
| Wine, Beer & Spirits | 1154 | 273 | 0 | 272 |
| Newsagent & Tobacconist | 303 | 0 | 0 | 0 |

Unclassified legacy paths are reported separately rather than counted as a nineteenth department. Counter deli is separate from packaged cooked meats in Chilled Food. Beer, lager, ale, stout, cider, wine, spirits and non-alcoholic products retain their actual category breadcrumbs.

## Public-source research

- [Official aisle navigation and featured campaigns](https://shop.supervalu.ie/sm/pickup/rsid/992/selected-offers) supplies the 18 department names and nested product categories. Navigation is discovered again rather than frozen in a seed list.
- [SuperValu shopping guide](https://shop.supervalu.ie/how-to-shop) identifies All Offers as the public promotion listing. The importer paginates that listing to its source total and retains simultaneous attached product promotions.
- [Current official leaflet](https://supervalu.ie/offers) redirected to https://supervalu.ie/offers/leaflet/614 at inspection. Its 30 pages supplied 60 shop links. A leaflet link or campaign title alone does not prove SKU eligibility, a unit price or dates.
- Public campaign lists observed included meat and fruit/vegetable 3-for-10, mix-and-match meals, fish, beer, wine, spirits, half-price wine, Super Fresh 5, Rewards listings and department-specific featured listings. Both WK39 and WK40 were already exposed on 30 September. Next-week membership must not become current-week campaign evidence.
- [Real Rewards terms](https://supervalu.ie/new-terms) distinguish product prices from app money-off vouchers, spend/save conditions, coupons, promotional rewards and local offers. Anonymous product pages cannot expose a caller's personalised voucher entitlements.

## Offer-type coverage and remaining gaps

| Type | Current handling | Remaining requirement |
|---|---|---|
| Product price cuts, percentage savings, half price | Attached product promotions, selling price, source dates and conditions retained | Source must expose the offer; require cross-store agreement before national quoting |
| Any N for €X, 3 for €10, mix & match, buy/get/free | Preserve bundle label and quantity/total where explicit; do not divide into an invented unit offer price | Explicit qualifying membership and conditions; separate basket-only bundles remain unverified |
| Real Rewards product prices | Preserve loyalty requirement, source price, dates and restrictions | Customer-specific coupons require separate authorised access |
| Named events, Super 7/Super Fresh campaigns, featured departmental campaigns | Import explicit listing membership; quote only supported current product offers | Do not assume a requested campaign is active; upcoming WK lists are excluded from current consensus |
| Counter butcher, deli, fish, bakery | Import public counter products independently from packaged lines | Local or unpublished counter promotions require a shop/national source; zero imported offers is not a negative fact |
| Spend/save, basket vouchers, app coupons, points/token events, partner promotions | Explicit unverified-channel reporting; no invented amounts or personal entitlement | Structured public terms with effective dates, or an authorised programme source |
| Printed/image-only offers absent from product listings | Leaflet discovery evidence retained | Validate exact products, eligibility, price and dates before creating searchable product offers; ambiguous image/link matches cannot be auto-published |
| Products absent from all public online stores | Cannot discover or certify them publicly | Musgrave national assortment master/export or an authorised equivalent |

## Changes deployed during this audit

1. Full crawls now include top-level department pages as well as child categories, closing the root-only product gap. Each discovery records the department manifest.
2. Leaflet discovery accepts letter-suffixed official editions and follows the live official redirect when navigation has no leaflet link.
3. Finalization moved out of the short API request into a bounded database publisher. Busy publishers defer rather than wait for the shared publication lock. The scheduler no longer sends HTTP workers just to finalize already downloaded queues.
4. Publication retains the existing page-total, failed-job, prior-range and cross-store consensus guards. It stores publication outcomes separately from successful downloads.
5. Consensus builds indexed/narrow temporary snapshots, avoids rewriting unchanged national product/promotion rows and materializes campaign evidence once. These changes address measured API and database publication timeouts; cron failures remain visible and are not declared successful.
6. Explicit WK campaign names must match the current Thursday-based offer week. Future/expired product promotions remain excluded by their actual source dates.
7. Added service-only `supervalu_public_department_audit()` and `scripts/audit-supervalu-public-coverage.ts`. The report compares live public navigation with a consistent aggregate database snapshot, counts fresh versus merely date-current offers, separates mechanics, and reports failed imports. It contains no call/customer data.

## Automatic Thursday and daily plan

The existing database dispatcher is enabled and checks work every minute. Offer passes are due every 15 minutes on Thursday in Europe/Dublin and hourly on other days. A full catalogue pass is due daily at 20:00 Dublin. The independent publisher validates ready queues and retries unfinished publication every minute. Vercel's Thursday and Friday refresh requests remain additional entry points; the durable database schedule survives app deployments.

A due time is a polling/dispatch cadence, not a promise that a multi-store import completes instantaneously. Running crawls, source errors, changing source totals and database capacity can delay publication. Continue serving only date-current, sufficiently fresh verified evidence; preserve the prior snapshot on incomplete or implausible replacement data. Never weaken pagination checks to get a green status.

Every new batch should be assessed against: discovered departments; successful pages and expected totals; per-department range/offers/mechanics; full-run completion for each configured source; actual national publication; data freshness; unresolved campaign/leaflet/offer channels; and whether Cara's product search returns the relevant current data. Raw row count alone cannot pass this checklist.

For a certified complete national list, the long-term dependency remains an authoritative assortment and promotion export covering SKUs, categories/counter scope, campaign eligibility, bundle rules, loyalty conditions and validity. Once available, use it as the primary national source and reconcile public catalogues against it. Personalised vouchers remain account-specific rather than universal national offers.

## Verification

124 source, promotion, catalogue-search and schedule regression tests passed. Type checks and changed-file lint passed. Production evidence confirmed recovered full imports and fresh national snapshot publication. The report explicitly retains the source failures and coverage limits; no live telephone call was used as verification.
