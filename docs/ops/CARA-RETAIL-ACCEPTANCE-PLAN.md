# Cara supermarket acceptance programme

## Goal and honest boundary

Every product and every validated offer in an identified national catalogue snapshot must be discoverable through customer questions. Cara must clarify a materially broad request before choosing products, retain scope through its clarification, and give correct prices, units, quantities, dates and Rewards conditions. She must never turn a missing source into a claim that the shop does not sell something, or present national range presence as local stock.

Every possible utterance is unbounded. Complete national assortment is not certified by the public catalogue. Those are explicit coverage limits, not reasons to omit tests for any item we do possess. A green retrieval report is not a green customer call.

## Layers and evidence

| Layer | Coverage | Pass evidence |
|---|---|---|
| Source coverage | All live menu departments, full source totals, failed pages, current leaflet/campaign channels | Complete source manifests, validity and freshness; unresolved source channels remain unverified |
| Exhaustive retrieval | Every observed shared-range SKU; every date-current, fresh, semantically valid offer row | Expected SKU/offer identity survives the real lookup logic among returned matches; save every failed query |
| Customer phrasing | Canonical names, Irish stock questions, prices, looking-for wording, casing/punctuation, compact pack sizes; offer and mechanic wording | Same expected identity; no other product or department substituted |
| Model conversation | Every department: broad question, product preference, counter/prepack choice if material, follow-up price/offer question, new department | Actual assistant replies and tool calls, assertions for each turn; no broad-request random selection |
| Spoken production | GPT-Live, current LiveKit version, synthetic speech, noise, speech overlap, accent/STT errors, interruption, reconnect and hang-up | Call review bundle and recording; both speakers, sequence continuity, expected/persisted counts, capture status, received audio; no reconstruction |
| Ongoing calls | Production post-call analysis against the same rules | Unknown/partial evidence is not passed; tool errors and customer frustration are individually visible |

`scripts/evaluate-supervalu-catalogue.ts` generates six stock/price variants for every product and three offer variants for every valid current offer from one public-only production snapshot. It uses production retrieval functions against an in-memory candidate adapter. It saves snapshot timestamp/hash, every generated case, every failure, and grouped counts. This proves retrieval logic, not SQL/network, realtime-model behavior or audio.

`scripts/evaluate-retail-clarification.ts` in the voice repository tests the actual OpenAI backend model and production instructions for the 18 public departments. It keeps synthetic response/tool evidence in ignored `call-transcripts/`. It is text-only and cannot certify GPT-Live audio.

`scenarios/retail-all-departments.yml` supplies 72 real-worker conversations: three broad phrasings plus a narrow follow-up for each department. The harness now checks per-turn expectations, so a correct last answer cannot hide premature prices in the first reply. A tool invocation alone cannot count as a clarification question.

## Customer and adversarial matrix

For each SKU, expand with validated aliases, brand/own-label names, omitted pack sizes, common misspellings and phonetic/STT substitutions. Do not require a single SKU for an ambiguous shortened name: require one relevant clarifying question or an explicitly requested list of labelled alternatives. Never silently rewrite an uncertain alias to another item.

For every department, test “any offers?”, “anything on special?”, “have ye got…”, “what's the price…”, “I'm after…”, “what would you recommend?”, “just give me a few examples”, broad→specific, counter→prepack→both, correction after a wrong interpretation, and a new unrelated department. Explicit permission to choose examples must not get stuck in repeated clarification.

Cover every observed mechanic: ordinary price reduction, amount/percentage off, half price, N for €X, 3 for €10, mix-and-match, buy/get/free, Rewards product price, Rewards multibuy, named campaign membership, selling by weight and pack totals. Include simultaneous promotions and qualifying-SKU membership. Positive fixtures come from real verified evidence; synthetic absent mechanics test parser behavior without pretending those promotions are live.

Negative/edge fixtures include expired/future dates, Thursday midnight and Dublin DST, stale or future-dated observations, unknown price, null bundle unit price, inconsistent savings, ambiguous category/brand/pack size, no result, partial source import, missing campaign, personalised voucher, out-of-range product, disallowed counter/department, local stock unknown, disconnected/failed tool, slow tool, duplicate tool request, caller correction, scope reset, cheapest pack versus per-kilo comparison, dietary/allergen uncertainty, alcohol/food ingredient collisions, and requests covering several departments.

Test plausible multi-constraint combinations with pairwise coverage plus explicit high-risk combinations. Keep new genuine failures as permanent regressions. Do not claim all mathematical combinations or all future speech are tested.

## Checklist: one failed critical check fails the scenario

