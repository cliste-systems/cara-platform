import {parseOutsideHoursPolicy, type OutsideHoursPolicy} from "./outside-hours-policy";
export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DaySchedule = {
  open: boolean;
  start: string;
  end: string;
};

export type WeekSchedule = Record<DayKey, DaySchedule>;

export type WeekScheduleMeta = {
  open24_7?: boolean;
  hoursNote?: string;
  bankHolidays?: BankHolidayConfig;
  outsideHours?: OutsideHoursPolicy;
};

/** Bank & public holiday handling — optional add-on to the weekly schedule. */
export type BankHolidayConfig = {
  /** Owner opted in to bank-holiday rules. */
  configured: boolean;
  usualHours?: boolean;
  /** When configured: open on bank/public holidays vs closed. */
  open: boolean;
  start: string;
  end: string;
};

export function defaultBankHolidayConfig(): BankHolidayConfig {
  return { configured: false, open: false, start: "10:00", end: "14:00" };
}

const META_OPEN_24_7 = "_open24_7";
const META_HOURS_NOTE = "_hoursNote";
const META_BANK_HOLIDAYS_CONFIGURED = "_bankHolidaysConfigured";
const META_BANK_HOLIDAYS_OPEN = "_bankHolidaysOpen";
const META_BANK_HOLIDAYS_START = "_bankHolidaysStart";
const META_BANK_HOLIDAYS_END = "_bankHolidaysEnd";

export const DAY_KEYS: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const DAY_LABELS_SHORT: Record<DayKey, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export function defaultWeekSchedule(): WeekSchedule {
  return {
    monday: { open: true, start: "09:00", end: "17:30" },
    tuesday: { open: true, start: "09:00", end: "17:30" },
    wednesday: { open: true, start: "09:00", end: "17:30" },
    thursday: { open: true, start: "09:00", end: "17:30" },
    friday: { open: true, start: "09:00", end: "18:00" },
    saturday: { open: true, start: "10:00", end: "16:00" },
    sunday: { open: false, start: "10:00", end: "14:00" },
  };
}

/** Fresh onboarding — nothing open until the owner ticks days. */
export function emptyWeekSchedule(): WeekSchedule {
  const base = defaultWeekSchedule();
  return Object.fromEntries(
    DAY_KEYS.map((day) => [day, { ...base[day], open: false }]),
  ) as WeekSchedule;
}

function isDaySchedule(v: unknown): v is DaySchedule {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.open === "boolean" &&
    typeof o.start === "string" &&
    typeof o.end === "string"
  );
}

/** True when the org has never saved structured hours (empty jsonb). */
export function isBusinessHoursUnset(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return true;
  return Object.keys(raw as Record<string, unknown>).length === 0;
}

function readBankHolidayConfig(raw: Record<string, unknown>): BankHolidayConfig {
  const defaults = defaultBankHolidayConfig();
  if (raw[META_BANK_HOLIDAYS_CONFIGURED] !== true) {
    return defaults;
  }
  const open = raw[META_BANK_HOLIDAYS_OPEN] === true;
  const start =
    typeof raw[META_BANK_HOLIDAYS_START] === "string" &&
    raw[META_BANK_HOLIDAYS_START].trim()
      ? raw[META_BANK_HOLIDAYS_START].trim()
      : defaults.start;
  const end =
    typeof raw[META_BANK_HOLIDAYS_END] === "string" &&
    raw[META_BANK_HOLIDAYS_END].trim()
      ? raw[META_BANK_HOLIDAYS_END].trim()
      : defaults.end;
  return { configured: true, open, start, end, ...(raw._bankHolidaysUsualHours === true ? {usualHours:true} : {}) };
}

function readWeekScheduleMeta(raw: Record<string, unknown>): WeekScheduleMeta {
  return {
    open24_7: raw[META_OPEN_24_7] === true,
    hoursNote:
      typeof raw[META_HOURS_NOTE] === "string"
        ? raw[META_HOURS_NOTE].trim().slice(0, 120)
        : "",
    bankHolidays: readBankHolidayConfig(raw),
    outsideHours: raw._outsideHours ? parseOutsideHoursPolicy(raw._outsideHours) : undefined,
  };
}

export function parseBusinessHoursBundle(raw: unknown): {
  schedule: WeekSchedule;
  meta: WeekScheduleMeta;
} {
  const base = defaultWeekSchedule();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { schedule: base, meta: {} };
  }
  const o = raw as Record<string, unknown>;
  const meta = readWeekScheduleMeta(o);
  const out: WeekSchedule = { ...base };
  for (const day of DAY_KEYS) {
    const v = o[day];
    if (isDaySchedule(v)) {
      out[day] = { open: v.open, start: v.start, end: v.end };
    }
  }
  return { schedule: out, meta };
}

export function serializeBusinessHours(
  schedule: WeekSchedule,
  meta: WeekScheduleMeta = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...schedule };
  if (meta.outsideHours) payload._outsideHours = meta.outsideHours;
  if (meta.open24_7) payload[META_OPEN_24_7] = true;
  if (meta.hoursNote?.trim()) {
    payload[META_HOURS_NOTE] = meta.hoursNote.trim().slice(0, 120);
  }
  if (meta.bankHolidays?.configured) {
    payload[META_BANK_HOLIDAYS_CONFIGURED] = true;
    payload[META_BANK_HOLIDAYS_OPEN] = meta.bankHolidays.open;
    if (meta.bankHolidays.usualHours) payload._bankHolidaysUsualHours = true;
    if (meta.bankHolidays.open) {
      payload[META_BANK_HOLIDAYS_START] = meta.bankHolidays.start;
      payload[META_BANK_HOLIDAYS_END] = meta.bankHolidays.end;
    }
  }
  return payload;
}

export function open24_7WeekSchedule(): WeekSchedule {
  return Object.fromEntries(
    DAY_KEYS.map((day) => [
      day,
      { open: true, start: "00:00", end: "23:59" },
    ]),
  ) as WeekSchedule;
}

export function weekScheduleHasOpenDay(schedule: WeekSchedule): boolean {
  return DAY_KEYS.some((day) => schedule[day].open);
}
