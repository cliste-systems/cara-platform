/** Generated from actual SKUs, never invented supermarket fixtures. */
export type RetailEvaluationProduct = {
  id: string; sku: string; product_name: string; brand: string | null;
  department: string; category_breadcrumb?: string | null;
  service_area: string; fulfilment: string; is_alcohol: boolean;
  search_text: string; national_store_count: number; national_regular_price_eur: number | null;
};
export type RetailEvaluationCase = {
  id: string; kind: "product" | "offer"; variant: string; query: string;
  expectedId: string; intent: "stock" | "price" | "offer";
};
export function productEvaluationCases(product: RetailEvaluationProduct): RetailEvaluationCase[] {
  const name = product.product_name;
  return [
    ["canonical", name, "stock"],
    ["irish-stock", `Have ye got ${name}?`, "stock"],
    ["price", `How much is ${name}?`, "price"],
    ["looking-for", `I'm looking for ${name}`, "stock"],
    ["punctuation", name.toUpperCase().replace(/[()]/g, " "), "stock"],
    ["compact-size", name.replace(/(\d)\s+(ml|kg|g|l)\b/gi, "$1$2"), "stock"],
  ].map(([variant, query, intent]) => ({
    id: `${product.sku}:${variant}`, kind: "product", variant, query,
    expectedId: product.sku, intent: intent as "stock" | "price",
  }));
}
export function offerEvaluationCases(offer: { id: string; product_name: string; discount_label: string | null }): RetailEvaluationCase[] {
  const label = offer.discount_label ?? "offers";
  const mechanic = label.match(/\d+\s+for\s+€?\s*\d+(?:[.,]\d+)?|buy\s+\d+\s+get\s+\d+\s+free|rewards?\s+price|half[ -]price|save\s+\d+\s*%/i)?.[0] ?? "offers";
  return [
    ["offer-name", `Any offers on ${offer.product_name}?`],
    ["offer-colloquial", `Is ${offer.product_name} on special this week?`],
    ["offer-mechanic", `${offer.product_name} ${mechanic}`],
  ].map(([variant, query]) => ({ id: `${offer.id}:${variant}`, kind: "offer", variant, query, expectedId: offer.id, intent: "offer" }));
}
