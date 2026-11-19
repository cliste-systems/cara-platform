import type {
  ServiceCatalogItem,
  ServiceDetails,
  ServicePriceMode,
} from "./service-catalog-format";
export const SERVICE_PRICE_LABELS: Record<ServicePriceMode, string> = {
  unset: "Not listed",
  fixed: "Fixed price",
  from: "Starting from",
  range: "Price range",
  hourly: "Hourly / daily rate",
  quote: "Quote required",
  free: "Free",
};
export function serviceDetails(
  item: Pick<ServiceCatalogItem, "price" | "durationMinutes" | "details">,
): ServiceDetails {
  return {
    priceMode: item.price > 0 ? "from" : "unset",
    durationMode: item.durationMinutes > 0 ? "estimate" : "unset",
    status: "available",
    ...item.details,
  };
}
export function validateService(item: ServiceCatalogItem): string | null {
  if (
    !item ||
    typeof item.name !== "string" ||
    typeof item.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      item.id,
    )
  )
    return "This service could not be identified. Reload and try again.";
  for (const value of [
    item.category,
    item.description,
    item.aiVoiceNotes,
    item.details?.priceNotes,
    item.details?.privateNotes,
  ])
    if (value != null && typeof value !== "string")
      return "Service notes must be text.";
  const d = serviceDetails(item);
  if (!item.name.trim() || item.name.length > 120)
    return "Give this service a name of up to 120 characters.";
  if (d.priceUnit && !["hour", "day"].includes(d.priceUnit))
    return "Choose an hourly or daily rate.";
  if (d.durationUnit && !["minute", "hour", "day"].includes(d.durationUnit))
    return "Choose a duration unit.";
  if (
    !Number.isInteger(item.durationMinutes) ||
    !Number.isInteger(d.durationMaxMinutes ?? 0)
  )
    return "Use whole minutes for the duration.";
  if (!Object.hasOwn(SERVICE_PRICE_LABELS, d.priceMode))
    return "Choose how this service is priced.";
  if (!["available", "unavailable", "archived"].includes(d.status!))
    return "Choose a service status.";
  if (!["unset", "exact", "estimate", "range"].includes(d.durationMode!))
    return "Choose a duration type.";
  if (
    ![
      item.price,
      item.durationMinutes,
      d.priceMax ?? 0,
      d.durationMaxMinutes ?? 0,
    ].every((n) => Number.isFinite(n) && n >= 0)
  )
    return "Prices and durations must be valid positive numbers.";
  if (
    ["fixed", "from", "range", "hourly"].includes(d.priceMode) &&
    item.price <= 0
  )
    return "Enter a price, or choose Free or Quote required.";
  if (d.priceMode === "range" && (!d.priceMax || d.priceMax < item.price))
    return "The upper price must be at least the starting price.";
  if (d.durationMode !== "unset" && item.durationMinutes <= 0)
    return "Enter how long the service takes.";
  if (
    d.durationMode === "range" &&
    (!d.durationMaxMinutes || d.durationMaxMinutes < item.durationMinutes)
  )
    return "The upper duration must be at least the starting duration.";
  if (
    (d.priceNotes?.length ?? 0) > 500 ||
    (item.description?.length ?? 0) > 500 ||
    (item.aiVoiceNotes?.length ?? 0) > 200 ||
    (d.privateNotes?.length ?? 0) > 1000
  )
    return "Shorten the notes before saving.";
  return null;
}
