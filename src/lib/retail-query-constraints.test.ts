import assert from "node:assert/strict";
import {it} from "node:test";
import {positiveRetailQuery,matchesRetailQueryConstraints} from "./retail-query-constraints";
import {searchSyncedWeeklyOffersInRows} from "./retail-weekly-offers-search";
import type {RetailWeeklyOfferRow} from "./supervalu-offers-types";
const offer=(name:string,category:string,extra:Partial<RetailWeeklyOfferRow>={}):RetailWeeklyOfferRow=>({id:name,organization_id:null,retail_banner:"supervalu",sync_batch_id:"test",product_name:name,department:category,category_breadcrumb:category,search_text:`${name} ${category}`,offer_channel:"prepack",service_area:"grocery",fulfilment:"prepack",current_price_eur:2,was_price_eur:null,discount_label:"Only €2",price_per_unit:null,sell_by:null,price_unit_type:null,is_alcohol:false,brand:null,sku:name,offer_week_start:"2026-10-01",offer_week_end:"2026-10-07",source_url:null,synced_at:"2026-10-02T09:00:00Z",...extra});
const reference=new Date("2026-10-02T10:00:00Z");
it("keeps requested cheddar blocks and removes explicitly excluded spreads and slices",()=>{
  const rows=[offer("Charleville Mature Cheddar 200 g","Cheddar"),offer("Cheddar Spread","Cheddar"),offer("Cheddar Slices","Cheddar")];
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,"Cheddar in a solid block, no spread or slices",{reference}).map(x=>x.productName),[rows[0]!.product_name]);
});
it("keeps dairy-free dessert evidence while refusing ordinary dairy ice cream",()=>{
  const query="dairy-free ice cream, not regular dairy ice cream";
  assert.equal(matchesRetailQueryConstraints(query,"Swedish Glace Dairy Free Vanilla Ice Cream"),true);
  assert.equal(matchesRetailQueryConstraints(query,"Vanilla Dairy Ice Cream"),false);
});
it("a size-six nappy search cannot match size-six pastry",()=>{
  const rows=[offer("Pampers Nappies Size 6","Baby"),offer("Jus-Rol Vol Au Vents King Size 6 Pack","Pastry")];
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,"nappies size 6 offers",{reference}).map(x=>x.productName),[rows[0]!.product_name]);
});
it("offer expiry requests do not substitute products ending on another day",()=>{
  const rows=[offer("Tea","Tea"),offer("Coffee","Coffee",{offer_week_end:"2026-10-04"})];
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,"weekly offers examples that expire this Sunday",{reference}).map(x=>x.productName),[rows[1]!.product_name]);
});
it("negative scope and price explanations are not product identity tokens",()=>{
  assert.equal(positiveRetailQuery("Back Bacon Joint 700 g standard price rather than bundle price"),"Back Bacon Joint 700 g");
});
