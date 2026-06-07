import { jsPDF } from 'npm:jspdf@2';

type LineItem = {
  description?: string;
  quantity?: number;
  rate?: number;
  entry_type?: string;
  entryType?: string;
  source_recurring_line_item_id?: string | null;
  sourceRecurringLineItemId?: string | null;
};

type InvoicePdfInput = {
  invoice: {
    number: string;
    issue_date: string;
    due_date?: string | null;
    line_items: LineItem[];
    notes?: string | null;
    tax_enabled: boolean;
    tax_rate: number;
    status: string;
    client_name?: string;
  };
  settings: {
    business_name?: string | null;
    email?: string | null;
    business_address?: string | null;
    payment_details?: string | null;
  };
  client: {
    companyName?: string;
    owner?: string;
    primaryEmail?: string;
    address?: string;
  } | null;
  clientDisplayName: string;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDateLong(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function splitStreetAndCityLines(address: string): [string, string] {
  const trimmed = address.trim();
  if (!trimmed) return ['', ''];

  const newlineIndex = trimmed.indexOf('\n');
  if (newlineIndex >= 0) {
    return [
      trimmed.slice(0, newlineIndex).trim(),
      trimmed.slice(newlineIndex + 1).trim(),
    ];
  }

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex >= 0) {
    return [
      trimmed.slice(0, commaIndex).trim(),
      trimmed.slice(commaIndex + 1).trim(),
    ];
  }

  return [trimmed, ''];
}

function lineItemEntryType(item: LineItem): string {
  return String(item.entry_type ?? item.entryType ?? 'hourly');
}

function isRecurringLineItem(item: LineItem): boolean {
  return Boolean(item.source_recurring_line_item_id ?? item.sourceRecurringLineItemId);
}

function formatLineItemQtyRate(item: LineItem): string {
  const entryType = lineItemEntryType(item);
  const quantity = Number(item.quantity ?? 0);
  const rate = Number(item.rate ?? 0);

  if (isRecurringLineItem(item) && entryType === 'fixed') {
    return 'Recurring';
  }
  if (entryType === 'fixed') {
    return '—';
  }
  return `${quantity} × ${formatCurrency(rate)}/hr`;
}

function calculateTotals(
  lineItems: LineItem[],
  taxEnabled: boolean,
  taxRate: number
): { subtotal: number; tax: number; total: number } {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + Number(item.quantity ?? 0) * Number(item.rate ?? 0),
    0
  );
  const tax = taxEnabled ? subtotal * (taxRate / 100) : 0;
  return { subtotal, tax, total: subtotal + tax };
}

function statusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'payment_sent':
      return 'Payment sent';
    case 'unpaid':
      return 'Unpaid';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}

function statusColor(status: string): [number, number, number] {
  switch (status) {
    case 'paid':
      return [52, 199, 89];
    case 'payment_sent':
      return [255, 149, 0];
    case 'unpaid':
      return [0, 113, 227];
    default:
      return [110, 110, 115];
  }
}

function clientSecondaryName(client: InvoicePdfInput['client']): string {
  if (!client) return '';
  const company = String(client.companyName ?? '').trim();
  const owner = String(client.owner ?? '').trim();
  if (company && owner) return company;
  return '';
}

