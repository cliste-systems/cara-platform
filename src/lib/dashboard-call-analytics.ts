export type CallAnalyticsBucket = {
  id: string;
  label: string;
  shortLabel: string;
  calls: number;
  measured: number;
  averageSeconds: number | null;
};
export type CallAnalyticsOutcome = { id: string; label: string; count: number; percent: number; shade: string };
export type DashboardCallAnalytics = {
  total: number;
  measured: number;
  averageSeconds: number | null;
  longestSeconds: number | null;
  totalSeconds: number;
  buckets: CallAnalyticsBucket[];
  outcomes: CallAnalyticsOutcome[];
  granularity: "hour" | "day";
};
export type AnalyticsRollup = {
  total: number;
  measured: number;
  average_seconds: number | null;
  longest_seconds: number | null;
  total_seconds: number;
  hourly: { id: number; calls: number; measured: number; average_seconds: number | null }[];
  daily: { day: string; calls: number; measured: number; average_seconds: number | null }[];
};
const OUTCOMES = [
  ["answered", "Handled by Cara", "#f1f1f1"],
  ["link_sent", "Link sent", "#c9c9c9"],
  ["callback_requested", "Callback requested", "#aaa"],
  ["action_created", "Follow-up logged", "#8c8c8c"],
  ["failed", "Failed", "#b4a8a8"],
  ["voicemail_or_no_speech", "No conversation recorded", "#aaa79f"],
  ["spam_or_abuse", "Spam or abuse", "#858992"],
  ["blocked", "Blocked", "#666"],
  ["unknown", "Unclassified", "#545454"],
] as const;
const nonnegative = (value: number) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const optional = (value: number | null) => value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export function buildWeightedCallOutcomes(rows: { outcome: string | null; count: number }[]): CallAnalyticsOutcome[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = row.outcome?.trim().toLowerCase() ?? "";
    const key = OUTCOMES.some(([id]) => id === raw) ? raw : raw === "linksent" ? "link_sent" : "unknown";
    counts.set(key, (counts.get(key) ?? 0) + Math.floor(nonnegative(row.count)));
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const items = OUTCOMES.map(([id, label, shade]) => ({ id, label, shade, count: counts.get(id) ?? 0 })).filter(row => row.count > 0);
  // Largest-remainder rounding: displayed percentages always sum to 100.
  const percentages = items.map(row => total ? row.count / total * 100 : 0);
  const rounded = percentages.map(Math.floor);
  const order = percentages.map((value, index) => ({ index, fraction: value - rounded[index] })).sort((a, b) => b.fraction - a.fraction);
  for (let i = 0, left = total ? 100 - rounded.reduce((a, b) => a + b, 0) : 0; i < left; i++) rounded[order[i].index]++;
  return items.map((row, index) => ({ ...row, percent: rounded[index] }));
}

function localDay(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
}
export function buildDashboardCallAnalytics(raw: AnalyticsRollup, outcomes: { outcome: string | null; count: number }[], range: string, start: string, now = new Date()): DashboardCallAnalytics {
  const granularity = range === "today" ? "hour" : "day";
  const bucket = (id: string, label: string, shortLabel: string, row?: { calls: number; measured: number; average_seconds: number | null }): CallAnalyticsBucket => ({
    id, label, shortLabel, calls: Math.floor(nonnegative(row?.calls ?? 0)), measured: Math.floor(nonnegative(row?.measured ?? 0)), averageSeconds: optional(row?.average_seconds ?? null),
  });
  let buckets: CallAnalyticsBucket[];
  if (granularity === "hour") {
    const byHour = new Map(raw.hourly.map(row => [Number(row.id), row]));
    buckets = Array.from({ length: 24 }, (_, hour) => bucket(String(hour), `${String(hour).padStart(2, "0")}:00–${String(hour).padStart(2, "0")}:59`, `${String(hour).padStart(2, "0")}:00`, byHour.get(hour)));
  } else {
    const first = new Date(`${localDay(start)}T12:00:00Z`);
    const last = localDay(now.toISOString());
    const byDay = new Map(raw.daily.map(row => [row.day, row]));
    buckets = [];
    for (let i = 0; i < 32; i++) {
      const day = new Date(first.getTime() + i * 86_400_000);
      const id = day.toISOString().slice(0, 10);
      if (id > last) break;
      buckets.push(bucket(id, new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", timeZone: "UTC" }).format(day), new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", timeZone: "UTC" }).format(day), byDay.get(id)));
    }
  }
  return { total: Math.floor(nonnegative(raw.total)), measured: Math.floor(nonnegative(raw.measured)), averageSeconds: optional(raw.average_seconds), longestSeconds: optional(raw.longest_seconds), totalSeconds: nonnegative(raw.total_seconds), buckets, outcomes: buildWeightedCallOutcomes(outcomes), granularity };
}
export function chartAxis(max: number, integer = true): { max: number; ticks: number[] } {
  const value = nonnegative(max);
  if (!value) return { max: integer ? 4 : 60, ticks: integer ? [0, 1, 2, 3, 4] : [0, 15, 30, 45, 60] };
  const raw = value / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const candidate = [1, 2, 2.5, 5, 10].find(n => n * power >= raw)! * power;
  const step = integer ? Math.max(1, Math.ceil(candidate)) : Math.max(0.25, candidate);
  const ceiling = Math.ceil(value / step) * step;
  return { max: ceiling, ticks: Array.from({ length: Math.round(ceiling / step) + 1 }, (_, i) => i * step) };
}
export function durationChartAxis(max: number): { max: number; ticks: number[] } {
  const value = nonnegative(max);
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 21600, 43200, 86400];
  const step = steps.find(n => n >= value / 4) ?? Math.ceil(value / 4 / 86400) * 86400;
  const ceiling = value ? Math.ceil(value / step) * step : 60;
  const increment = value ? step : 15;
  return { max: ceiling, ticks: Array.from({ length: Math.round(ceiling / increment) + 1 }, (_, i) => i * increment) };
}
export function formatCallDuration(seconds: number | null, compact = false): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const n = Math.round(seconds);
  if (n < 60) return `${n}s`;
  if (n < 3600) return compact ? `${Math.floor(n / 60)}m` : `${Math.floor(n / 60)}m ${n % 60}s`;
  return `${Math.floor(n / 3600)}h${n % 3600 >= 60 ? ` ${Math.floor(n % 3600 / 60)}m` : ""}`;
}
export function formatChartCount(value: number) {
  return new Intl.NumberFormat("en-IE", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}
export function durationLineSegments(buckets: CallAnalyticsBucket[], max: number): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  buckets.forEach((bucket, i) => {
    if (bucket.averageSeconds == null || bucket.measured === 0) {
      if (current.length) segments.push(current.join(" "));
      current = [];
    } else current.push(`${buckets.length === 1 ? 50 : i / (buckets.length - 1) * 100},${100 - bucket.averageSeconds / max * 100}`);
  });
  if (current.length) segments.push(current.join(" "));
  return segments;
}
