/** Shared service-dashboard display formats, always in the business timezone. */
export function formatServiceCallDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return new Intl.DateTimeFormat("en-GB", { day:"2-digit", month:"2-digit", year:"2-digit", timeZone:"Europe/Dublin" }).format(date);
}
export function formatServiceCallTime(value: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { hour:"2-digit", minute:"2-digit", hourCycle:"h23", timeZone:"Europe/Dublin" }).formatToParts(new Date(value));
  const hour = parts.find(part => part.type === "hour")?.value ?? "00";
  const minute = parts.find(part => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}${Number(hour) >= 12 ? "pm" : "am"}`;
}
