import {
  DAY_KEYS,
  type BankHolidayConfig,
  type WeekSchedule,
} from "./business-hours";
import { firstCallHoursErrors } from "./first-call-hours-validation";

/** Share the setup rules with dashboard edits; inactive times are retained drafts. */
export function dashboardHoursError(
  schedule: WeekSchedule,
  open24_7: boolean,
  holidays: BankHolidayConfig,
): string | null {
  if (
    !schedule ||
    DAY_KEYS.some(
      (day) => !schedule[day] || typeof schedule[day].open !== "boolean",
    )
  )
    return "Choose your opening days and hours before saving.";
  const fields: Record<string, string> = {};
  if (!open24_7)
    for (const day of DAY_KEYS) {
      fields[`${day}_open`] = schedule[day].open ? "on" : "off";
      fields[`${day}_start`] = schedule[day].start;
      fields[`${day}_end`] = schedule[day].end;
    }
  fields.holidayMode =
    holidays?.configured && !holidays.usualHours
      ? holidays.open
        ? "different"
        : "closed"
      : "usual";
  fields.holidayStart = holidays?.start;
  fields.holidayEnd = holidays?.end;
  return Object.values(firstCallHoursErrors(fields))[0] ?? null;
}
