import { startOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type DashboardMetricRangeKey = "today" | "7d" | "4w";

const DUBLIN = "Europe/Dublin";

export function parseDashboardMetricRange(
  raw: string | string[] | undefined,
): DashboardMetricRangeKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "7d" || v === "4w" || v === "30d") return v === "30d" ? "4w" : v;
  if (v === "today") return "today";
  return "today";
}

/**
 * Lower bound (inclusive) for `created_at >=` filters in UTC ISO.
 */
export function getDashboardMetricRangeLowerBoundIso(
  key: DashboardMetricRangeKey,
  now: Date = new Date(),
): string {
  if (key === "7d") {
    return subDays(now, 7).toISOString();
  }
  if (key === "4w") {
    return subDays(now, 28).toISOString();
  }

  const zonedNow = toZonedTime(now, DUBLIN);
  const startTodayZoned = startOfDay(zonedNow);
  return fromZonedTime(startTodayZoned, DUBLIN).toISOString();
}

/** Exclusive upper bound when needed. Home/Calls use `gte` from lower bound only. */
export function getDashboardMetricRangeUpperExclusiveIso(
  _key: DashboardMetricRangeKey,
  _now: Date = new Date(),
): string | null {
  return null;
}

export function dashboardMetricRangePeriodPhrase(
  key: DashboardMetricRangeKey,
): string {
  switch (key) {
    case "today":
      return "today";
    case "7d":
      return "last 7 days";
    case "4w":
      return "last 4 weeks";
    default:
      return "today";
  }
}

/** Greeting subline under “Hello, …” — calendar date for Today, range label otherwise. */
export function dashboardMetricRangeGreetingSubline(
  key: DashboardMetricRangeKey,
  now: Date = new Date(),
): string {
  if (key === "today") {
    return new Intl.DateTimeFormat("en-IE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: DUBLIN,
    }).format(now);
  }

  const phrase = dashboardMetricRangePeriodPhrase(key);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
