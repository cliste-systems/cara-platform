/** Keep exclusions out of positive matching, but enforce them on candidates. */
export function positiveRetailQuery(query: string): string {
  return query
    .replace(/\b(?:to|for)\s+(?:boil(?:ing)?|cook(?:ing)?)\s+(?:it\s+)?myself\b/gi, " ")
    .replace(/\b(?:that\s+)?(?:expir(?:e|es|ing)|end(?:s|ing)?)\b.*?(?:this Sunday|\d{4}-\d{2}-\d{2})/gi, " ")
    .replace(/\b(?:not|no(?!\s+(?:drain|added\s+sugar|artificial\s+(?:colours?|colors?|flavou?rs?)))|without|excluding|except|rather than)\s+(?:the\s+)?[^,.!?;]+/gi, " ")
    .replace(/\b(?:standard price|regular price|bundle price|anything is fine|any make|any brand|in cans please|solid block|sealed packets)\b/gi, " ")
    .replace(/\bdark\s+(?=stout)/gi, "")
    .replace(/\s+/g, " ").trim();
}
export function matchesRetailQueryConstraints(query: string, name: string, category = ""): boolean {
  const text = `${name} ${category}`.toLowerCase();
  if (/\bpasta\b/i.test(query) && /\b(?:boil|cooking|cook)\b/i.test(query)) {
    if (!/\b(?:pasta|spaghetti|penne|fusilli|linguine|ravioli|tortellini|tagliatelle|rigatoni|macaroni)\b/i.test(text) || /\b(?:instant|ready to heat|microwave|hot snacks)\b/i.test(text)) return false;
  }
  const negatives = [...query.matchAll(/\b(?:not|no(?!\s+(?:drain|added\s+sugar|artificial\s+(?:colours?|colors?|flavou?rs?)))|without|excluding|except|rather than)\s+(?:the\s+)?([^,.!?;]+)/gi)];
  for (const negative of negatives) {
    const clause = negative[1]!;
    for (const [words, candidate] of [
      [/\b(?:spread|spreadable)\b/i, /\b(?:spread|spreadable)\b/i],
      [/\bslices?\b/i, /\b(?:sliced|slices)\b/i],
      [/\bred wine\b/i, /\bred\b/i],
      [/\bdog food\b/i, /\bdog\b/i],
      [/\b(?:wet|pouches)\b/i, /\b(?:wet|pouch|pouches)\b/i],
      [/\bpods?\b/i, /\bpods?\b/i],
      [/\bapples?\b/i, /\bapples?\b/i],
      [/\bbananas?\b/i, /\bbananas?\b/i],
      [/\bsoftener\b/i, /\bsoftener\b/i],
      [/\baerosol\b/i, /\b(?:aerosol|spray)\b/i],
      [/\bprotein bars?\b/i, /\bbar(?:s)?\b/i],
      [/\b(?:microwave rice|ready meals?)\b/i, /\b(?:microwave|ready meal)\b/i],
    ] as [RegExp, RegExp][]) if (words.test(clause) && candidate.test(text)) return false;
  }
  if (/\b(?:stout|lager)\b/i.test(positiveRetailQuery(query)) && /\bcans?\b/i.test(query)) {
    const type = /\bstout\b/i.test(query) ? /\bstout\b/i : /\b(?:lager|pilsner)\b/i;
    if (!type.test(text)) return false;
  }
  if (/\bwhite wine\b/i.test(positiveRetailQuery(query)) && !/\bwhite\b/i.test(text)) return false;
  if (/\bdairy[- ]free\b/i.test(query) && /\bice cream\b/i.test(query) && !/dairy[- ]free|non[- ]dairy|vegan|swedish glace|plant[- ]based/i.test(text)) return false;
  return true;
}
