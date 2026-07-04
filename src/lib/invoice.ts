import { calculateTotal, formatDate, formatDateLong } from '@/lib/calculations';
import { isHistoricalInvoice } from '@/lib/historicalInvoice';
import type {
  Client,
  Invoice,
  InvoiceReminderSettings,
  InvoiceStatus,
  InvoiceStoredStatus,
} from '../types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const INVOICE_STORED_STATUSES: InvoiceStoredStatus[] = [
  'draft',
  'unpaid',
  'payment_sent',
  'paid',
];

export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(3, '0')}`;
}

function invoiceNumberSortKey(number: string): { prefix: string; numeric: number; raw: string } {
  const raw = number.trim();
  const match = raw.match(/^(.*?)(\d+)$/);
  if (!match) return { prefix: raw.toLowerCase(), numeric: 0, raw };
  return { prefix: match[1].toLowerCase(), numeric: Number(match[2]), raw };
}

export function compareInvoiceNumbers(a: string, b: string): number {
  const left = invoiceNumberSortKey(a);
  const right = invoiceNumberSortKey(b);
  const prefixCmp = left.prefix.localeCompare(right.prefix);
  if (prefixCmp !== 0) return prefixCmp;
  if (left.numeric !== right.numeric) return left.numeric - right.numeric;
  return left.raw.localeCompare(right.raw);
}

export type InvoiceListSortKey = 'client' | 'number' | 'date' | 'amount';
export type InvoiceListSortDirection = 'asc' | 'desc';

function applyDirection(value: number, direction: InvoiceListSortDirection): number {
  return direction === 'asc' ? value : -value;
}

export function sortInvoices(
  invoices: Invoice[],
  key: InvoiceListSortKey,
  direction: InvoiceListSortDirection
): Invoice[] {
  return [...invoices].sort((a, b) => {
    let cmp = 0;

    switch (key) {
      case 'client':
        cmp = a.clientName.localeCompare(b.clientName, undefined, { sensitivity: 'base' });
        break;
      case 'number':
        cmp = compareInvoiceNumbers(a.number, b.number);
        break;
      case 'date':
        cmp = a.issueDate.localeCompare(b.issueDate);
        break;
      case 'amount': {
        const aTotal = calculateTotal(a.lineItems, a.taxEnabled, a.taxRate).total;
        const bTotal = calculateTotal(b.lineItems, b.taxEnabled, b.taxRate).total;
        cmp = aTotal - bTotal;
        break;
      }
    }

    if (cmp !== 0) return applyDirection(cmp, direction);

    if (key !== 'date') {
      const dateCmp = b.issueDate.localeCompare(a.issueDate);
      if (dateCmp !== 0) return dateCmp;
    }
    if (key !== 'number') {
      return compareInvoiceNumbers(b.number, a.number);
    }
    return 0;
  });
}

export function compareInvoicesForList(a: Invoice, b: Invoice): number {
  const dateCmp = b.issueDate.localeCompare(a.issueDate);
  if (dateCmp !== 0) return dateCmp;
  return compareInvoiceNumbers(b.number, a.number);
}

export function resolveClientIdForInvoice(
  clients: Client[],
  clientId: string,
  clientName: string
): string {
  if (clientId) return clientId;
  const trimmed = clientName.trim().toLowerCase();
  if (!trimmed) return '';
  const match = clients.find(
    (c) =>
      c.owner.toLowerCase() === trimmed || c.companyName.toLowerCase() === trimmed
  );
  return match?.id ?? '';
}

export function nextInvoiceNumberForClient(
  invoices: Invoice[],
  clients: Client[],
  clientId: string,
  clientName: string
): string {
  const resolvedId = resolveClientIdForInvoice(clients, clientId, clientName);
  if (!resolvedId) return formatInvoiceNumber(1);
  const count = invoices.filter((inv) => inv.clientId === resolvedId).length;
  return formatInvoiceNumber(count + 1);
}

export function resolveStatus(invoice: Invoice): InvoiceStatus {
  if (
    invoice.status === 'paid' ||
    invoice.status === 'draft' ||
    invoice.status === 'payment_sent' ||
    invoice.status === 'overdue'
  ) {
    return invoice.status;
  }
  if (!invoice.dueDate) return invoice.status;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(invoice.dueDate + 'T00:00:00');
  if (due < today) {
    return 'overdue';
  }
  return invoice.status;
}

export function isInvoicePastDue(
  invoice: Pick<Invoice, 'dueDate'>,
  now = new Date()
): boolean {
  if (!invoice.dueDate) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${invoice.dueDate}T00:00:00`);
  return due < today;
}

