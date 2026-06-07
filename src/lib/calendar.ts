import type { CalendarEntry, CalendarEntryType, LineItem } from '@/types';
import { formatCurrency } from '@/lib/calculations';
import { formatDurationQuantity } from '@/lib/duration';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function toDateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function parseDateString(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month: month - 1, day };
}

export interface CalendarCell {
  date: string;
  inMonth: boolean;
}

export function monthGridCells(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  const prevMonthDate = new Date(year, month, 0);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth();
  const daysInPrevMonth = prevMonthDate.getDate();

  for (let i = 0; i < firstDay; i++) {
    const day = daysInPrevMonth - firstDay + i + 1;
    cells.push({ date: toDateString(prevYear, prevMonth, day), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: toDateString(year, month, day), inMonth: true });
  }

  const nextMonthDate = new Date(year, month + 1, 1);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth();
  let nextDay = 1;

  while (cells.length % 7 !== 0) {
    cells.push({ date: toDateString(nextYear, nextMonth, nextDay), inMonth: false });
    nextDay++;
  }

  return cells;
}

export function weekdayLabels(): string[] {
  return WEEKDAY_LABELS;
}

export function isToday(date: string): boolean {
  return date === new Date().toISOString().split('T')[0];
}

export function formatCalendarDayLabel(date: string): string {
  const { year, month, day } = parseDateString(date);
  return new Date(year, month, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function dayOfMonth(date: string): number {
  return parseDateString(date).day;
}

export function calendarEntryType(entry: CalendarEntry): CalendarEntryType {
  return entry.entryType ?? 'hourly';
}

export function isCalendarEntryFixed(entry: CalendarEntry): boolean {
  return calendarEntryType(entry) === 'fixed';
}

export function calendarEntryAmount(entry: CalendarEntry): number {
  return isCalendarEntryFixed(entry) ? entry.rate : entry.quantity * entry.rate;
}

export function formatCalendarEntryAmount(entry: CalendarEntry): string {
  if (isCalendarEntryFixed(entry)) {
    return formatCurrency(entry.rate);
  }

  return `${formatDurationQuantity(entry.quantity)} × ${formatCurrency(entry.rate)} = ${formatCurrency(
    entry.quantity * entry.rate
  )}`;
}

export function isCalendarEntryBilled(entry: CalendarEntry): boolean {
  return Boolean(entry.invoiceId);
}

export function unbilledCalendarEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return entries.filter((entry) => !isCalendarEntryBilled(entry));
}

export function billedCalendarEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return entries.filter((entry) => isCalendarEntryBilled(entry));
}

export function unbilledCalendarTotal(entries: CalendarEntry[]): number {
  return unbilledCalendarEntries(entries).reduce(
    (sum, entry) => sum + calendarEntryAmount(entry),
    0
  );
}

export function calendarEntryToLineItem(entry: CalendarEntry, lineItemId?: string): LineItem {
  const description = entry.description.trim();
  return {
    id: lineItemId ?? crypto.randomUUID(),
    description: isCalendarEntryFixed(entry) ? description : description || 'Work logged',
    quantity: isCalendarEntryFixed(entry) ? 1 : entry.quantity,
    rate: entry.rate,
    entryType: calendarEntryType(entry),
    sourceCalendarEntryId: entry.id,
    sourceRecurringLineItemId: entry.recurringLineItemId ?? undefined,
    sourceDate: entry.date,
  };
}

export function calendarEntriesToLineItems(entries: CalendarEntry[]): LineItem[] {
  return unbilledCalendarEntries(entries)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => calendarEntryToLineItem(entry));
}

export function pruneOrphanedImportedLineItems(
  lineItems: LineItem[],
  calendarEntries: CalendarEntry[],
  clientId: string
): LineItem[] {
  if (!clientId) {
    return lineItems.filter((item) => !item.sourceCalendarEntryId);
  }

  const entryIds = new Set(
    calendarEntries
      .filter((entry) => entry.clientId === clientId)
      .map((entry) => entry.id)
  );

  return lineItems.filter(
    (item) =>
      !item.sourceCalendarEntryId || entryIds.has(item.sourceCalendarEntryId)
  );
}

