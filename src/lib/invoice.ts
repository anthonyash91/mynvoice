import type { Client, Invoice, InvoiceStatus } from '../types';

export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(3, '0')}`;
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
    invoice.status === 'payment_sent'
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
