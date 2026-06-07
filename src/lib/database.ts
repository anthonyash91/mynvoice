import { clientInvoiceName } from '@/lib/client';
import { supabase } from '@/lib/supabase';
import type {
  AppData,
  CalendarEntry,
  CalendarEntryType,
  Client,
  ClientRate,
  RecurringLineItem,
  Invoice,
  InvoiceDraft,
  LineItem,
  Settings,
} from '@/types';

type ClientSchema = 'renamed' | 'legacy';

interface ClientDbConfig {
  schema: ClientSchema;
  extended: boolean;
  selectColumns: string;
}

const CLIENT_DB_ATTEMPTS: ClientDbConfig[] = [
  {
    schema: 'renamed',
    extended: true,
    selectColumns:
      'id, owner, company_name, primary_email, hourly_rate, additional_emails, additional_rates, recurring_line_items, address',
  },
  {
    schema: 'legacy',
    extended: true,
    selectColumns:
      'id, name, company, email, hourly_rate, additional_emails, additional_rates, recurring_line_items, address',
  },
  {
    schema: 'renamed',
    extended: true,
    selectColumns:
      'id, owner, company_name, primary_email, hourly_rate, additional_emails, additional_rates, address',
  },
  {
    schema: 'legacy',
    extended: true,
    selectColumns:
      'id, name, company, email, hourly_rate, additional_emails, additional_rates, address',
  },
  {
    schema: 'renamed',
    extended: false,
    selectColumns: 'id, owner, company_name, primary_email',
  },
  {
    schema: 'legacy',
    extended: false,
    selectColumns: 'id, name, company, email',
  },
];

let clientDbConfig: ClientDbConfig | null = null;

interface DbClient {
  id: string;
  name?: string;
  company?: string;
  email?: string;
  owner?: string;
  company_name?: string;
  primary_email?: string;
  hourly_rate?: number;
  additional_emails?: string[];
  additional_rates?: ClientRate[];
  recurring_line_items?: RecurringLineItem[];
  address?: string;
}

interface DbInvoice {
  id: string;
  client_id: string | null;
  client_name: string;
  number: string;
  issue_date: string;
  due_date: string | null;
  line_items: LineItem[];
  notes: string;
  tax_enabled: boolean;
  tax_rate: number;
  status: Invoice['status'];
  created_at: string;
}

interface DbCalendarEntry {
  id: string;
  client_id: string;
  entry_date: string;
  description: string;
  quantity: number;
  rate: number;
  entry_type?: CalendarEntryType;
  invoice_id?: string | null;
  recurring_line_item_id?: string | null;
}

const CALENDAR_ENTRY_SELECT =
  'id, client_id, entry_date, description, quantity, rate, entry_type, invoice_id, recurring_line_item_id';

interface DbSettings {
  business_name: string;
  email: string;
  business_address: string;
  mailing_address: string;
  payment_details: string;
  default_tax_rate: number;
  default_due_days: number;
  logo: string | null;
  next_invoice_number: number;
}

function toClient(row: DbClient): Client {
  return {
    id: row.id,
    companyName: row.company_name ?? row.company ?? '',
    owner: row.owner ?? row.name ?? '',
    primaryEmail: row.primary_email ?? row.email ?? '',
    hourlyRate: Number(row.hourly_rate ?? 0),
    additionalEmails: row.additional_emails ?? [],
    additionalRates: row.additional_rates ?? [],
    recurringLineItems: row.recurring_line_items ?? [],
    address: row.address ?? '',
  };
}

function clientSelectColumns(
  config: ClientDbConfig,
  includeRecurringLineItems: boolean
): string {
  if (!config.extended || !includeRecurringLineItems) {
    return config.selectColumns;
  }
  if (config.selectColumns.includes('recurring_line_items')) {
    return config.selectColumns;
  }
  return `${config.selectColumns}, recurring_line_items`;
}

