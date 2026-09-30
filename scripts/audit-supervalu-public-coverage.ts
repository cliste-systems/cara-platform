/** Live public-source audit. Contains aggregate product data, never call/customer data. */
import { config } from "dotenv";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { readStorefrontState, readLeafletCampaignLinks } from "../supabase/functions/supervalu-catalog-bootstrap/storefront";
config({ path: ".env.local", quiet: true });
// Offline audit budget is separate from the short voice-tool request budget.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(60000) }) },
});
async function main() {
  const source = "https://shop.supervalu.ie/sm/pickup/rsid/992/selected-offers";
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`Navigation HTTP ${response.status}`);
  const html = await response.text();
  readStorefrontState(html); // Refuse a blocked/empty page as successful evidence.
  const departments = new Map<string, string>();
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]*\/categories\/[^"]*-id-(O1\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const name = match[3].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
    if (name) departments.set(match[2], name);
  }
  if (departments.size < 10) throw Error("Incomplete public department navigation");
  let evidence;
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    const result = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
      method: "POST", signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "select public.supervalu_public_department_audit() audit" }),
    });
    if (!result.ok) throw Error(`Database audit HTTP ${result.status}`);
    evidence = (await result.json())[0].audit;
  } else {
    const result = await admin.rpc("supervalu_public_department_audit");
    if (result.error) throw result.error;
    evidence = result.data;
  }
  type Department = { department: string; observed_products: number; cross_store_products: number; current_offer_rows: number; fresh_offer_rows: number; multibuy_rows: number; rewards_offer_rows: number; counter_products: number };
  const coverage = [...departments].map(([id, department]) => {
    const row = (evidence.departments as Department[]).find(p => p.department.toLowerCase() === department.toLowerCase());
    return { ...row, id, department,
      coverage_status: row?.observed_products ? "observed_public_range" : "missing_public_range",
      offer_status: row?.fresh_offer_rows ? "fresh_current_offers_observed" : "no_confirmed_fresh_current_offer" };
  });
  const leafletResponse = await fetch("https://supervalu.ie/offers", { signal: AbortSignal.timeout(30000) });
  if (!leafletResponse.ok) throw Error(`Leaflet HTTP ${leafletResponse.status}`);
  const leaflet = readLeafletCampaignLinks(await leafletResponse.text(), leafletResponse.url);
  const report = { ...evidence, checked_at: new Date().toISOString(), database_checked_at: evidence.checked_at,
    source, source_department_count: departments.size, departments: coverage, leaflet,
    limitations: ["Cross-store agreement is evidence of a shared range, not Musgrave national-master certification.", "No confirmed offer is not proof that a department has no offers.", "Anonymous sources cannot expose a customer's private vouchers or personalised coupons.", "Unpublished in-store-only products and promotions cannot be certified through public sources."] };
  const output = process.argv[process.argv.indexOf("--output") + 1];
  if (process.argv.includes("--output") && output) await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, leaflet: { source_url: leaflet.source_url, page_count: leaflet.page_count, shop_link_count: leaflet.shop_link_count }, sources: undefined }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : (error as {message?: string})?.message || String(error)); process.exit(1); });