export function unbilledClientCalendarEntries(
  calendarEntries: CalendarEntry[],
  clientId: string,
  excludedEntryIds: ReadonlySet<string> = new Set()
): CalendarEntry[] {
  return unbilledCalendarEntries(
    calendarEntries.filter(
      (entry) => entry.clientId === clientId && !excludedEntryIds.has(entry.id)
    )
  );
}

export function isEmptyFixedCalendarEntry(entry: CalendarEntry): boolean {
  return (
    isCalendarEntryFixed(entry) &&
    entry.rate === 0 &&
    entry.description.trim().length === 0
  );
}

export function isInvoiceImportableCalendarEntry(entry: CalendarEntry): boolean {
  return !isEmptyFixedCalendarEntry(entry);
}

export function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

export function previousMonthKey(issueDate: string): string {
  const { year, month } = parseDateString(issueDate);
  return monthKeyFromDate(toDateString(year, month - 1, 1));
}

export function isEntryInInvoiceImportWindow(entryDate: string, issueDate: string): boolean {
  const entryMonth = monthKeyFromDate(entryDate);
  const currentMonth = monthKeyFromDate(issueDate);
  const priorMonth = previousMonthKey(issueDate);
  return entryMonth === currentMonth || entryMonth === priorMonth;
}

export function invoiceCalendarEntries(
  calendarEntries: CalendarEntry[],
  clientId: string,
  issueDate: string,
  excludedEntryIds: ReadonlySet<string> = new Set()
): CalendarEntry[] {
  return unbilledClientCalendarEntries(calendarEntries, clientId, excludedEntryIds)
    .filter((entry) => isEntryInInvoiceImportWindow(entry.date, issueDate))
    .filter(isInvoiceImportableCalendarEntry);
}

export function isLineItemVisibleOnInvoice(
  item: LineItem,
  calendarEntries: CalendarEntry[],
  clientId: string,
  issueDate: string
): boolean {
  if (!item.sourceCalendarEntryId) {
    return item.description.trim().length > 0 || item.rate > 0;
  }

  const entry = calendarEntries.find(
    (calendarEntry) => calendarEntry.id === item.sourceCalendarEntryId
  );
  const entryDate = entry?.date ?? item.sourceDate;
  if (!entry || entry.clientId !== clientId) return false;
  if (entryDate && !isEntryInInvoiceImportWindow(entryDate, issueDate)) return false;

  return isInvoiceImportableCalendarEntry(entry);
}

export function syncImportedLineItems(
  prev: LineItem[],
  calendarEntries: CalendarEntry[],
  clientId: string,
  issueDate: string,
  excludedEntryIds: ReadonlySet<string> = new Set()
): LineItem[] {
  const prunedPrev = pruneOrphanedImportedLineItems(prev, calendarEntries, clientId);
  const clientEntries = invoiceCalendarEntries(
    calendarEntries,
    clientId,
    issueDate,
    excludedEntryIds
  );
  const imported = calendarEntriesToLineItems(clientEntries);
  const manual = prunedPrev.filter((item) => !item.sourceCalendarEntryId);

  if (imported.length === 0) return manual;

  const merged = imported.map((item) => {
    const existing = prunedPrev.find(
      (lineItem) => lineItem.sourceCalendarEntryId === item.sourceCalendarEntryId
    );
    return existing ? { ...item, id: existing.id } : item;
  });

  return manual.length > 0 ? [...merged, ...manual] : merged;
}

export function lineItemToCalendarEntry(
  entry: CalendarEntry,
  item: Pick<LineItem, 'description' | 'quantity' | 'rate' | 'entryType'>
): CalendarEntry {
  const entryType = item.entryType ?? 'hourly';
  const isFixed = entryType === 'fixed';

  return {
    ...entry,
    description: item.description.trim(),
    quantity: isFixed ? 1 : item.quantity,
    rate: item.rate,
    entryType,
  };
}
