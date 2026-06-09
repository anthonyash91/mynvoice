import type { LineItem } from '../types';

export function lineItemAmount(item: LineItem): number {
  return item.quantity * item.rate;
}

export interface RateBreakdownRow {
  rate: number;
  entryType: 'hourly' | 'fixed';
  isRecurring: boolean;
  hours: number | null;
  total: number;
}

export function buildRateBreakdown(lineItems: LineItem[]): RateBreakdownRow[] {
  const groups = new Map<string, RateBreakdownRow>();

  for (const item of lineItems) {
    const isFixed = item.entryType === 'fixed';
    const isRecurring = Boolean(item.sourceRecurringLineItemId);
    const key = `${isRecurring ? 'recurring-' : ''}${isFixed ? 'fixed' : 'hourly'}:${item.rate}`;
    const amount = lineItemAmount(item);
    const existing = groups.get(key);

    if (existing) {
      if (!isFixed) {
        existing.hours = (existing.hours ?? 0) + item.quantity;
      }
      existing.total += amount;
      continue;
    }

    groups.set(key, {
      rate: item.rate,
      entryType: isFixed ? 'fixed' : 'hourly',
      isRecurring,
      hours: isFixed ? null : item.quantity,
      total: amount,
    });
  }

  return [...groups.values()].sort((a, b) => {
    if (a.entryType !== b.entryType) {
      return a.entryType === 'hourly' ? -1 : 1;
    }
    if (a.isRecurring !== b.isRecurring) {
      return a.isRecurring ? 1 : -1;
    }
    return a.rate - b.rate;
  });
}

export function calculateSubtotal(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, item) => sum + lineItemAmount(item), 0);
}

export function calculateTax(subtotal: number, taxEnabled: boolean, taxRate: number): number {
  if (!taxEnabled) return 0;
  return subtotal * (taxRate / 100);
}

export function calculateTotal(
  lineItems: LineItem[],
  taxEnabled: boolean,
  taxRate: number
): { subtotal: number; tax: number; total: number } {
  const subtotal = calculateSubtotal(lineItems);
  const tax = calculateTax(subtotal, taxEnabled, taxRate);
  return { subtotal, tax, total: subtotal + tax };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