export function generateInvoicePdfBase64(input: InvoicePdfInput): string {
  const { invoice, settings, client, clientDisplayName } = input;
  const lineItems = invoice.line_items ?? [];
  const totals = calculateTotals(lineItems, invoice.tax_enabled, Number(invoice.tax_rate ?? 0));
  const [addressLineOne, addressLineTwo] = splitStreetAndCityLines(
    String(settings.business_address ?? '')
  );

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (height: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeMuted = (text: string, x: number, size = 9) => {
    if (!text) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(110, 110, 115);
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 4.5);
    doc.text(lines, x, y);
    y += lines.length * 4.5;
  };

  const writeStrong = (text: string, x: number, size = 10) => {
    if (!text) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(17, 17, 17);
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 5);
    doc.text(lines, x, y);
    y += lines.length * 5;
  };

  const writeNormal = (text: string, x: number, size = 9) => {
    if (!text) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(17, 17, 17);
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 4.5);
    doc.text(lines, x, y);
    y += lines.length * 4.5;
  };

  const headerStartY = y;
  writeStrong(String(settings.business_name ?? ''), margin, 11);
  writeMuted(String(settings.email ?? ''), margin);
  writeMuted(addressLineOne, margin);
  writeMuted(addressLineTwo, margin);

  const rightX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 17, 17);
  doc.text(formatCurrency(totals.total), rightX, headerStartY + 4, { align: 'right' });

  const [r, g, b] = statusColor(invoice.status);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(r, g, b);
  doc.text(statusLabel(invoice.status), rightX, headerStartY + 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 115);
  doc.text('Invoice', rightX, headerStartY + 18, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(17, 17, 17);
  doc.text(String(invoice.number), rightX, headerStartY + 23, { align: 'right' });

  y = Math.max(y, headerStartY + 28) + 8;

  const billedToY = y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 115);
  doc.text('Billed to', margin, billedToY);
  y = billedToY + 6;
  writeStrong(clientDisplayName, margin);
  const secondary = clientSecondaryName(client);
  if (secondary) writeMuted(secondary, margin);
  if (client?.primaryEmail) writeMuted(client.primaryEmail, margin);
  if (client?.address) writeMuted(client.address, margin);

  const datesX = pageWidth - margin - 45;
  let datesY = billedToY;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 115);
  doc.text('Issued', datesX, datesY);
  datesY += 5;
  doc.setTextColor(17, 17, 17);
  doc.text(formatDateLong(invoice.issue_date), datesX, datesY);
  if (invoice.due_date) {
    datesY += 8;
    doc.setTextColor(110, 110, 115);
    doc.text('Due', datesX, datesY);
    datesY += 5;
    doc.setTextColor(17, 17, 17);
    doc.text(formatDateLong(String(invoice.due_date)), datesX, datesY);
  }

  y = Math.max(y, datesY + 10);

  const colDesc = margin;
  const colQty = margin + contentWidth * 0.55;
  const colAmount = pageWidth - margin;

  ensureSpace(10);
  doc.setDrawColor(229, 229, 229);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 115);
  doc.text('Description', colDesc, y);
  doc.text('Qty/Rate', colQty, y);
  doc.text('Amount', colAmount, y, { align: 'right' });
  y += 5;
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  for (const item of lineItems) {
    const description = String(item.description ?? '');
    const qtyRate = formatLineItemQtyRate(item);
    const amount = formatCurrency(Number(item.quantity ?? 0) * Number(item.rate ?? 0));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(17, 17, 17);

    const descLines = doc.splitTextToSize(description, contentWidth * 0.5);
    const rowHeight = Math.max(descLines.length * 4.5, 6);
    ensureSpace(rowHeight + 2);

    const rowY = y;
    doc.text(descLines, colDesc, rowY);
    doc.text(qtyRate, colQty, rowY);
    doc.text(amount, colAmount, rowY, { align: 'right' });
    y += rowHeight + 3;
  }

  y += 4;
  const totalsX = pageWidth - margin - 55;
  ensureSpace(28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 115);
  doc.text('Subtotal', totalsX, y);
  doc.setTextColor(17, 17, 17);
  doc.text(formatCurrency(totals.subtotal), colAmount, y, { align: 'right' });
  y += 6;

  if (invoice.tax_enabled) {
    doc.setTextColor(110, 110, 115);
    doc.text(`Tax (${invoice.tax_rate}%)`, totalsX, y);
    doc.setTextColor(17, 17, 17);
    doc.text(formatCurrency(totals.tax), colAmount, y, { align: 'right' });
    y += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 17, 17);
  doc.text('Total due', totalsX, y);
  doc.text(formatCurrency(totals.total), colAmount, y, { align: 'right' });
  y += 12;

  if (invoice.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 115);
    ensureSpace(8);
    doc.text('Notes', margin, y);
    y += 5;
    writeNormal(String(invoice.notes), margin);
    y += 4;
  }

  if (settings.payment_details) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 115);
    ensureSpace(8);
    doc.text('Payment', margin, y);
    y += 5;
    writeMuted(String(settings.payment_details), margin);
  }

  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1];
  if (!base64) {
    throw new Error('Failed to generate invoice PDF.');
  }
  return base64;
}
