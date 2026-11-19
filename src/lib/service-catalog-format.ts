import {
  findExactChipInList,
  findNearDuplicateChip,
} from "@/lib/cara-setup-chips";
import type { ServicePolicyFlag } from "@/lib/service-policy-presets";

export type ServiceCatalogSource = "manual" | "booking_import" | "website_import";

export type ServicePriceMode = "unset" | "fixed" | "from" | "range" | "hourly" | "quote" | "free";
export type ServiceDetails = {
  priceMode: ServicePriceMode;
  priceMax?: number;
  priceUnit?: "hour" | "day";
  priceNotes?: string;
  durationMode?: "unset" | "exact" | "estimate" | "range";
  durationMaxMinutes?: number;
  durationUnit?: "minute" | "hour" | "day";
  status?: "available" | "unavailable" | "archived";
  privateNotes?: string;
};

export type ServiceCatalogItem = {
  id: string;
  name: string;
  category: string | null;
  /** EUR. 0 = unset. */
  price: number;
  /** Minutes. 0 = unset. */
  durationMinutes: number;
  description: string | null;
  aiVoiceNotes: string | null;
  policyFlags: ServicePolicyFlag[];
  source: ServiceCatalogSource;
  details?: ServiceDetails;
  updatedAt?: string;
};

export type ServiceCatalogDraft = Omit<ServiceCatalogItem, "id"> & {
  id?: string;
};

export const MAX_SERVICE_CATALOG_ITEMS = 60;
export const MAX_SERVICE_NAME = 120;
export const MAX_SERVICE_CATEGORY = 80;
export const MAX_SERVICE_DESCRIPTION = 500;
export const MAX_SERVICE_VOICE_NOTES = 200;

export function servicePriceIsSet(price: number): boolean {
  return Number.isFinite(price) && price > 0;
}

export function serviceDurationIsSet(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes > 0;
}

export function formatServicePriceEur(price: number): string | null {
  if (!servicePriceIsSet(price)) return null;
  const rounded = Math.round(price * 100) / 100;
  const text =
    rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(2);
  return `€${text}`;
}

export function formatServiceDuration(minutes: number): string | null {
  if (!serviceDurationIsSet(minutes)) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return hours === 1 ? "1 hr" : `${hours} hr`;
  return `${hours} hr ${rem} min`;
}

export function formatServiceCatalogLine(
  item: Pick<ServiceCatalogItem, "name" | "price" | "durationMinutes" | "details">,
): string {
  const parts = [item.name.trim()];
  const durationText = (minutes: number) => item.details?.durationUnit === "day" && minutes > 0 ? `${Number((minutes / 1440).toFixed(2))} days` : formatServiceDuration(minutes);
  const duration = durationText(item.durationMinutes);
  const price = formatServicePriceEur(item.price);
  const d = item.details;
  if (d?.status === "unavailable") parts.push("Temporarily unavailable — take an enquiry; do not confirm availability");
  if (duration && d?.durationMode !== "unset") {
    const max = durationText(d?.durationMaxMinutes ?? 0);
    parts.push(d?.durationMode === "range" && max ? `${duration}–${max}` : `${d?.durationMode === "estimate" ? "about " : ""}${duration}`);
  }
  const mode = d?.priceMode ?? (price ? "from" : "unset");
  if (mode === "free") parts.push("Free");
  else if (mode === "quote") parts.push("Quote required — take details for a quote");
  else if (price && mode !== "unset") {
    const max = formatServicePriceEur(d?.priceMax ?? 0);
    parts.push(mode === "fixed" ? price : mode === "range" && max ? `${price}–${max}` : mode === "hourly" ? `${price} per ${d?.priceUnit ?? "hour"}` : `from ${price}`);
  }
  if (d?.priceNotes?.trim()) parts.push(d.priceNotes.trim());
  return parts.join(" — ");
}

export function catalogHasExtractedPrices(
  services: Pick<ServiceCatalogItem, "price" | "details">[],
): boolean {
  return services.some((s) => s.details?.status !== "archived" && (s.details?.priceMode === "free" || (!["unset","quote"].includes(s.details?.priceMode ?? "from") && servicePriceIsSet(s.price))));
}

/** Owner can opt out; default on when catalog has prices. */
export function resolveQuotePricesOnCalls(
  services: Pick<ServiceCatalogItem, "price" | "details">[],
  ownerPreference: boolean | null | undefined,
): boolean {
  if (!catalogHasExtractedPrices(services)) return false;
  return ownerPreference !== false;
}

