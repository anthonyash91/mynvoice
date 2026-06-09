export type InvoiceStoredStatus = 'draft' | 'unpaid' | 'overdue' | 'paid' | 'payment_sent';
export type InvoiceStatus = InvoiceStoredStatus | 'overdue';

export type View = 'invoices' | 'clients' | 'calendar' | 'history' | 'settings' | 'templates';

export type Panel =
  | { kind: 'clients' }
  | { kind: 'history' }
  | { kind: 'settings' }
  | { kind: 'templates' }
  | { kind: 'calendar-day'; date: string }
  | { kind: 'invoice'; id: string; from?: 'history' }
  | { kind: 'edit-invoice'; id: string; from?: 'history' }
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
  status: InvoiceStoredStatus;
  publicToken: string | null;
  paidAt: string | null;
  emailSendCount: number;
  lastEmailSentAt: string | null;
  lastEmailSentKind: EmailTemplateKind | null;
  remindersPaused: boolean;
  reminderSnoozeUntil: string | null;
  reminderIntervalDaysOverride: number | null;
  lateReminderIntervalDaysOverride: number | null;
  createdAt: string;
}

export interface InvoiceReminderSettings {
  remindersPaused: boolean;
  reminderSnoozeUntil: string | null;
  reminderIntervalDaysOverride: number | null;
  lateReminderIntervalDaysOverride: number | null;
}

export interface ClientRate {
  id: string;
  label: string;
  rate: number;
}

export interface RecurringCalendarExclusion {
  clientId: string;
  recurringLineItemId: string;
  monthKey: string;
}

export type ClientRecurringCalendarExclusion = Omit<
  RecurringCalendarExclusion,
  'clientId'
>;

export interface Client {
  id: string;
  companyName: string;
  owner: string;
  primaryEmail: string;
  hourlyRate: number;
  additionalEmails: string[];
  additionalRates: ClientRate[];
  recurringLineItems: RecurringLineItem[];
  recurringCalendarExclusions: ClientRecurringCalendarExclusion[];
  address: string;
  reminderIntervalDays: number | null;
  lateReminderIntervalDays: number | null;
}

export type EmailTemplateKind = 'unpaid' | 'reminder' | 'late' | 'payment_received';

export interface EmailTemplate {
  subject: string;
  html: string;
  css: string;
  /** @deprecated Legacy combined body; migrated on load */
  body?: string;
}

export interface EmailTemplates {
  unpaid: EmailTemplate;
  reminder: EmailTemplate;
  late: EmailTemplate;
  payment_received: EmailTemplate;
}

export interface Settings {
  businessName: string;
  email: string;
  businessAddress: string;
  mailingAddress: string;
  paymentDetails: string;
  defaultTaxRate: number;
  defaultDueDays: number;
  reminderIntervalDays: number;
  lateReminderIntervalDays: number;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalSandbox: boolean;
  logo: string | null;
  emailTemplates: EmailTemplates;
}

export interface EmailHistoryEntry {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string;
  clientName: string;
  emailKind: EmailTemplateKind;
  sentAt: string;
}

export interface AppData {
  invoices: Invoice[];
  clients: Client[];
  calendarEntries: CalendarEntry[];
  recurringCalendarExclusions: RecurringCalendarExclusion[];
  emailHistory: EmailHistoryEntry[];
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
  if (panel.kind === 'history') return 'history';
  if (panel.kind === 'settings') return 'settings';
  if (panel.kind === 'templates') return 'templates';
  if (panel.kind === 'calendar-day') return 'calendar';
  return 'invoices';
}