function clientToRow(
  userId: string,
  client: Omit<Client, 'id'>,
  config: ClientDbConfig,
  includeRecurringLineItems: boolean
) {
  const row: Record<string, unknown> =
    config.schema === 'renamed'
      ? {
          user_id: userId,
          owner: client.owner,
          company_name: client.companyName,
          primary_email: client.primaryEmail,
        }
      : {
          user_id: userId,
          name: client.owner,
          company: client.companyName,
          email: client.primaryEmail,
        };

  if (config.extended) {
    row.hourly_rate = client.hourlyRate;
    row.additional_emails = client.additionalEmails;
    row.additional_rates = client.additionalRates;
    if (includeRecurringLineItems) {
      row.recurring_line_items = client.recurringLineItems;
    }
    row.address = client.address;
  }

  return row;
}

function isMissingColumnError(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes('does not exist'));
}

async function resolveClientDbConfig(userId: string): Promise<ClientDbConfig> {
  if (clientDbConfig) return clientDbConfig;

  for (const attempt of CLIENT_DB_ATTEMPTS) {
    const { error } = await supabase
      .from('clients')
      .select(attempt.selectColumns)
      .eq('user_id', userId)
      .limit(1);

    if (!error) {
      clientDbConfig = attempt;
      return attempt;
    }
    if (!isMissingColumnError(error)) throw error;
  }

  throw new Error('Unrecognized clients table schema');
}

async function resolveRecurringLineItemsSupport(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('clients')
    .select('recurring_line_items')
    .eq('user_id', userId)
    .limit(1);

  return !error;
}

function isMissingRecurringColumnError(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes('recurring_line_items'));
}

async function fetchClients(userId: string): Promise<Client[]> {
  const config = await resolveClientDbConfig(userId);
  const includeRecurring = await resolveRecurringLineItemsSupport(userId);
  const { data, error } = await supabase
    .from('clients')
    .select(clientSelectColumns(config, includeRecurring))
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((row) => toClient(row as unknown as DbClient));
}

function toCalendarEntry(row: DbCalendarEntry): CalendarEntry {
  return {
    id: row.id,
    clientId: row.client_id,
    date: row.entry_date,
    description: row.description,
    quantity: Number(row.quantity),
    rate: Number(row.rate),
    entryType: row.entry_type ?? 'hourly',
    invoiceId: row.invoice_id ?? null,
    recurringLineItemId: row.recurring_line_item_id ?? null,
  };
}

function toInvoice(row: DbInvoice): Invoice {
  return {
    id: row.id,
    clientId: row.client_id ?? '',
    clientName: row.client_name,
    number: row.number,
    issueDate: row.issue_date,
    dueDate: row.due_date ?? null,
    lineItems: row.line_items,
    notes: row.notes,
    taxEnabled: row.tax_enabled,
    taxRate: Number(row.tax_rate),
    status: row.status,
    createdAt: row.created_at,
  };
}

function toSettings(row: DbSettings): Settings {
  return {
    businessName: row.business_name,
    email: row.email,
    businessAddress: row.business_address ?? '',
    mailingAddress: row.mailing_address ?? '',
    paymentDetails: row.payment_details,
    defaultTaxRate: Number(row.default_tax_rate),
    defaultDueDays: Number(row.default_due_days ?? 14),
    logo: row.logo,
  };
}

function invoiceToRow(
  userId: string,
  invoice: Invoice
): Omit<DbInvoice, 'id'> & { user_id: string; id?: string } {
  return {
    user_id: userId,
    id: invoice.id,
    client_id: invoice.clientId || null,
    client_name: invoice.clientName,
    number: invoice.number,
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate,
    line_items: invoice.lineItems,
    notes: invoice.notes,
    tax_enabled: invoice.taxEnabled,
    tax_rate: invoice.taxRate,
    status: invoice.status,
    created_at: invoice.createdAt,
  };
}

