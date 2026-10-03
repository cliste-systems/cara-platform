import assert from 'node:assert/strict';
import {it} from 'node:test';
import {matchesRetailQueryConstraints} from './retail-query-constraints';
import {stripRetailCounterLocation,offerSearchProductIdentityTokens} from './retail-weekly-offers-search';

// Customer requests paired with correct evidence and plausible wrong substitutions.
const cases:[string,string,string,string][]=[
 ['Any grated cheddar deals?','Grated Mature Cheddar','Mature Cheddar Block','Cheese'],
 ['Cheddar slices please','Cheddar Slices','Grated Cheddar','Cheese'],
 ['Cheddar spread','Cheddar Spread','Cheddar Slices','Cheese'],
 ['Strawberry yogurt offers','Strawberry Yogurt','Vanilla Yogurt','Yogurt'],
 ['Orange juice offers','Orange Juice','Apple Juice','Juice'],
 ['Vanilla ice cream deals','Vanilla Ice Cream','Strawberry Ice Cream','Frozen'],
 ['Whole milk offers','Whole Milk','Skimmed Milk','Milk'],
 ['Semi-skimmed milk please','Semi Skimmed Milk','Whole Milk','Milk'],
 ['Skimmed milk offers','Skimmed Milk','Semi Skimmed Milk','Milk'],
 ['Red wine deals','Rioja Red Wine','Sauvignon White Wine','Wine'],
 ['White wine please','Sauvignon White Wine','Rioja Red Wine','Wine'],
 ['Rosé wine offers','Rosé Wine','White Wine','Wine'],
 ['Laundry liquid offers','Laundry Liquid','Laundry Powder','Laundry'],
 ['Any washing powder multibuys?','Washing Powder','Washing Capsules','Laundry'],
 ['Detergent pods please','Laundry Detergent Pods','Laundry Detergent Liquid','Laundry'],
 ['Shampoo offers','Shampoo','Conditioner','Hair Care'],
 ['Conditioner deals','Conditioner','Shampoo','Hair Care'],
 ['Wet cat food deals','Wet Cat Food','Wet Dog Food','Pet Food'],
 ['Wet dog food please','Wet Dog Food','Dry Dog Food','Pet Food'],
 ['Dry cat food please','Dry Cat Food','Wet Cat Food','Pet Food'],
 ['Puppy food offers','Puppy Dog Food','Adult Dog Food','Pet Food'],
 ['Kitten food deals','Kitten Cat Food','Adult Cat Food','Pet Food'],
 ['Wholemeal bread offers','Wholemeal Bread','White Bread','Bread'],
 ['White bread multibuys','White Bread','Wholemeal Bread','Bread'],
 ['Sourdough bread please','Sourdough Bread','White Bread','Bread'],
 ['Microwave rice deals','Microwave Rice','Long Grain Rice','Rice'],
 ['Thin pizza offers','Thin Crust Pizza','Deep Pan Pizza','Pizza'],
 ['Deep pan pizza please','Deep Pan Pizza','Thin Pizza','Pizza'],
 ['Smoked mackerel offers','Smoked Mackerel','Fresh Mackerel','Fish'],
 ['Breaded cod deals','Breaded Cod','Battered Cod','Fish'],
 ['Battered haddock please','Battered Haddock','Breaded Haddock','Fish'],
 ['Nappies size 4 offers','Nappies Size 4','Nappies Size 5','Baby'],
 ['Any size 6 nappies?','Nappies Size 6','Pastry Size 6 Pack','Baby'],
 ['Gluten-free bread deals','Gluten Free Bread','Wholemeal Bread','Bread'],
 ['Vegan burgers please','Vegan Burgers','Beef Burgers','Frozen'],
 ['Dairy-free yogurt please','Dairy Free Yogurt','Natural Yogurt','Yogurt'],
 ['Wood-smoked shredded ham offers','Wood Smoked Shredded Ham','Traditional Shredded Ham','Deli'],
 ['Honey roast carved ham please','Honey Roasted Carved Ham','Honey Roasted Shredded Ham','Deli'],
 ['Beef striploin offers','Beef Striploin Steak','Pork Loin Steak','Meat'],
 ['Beef rib-eye please','Beef Ribeye Steak','Beef Sirloin Steak','Meat'],
 ['White wine, not red wine','White Wine','Red Wine','Wine'],
 ['Cat food, no dog food','Cat Food','Dog Food','Pets'],
 ['Laundry detergent, not pods','Laundry Detergent Liquid','Laundry Detergent Pods','Laundry'],
];
for(const [query,right,wrong,category] of cases) {
 it(`preserves requested identity: ${query}`,()=>assert.equal(matchesRetailQueryConstraints(query,right,category),true));
 it(`rejects wrong substitution: ${query}`,()=>assert.equal(matchesRetailQueryConstraints(query,wrong,category),false));
}
it('allows explicitly offered alternatives without silently narrowing them',()=>{
 for(const product of ['Red Wine','White Wine'])assert.equal(matchesRetailQueryConstraints('Red or white wine',product,'Wine'),true);
 assert.equal(matchesRetailQueryConstraints('Red or white wine','Rosé Wine','Wine'),false);
});
it('structural locations do not contaminate named product identity across the shop',()=>{
 for(const department of ['meat','deli','fish','bakery','cheese','dairy','produce','frozen food','household','baby','pet','drinks','off licence','health','beauty','food cupboard','chilled food','newsagent']) {
  for(const location of ['counter','section','department','aisle']) {
   const query=`Find Acme in the ${department} ${location}`;
   assert.equal(stripRetailCounterLocation(query),'Find Acme in the  ',query);
   assert.ok(offerSearchProductIdentityTokens(query).includes('acme'),query);
  }
 }
 for(const query of ['wine gums','beer battered cod','frozen pizza','fish fingers','baby spinach','Prepared By Our Butcher Beef'])assert.equal(stripRetailCounterLocation(query),query);
});
it('qualifiers stay contextual and absent qualifiers do not narrow a broad product search',()=>{
 for(const [query,name] of [['White chocolate','Milk Chocolate'],['Coffee pods','Coffee Capsules'],['Smoked paprika','Paprika'],['Ham','Shredded Ham'],['Milk','Whole Milk']])assert.equal(matchesRetailQueryConstraints(query,name),true);
});

it('plant-based or meat-free wording alone is not evidence of a vegan label',()=>{
 assert.equal(matchesRetailQueryConstraints('Vegan burgers','Plant Based Burgers','Frozen'),false);
 assert.equal(matchesRetailQueryConstraints('Vegan burgers','Meat Free Burgers','Frozen'),false);
 assert.equal(matchesRetailQueryConstraints('Vegan burgers','Plant Based Burgers','Vegan Frozen Food'),true);
});

it('full public department titles are locations, including comma and ampersand lists',()=>{
 for(const department of ['Fruit & Vegetables','Meat & Poultry','Fish & Seafood','Milk, Yogurt, Butter & Eggs','Health & Wellness','Beauty & Personal Care','Household & Cleaning','Wine, Beer & Spirits','Newsagent & Tobacconist']) {
  assert.equal(stripRetailCounterLocation(`Acme in the ${department} section`),'Acme in the  ',department);
 }
});
