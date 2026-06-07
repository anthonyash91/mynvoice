import type { Invoice, InvoiceStatus } from '../types';

export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(3, '0')}`;
}

export function resolveStatus(invoice: Invoice): InvoiceStatus {
  if (invoice.status === 'paid' || invoice.status === 'draft') {
    return invoice.status;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(invoice.dueDate + 'T00:00:00');
  if (due < today) {
    return 'overdue';
  }
  return invoice.status;
}

export function statusLabel(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue',
  };
  return labels[status];
}
