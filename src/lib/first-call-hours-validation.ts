import { DAY_KEYS, DAY_LABELS } from './business-hours';
import { normalizeAlertMobile } from './outside-hours-policy';

export type HoursPanel = 'week' | 'holidays' | 'outside';
export function hoursPanelForField(name: string): HoursPanel {
  return name.startsWith('holiday') ? 'holidays' : ['alertPhone', 'smsAlerts', 'outsideAvailability'].includes(name) ? 'outside' : 'week';
}

/** Validate active settings only; retained values for closed days/options are drafts. */
export function firstCallHoursErrors(fields: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  function range(startKey: string, endKey: string, label: string) {
    const start = fields[startKey] ?? '', end = fields[endKey] ?? '';
    if (!time.test(start)) errors[startKey] = `${label}: enter an opening time.`;
    if (!time.test(end)) errors[endKey] = `${label}: enter a closing time.`;
    else if (time.test(start) && end <= start) errors[endKey] = `${label}: choose a closing time after opening.`;
  }
  for (const day of DAY_KEYS) if (fields[`${day}_open`] === 'on') range(`${day}_start`, `${day}_end`, DAY_LABELS[day]);
  if (!['usual', 'closed', 'different'].includes(fields.holidayMode || 'usual')) errors.holidayMode = 'Choose how Cara should handle bank holidays.';
  if (fields.holidayMode === 'different') range('holidayStart', 'holidayEnd', 'Bank holidays');
  if (!['closed', 'urgent_only', 'normal'].includes(fields.outsideAvailability || 'closed')) errors.outsideAvailability = 'Choose your outside-hours availability.';
  if (!['off', 'urgent', 'all_messages'].includes(fields.smsAlerts || 'off')) errors.smsAlerts = 'Choose when you want SMS alerts.';
  else if (fields.smsAlerts && fields.smsAlerts !== 'off' && !normalizeAlertMobile(fields.alertPhone || '')) errors.alertPhone = 'Enter a mobile number for SMS alerts, e.g. 087 123 4567.';
  return errors;
}
