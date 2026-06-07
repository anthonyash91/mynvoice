import { monthKeyFromDate, parseDateString, toDateString } from '@/lib/calendar';
import type { CalendarEntry, Client, Invoice, RecurringLineItem } from '@/types';

export function emptyRecurringLineItem(): RecurringLineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    rate: 0,
    entryType: 'fixed',
    dayOfMonth: 1,
  };
}

export function monthAnchorDate(year: number, month: number): string {
  return toDateString(year, month, 1);
}

export function recurringDateForMonth(issueDate: string, dayOfMonth: number): string {
  const { year, month } = parseDateString(issueDate);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(Math.max(1, Math.round(dayOfMonth)), lastDay);
  return toDateString(year, month, day);
}

export function recurringLineItemAppliedForMonth(
  recurringId: string,
  clientId: string,
  monthKey: string,
  invoices: Invoice[],
  calendarEntries: CalendarEntry[]
): boolean {
  for (const invoice of invoices) {
    if (invoice.clientId !== clientId) continue;
    if (!invoice.issueDate.startsWith(monthKey)) continue;
    if (
      invoice.lineItems.some(
        (item) => item.sourceRecurringLineItemId === recurringId
      )
    ) {
      return true;
    }
  }

  for (const entry of calendarEntries) {
    if (entry.clientId !== clientId) continue;
    if (!entry.date.startsWith(monthKey)) continue;
    if (entry.recurringLineItemId === recurringId) return true;
  }

  return false;
}

export function missingRecurringLineItems(
  recurringItems: RecurringLineItem[],
  clientId: string,
  issueDate: string,
  invoices: Invoice[],
  calendarEntries: CalendarEntry[]
): RecurringLineItem[] {
  const monthKey = monthKeyFromDate(issueDate);

  return recurringItems.filter((item) => {
    if (!item.description.trim() || item.rate <= 0) return false;
    if (item.dayOfMonth < 1 || item.dayOfMonth > 31) return false;
    return !recurringLineItemAppliedForMonth(
      item.id,
      clientId,
      monthKey,
      invoices,
      calendarEntries
    );
  });
}

export function recurringCalendarEntriesForMonth(
  clients: Client[],
  year: number,
  month: number,
  invoices: Invoice[],
  calendarEntries: CalendarEntry[]
): Omit<CalendarEntry, 'id'>[] {
  const anchor = monthAnchorDate(year, month);
  const entries: Omit<CalendarEntry, 'id'>[] = [];

  for (const client of clients) {
    const missing = missingRecurringLineItems(
      client.recurringLineItems,
      client.id,
      anchor,
      invoices,
      calendarEntries
    );

    for (const recurring of missing) {
      entries.push(recurringLineItemToCalendarEntry(recurring, client.id, anchor));
    }
  }

  return entries;
}

export function recurringLineItemToCalendarEntry(
  recurring: RecurringLineItem,
  clientId: string,
  issueDate: string
): Omit<CalendarEntry, 'id'> {
  const isFixed = recurring.entryType === 'fixed';

  return {
    clientId,
    date: recurringDateForMonth(issueDate, recurring.dayOfMonth),
    description: recurring.description.trim(),
    quantity: isFixed ? 1 : recurring.quantity,
    rate: recurring.rate,
    entryType: recurring.entryType,
    recurringLineItemId: recurring.id,
  };
}
