const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function localTodayDateString(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function positiveInterval(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function optionalInterval(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
}

export function resolveUnpaidReminderIntervalDays(
  invoice: Record<string, unknown>,
  client: Record<string, unknown> | null,
  settings: Record<string, unknown>
): number {
  const globalDefault = positiveInterval(settings.reminder_interval_days, 5);
  return (
    optionalInterval(invoice.reminder_interval_days_override) ??
    optionalInterval(client?.reminder_interval_days) ??
    globalDefault
  );
}

export function resolveLateReminderIntervalDays(
  invoice: Record<string, unknown>,
  client: Record<string, unknown> | null,
  settings: Record<string, unknown>
): number {
  const globalDefault = positiveInterval(settings.late_reminder_interval_days, 3);
  return (
    optionalInterval(invoice.late_reminder_interval_days_override) ??
    optionalInterval(client?.late_reminder_interval_days) ??
    globalDefault
  );
}

export function automaticRemindersBlocked(
  invoice: Record<string, unknown>,
  now = new Date()
): boolean {
  if (Boolean(invoice.reminders_paused)) return true;

  const snoozeUntil = invoice.reminder_snooze_until;
  if (!snoozeUntil) return false;

  return String(snoozeUntil) > localTodayDateString(now);
}

export function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / MS_PER_DAY);
}
