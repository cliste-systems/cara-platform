#!/usr/bin/env tsx
/**
 * Manual SuperValu weekly offers sync + search smoke test.
 *
 * Usage:
 *   npx tsx scripts/sync-supervalu-offers.ts
 *   npx tsx scripts/sync-supervalu-offers.ts --search "Heinz tomato ketchup"
 */
import "dotenv/config";

import { searchRetailWeeklyOffers } from "../src/lib/retail-weekly-offers-search";
import { syncSupervaluNationalOffers } from "../src/lib/supervalu-offers-sync";
import { createAdminClient } from "../src/utils/supabase/admin";

async function main() {
  const searchArgIndex = process.argv.indexOf("--search");
  const searchQuery =
    searchArgIndex >= 0 ? String(process.argv[searchArgIndex + 1] ?? "").trim() : "";
  const recompilePrompts = process.argv.includes("--recompile");

  const admin = createAdminClient();
  const result = await syncSupervaluNationalOffers(admin, {
    skipPromptRecompile: !recompilePrompts,
  });
  if (!result.ok) {
    console.error("Sync failed:", result.message);
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
  console.log(
    `\nNational refresh queued. Search below shows the last published snapshot; the crawler publishes the new snapshot after source validation.`,
  );

  const query = searchQuery || "weekly offers";
  const matches = await searchRetailWeeklyOffers(admin, "supervalu", query);
  console.log(`\nSearch "${query}": ${matches.length} match(es)`);
  for (const match of matches.slice(0, 8)) {
    console.log(`- ${match.productName}: ${match.quoteText}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
