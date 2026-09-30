/** Cooking context is a constraint on burger form, not part of its product name. */
export function queryRequestsBurgersForCooking(query: string): boolean {
  return /\bburgers?\b/i.test(query) &&
    /\b(?:bbq|barbecues?|barbeques?|barbecuing|barbequing|grill|grilling|raw|uncooked|cooking)\b/i.test(query) &&
    !/\bburger\s+(?:sauce|buns?|relish|mayonnaise|mayo|seasoning)\b/i.test(query);
}

export function queryRequestsMeatBurgers(query: string): boolean {
  return /\bburgers?\b/i.test(query) && /\bmeat\b/i.test(query) &&
    !/\b(?:vegetarian|vegan|veggie|plant[ -]based|meat[ -]free|meatless|no meat|without meat)\b/i.test(query);
}

export function stripBurgerSearchContext(query: string): string {
  let result = query;
  if (queryRequestsBurgersForCooking(query)) result = result.replace(/\b(?:bbq|barbecues?|barbeques?|barbecuing|barbequing|grill|grilling|raw|uncooked|cooking)\b/gi, " ");
  if (queryRequestsMeatBurgers(query)) result = result.replace(/\bmeat\b/gi, " ");
  return result.replace(/\s{2,}/g, " ").trim();
}

/** Use catalogue evidence; do not guess a product's preparation from its brand. */
export function isPreparedBurgerProduct(productName: string, department = ""): boolean {
  return /\b(?:single[ -]serve|ready[ -]meals?|ready[ -]to[ -]eat|microwave|microwavable|fully[ -]cooked|pre[ -]cooked)\b/i.test(`${productName} ${department}`) ||
    /\bburgers?\s+(?:(?:with|and|&)\s+)?(?:fries|chips|dinners?|meals?)\b/i.test(productName);
}

export function matchesBurgerProductContext(query: string, productName: string, department = ""): boolean {
  if (queryRequestsBurgersForCooking(query) && isPreparedBurgerProduct(productName, department)) return false;
  if (!queryRequestsMeatBurgers(query)) return true;
  const text = `${productName} ${department}`;
  if (/\b(?:vegetarian|vegan|veggie|plant[ -]based|meat[ -]free|meatless|no[ -]beef)\b/i.test(text)) return false;
  return /\b(?:beef|chicken|turkey|lamb|pork|steak|venison|bison|buffalo|duck|meats?)\b/i.test(text);
}
