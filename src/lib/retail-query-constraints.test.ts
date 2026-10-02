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

it("a cross-product beer and crisps bundle does not hide the crisps single price",()=>{
  const rows=[offer("Doritos BBQ Corn Chips Bag (180 g)","Crisps",{current_price_eur:2.5,discount_label:"Bundle Offer Heineken 4pk + Dorito Sharing Only €7 Minimum quantity: 2."})];
  const found=searchSyncedWeeklyOffersInRows(rows,"Doritos BBQ Corn Chips Bag 180 g",{reference});
  assert.equal(found[0]?.currentPriceEur,2.5);
  assert.match(found[0]?.quoteText??"",/cross-product bundle/);
});

it("No Drain in a full tuna name is product identity, not an exclusion",()=>{
  const rows=[offer("John West No Drain Tuna Steak In Sunflower Oil (110 g)","Tuna")];
  assert.equal(searchSyncedWeeklyOffersInRows(rows,"John West No Drain Tuna Steak In Sunflower Oil 110 g",{reference})[0]?.productName,rows[0]!.product_name);
});

it("a dairy-free ice cream request cannot be satisfied by dairy-free milk",()=>{
  assert.equal(matchesRetailQueryConstraints("dairy-free ice cream, not dairy ice cream","Alpro Dairy Free Soya Milk","Dairy Free"),false);
  assert.equal(matchesRetailQueryConstraints("dairy-free ice cream, not dairy ice cream","Swedish Glace Dairy Free Vanilla Ice Cream","Ice Cream"),true);
});


it("smoked salmon, gluten-free bread and dog kibble cannot be replaced by soup, breaded fish or chocolate",()=>{
  assert.equal(matchesRetailQueryConstraints("sealed smoked salmon packets","Erin Chicken Soup","Soup"),false);
  assert.equal(matchesRetailQueryConstraints("gluten-free bread","Kilmore Gluten Free Breaded Cod","Fish"),false);
  assert.equal(matchesRetailQueryConstraints("adult dog dry kibble","Cadbury Dairy Milk","Chocolate"),false);
  assert.equal(matchesRetailQueryConstraints("adult dog dry kibble","Pedigree Adult Complete Beef","Dry Dog Food"),true);
});

it("adult dog kibble treats dry food as a category and excludes puppy-specific food",()=>{
  assert.equal(positiveRetailQuery("adult dog dry kibble"),"dog dry food");
  assert.equal(matchesRetailQueryConstraints("adult dog dry kibble","Perfect Fit Rich Chicken Puppy Food","Dry Dog Food"),false);
});

it("spoken beer pack refinements preserve size, exclude Nitrosurge and resolve regular versus zero",()=>{
 const rows=[offer("Guinness Draught Stout Can 8 Pack (500 ml)","Beer",{service_area:"off_licence",is_alcohol:true}),offer("Guinness Draught 0.0% Can 8 Pack (500 ml)","Beer",{service_area:"off_licence"}),offer("Guinness Draught Nitrosurge Can 6 Pack (558 ml)","Beer",{service_area:"off_licence",is_alcohol:true})];
 const query="regular Guinness Draught 8 pack 500ml cans not Nitrosurge";
 assert.equal(positiveRetailQuery(query),"Guinness Draught 8 pack 500 ml cans");
 assert.equal(matchesRetailQueryConstraints(query,rows[1]!.product_name,"Beer"),false);
 assert.equal(matchesRetailQueryConstraints("Guinness Draught not Nitrosurge",rows[2]!.product_name,"Beer"),false);
 assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,query,{reference,serviceArea:"off_licence"}).map(x=>x.productName),[rows[0]!.product_name]);
});
