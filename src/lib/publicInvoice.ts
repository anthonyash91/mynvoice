import { supabase } from '@/lib/supabase';
import type { Client, Invoice, InvoiceStoredStatus, Settings } from '@/types';

export type PublicInvoiceClient = Pick<
  Client,
  'companyName' | 'owner' | 'primaryEmail' | 'additionalEmails' | 'address'
>;

export interface PublicInvoicePayload {
  invoice: Omit<Invoice, 'id' | 'publicToken'> & { status: InvoiceStoredStatus | 'paid' };
  settings: Pick<
    Settings,
    | 'businessName'
    | 'email'
    | 'businessAddress'
    | 'mailingAddress'
    | 'paymentDetails'
    | 'defaultTaxRate'
    | 'defaultDueDays'
    | 'logo'
  >;
  client: PublicInvoiceClient;
}

interface PublicInvoiceResponse {
  invoice: PublicInvoicePayload['invoice'];
  settings: PublicInvoicePayload['settings'];
  client?: PublicInvoiceClient | null;
  ok?: boolean;
  notifiedOwner?: boolean;
  alreadyPaid?: boolean;
  invoiceNumber?: string;
  clientName?: string;
  error?: string;
}

async function invokeInvoicePublic(body: Record<string, string>): Promise<PublicInvoiceResponse> {
  const { data, error } = await supabase.functions.invoke('invoice-public', { body });

  if (error) {
    throw new Error(error.message || 'Failed to reach the invoice service.');
  }

  const response = data as PublicInvoiceResponse;
  if (response?.error) {
    throw new Error(response.error);
  }

  return response;
}

function normalizePublicClient(
  client: PublicInvoiceClient | null | undefined,
  invoiceClientName: string
): PublicInvoiceClient {
  const companyName = client?.companyName?.trim() ?? '';
  const owner = client?.owner?.trim() ?? '';
  const invoiceName = invoiceClientName.trim();

  return {
    companyName,
    owner: owner || (companyName ? '' : invoiceName),
    primaryEmail: client?.primaryEmail?.trim() ?? '',
    additionalEmails: client?.additionalEmails ?? [],
    address: client?.address?.trim() ?? '',
  };
}

function mergePublicSettings(
  previous: PublicInvoicePayload['settings'],
  next: PublicInvoicePayload['settings']
): PublicInvoicePayload['settings'] {
  return {
    businessName: next.businessName || previous.businessName,
    email: next.email || previous.email,
    businessAddress: next.businessAddress || previous.businessAddress,
    mailingAddress: next.mailingAddress || previous.mailingAddress,
    paymentDetails: next.paymentDetails || previous.paymentDetails,
    defaultTaxRate: next.defaultTaxRate ?? previous.defaultTaxRate,
    defaultDueDays: next.defaultDueDays ?? previous.defaultDueDays,
    logo: next.logo ?? previous.logo,
  };
}

function mergePublicClient(
  previous: PublicInvoiceClient,
  next: PublicInvoiceClient,
  invoiceClientName: string
): PublicInvoiceClient {
  const normalized = normalizePublicClient(next, invoiceClientName);

  return {
    companyName: normalized.companyName || previous.companyName,
    owner: normalized.owner || previous.owner,
    primaryEmail: normalized.primaryEmail || previous.primaryEmail,
    additionalEmails:
      normalized.additionalEmails.length > 0
        ? normalized.additionalEmails
        : previous.additionalEmails,
    address: normalized.address || previous.address,
  };
}

function normalizePublicPayload(response: PublicInvoiceResponse): PublicInvoicePayload {
  return {
    invoice: response.invoice,
    settings: response.settings,
    client: normalizePublicClient(response.client, response.invoice.clientName),
  };
}

/** Keep full invoice display data when a partial API response follows payment-sent. */
export function mergePublicInvoicePayload(
  previous: PublicInvoicePayload,
  next: PublicInvoicePayload
): PublicInvoicePayload {
  return {
    invoice: next.invoice,
    settings: mergePublicSettings(previous.settings, next.settings),
    client: mergePublicClient(previous.client, next.client, next.invoice.clientName),
  };
}

export async function fetchPublicInvoice(token: string): Promise<PublicInvoicePayload> {
  const response = await invokeInvoicePublic({ action: 'get', token });
  return normalizePublicPayload(response);
}

export async function markPublicPaymentSent(token: string): Promise<PublicInvoicePayload> {
  const response = await invokeInvoicePublic({ action: 'mark_payment_sent', token });
  return normalizePublicPayload(response);
}

export async function confirmPublicPayment(token: string): Promise<{
  invoiceNumber: string;
  clientName: string;
  alreadyPaid: boolean;
}> {
  const response = await invokeInvoicePublic({ action: 'confirm_payment', token });
  return {
    invoiceNumber: response.invoiceNumber ?? response.invoice?.number ?? '',
    clientName: response.clientName ?? response.invoice?.clientName ?? '',
    alreadyPaid: Boolean(response.alreadyPaid),
  };
}

export function publicClientToClient(
  client: PublicInvoiceClient | null | undefined,
  invoice: PublicInvoicePayload['invoice']
): Client {
  const normalized = normalizePublicClient(client, invoice.clientName);

  return {
    id: invoice.clientId,
    companyName: normalized.companyName,
    owner: normalized.owner,
    primaryEmail: normalized.primaryEmail,
    hourlyRate: 0,
    additionalEmails: normalized.additionalEmails,
    additionalRates: [],
    recurringLineItems: [],
    recurringCalendarExclusions: [],
    address: normalized.address,
  };
}

export function publicInvoiceToInvoice(
  invoice: PublicInvoicePayload['invoice']
): Invoice {
  return {
    id: 'public',
    clientId: invoice.clientId,
    clientName: invoice.clientName,
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    lineItems: invoice.lineItems,
    notes: invoice.notes,
    taxEnabled: invoice.taxEnabled,
    taxRate: invoice.taxRate,
    status: invoice.status as Invoice['status'],
    publicToken: null,
    paidAt: null,
    createdAt: invoice.createdAt,
  };
}
