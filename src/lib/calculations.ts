import type { LineItem } from '../types';

export function lineItemAmount(item: LineItem): number {
  return item.quantity * item.rate;
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