function draftToInvoice(
  draft: InvoiceDraft,
  status: Invoice['status'],
  id: string,
  createdAt: string
): Invoice {
  return {
    id,
    clientId: draft.clientId,
    clientName: draft.clientName,
    number: draft.number,
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    lineItems: draft.lineItems,
    notes: draft.notes,
    taxEnabled: draft.taxEnabled,
    taxRate: draft.taxRate,
    status,
    createdAt,
  };
}

async function ensureUserSettings(userId: string): Promise<DbSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id' })
    .select(
      'business_name, email, business_address, mailing_address, payment_details, default_tax_rate, default_due_days, logo, next_invoice_number'
    )
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAppData(userId: string): Promise<AppData> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated. Please sign in again.');

  const [clients, invoicesRes, calendarRes, settingsRow] = await Promise.all([
    fetchClients(userId),
    supabase
      .from('invoices')
      .select(
        'id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, created_at'
      )
      .eq('user_id', userId),
    supabase
      .from('calendar_entries')
      .select(CALENDAR_ENTRY_SELECT)
      .eq('user_id', userId)
      .order('entry_date', { ascending: true }),
    ensureUserSettings(userId),
  ]);

  if (invoicesRes.error) throw invoicesRes.error;
  if (calendarRes.error) throw calendarRes.error;

  return {
    clients,
    invoices: (invoicesRes.data ?? []).map(toInvoice),
    calendarEntries: (calendarRes.data ?? []).map((row) =>
      toCalendarEntry(row as DbCalendarEntry)
    ),
    settings: toSettings(settingsRow),
    nextInvoiceNumber: settingsRow.next_invoice_number,
  };
}

export async function upsertSettings(userId: string, settings: Settings): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: userId,
      business_name: settings.businessName,
      email: settings.email,
      business_address: settings.businessAddress,
      mailing_address: settings.mailingAddress,
      payment_details: settings.paymentDetails,
      default_tax_rate: settings.defaultTaxRate,
      default_due_days: settings.defaultDueDays,
      logo: settings.logo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export async function insertClient(
  userId: string,
  client: Omit<Client, 'id'>
): Promise<Client> {
  const config = await resolveClientDbConfig(userId);
  let includeRecurring = await resolveRecurringLineItemsSupport(userId);
  let row = clientToRow(userId, client, config, includeRecurring);
  let selectColumns = clientSelectColumns(config, includeRecurring);

  let { data, error } = await supabase
    .from('clients')
    .insert(row)
    .select(selectColumns)
    .single();

  if (error && includeRecurring && isMissingRecurringColumnError(error)) {
    includeRecurring = false;
    row = clientToRow(userId, client, config, false);
    selectColumns = clientSelectColumns(config, false);
    ({ data, error } = await supabase
      .from('clients')
      .insert(row)
      .select(selectColumns)
      .single());
  }

  if (error) throw error;
  if (!data) throw new Error('Failed to create client');
  return toClient(data as unknown as DbClient);
}

export async function updateClientRow(userId: string, client: Client): Promise<Client> {
  const config = await resolveClientDbConfig(userId);
  let includeRecurring = await resolveRecurringLineItemsSupport(userId);
  let row = clientToRow(userId, client, config, includeRecurring);
  let selectColumns = clientSelectColumns(config, includeRecurring);

  let { data, error } = await supabase
    .from('clients')
    .update(row)
    .eq('user_id', userId)
    .eq('id', client.id)
    .select(selectColumns)
    .single();

  if (error && includeRecurring && isMissingRecurringColumnError(error)) {
    includeRecurring = false;
    row = clientToRow(userId, client, config, false);
    selectColumns = clientSelectColumns(config, false);
    ({ data, error } = await supabase
      .from('clients')
      .update(row)
      .eq('user_id', userId)
      .eq('id', client.id)
      .select(selectColumns)
      .single());
  }

  if (error) throw error;
  if (!data) throw new Error('Failed to update client');

  await supabase
    .from('invoices')
    .update({ client_name: clientInvoiceName(client) })
    .eq('user_id', userId)
    .eq('client_id', client.id);

  return toClient(data as unknown as DbClient);
}