export function localTodayDateString(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface InvoiceReminderIntervals {
  reminderIntervalDays: number;
  lateReminderIntervalDays: number;
}

function positiveInterval(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export function resolveReminderIntervals(
  invoice: Pick<
    Invoice,
    | 'status'
    | 'reminderIntervalDaysOverride'
    | 'lateReminderIntervalDaysOverride'
  >,
  settings: InvoiceReminderIntervals,
  client?: Pick<Client, 'reminderIntervalDays' | 'lateReminderIntervalDays'> | null
): InvoiceReminderIntervals {
  const globalUnpaid = positiveInterval(settings.reminderIntervalDays, 5);
  const globalLate = positiveInterval(settings.lateReminderIntervalDays, 3);

  return {
    reminderIntervalDays:
      invoice.reminderIntervalDaysOverride ??
      client?.reminderIntervalDays ??
      globalUnpaid,
    lateReminderIntervalDays:
      invoice.lateReminderIntervalDaysOverride ??
      client?.lateReminderIntervalDays ??
      globalLate,
  };
}

export function automaticRemindersBlocked(
  invoice: Pick<Invoice, 'remindersPaused' | 'reminderSnoozeUntil'>,
  now = new Date()
): boolean {
  if (invoice.remindersPaused) return true;
  if (!invoice.reminderSnoozeUntil) return false;
  return invoice.reminderSnoozeUntil > localTodayDateString(now);
}

function intervalSourceNote(
  invoice: Pick<Invoice, 'reminderIntervalDaysOverride' | 'lateReminderIntervalDaysOverride'>,
  client: Pick<Client, 'reminderIntervalDays' | 'lateReminderIntervalDays'> | null | undefined,
  kind: 'unpaid' | 'late'
): string {
  if (kind === 'unpaid' && invoice.reminderIntervalDaysOverride != null) {
    return 'Using invoice reminder interval override.';
  }
  if (kind === 'late' && invoice.lateReminderIntervalDaysOverride != null) {
    return 'Using invoice late-notice interval override.';
  }
  if (kind === 'unpaid' && client?.reminderIntervalDays != null) {
    return 'Using client reminder interval override.';
  }
  if (kind === 'late' && client?.lateReminderIntervalDays != null) {
    return 'Using client late-notice interval override.';
  }
  return 'Using global interval from Settings.';
}

export function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatPaymentDate(paidAt: string | null | undefined): string {
  if (!paidAt) return '—';
  const date = new Date(`${paidAt}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function localDateStringFromMs(ms: number): string {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function utcDateStringFromMs(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextCronRunUtcMs(now = Date.now()): number {
  const nowDate = new Date(now);
  const runToday = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate(),
    9,
    0,
    0,
    0
  );
  if (now < runToday) return runToday;
  return runToday + MS_PER_DAY;
}

function daysLeftLabel(days: number): string {
  if (days === 1) return '1 day';
  return `${days} days`;
}

function calendarDaysUntil(dueDate: string, now = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
}

export function invoiceDueDisplay(
  invoice: Invoice,
  now = new Date()
): { label: string; tooltip: string } {
  if (invoice.status === 'paid') {
    return {
      label: '—',
      tooltip: 'Paid invoices no longer show a due countdown.',
    };
  }

  if (!invoice.dueDate) {
    return {
      label: '—',
      tooltip: 'No due date set.',
    };
  }

  const dueDateFormatted = formatDate(invoice.dueDate);
  const daysUntil = calendarDaysUntil(invoice.dueDate, now);

  if (daysUntil >= 0) {
    return {
      label: daysLeftLabel(daysUntil),
      tooltip:
        daysUntil === 0
          ? `Due on ${dueDateFormatted} (due today).`
          : `Due on ${dueDateFormatted} (${daysLeftLabel(daysUntil)} left).`,
    };
  }

  const overdueDays = Math.abs(daysUntil);
  const overdueLabel = overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;

  return {
    label: overdueLabel,
    tooltip: `Due on ${dueDateFormatted} (${overdueLabel}).`,
  };
}

function reminderIntervalForInvoice(
  invoice: Pick<Invoice, 'status'>,
  intervals: InvoiceReminderIntervals
): number | null {
  if (invoice.status === 'overdue') {
    return Math.max(1, intervals.lateReminderIntervalDays);
  }
  if (invoice.status === 'unpaid' || invoice.status === 'draft') {
    return Math.max(1, intervals.reminderIntervalDays);
  }
  return null;
}

function nextScheduledEmailDate(
  lastSentMs: number,
  interval: number,
  now: number
): string {
  const daysSinceLastSend = Math.floor((now - lastSentMs) / MS_PER_DAY);
  const daysLeft = Math.max(0, interval - daysSinceLastSend);
  const dateStr =
    daysLeft === 0
      ? utcDateStringFromMs(nextCronRunUtcMs(now))
      : localDateStringFromMs(lastSentMs + interval * MS_PER_DAY);
  return formatDateLong(dateStr);
}

export function invoiceNextReminderDate(
  invoice: Pick<
    Invoice,
    | 'status'
    | 'emailSendCount'
    | 'lastEmailSentAt'
    | 'remindersPaused'
    | 'reminderSnoozeUntil'
    | 'reminderIntervalDaysOverride'
    | 'lateReminderIntervalDaysOverride'
  >,
  intervals: InvoiceReminderIntervals,
  options?: {
    forOutgoingEmail?: boolean;
    now?: number;
    client?: Pick<Client, 'reminderIntervalDays' | 'lateReminderIntervalDays'> | null;
  }
): string {
  const now = options?.now ?? Date.now();
  const forOutgoing = options?.forOutgoingEmail ?? false;
  const resolved = resolveReminderIntervals(invoice, intervals, options?.client ?? null);
  const interval = reminderIntervalForInvoice(invoice, resolved);

  if (interval === null || automaticRemindersBlocked(invoice, new Date(now))) return '—';

  if (forOutgoing) {
    return formatDateLong(localDateStringFromMs(now + interval * MS_PER_DAY));
  }

  if (invoice.emailSendCount <= 0 || !invoice.lastEmailSentAt) return '—';

  return nextScheduledEmailDate(
    new Date(invoice.lastEmailSentAt).getTime(),
    interval,
    now
  );
}

export function invoiceEmailSendCountForTemplate(
  invoice: Pick<Invoice, 'emailSendCount'>,
  forOutgoingEmail = false
): string {
  const count = forOutgoingEmail ? invoice.emailSendCount + 1 : invoice.emailSendCount;
  return String(Math.max(0, count));
}

export function invoiceReminderDisplay(
  invoice: Invoice,
  intervals: InvoiceReminderIntervals,
  options?: {
    now?: number;
    client?: Pick<Client, 'reminderIntervalDays' | 'lateReminderIntervalDays'> | null;
  }
): { label: string; tooltip: string } {
  if (isHistoricalInvoice(invoice)) {
    return {
      label: '—',
      tooltip: 'Historical import — emails are permanently disabled for this invoice.',
    };
  }

  const now = options?.now ?? Date.now();
  const client = options?.client ?? null;
  const resolved = resolveReminderIntervals(invoice, intervals, client);
  const unpaidInterval = Math.max(1, resolved.reminderIntervalDays);
  const lateInterval = Math.max(1, resolved.lateReminderIntervalDays);
  const unpaidNote = `Unpaid invoices receive an automatic reminder every ${unpaidInterval} day${unpaidInterval === 1 ? '' : 's'} after the last email.`;
  const lateNote = `Overdue invoices receive a late notice every ${lateInterval} day${lateInterval === 1 ? '' : 's'} after the last email.`;
  const settingsNote = 'Change default intervals in Settings.';

  if (invoice.status !== 'unpaid' && invoice.status !== 'overdue') {
    return {
      label: '—',
      tooltip: `Automatic emails are only sent for unpaid or overdue invoices. ${unpaidNote} ${lateNote} ${settingsNote}`,
    };
  }

  if (automaticRemindersBlocked(invoice, new Date(now))) {
    if (invoice.remindersPaused) {
      return {
        label: 'Paused',
        tooltip: 'Automatic reminders are paused for this invoice. Resume from the invoice panel.',
      };
    }

    const snoozeDate = formatDateLong(invoice.reminderSnoozeUntil!);
    return {
      label: 'Snoozed',
      tooltip: `Automatic reminders are snoozed until ${snoozeDate}.`,
    };
  }

  if (invoice.emailSendCount <= 0 || !invoice.lastEmailSentAt) {
    return {
      label: '—',
      tooltip: `Send the invoice first. ${unpaidNote} ${settingsNote}`,
    };
  }

  const kind = invoice.status === 'overdue' ? 'late' : 'unpaid';
  const interval = kind === 'late' ? lateInterval : unpaidInterval;
  const emailLabel = kind === 'late' ? 'late notice' : 'reminder';
  const sourceNote = intervalSourceNote(invoice, client, kind);
  const intervalNote =
    kind === 'late'
      ? `${lateNote} ${sourceNote}`
      : `${unpaidNote} ${sourceNote}`;

  const lastSentMs = new Date(invoice.lastEmailSentAt).getTime();
  const daysSinceLastSend = Math.floor((now - lastSentMs) / MS_PER_DAY);
  const daysLeft = Math.max(0, interval - daysSinceLastSend);

  if (daysLeft === 0) {
    const sendDate = formatDate(utcDateStringFromMs(nextCronRunUtcMs(now)));
    return {
      label: daysLeftLabel(0),
      tooltip: `Next ${emailLabel} on ${sendDate} (due now; sent on the daily run at 9:00 AM UTC). ${intervalNote}`,
    };
  }

  const sendDate = formatDate(localDateStringFromMs(lastSentMs + interval * MS_PER_DAY));

  return {
    label: daysLeftLabel(daysLeft),
    tooltip: `Next ${emailLabel} on ${sendDate} (${daysLeftLabel(daysLeft)} left). ${intervalNote}`,
  };
}

export function emptyInvoiceReminderSettings(): InvoiceReminderSettings {
  return {
    remindersPaused: false,
    reminderSnoozeUntil: null,
    reminderIntervalDaysOverride: null,
    lateReminderIntervalDaysOverride: null,
  };
}

export { isHistoricalInvoice, historicalInvoiceLabel } from '@/lib/historicalInvoice';

export function statusLabel(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    draft: 'Draft',
    unpaid: 'Unpaid',
    paid: 'Paid',
    overdue: 'Overdue',
    payment_sent: 'Payment sent',
  };
  return labels[status];
}
