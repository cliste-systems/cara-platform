# Vertical packs

A **vertical** is the product-tailoring layer above organization **niches**. Today there are three verticals — `salon_beauty` (tailored), `retail` (stores & supermarkets), and `generic` (neutral fallback). Each vertical is defined by a single **pack object** in [`src/lib/verticals.ts`](../src/lib/verticals.ts).

Retail stores use [`RETAILSTORESETUP.md`](./RETAILSTORESETUP.md) for admin provisioning and dashboard scope.

Adding a new vertical should require **one pack object + config rows**, not new pages or components.

## How to add a vertical

Follow these steps in order:

1. **Add the id** to `VerticalId` in [`src/lib/verticals.ts`](../src/lib/verticals.ts).

2. **Map niche(s)** — add entries to the pack's `niches[]` array and `NICHE_TO_VERTICAL`. If the niche is new, add it to [`src/lib/organization-niche.ts`](../src/lib/organization-niche.ts) first.

3. **Author the pack** — set `capabilities`, `locationNoun`, `nav` (optional diffs), `onboarding`, and `selection` copy on the pack object. Register it in `VERTICAL_PACKS`.

4. **Author dashboard copy** — create `<NAME>_COPY` in [`src/lib/dashboard-vertical-copy.ts`](../src/lib/dashboard-vertical-copy.ts) and register it in `VERTICAL_COPY`. TypeScript `Record<VerticalId, …>` completeness will flag anything missing.

5. **Register onboarding copy** — add entries to train-cara vertical copy registries (`train-cara-vertical-copy.ts`, capture fields, FAQ suggestions, services copy as needed).

6. **Nav diffs** (optional) — use `pack.nav.labelOverrides`, `hiddenHrefs`, or `extraItems`. New hrefs need a destination page and an entry in `NAV_ICONS` in [`dashboard-sidebar.tsx`](../src/app/(dashboard)/dashboard/dashboard-sidebar.tsx) (fallback icon is `LayoutDashboard`).

7. **Add to `VERTICAL_CHOICES`** only when copy is real — no placeholder picker entries.

8. **Run verification** — `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. The guardrail test in [`src/lib/vertical-fork-guardrail.test.ts`](../src/lib/vertical-fork-guardrail.test.ts) must pass.

## Capability flags

Behaviour differences (service catalog, service area, booking routes, go-live checklist) live on `VerticalPack.capabilities`. Shared UI and server actions read flags via `verticalPackForNiche(niche)` — never `=== "salon_beauty"` outside config files.

## Copy registries

String differences (labels, placeholders, hero text, FAQ templates) live in vertical-keyed copy registries (`VERTICAL_COPY`, train-cara copy modules). Content forks stay in registries; do not collapse them to boolean flags.

## Routing overrides

Niche-specific routing examples for generic-vertical orgs merge from `ROUTING_OVERRIDES_BY_NICHE` in `dashboard-vertical-copy.ts` onto the vertical base copy. Salon niches use `SALON_COPY.routing` directly.

## What this does not cover

- **New pages** for a vertical still require real page work.
- **Declarative per-service field controls** (e.g. a patch-test toggle) are a separate follow-up — not part of the pack layer.

## Service-business dashboard V1

Non-retail packs share a seven-item workspace: Overview, Calls, Services, Cara’s knowledge, Your business, Settings & billing, and Help. `navItemsForVertical` keeps retail’s existing navigation and product/department pages. The new Services route redirects retail accounts to Products. Bookings and calendar tooling are outside this workspace’s V1 navigation.

- **Services** owns offered, paused and archived services; fixed/from/range/hourly/daily/free/quote pricing; typical, estimated or ranged durations; caller-facing conditions; and private team notes. Private notes are never included in Cara’s compiled instructions. Unlisted prices are not treated as free. The existing permission to quote prices is retained.
- **Your business** groups profile, areas, opening/holiday/outside hours, greeting/capture preferences and phone connection. It loads the same organization fields saved by signup/setup. Business or hours edits do not overwrite the service catalogue.
- **Cara’s knowledge** groups searchable knowledge, questions awaiting an answer, temporary updates and history, with an FAQ/policy editor. Canonical services, prices and hours remain in their own editors to avoid conflicting answers.
- **Calls** contains the call log and live follow-ups. Follow-ups use `call_logs`, not the retired `action_tickets` ingestion path. Completion and reopening update dedicated timestamps without changing the original analysis. Test and erased calls are excluded. Retail’s existing call/department processing is retained.
- **Settings & billing** groups personal details/notifications, usage, subscription/card/invoice information, team and privacy. Billing changes use the existing owner-protected Stripe portal. Setup assistance is shown separately from the recurring plan.

### Persistence and permissions

The `20261021143742` migration adds service details, carries existing non-retail setup services into the catalogue, and adds atomic publication of the catalogue and compiled prompt. `20261021145614` keeps later setup service-name changes in sync while preserving detailed entries and paused state. `20261021153000` hardens the publication permissions and preserves punctuation in catalogue names. `20261021165000` adds owner-protected follow-up completion. All four retain retail records and tenant isolation.

Service/FAQ publication checks the organization version so a stale tab cannot overwrite newer edits. Business, hours, phone and call-handling changes compile before persisting. Shared controls provide branded validation, unsaved-edit protection and accessible dialogs. Mobile editors use a scrollable body and a persistent action area; page headers/navigation stay outside the scrollable form.

### Verification

The V1 regression suite covers service price/duration validation, private-note exclusion, inactive hours, owner-only follow-up writes, test/erasure exclusions, and retail/general navigation. Manual checks use the explicitly marked synthetic smoke workspace: service save/archive/restore, FAQ publication and conflict handling, follow-up completion/reopening, trial/card/invoice reads, and mobile navigation/editor/error layouts. Real customer calls, billing changes and new phone provisioning are not part of the fixture checks.
