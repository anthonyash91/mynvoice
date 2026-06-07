export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export type View = 'invoices' | 'clients' | 'settings';

export type Panel =
  | { kind: 'invoice'; id: string }
  | { kind: 'client'; id: string }
  | { kind: 'new-client' }
  | { kind: 'new-invoice' }
  | null;

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

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
}

export interface Settings {
  businessName: string;
  email: string;
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
