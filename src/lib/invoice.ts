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
  if (invoice.status === 'paid' || invoice.status === 'draft') {
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

export function statusLabel(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    draft: 'Draft',
    unpaid: 'Unpaid',
    paid: 'Paid',
    overdue: 'Overdue',
  };
  return labels[status];
}
