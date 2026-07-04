import type { HistoricalInvoiceInput, InvoiceStoredStatus, LineItem } from '@/types';
import { compareInvoiceNumbers } from '@/lib/invoice';

export const HISTORICAL_CSV_TEMPLATE = `client,number,issue_date,due_date,status,paid_date,description,amount,tax_rate,notes
Mia Chen,INV-2019-001,2019-01-15,2019-02-15,paid,2019-02-10,Brand identity work,2400,0,
Mia Chen,INV-2019-002,2019-03-01,2019-03-31,unpaid,,Website copy,1400,0,Imported from previous app`;

export function newFixedHistoricalLineItem(description: string, amount: number): LineItem {
  return {
    id: crypto.randomUUID(),
    description,
    quantity: 1,
    rate: amount,
    entryType: 'fixed',
  };
}

export function normalizeHistoricalLineItem(item: LineItem): LineItem {
  const amount =
    item.entryType === 'fixed' ? item.rate : Math.max(0, item.quantity) * Math.max(0, item.rate);
  return {
    ...item,
    entryType: 'fixed',
    quantity: 1,
    rate: amount,
  };
}

const HISTORICAL_STATUSES = new Set<InvoiceStoredStatus>([
  'paid',
  'unpaid',
  'overdue',
  'draft',
  'payment_sent',
]);

export function isHistoricalInvoice(
  invoice: Pick<{ isHistorical?: boolean }, 'isHistorical'>
): boolean {
  return invoice.isHistorical === true;
}

export function historicalInvoiceLabel(): string {
  return 'Historical';
}

function detectDelimiter(text: string): ',' | '\t' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const tabs = firstLine.match(/\t/g)?.length ?? 0;
  const commas = firstLine.match(/,/g)?.length ?? 0;
  return tabs > commas ? '\t' : ',';
}

function parseCsvRows(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(normalized);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      cell = '';
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

const HEADER_ALIASES: Record<string, string> = {
  total: 'amount',
  line_total: 'amount',
  invoice_total: 'amount',
  invoice_amount: 'amount',
  subtotal: 'amount',
  inv_number: 'number',
  invoice_number: 'number',
  invoice_no: 'number',
  invoiceno: 'number',
  customer: 'client',
  client_name: 'client',
  company: 'client',
  issued: 'issue_date',
  issued_date: 'issue_date',
  invoice_date: 'issue_date',
  due: 'due_date',
  paid: 'paid_date',
  payment_date: 'paid_date',
  tax: 'tax_rate',
};

function canonicalHeader(header: string): string {
  const normalized = normalizeHeader(header);
  return HEADER_ALIASES[normalized] ?? normalized;
}

function buildHeaderIndex(rawHeaders: string[]): {
  headers: string[];
  index: Record<string, number>;
} {
  const index: Record<string, number> = {};
  for (let i = 0; i < rawHeaders.length; i += 1) {
    const canonical = canonicalHeader(rawHeaders[i]);
    if (!(canonical in index)) {
      index[canonical] = i;
    }
  }
  return { headers: Object.keys(index), index };
}

function parseDate(value: string, field: string, rowNumber: number): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const excelSerial = Number(trimmed);
  if (Number.isFinite(excelSerial) && excelSerial > 30_000 && excelSerial < 100_000) {
    const ms = (excelSerial - 25_569) * 86_400_000;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  throw new Error(
    `Row ${rowNumber}: ${field} must be YYYY-MM-DD or M/D/YYYY (got "${trimmed}").`
  );
}

function normalizeStatus(value: string): InvoiceStoredStatus | null {
  const raw = value.trim().toLowerCase();
  const aliases: Record<string, InvoiceStoredStatus> = {
    sent: 'unpaid',
    open: 'unpaid',
    outstanding: 'unpaid',
    closed: 'paid',
    complete: 'paid',
    completed: 'paid',
    pending: 'unpaid',
  };
  if (aliases[raw]) return aliases[raw];
  if (HISTORICAL_STATUSES.has(raw as InvoiceStoredStatus)) {
    return raw as InvoiceStoredStatus;
  }
  return null;
}

function parseStatus(value: string, rowNumber: number): InvoiceStoredStatus {
  const status = normalizeStatus(value);
  if (!status) {
    throw new Error(
      `Row ${rowNumber}: status must be paid, unpaid, overdue, draft, or payment_sent (got "${value.trim()}").`
    );
  }
  return status;
}

function parseNumber(value: string, field: string, rowNumber: number): number {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Row ${rowNumber}: ${field} is required.`);
  const normalized = trimmed.replace(/[$,\s]/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowNumber}: ${field} must be a number (got "${trimmed}").`);
  }
  return parsed;
}

function invoiceKey(client: string, number: string): string {
  return `${client.trim().toLowerCase()}::${number.trim().toLowerCase()}`;
}

function newLineItem(description: string, amount: number): LineItem {
  return newFixedHistoricalLineItem(description, amount);
}

