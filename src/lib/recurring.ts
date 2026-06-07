import { dayOfMonth, monthKeyFromDate, parseDateString, toDateString } from '@/lib/calendar';
import { recurringExclusionsForClient } from '@/lib/recurringExclusions';
import type {
  CalendarEntry,
  Client,
  ClientRecurringCalendarExclusion,
  Invoice,
  RecurringCalendarExclusion,
  RecurringLineItem,
} from '@/types';

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

export function isRecurringExcludedForMonth(
  recurringId: string,
  clientId: string,
  monthKey: string,
  exclusions: RecurringCalendarExclusion[]
): boolean {
  return exclusions.some(
    (exclusion) =>
      exclusion.clientId === clientId &&
      exclusion.recurringLineItemId === recurringId &&
      exclusion.monthKey === monthKey
  );
}

export function addClientRecurringCalendarExclusion(
  exclusions: ClientRecurringCalendarExclusion[],
  recurringLineItemId: string,
  monthKey: string
): ClientRecurringCalendarExclusion[] {
  if (
    exclusions.some(
      (exclusion) =>
        exclusion.recurringLineItemId === recurringLineItemId &&
        exclusion.monthKey === monthKey
    )
  ) {
    return exclusions;
  }

  return [...exclusions, { recurringLineItemId, monthKey }];
}

export function resolveRecurringLineItemIdForEntry(
  entry: CalendarEntry,
  client: Client
): string | null {
  if (entry.recurringLineItemId) return entry.recurringLineItemId;

  const day = dayOfMonth(entry.date);
  const description = entry.description.trim();
  const match = client.recurringLineItems.find(
    (item) =>
      item.dayOfMonth === day &&
      item.rate === entry.rate &&
      item.description.trim() === description
  );

  return match?.id ?? null;
}

export function recurringLineItemAppliedForMonth(
  recurringId: string,
  clientId: string,
  monthKey: string,
  invoices: Invoice[],
  calendarEntries: CalendarEntry[],
  exclusions: RecurringCalendarExclusion[] = []
): boolean {
  if (isRecurringExcludedForMonth(recurringId, clientId, monthKey, exclusions)) {
    return true;
  }

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
  calendarEntries: CalendarEntry[],
  exclusions: RecurringCalendarExclusion[] = []
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
      calendarEntries,
      exclusions
    );
  });
}

export function recurringCalendarEntriesForMonth(
  clients: Client[],
  year: number,
  month: number,
  invoices: Invoice[],
  calendarEntries: CalendarEntry[],
  globalExclusions: RecurringCalendarExclusion[] = []
): Omit<CalendarEntry, 'id'>[] {
  const anchor = monthAnchorDate(year, month);
  const entries: Omit<CalendarEntry, 'id'>[] = [];

  for (const client of clients) {
    const missing = missingRecurringLineItems(
      client.recurringLineItems,
      client.id,
      anchor,
      invoices,
      calendarEntries,
      recurringExclusionsForClient(client, globalExclusions)
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
