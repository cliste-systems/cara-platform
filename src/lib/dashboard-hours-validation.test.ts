import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultWeekSchedule,
  defaultBankHolidayConfig,
} from "./business-hours";
import { dashboardHoursError } from "./dashboard-hours-validation";
test("dashboard hours reject reversed ranges but ignore inactive holiday drafts", () => {
  const week = defaultWeekSchedule();
  const holidays = {
    ...defaultBankHolidayConfig(),
    configured: true,
    open: true,
    start: "10:00",
    end: "09:00",
  };
  assert.match(
    dashboardHoursError(week, false, holidays)!,
    /Bank holidays: choose a closing time after opening/,
  );
  assert.equal(
    dashboardHoursError(week, false, { ...holidays, open: false }),
    null,
  );
  assert.equal(
    dashboardHoursError(week, false, { ...holidays, usualHours: true }),
    null,
  );
  week.monday.end = "08:00";
  assert.match(
    dashboardHoursError(week, false, defaultBankHolidayConfig())!,
    /Monday/,
  );
  assert.equal(
    dashboardHoursError(week, true, defaultBankHolidayConfig()),
    null,
  );
});
test("dashboard hours reject missing times and malformed schedules", () => {
  const week = defaultWeekSchedule();
  week.tuesday.start = "";
  assert.match(
    dashboardHoursError(week, false, defaultBankHolidayConfig())!,
    /Tuesday: enter an opening/,
  );
  assert.match(
    dashboardHoursError({} as typeof week, false, defaultBankHolidayConfig())!,
    /opening days/,
  );
});
