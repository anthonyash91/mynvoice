export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export type View = 'invoices' | 'clients' | 'settings';

export type Panel =
  | { kind: 'clients' }
  | { kind: 'settings' }
  | { kind: 'invoice'; id: string }
  | { kind: 'edit-client'; id: string }
  | { kind: 'new-client' }
  | { kind: 'new-invoice' };

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  number: string;
  issueDate: string;
  dueDate: string;
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
  address: string;
}

export interface Settings {
  businessName: string;
  email: string;
  businessAddress: string;
  mailingAddress: string;
  paymentDetails: string;
  defaultTaxRate: number;
  logo: string | null;
}

export interface AppData {
  invoices: Invoice[];
  clients: Client[];
  settings: Settings;
  nextInvoiceNumber: number;
}

export interface InvoiceDraft {
  clientId: string;
  clientName: string;
  number: string;
  issueDate: string;
  dueDate: string;
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
  return 'invoices';
}