function resolveLineItemAmount(
  read: (column: string) => string,
  index: Record<string, number>,
  rowNumber: number
): number {
  const headers = Object.keys(index);
  if (headers.includes('amount')) {
    return parseNumber(read('amount'), 'amount', rowNumber);
  }

  if (headers.includes('quantity') && headers.includes('rate')) {
    const quantity = parseNumber(read('quantity'), 'quantity', rowNumber);
    const rate = parseNumber(read('rate'), 'rate', rowNumber);
    return quantity * rate;
  }

  throw new Error(`Row ${rowNumber}: amount is required (or legacy quantity and rate columns).`);
}

export type ParsedHistoricalCsv = {
  invoices: HistoricalInvoiceInput[];
  errors: string[];
};

export function parseHistoricalCsv(text: string): ParsedHistoricalCsv {
  const errors: string[] = [];
  const rows = parseCsvRows(text.trim());
  if (rows.length === 0) {
    return { invoices: [], errors: ['CSV is empty.'] };
  }

  const { headers, index } = buildHeaderIndex(rows[0]);
  const hasAmount = headers.includes('amount');
  const hasLegacyQtyRate = headers.includes('quantity') && headers.includes('rate');
  const required = ['client', 'number', 'issue_date', 'status', 'description'];
  for (const column of required) {
    if (!headers.includes(column)) {
      return { invoices: [], errors: [`Missing required column: ${column}`] };
    }
  }
  if (!hasAmount && !hasLegacyQtyRate) {
    return {
      invoices: [],
      errors: [
        'Missing required column: amount. Use a single `amount` column for fixed invoice totals — quantity and rate are not required.',
      ],
    };
  }

  const grouped = new Map<
    string,
    {
      clientName: string;
      number: string;
      issueDate: string;
      dueDate: string | null;
      status: InvoiceStoredStatus;
      paidAt: string | null;
      taxRate: number;
      notes: string;
      lineItems: LineItem[];
      createdAt: string;
    }
  >();

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowNumber = rowIndex + 1;
    if (row.every((cell) => !cell.trim())) continue;

    try {
      const read = (column: string): string => row[index[column]] ?? '';
      const clientName = read('client').trim();
      const number = read('number').trim();
      if (!clientName) throw new Error(`Row ${rowNumber}: client is required.`);
      if (!number) throw new Error(`Row ${rowNumber}: number is required.`);

      const description = read('description').trim();
      if (!description) throw new Error(`Row ${rowNumber}: description is required.`);
      const amount = resolveLineItemAmount(read, index, rowNumber);

      const key = invoiceKey(clientName, number);
      let group = grouped.get(key);

      if (!group) {
        const issueDate = parseDate(read('issue_date'), 'issue_date', rowNumber);
        if (!issueDate) throw new Error(`Row ${rowNumber}: issue_date is required.`);
        const status = parseStatus(read('status'), rowNumber);
        const dueDate = parseDate(read('due_date'), 'due_date', rowNumber);
        const paidDateRaw = read('paid_date');
        const paidAt =
          status === 'paid'
            ? parseDate(paidDateRaw, 'paid_date', rowNumber) ?? issueDate
            : parseDate(paidDateRaw, 'paid_date', rowNumber);
        const taxRateRaw = read('tax_rate').trim();
        const taxRate = taxRateRaw ? parseNumber(taxRateRaw, 'tax_rate', rowNumber) : 0;
        const notes = read('notes').trim();

        group = {
          clientName,
          number,
          issueDate: issueDate!,
          dueDate,
          status,
          paidAt,
          taxRate,
          notes,
          lineItems: [],
          createdAt: issueDate!,
        };
        grouped.set(key, group);
      }

      group.lineItems.push(newLineItem(description, amount));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Row ${rowNumber}: Invalid row.`);
    }
  }

  const invoices: HistoricalInvoiceInput[] = [];
  for (const group of grouped.values()) {
    invoices.push({
      clientId: '',
      clientName: group.clientName,
      number: group.number,
      issueDate: group.issueDate,
      dueDate: group.dueDate,
      lineItems: group.lineItems,
      notes: group.notes,
      taxEnabled: group.taxRate > 0,
      taxRate: group.taxRate,
      status: group.status,
      paidAt: group.status === 'paid' ? group.paidAt ?? group.issueDate : null,
      createdAt: group.createdAt,
    });
  }

  invoices.sort((a, b) => {
    const dateCmp = a.issueDate.localeCompare(b.issueDate);
    if (dateCmp !== 0) return dateCmp;
    return compareInvoiceNumbers(a.number, b.number);
  });

  return { invoices, errors };
}

export function validateHistoricalInput(input: HistoricalInvoiceInput): string | null {
  if (!input.clientName.trim()) return 'Client is required.';
  if (!input.number.trim()) return 'Invoice number is required.';
  if (!input.issueDate) return 'Issue date is required.';
  if (input.lineItems.length === 0) return 'Add at least one line item.';
  if (input.lineItems.some((item) => !item.description.trim())) {
    return 'Every line item needs a description.';
  }
  if (input.lineItems.some((item) => item.rate <= 0)) {
    return 'Every line item needs an amount greater than zero.';
  }
  if (input.status === 'paid' && !input.paidAt) {
    return 'Paid date is required for paid invoices.';
  }
  return null;
}