export async function deleteClientRow(userId: string, clientId: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('user_id', userId)
    .eq('id', clientId);
  if (error) throw error;
}

async function resolveInvoiceClientId(
  userId: string,
  draft: InvoiceDraft
): Promise<{ clientId: string; newClient?: Client }> {
  let clientId = draft.clientId;
  let newClient: Client | undefined;

  if (!clientId && draft.clientName.trim()) {
    const config = await resolveClientDbConfig(userId);
    const { data: existingClients } = await supabase
      .from('clients')
      .select(config.selectColumns)
      .eq('user_id', userId);

    const trimmed = draft.clientName.trim().toLowerCase();
    const match = (existingClients ?? []).find((row) => {
      const c = toClient(row as unknown as DbClient);
      const owner = c.owner.toLowerCase();
      const company = c.companyName.toLowerCase();
      return owner === trimmed || company === trimmed;
    });

    if (match) {
      clientId = toClient(match as unknown as DbClient).id;
    } else {
      newClient = await insertClient(userId, {
        companyName: '',
        owner: draft.clientName.trim(),
        primaryEmail: '',
        hourlyRate: 0,
        additionalEmails: [],
        additionalRates: [],
        recurringLineItems: [],
        address: '',
      });
      clientId = newClient.id;
    }
  }

  return { clientId, newClient };
}

export async function saveInvoice(
  userId: string,
  draft: InvoiceDraft,
  status: Invoice['status'],
  existingId?: string,
  existingCreatedAt?: string
): Promise<{ invoice: Invoice; nextInvoiceNumber: number; newClient?: Client }> {
  const { clientId, newClient } = await resolveInvoiceClientId(userId, draft);

  let byNumberQuery = supabase
    .from('invoices')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('number', draft.number);

  byNumberQuery = clientId
    ? byNumberQuery.eq('client_id', clientId)
    : byNumberQuery.is('client_id', null);

  const byNumber = await byNumberQuery.maybeSingle();

  if (byNumber.error) throw byNumber.error;

  const isNew = !existingId && !byNumber.data;
  const id = existingId ?? byNumber.data?.id ?? crypto.randomUUID();
  const createdAt =
    existingCreatedAt ?? byNumber.data?.created_at ?? new Date().toISOString().split('T')[0];

  const invoice = draftToInvoice({ ...draft, clientId }, status, id, createdAt);
  const row = invoiceToRow(userId, invoice);
  const { id: _rowId, ...updateFields } = row;

  const selectCols =
    'id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, created_at';

  let data: DbInvoice;
  if (!isNew) {
    const { data: updated, error } = await supabase
      .from('invoices')
      .update(updateFields)
      .eq('user_id', userId)
      .eq('id', id)
      .select(selectCols)
      .single();
    if (error) throw error;
    data = updated;
  } else {
    const { data: inserted, error } = await supabase
      .from('invoices')
      .insert(row)
      .select(selectCols)
      .single();
    if (error) throw error;
    data = inserted;
  }

  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('next_invoice_number')
    .eq('user_id', userId)
    .single();
  if (settingsError) throw settingsError;

  return {
    invoice: toInvoice(data),
    nextInvoiceNumber: settings.next_invoice_number,
    newClient,
  };
}

export async function updateInvoiceStatusRow(
  userId: string,
  invoiceId: string,
  status: Invoice['status']
): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('user_id', userId)
    .eq('id', invoiceId)
    .select(
      'id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, created_at'
    )
    .single();
  if (error) throw error;
  return toInvoice(data);
}

export async function insertCalendarEntry(
  userId: string,
  entry: Omit<CalendarEntry, 'id'>
): Promise<CalendarEntry> {
  const { data, error } = await supabase
    .from('calendar_entries')
    .insert({
      user_id: userId,
      client_id: entry.clientId,
      entry_date: entry.date,
      description: entry.description,
      quantity: entry.quantity,
      rate: entry.rate,
      entry_type: entry.entryType,
      recurring_line_item_id: entry.recurringLineItemId ?? null,
    })
    .select(CALENDAR_ENTRY_SELECT)
    .single();
  if (error) throw error;
  return toCalendarEntry(data as DbCalendarEntry);
}