1. Intended product or appropriate clarification; exact SKU where caller supplied enough identity.
2. Broad request clarified before product selection; one useful question, then wait.
3. No repeated question for information already supplied.
4. Caller department/counter/prepack scope honoured; no unrequested widening.
5. Follow-up keeps its product and scope; new requests clear previous scope.
6. Actual tool used when factual lookup is needed; no unsupported claim that a check happened.
7. Price, pack size, selling unit and regular/offer distinction correct.
8. Multibuy quantity/total and qualifying membership correct; no invented single-item bargain.
9. Rewards, dates and restrictions retained where material.
10. Missing/stale/private data handled as uncertainty; no invented offer, product absence or local stock guarantee.
11. Natural, concise wording; no internal instructions, repetitive caveats or long category recital.
12. Tool failure/timeout handled without fabricated facts or silence; latency measured separately.
13. For spoken tests: audible complete response, interruption behavior and capture evidence verified.
14. No unconfirmed order/payment/notification action; test calls excluded from customer billing and reporting.

Deterministic fact checks take precedence over an AI judge. A judge can assess relevance, natural clarification and frustration, but must cite the actual reply and tool evidence. Judge uncertainty/disagreement requires review. Missing evidence is UNVERIFIED, not PASS. Release results must show denominators: departments/SKUs/offers tested, failures, untested cases and layers not run.

## Recurring execution and release gate

On each validated catalogue publication, freeze a public-only snapshot and generate cases for all newly added/changed SKUs, offers, mechanics and categories. Run a complete catalogue sweep daily and after Thursday changeover. Run the department/multi-turn suite after prompt, tool, parser or model changes. Perform spoken regression checks after voice/transport changes and on representative Thursday offer examples; retain every new real-call failure.

Do not run tens of thousands of requests against the live voice API. Exhaustive sweeps run offline against the frozen snapshot; a bounded API sample checks actual database transport and deployment. Model and audio runs have explicit concurrency, deadlines, cost and room cleanup limits. Backpressure must protect real customer calls.

The CLI is executable now. A hosted recurring QA job still needs a dedicated least-privilege snapshot reader and report destination; the existing automatic catalogue refresh is separate from this QA schedule. Do not export an account-wide Supabase management token to CI merely to schedule tests. Until that runner is connected, describe recurring QA as pending rather than active.

Do not release a claimed all-clear with known critical failures. Re-run the exact failed snapshot/cases after each fix, then a fresh snapshot, then the relevant live API/model/audio layer. Confidence means a verified answer or a useful clarification with an honest source limit; it does not mean confidently inventing missing facts.

## Measured baseline — 30 September 2026

Frozen public snapshot: 18:03:17 UTC; SHA-256 `10852c6407363f766f4c7d176c07d78742917366c26519f9abc1017adcc753d0`.

The first complete run tested 97,149 queries and failed 845. Replaying all 845 after corrections passed. A stricter first-result sweep exposed 391 cases where different SKUs were indistinguishable from their public product names, including conflicting prices. The safeguard now withholds conflicting prices, rather than selecting one arbitrarily. Final complete sweep: 97,149 tested, zero retrieval/safeguard failures; 14,263 shared-range products; 3,857 valid, fresh, current offer rows across all 18 departments. Eight additional offer rows were rejected by the existing price validator, rather than quoted.

An identical public label is not enough to require one internal SKU to be uniquely first. The stricter criterion requires the first result to have the requested public identity, the expected SKU to remain among matches, and conflicting-price groups to return null prices with an explicit conflict flag. This does not merge SKUs or erase contradictory source observations.

Failures fixed: natural looking-for wording; exact-name ranking; compact sizes; ingredient names misrouted as departments; a named product interpreted as a broad offer sample; percentages within product names mistaken for promotion amounts; loose product names interpreted as counters; Rewards pack counts interpreted as price-only browsing; missing department aliases; and a rehearsal grader accepting a tool call without a spoken clarification.

The actual production OpenAI backend prompt/model passed broad clarification tests for all 18 departments. The expanded 54-phrasing run passed after correcting a grader false negative for the natural question “Which were you after—milk, yogurt, butter or eggs?”. Original model responses and the initial grading result remain preserved; regrading did not regenerate speech. These are backend text rehearsals; the 72 real-worker conversations and spoken GPT-Live/audio matrix remain separate acceptance layers and are not claimed passed by this baseline.

Dashboard: 982 unit tests, typecheck and production build passed. Voice: 381 tests and production build passed. Raw synthetic backend responses remain in the ignored voice `call-transcripts/` directory. Public catalogue evaluation artifacts are saved separately from customer call evidence.

The hosted recurring QA runner and the 72 real-worker/GPT-Live spoken conversation layers are pending; automatic catalogue refresh remains active independently. No customer/PSTN call was made as part of this evaluation.
