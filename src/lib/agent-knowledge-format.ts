import {
  DAY_KEYS,
  DAY_LABELS,
  DAY_LABELS_SHORT,
  type BankHolidayConfig,
  type DayKey,
  type WeekSchedule,
  weekScheduleHasOpenDay,
} from "@/lib/business-hours";

/** Split stored agent text into discrete items (areas, services). */
export function parseAgentKnowledgeList(text: string): string[] {
  const raw = text.trim();
  if (!raw) return [];

  const parts = raw
    .split(/[\n,;]+/)
    .map((part) => part.replace(/^[\s•\-–—]+/, "").trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

/** Format list for voice-worker spoken context (one item per line). */
export function formatAgentKnowledgeList(items: string[]): string {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function formatTime12h(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return hhmm;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  if (minutes === 0) return `${hour12}${period}`;
  return `${hour12}:${String(minutes).padStart(2, "0")}${period}`;
}

function formatHoursRange(start: string, end: string): string {
  return `${formatTime12h(start)}–${formatTime12h(end)}`;
}

type DayGroup = {
  days: DayKey[];
  open: boolean;
  start: string;
  end: string;
};

function scheduleSignature(day: DayKey, schedule: WeekSchedule): string {
  const row = schedule[day];
  if (!row.open) return "closed";
  return `${row.start}-${row.end}`;
}

function buildDayGroups(schedule: WeekSchedule): DayGroup[] {
  const groups: DayGroup[] = [];

  for (const day of DAY_KEYS) {
    const row = schedule[day];
    const signature = scheduleSignature(day, schedule);
    const last = groups[groups.length - 1];
    const lastSignature = last
      ? last.open
        ? `${last.start}-${last.end}`
        : "closed"
      : null;

    if (last && lastSignature === signature) {
      last.days.push(day);
      continue;
    }

    groups.push({
      days: [day],
      open: row.open,
      start: row.start,
      end: row.end,
    });
  }

  return groups;
}

function formatDayLabel(days: DayKey[]): string {
  if (days.length === 1) return DAY_LABELS[days[0]!];
  const first = days[0]!;
  const last = days[days.length - 1]!;
  return `${DAY_LABELS_SHORT[first]}–${DAY_LABELS_SHORT[last]}`;
}

/** Human-readable hours for Cara (grouped Mon–Fri, etc.). */
export function formatWeekScheduleForAgent(schedule: WeekSchedule): string {
  if (!weekScheduleHasOpenDay(schedule)) return "";

  const lines: string[] = [];
  for (const group of buildDayGroups(schedule)) {
    const label = formatDayLabel(group.days);
    if (!group.open) {
      lines.push(`${label}: closed`);
    } else {
      lines.push(`${label}: ${formatHoursRange(group.start, group.end)}`);
    }
  }
  return lines.join("\n");
}

/** Spoken/prompt line for bank & public holidays when configured. */
export function formatBankHolidaysForAgent(
  config: BankHolidayConfig | undefined,
): string {
  if (!config?.configured) return "";
  if (config.usualHours) return "On bank and public holidays, follow the usual weekly opening hours for that day.";
  if (!config.open) return "Closed on bank and public holidays.";
  return `Bank & public holidays: ${formatHoursRange(config.start, config.end)}.`;
}