export async function updateCalendarEntryRow(
  userId: string,
  entry: CalendarEntry
): Promise<CalendarEntry> {
  const { data, error } = await supabase
    .from('calendar_entries')
    .update({
      client_id: entry.clientId,
      entry_date: entry.date,
      description: entry.description,
      quantity: entry.quantity,
      rate: entry.rate,
      entry_type: entry.entryType,
      recurring_line_item_id: entry.recurringLineItemId ?? null,
    })
    .eq('user_id', userId)
    .eq('id', entry.id)
    .select(CALENDAR_ENTRY_SELECT)
    .single();
  if (error) throw error;
  return toCalendarEntry(data as DbCalendarEntry);
}

export async function markCalendarEntriesBilled(
  userId: string,
  entryIds: string[],
  invoiceId: string
): Promise<CalendarEntry[]> {
  if (entryIds.length === 0) return [];

  const { data, error } = await supabase
    .from('calendar_entries')
    .update({ invoice_id: invoiceId })
    .eq('user_id', userId)
    .in('id', entryIds)
    .is('invoice_id', null)
    .select(CALENDAR_ENTRY_SELECT);

  if (error) throw error;
  return (data ?? []).map((row) => toCalendarEntry(row as DbCalendarEntry));
}

export async function unbillCalendarEntriesForInvoice(
  userId: string,
  invoiceId: string
): Promise<CalendarEntry[]> {
  const { data, error } = await supabase
    .from('calendar_entries')
    .update({ invoice_id: null })
    .eq('user_id', userId)
    .eq('invoice_id', invoiceId)
    .select(CALENDAR_ENTRY_SELECT);

  if (error) throw error;
  return (data ?? []).map((row) => toCalendarEntry(row as DbCalendarEntry));
}

export async function deleteCalendarEntryRow(userId: string, entryId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_entries')
    .delete()
    .eq('user_id', userId)
    .eq('id', entryId);
  if (error) throw error;
}

export async function deleteCalendarEntryRows(
  userId: string,
  entryIds: string[]
): Promise<void> {
  if (entryIds.length === 0) return;
  const { error } = await supabase
    .from('calendar_entries')
    .delete()
    .eq('user_id', userId)
    .in('id', entryIds);
  if (error) throw error;
}

export async function deleteInvoiceRow(userId: string, invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('user_id', userId)
    .eq('id', invoiceId);
  if (error) throw error;
}

export async function importLocalData(userId: string, data: AppData): Promise<AppData> {
  await upsertSettings(userId, data.settings);

  const { error: settingsError } = await supabase
    .from('user_settings')
    .update({ next_invoice_number: data.nextInvoiceNumber })
    .eq('user_id', userId);
  if (settingsError) throw settingsError;

  const clientIdMap = new Map<string, string>();
  for (const client of data.clients) {
    const created = await insertClient(userId, client);
    clientIdMap.set(client.id, created.id);
  }

  if (data.invoices.length > 0) {
    const rows = data.invoices.map((invoice) => ({
      user_id: userId,
      client_id: clientIdMap.get(invoice.clientId) ?? null,
      client_name: invoice.clientName,
      number: invoice.number,
      issue_date: invoice.issueDate,
      due_date: invoice.dueDate,
      line_items: invoice.lineItems,
      notes: invoice.notes,
      tax_enabled: invoice.taxEnabled,
      tax_rate: invoice.taxRate,
      status: invoice.status,
      created_at: invoice.createdAt,
    }));
    const { error: invoicesError } = await supabase.from('invoices').insert(rows);
    if (invoicesError) throw invoicesError;
  }

  return fetchAppData(userId);
}
