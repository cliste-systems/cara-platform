/** Promotion claims require recent source evidence, independently of validity dates. */
export const RETAIL_OFFER_MAX_SOURCE_AGE_MS = 48 * 60 * 60 * 1000;

export const RETAIL_OFFERS_UNVERIFIED_MESSAGE =
  "Current national offers could not be verified from source observations in the last 48 hours. " +
  "Do not quote older promotion prices or say that missing data means there are no offers in store.";

export function isRetailOfferObservationFresh(
  observedAt: string | null | undefined,
  reference = new Date(),
): boolean {
  if (typeof observedAt !== "string" || !observedAt.trim()) return false;
  const observed = Date.parse(observedAt);
  const age = reference.getTime() - observed;
  return Number.isFinite(observed) && Number.isFinite(age) && age >= 0 && age <= RETAIL_OFFER_MAX_SOURCE_AGE_MS;
}
