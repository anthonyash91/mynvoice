import type { CalendarEntry, LineItem } from '@/types';

export type LineItemKind = 'fixed' | 'hourly' | 'recurring';

export const LINE_ITEM_KIND_LABEL: Record<LineItemKind, string> = {
  fixed: 'Fixed',
  hourly: 'Hourly',
  recurring: 'Recurring',
};

export function lineItemKindFromLineItem(
  item: Pick<LineItem, 'entryType' | 'sourceRecurringLineItemId'>
): LineItemKind {
  if (item.sourceRecurringLineItemId) return 'recurring';
  if (item.entryType === 'fixed') return 'fixed';
  return 'hourly';
}

export function lineItemKindFromCalendarEntry(
  entry: Pick<CalendarEntry, 'entryType' | 'recurringLineItemId'>
): LineItemKind {
  if (entry.recurringLineItemId) return 'recurring';
  if (entry.entryType === 'fixed') return 'fixed';
  return 'hourly';
}

/** Calendar date on invoices. Fixed one-offs omit dates; recurring keeps them. */
export function lineItemInvoiceDate(
  item: Pick<LineItem, 'entryType' | 'sourceRecurringLineItemId' | 'sourceDate'>
): string | null {
  const date = item.sourceDate?.trim();
  if (!date) return null;
  if (item.entryType === 'fixed' && !item.sourceRecurringLineItemId) return null;
  return date;
}
