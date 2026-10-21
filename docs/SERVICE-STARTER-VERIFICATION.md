# HelloCara service starters — implementation and verification

Checked 20 October 2026. Application: `/Users/brendanotoole/cara-platform`.

## Delivered behaviour

- All 111 historical speciality IDs are accounted for: 91 supported starter recipes, one Other/manual-review entry, and 19 excluded entries. The setup picker contains 92 entries across 16 categories. Historical classifications remain readable; existing customer records have not been reclassified or deleted.
- 30 recipes have a direct core. 61 ask for relevant service types before generating a draft. Sales-only dealerships receive vehicle sales, while workshop services are added only after an explicit workshop choice. Multiple specialities and profile choices combine and deduplicate their services.
- Use suggested services is recommended on a first visit. Start fresh has its own draft. Switching modes preserves both lists and unfinished custom text. Existing saved services reopen unchanged.
- Suggestions remain editable drafts until Save & continue succeeds. Removing a suggestion does not create an exclusion. Explicit removals survive navigation, profile changes and speciality changes. Undo, custom edits, pasted lists and optional suggestions are supported.
- Exclusions start empty. Cross-list conflicts, unsupported scope, invalid metadata, missing required profile choices, instruction-like entries, spelling reviews and list limits are checked before saving.
- Each list retains the existing limit of 40 services, 2,000 characters total and 160 characters per entry. Oversized combinations receive a clear error instead of being silently truncated.
- Mobile and desktop now share one centred service editor. Suggested services / Start fresh is a separate starting decision, and required service-type questions appear before the editor. One bounded scrollable list replaces the tabs, paging arrows and button bar. Additions remain in the list; optional suggestions and list settings are under Options, and exclusions open only when needed. Save stays visible at 360 × 800, 390 × 844 and 1280 × 720. Internal Back actions use the existing bottom navigation.
- The customer save action persists the selected services and starter metadata, detects stale settings, preserves the prior service backup, recompiles Cara's instructions and records section completion. Failed compilation restores prior services and starter metadata. Only confirmed offered/excluded fields enter the voice prompt; unused suggestions and recipe metadata do not.

## Executed checks

| Check | Result |
| --- | --- |
| Complete app regression suite | **1,309 passed; 0 failed; 0 skipped** |
| TypeScript | `npx tsc --noEmit` passed |
| Production build | `npm run build` passed |
| Lint on implementation files | Passed |
| Repository-wide lint | 53 errors and 83 warnings in files outside this implementation; not represented as a clean repository-wide check |
| Catalogue coverage | Exact accounting for all 111 IDs; no missing/duplicate ID |
| Catalogue validation | All 957 label occurrences / 742 unique labels pass actual service/scope/spelling validation |
| Recipe validation | Every supported recipe, with its profile choices combined, produces a saveable service draft |
| Mixed specialities | All same-category pairs merge/deduplicate; over-limit combinations are rejected |
| Saved state | Separate mode banks, pending text, removals, profile changes, changed specialities, malformed cache/metadata, stale saves and compilation rollback tested |
| Prompt boundary | Confirmed services included; removed/unused suggestions and starter metadata excluded |
| Database permissions | Real authenticated owner role successfully updated and reread starter metadata |
| Database eligibility | All 19 excluded IDs and Other/manual-review admission rejected under authenticated owner permissions |
| Database malformed metadata | Rejected by constraints |
| Database test cleanup | All test updates rolled back |
| Browser | Checked in the existing localhost admin preview at **360 × 800**, **390 × 844** and **1280 × 720** |
| Browser errors | No error/warning entries returned by the browser log check |

Browser checks exercised salon defaults, removal without exclusion, undo, separate fresh/suggested drafts, custom additions, conflicting exclusions, suggestion conflicts, multi-line paste, last-page reveal, dealership sales/workshop choices, the optional exclusion editor, save/reopen, separate starting/profile screens, bottom Back navigation, and validation feedback reopening the exclusion editor when necessary. The later UI revision was also checked with six-plus services inside a 176px list: only the list scrolls, while the page and Save remain in view. Opening hours, greeting, the test-call screen, forwarding choices and help were also inspected for adjacent-flow regressions. The original hours presentation was retained.

## Database changes

Two additive migrations were applied to the connected HelloCara project:

- `supabase/migrations/20261020021853_service_starter_state.sql`
- `supabase/migrations/20261020022354_service_starter_required_fields.sql`

They add bounded starter metadata and an authenticated classification-admission trigger. The historical parser keeps excluded IDs readable. Other requires team review. Existing customer records, activation and phone-number status are not changed by these migrations.

## Evidence and practical limits

- [Simplified mobile service editor](/Users/brendanotoole/Documents/Codex/2026-10-02/re/outputs/setup-layout/services-simple-mobile.png)
- [Simplified desktop service editor](/Users/brendanotoole/Documents/Codex/2026-10-02/re/outputs/setup-layout/services-simple-desktop.png)
- [Separate starting-list choice](/Users/brendanotoole/Documents/Codex/2026-10-02/re/outputs/setup-layout/services-simple-choice-mobile.png)

UI interaction used the admin preview, whose saves are local preview changes. Server-action regressions exercise the real action code in isolated fixtures; database checks separately use actual authenticated customer permissions and roll back their writes. This is not a claim that a live customer onboarding or phone call was performed. No live call, identity submission, paid transaction or production deployment was performed.

The supported-scope check is an onboarding boundary, not a legal classification service. Explicit excluded activities are rejected, and unlisted/ambiguous business types use team review. Existing regulated customers are not automatically deactivated. Testing used the local in-app browser rather than a physical-device or multi-browser lab.