export type CatalogEconomics = Pick<
  ServiceCatalogItem,
  "price" | "durationMinutes"
>;

export function catalogEconomicsEqual(
  a: CatalogEconomics,
  b: CatalogEconomics,
): boolean {
  return (
    Math.max(0, Number(a.price) || 0) === Math.max(0, Number(b.price) || 0) &&
    Math.max(0, Math.round(Number(a.durationMinutes) || 0)) ===
      Math.max(0, Math.round(Number(b.durationMinutes) || 0))
  );
}

function catalogNameMatches(
  name: string,
  otherName: string,
): boolean {
  return (
    findExactChipInList(name, [otherName]) !== undefined ||
    findNearDuplicateChip(name, [otherName]) !== null
  );
}

export function findCatalogNearDuplicate(
  item: Pick<ServiceCatalogItem, "name" | "price" | "durationMinutes" | "id">,
  catalog: Pick<
    ServiceCatalogItem,
    "id" | "name" | "price" | "durationMinutes"
  >[],
  excludeId?: string,
): Pick<ServiceCatalogItem, "id" | "name"> | null {
  const trimmed = item.name.trim();
  if (!trimmed) return null;

  for (const existing of catalog) {
    if (excludeId && existing.id === excludeId) continue;
    if (!catalogNameMatches(trimmed, existing.name)) continue;
    if (
      !catalogEconomicsEqual(item, existing)
    ) {
      continue;
    }
    return { id: existing.id, name: existing.name };
  }

  return null;
}

export function findCatalogNameConflict(
  name: string,
  catalog: Pick<
    ServiceCatalogItem,
    "id" | "name" | "price" | "durationMinutes"
  >[],
  excludeId?: string,
  economics?: CatalogEconomics,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const probe: Pick<ServiceCatalogItem, "name" | "price" | "durationMinutes"> =
    {
      name: trimmed,
      price: economics?.price ?? 0,
      durationMinutes: economics?.durationMinutes ?? 0,
    };

  const match = findCatalogNearDuplicate(
    { ...probe, id: excludeId ?? "" },
    catalog,
    excludeId,
  );
  return match?.name ?? null;
}

export type DedupeCatalogDraftsResult = {
  drafts: ServiceCatalogDraft[];
  mergedCount: number;
};

/** Keep the first of exact or near-duplicate names with matching price/duration. */
export function dedupeCatalogDrafts(
  drafts: ServiceCatalogDraft[],
): ServiceCatalogDraft[] {
  return dedupeCatalogDraftsWithStats(drafts).drafts;
}

export function dedupeCatalogDraftsWithStats(
  drafts: ServiceCatalogDraft[],
): DedupeCatalogDraftsResult {
  const out: ServiceCatalogDraft[] = [];
  let mergedCount = 0;

  for (const draft of drafts) {
    const name = String(draft.name ?? "").trim();
    if (!name) continue;

    const normalized: ServiceCatalogDraft = {
      ...draft,
      name,
      price: Math.max(0, Number(draft.price) || 0),
      durationMinutes: Math.max(
        0,
        Math.round(Number(draft.durationMinutes) || 0),
      ),
    };

    const duplicate = out.find(
      (kept) =>
        catalogNameMatches(name, kept.name) &&
        catalogEconomicsEqual(normalized, kept),
    );
    if (duplicate) {
      mergedCount += 1;
      continue;
    }

    out.push(normalized);
  }

  return { drafts: out, mergedCount };
}

export function lintCatalogNearDuplicatePairs(
  catalog: Pick<
    ServiceCatalogItem,
    "id" | "name" | "price" | "durationMinutes"
  >[],
): { a: Pick<ServiceCatalogItem, "id" | "name">; b: Pick<ServiceCatalogItem, "id" | "name"> }[] {
  const pairs: {
    a: Pick<ServiceCatalogItem, "id" | "name">;
    b: Pick<ServiceCatalogItem, "id" | "name">;
  }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i]!;
    for (let j = i + 1; j < catalog.length; j++) {
      const other = catalog[j]!;
      if (!catalogNameMatches(item.name, other.name)) continue;
      if (!catalogEconomicsEqual(item, other)) continue;
      const pairKey = [item.id, other.id].sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      pairs.push({
        a: { id: item.id, name: item.name },
        b: { id: other.id, name: other.name },
      });
    }
  }

  return pairs;
}
