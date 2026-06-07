export type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'overdue';

export type View = 'invoices' | 'clients' | 'calendar' | 'settings';

export type Panel =
  | { kind: 'clients' }
  | { kind: 'settings' }
  | { kind: 'calendar-day'; date: string }
  | { kind: 'invoice'; id: string }
  | { kind: 'edit-client'; id: string }
  | { kind: 'new-client' }
  | { kind: 'new-invoice' };

export type CalendarEntryType = 'hourly' | 'fixed';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  entryType?: CalendarEntryType;
  sourceCalendarEntryId?: string;
  sourceRecurringLineItemId?: string;
  sourceDate?: string;
}

export interface CalendarEntry {
  id: string;
  clientId: string;
  date: string;
  description: string;
  quantity: number;
  rate: number;
  entryType: CalendarEntryType;
  invoiceId?: string | null;
  recurringLineItemId?: string | null;
}

export interface RecurringLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  entryType: CalendarEntryType;
  dayOfMonth: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  number: string;
  issueDate: string;
  dueDate: string | null;
  lineItems: LineItem[];
  notes: string;
  taxEnabled: boolean;
  taxRate: number;
  status: InvoiceStatus;
  createdAt: string;
}

export interface ClientRate {
  id: string;
  label: string;
  rate: number;
}

export interface Client {
  id: string;
  companyName: string;
  owner: string;
  primaryEmail: string;
  hourlyRate: number;
  additionalEmails: string[];
  additionalRates: ClientRate[];
  recurringLineItems: RecurringLineItem[];
  address: string;
}

export interface Settings {
  businessName: string;
  email: string;
  businessAddress: string;
  mailingAddress: string;
  paymentDetails: string;
  defaultTaxRate: number;
  defaultDueDays: number;
  logo: string | null;
}

export interface AppData {
  invoices: Invoice[];
  clients: Client[];
  calendarEntries: CalendarEntry[];
  settings: Settings;
  nextInvoiceNumber: number;
}

export interface InvoiceDraft {
  clientId: string;
  clientName: string;
  number: string;
  issueDate: string;
  dueDate: string | null;
  lineItems: LineItem[];
  notes: string;
  taxEnabled: boolean;
  taxRate: number;
}

export function activeViewFromPanel(panel: Panel | null): View {
  if (!panel) return 'invoices';
  if (
    panel.kind === 'clients' ||
    panel.kind === 'edit-client' ||
    panel.kind === 'new-client'
  ) {
    return 'clients';
  }
  if (panel.kind === 'settings') return 'settings';
  if (panel.kind === 'calendar-day') return 'calendar';
  return 'invoices';
}
