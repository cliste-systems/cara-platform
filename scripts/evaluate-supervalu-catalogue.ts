/** Public catalogue-only exhaustive retrieval evaluation. No calls or customer data. */
import { config } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { searchNationalRetailCatalog } from "../src/lib/retail-catalog-search";
import { searchSyncedWeeklyOffersInRows, filterRetailWeeklyOffersToActiveWeek } from "../src/lib/retail-weekly-offers-search";
import { productEvaluationCases, offerEvaluationCases, type RetailEvaluationProduct, type RetailEvaluationCase } from "../src/lib/retail-catalog-evaluation";
import type { RetailWeeklyOfferRow } from "../src/lib/supervalu-offers-types";
config({ path: ".env.local", quiet: true });
type Snapshot = { checked_at: string; products: RetailEvaluationProduct[]; offers: RetailWeeklyOfferRow[] };
const argument = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const output = resolve(argument("--output") ?? ".tmp/retail-evaluation");
async function snapshot(): Promise<Snapshot> {
  const file = argument("--snapshot");
  if (file) return JSON.parse(await readFile(file, "utf8"));
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !url) throw Error("Missing private database audit configuration");
  const project = new URL(url).hostname.split(".")[0];
  const query = `select jsonb_build_object('checked_at',now(),'products',
    (select coalesce(jsonb_agg(p order by p.sku),'[]'::jsonb) from
      (select id,sku,product_name,brand,department,category_breadcrumb,service_area,fulfilment,is_alcohol,search_text,national_store_count,national_regular_price_eur
       from public.retail_catalog_products where retail_banner='supervalu' and is_national and national_store_count>=3) p),
    'offers',(select coalesce(jsonb_agg(o order by o.id),'[]'::jsonb) from
      (select id, null::uuid organization_id,retail_banner,sync_batch_id,product_name,department,offer_channel,service_area,fulfilment,
      current_price_eur,was_price_eur,discount_label,price_per_unit,category_breadcrumb,campaign_names,sell_by,price_unit_type,is_alcohol,brand,sku,
      offer_week_start,offer_week_end,source_url,search_text,synced_at
      from public.retail_weekly_offers where retail_banner='supervalu' and organization_id is null and is_national and national_store_count>=3
        and offer_week_start<=(now() at time zone 'Europe/Dublin')::date and offer_week_end>=(now() at time zone 'Europe/Dublin')::date
        and synced_at between now()-interval '48 hours' and now()) o)) snapshot`;
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw Error(`Snapshot HTTP ${response.status}`);
  return (await response.json())[0].snapshot;
}
/** Replays the real candidate/filter/pagination contract in memory; SQL/network not tested. */
function catalogueAdapter(products: RetailEvaluationProduct[]) {
  const candidateCache = new Map<string, RetailEvaluationProduct[]>();
  return { from() {
    let needle = ""; const filters: Array<(p: RetailEvaluationProduct) => boolean> = [];
    return {
      select() { return this; }, order() { return this; },
      eq(column: string, value: unknown) {
        if (["fulfilment", "service_area"].includes(column)) filters.push(p => p[column as "fulfilment" | "service_area"] === value);
        return this;
      },
      gte() { return this; },
      ilike(_column: string, pattern: string) { needle = pattern.slice(1, -1).toLowerCase(); return this; },
      async range(from: number, to: number) {
        let rows = candidateCache.get(needle);
        if (!rows) { rows = products.filter(p => p.search_text.toLowerCase().includes(needle)); candidateCache.set(needle, rows); }
        return { data: rows.filter(p => filters.every(filter => filter(p))).slice(from, to + 1), error: null };
      },
    };
  } };
}
async function main() {
  await mkdir(output, { recursive: true });
  const data = await snapshot();
  if (!data.products?.length || !data.offers?.length || !data.checked_at) throw Error("Empty/incomplete snapshot; cannot pass");
  await writeFile(join(output, "snapshot.json"), JSON.stringify(data));
  const reference = new Date(data.checked_at);
  const offers = filterRetailWeeklyOffersToActiveWeek(data.offers, reference);
  const adapter = catalogueAdapter(data.products);
  const failures: Array<RetailEvaluationCase & { reason: string; returnedIds: string[] }> = [];
  const totals: Record<string, { tested: number; passed: number; failed: number }> = {};
  const cases: RetailEvaluationCase[] = [];
  let tested = 0;
  const productBySku = new Map(data.products.map(product=>[product.sku,product]));
  const identity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  let indistinguishableCases = 0;
  function record(test: RetailEvaluationCase, returnedIds: string[], group: string, productMatches?: {sku: string|null; productName: string; currentPriceEur: number|null; priceConflict?: boolean}[]) {
    const counts = totals[group] ??= { tested: 0, passed: 0, failed: 0 };
    counts.tested++; tested++;
    let passed = returnedIds.includes(test.expectedId);
    if (test.kind === "product") {
      const expected = productBySku.get(test.expectedId)!;
      const first = productBySku.get(returnedIds[0]);
      if (first && returnedIds[0] !== test.expectedId && identity(first.product_name) === identity(expected.product_name)) indistinguishableCases++;
      passed = passed && Boolean(first && identity(first.product_name) === identity(expected.product_name));
      const equivalent = productMatches?.filter(match=>identity(match.productName)===identity(expected.product_name)) ?? [];
      const evidencePrices = new Set(equivalent.map(match=>productBySku.get(match.sku??"")?.national_regular_price_eur));
      if (evidencePrices.size > 1) passed = passed && equivalent.every(match=>match.currentPriceEur===null && match.priceConflict===true);
    }
    if (passed) counts.passed++;
    else { counts.failed++; failures.push({ ...test, returnedIds, reason: test.query.length>120 ? "query_over_voice_limit" : test.kind === "product" ? "expected_product_not_ranked_first" : "expected_offer_not_in_returned_matches" }); }
    if (tested % 5000 === 0) console.log(JSON.stringify({ progress: tested, failures: failures.length }));
  }
  const limit = Number(argument("--limit") ?? Infinity);
  const replayFile = argument("--cases");
  const replayCases: RetailEvaluationCase[] | null = replayFile ? JSON.parse(await readFile(replayFile,"utf8")) : null;
  if (replayCases && !replayCases.length) throw Error("Empty replay cannot pass");
  const replayIds = replayCases ? new Set(replayCases.map(test=>test.id)) : null;
  for (const product of data.products.slice(0, limit)) {
    for (const test of productEvaluationCases(product)) {
      if (replayIds && !replayIds.has(test.id)) continue;
      cases.push(test);
      const matches = test.query.length > 120 ? [] : await searchNationalRetailCatalog(adapter as never, { retailBanner: "supervalu", query: test.query, intent: test.intent, limit: 5 });
      record(test, matches.map(m => m.sku ?? ""), `product:${product.department}:${test.variant}`, matches);
    }
  }
  for (const offer of offers.slice(0, limit)) {
    for (const test of offerEvaluationCases(offer)) {
      if (replayIds && !replayIds.has(test.id)) continue;
      cases.push(test);
      const matches = test.query.length > 120 ? [] : searchSyncedWeeklyOffersInRows(offers, test.query, { reference, limit: 5 });
      record(test, matches.map(m => m.id), `offer:${offer.department}:${test.variant}`);
    }
  }
  if (replayIds && tested !== replayIds.size) throw Error(`Replay coverage mismatch: ${tested} of ${replayIds.size}`);
  const departments: Record<string, {products: number; validOffers: number}> = {};
  for (const product of data.products) {
    const root = product.category_breadcrumb?.split("/")[1] || "Unclassified";
    (departments[root] ??= {products:0,validOffers:0}).products++;
  }
  for (const offer of offers) {
    const root = offer.category_breadcrumb?.split("/")[1] || "Unclassified";
    (departments[root] ??= {products:0,validOffers:0}).validOffers++;
  }
  const report = {
    checked_at: new Date().toISOString(), snapshot_at: data.checked_at,
    snapshot_sha256: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
    status: failures.length ? "FAIL" : "PASS_RETRIEVAL_ONLY",
    exhaustive_snapshot: !Number.isFinite(limit) && !replayIds, products: data.products.length, current_valid_offers: offers.length,
    excluded_offer_rows: data.offers.length-offers.length, tested, failed: failures.length, indistinguishable_cases: indistinguishableCases, departments, totals,
    limitations: ["Does not certify the national assortment or every possible utterance.", "In-memory retrieval only: does not prove deployed SQL, tool routing, model replies, local stock, audio or interruptions.", "A retrieval pass cannot mark a customer call passed."],
  };
  await writeFile(join(output, "cases.jsonl"), cases.map(c => JSON.stringify(c)).join("\n")+"\n");
  await writeFile(join(output, "failures.json"), JSON.stringify(failures, null, 2));
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, totals: undefined, output }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Evaluation failed"); process.exitCode=1; });
