import { clientInvoiceName } from '@/lib/client';
import {
  hasStoredEmailTemplates,
  migrateEmailTemplates,
  prepareEmailTemplatesForStorage,
} from '@/lib/emailTemplates';
import { loadEmailTemplatesFromStorage } from '@/lib/emailTemplateStorage';
import { emptyInvoiceReminderSettings, isInvoicePastDue } from '@/lib/invoice';
import { supabase } from '@/lib/supabase';
import type {
  AppData,
  CalendarEntry,
  CalendarEntryType,
  Client,
  ClientRate,
  ClientRecurringCalendarExclusion,
  RecurringLineItem,
  Invoice,
  InvoiceDraft,
  InvoiceReminderSettings,
  LineItem,
  EmailHistoryEntry,
  EmailTemplateKind,
  EmailTemplates,
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
      'id, owner, company_name, primary_email, hourly_rate, additional_emails, additional_rates, recurring_line_items, recurring_calendar_exclusions, address, reminder_interval_days, late_reminder_interval_days',
  },
  {
    schema: 'legacy',
    extended: true,
    selectColumns:
      'id, name, company, email, hourly_rate, additional_emails, additional_rates, recurring_line_items, recurring_calendar_exclusions, address, reminder_interval_days, late_reminder_interval_days',
  },
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
  recurring_calendar_exclusions?: ClientRecurringCalendarExclusion[];
  address?: string;
  reminder_interval_days?: number | null;
  late_reminder_interval_days?: number | null;
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
  public_token?: string | null;
  owner_confirm_token?: string | null;
  paid_at?: string | null;
  email_send_count?: number;
  last_email_sent_at?: string | null;
  last_email_sent_kind?: EmailTemplateKind | null;
  reminders_paused?: boolean;
  reminder_snooze_until?: string | null;
  reminder_interval_days_override?: number | null;
  late_reminder_interval_days_override?: number | null;
  created_at: string;
}

const INVOICE_SELECT =
  'id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, public_token, paid_at, email_send_count, last_email_sent_at, last_email_sent_kind, reminders_paused, reminder_snooze_until, reminder_interval_days_override, late_reminder_interval_days_override, created_at';

const INVOICE_SELECT_TOKEN =
  'id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, public_token, paid_at, email_send_count, last_email_sent_at, last_email_sent_kind, created_at';

const INVOICE_SELECT_BASE =
  'id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, created_at';

interface DbEmailHistory {
  id: string;
  invoice_id: string | null;
  invoice_number: string;
  client_name: string;
  email_kind: EmailTemplateKind;
  sent_at: string;
}

const EMAIL_HISTORY_SELECT =
  'id, invoice_id, invoice_number, client_name, email_kind, sent_at';

function isMissingEmailHistoryTableError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('invoice_email_history') ||
    message.includes('schema cache') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

function toEmailHistoryEntry(row: DbEmailHistory): EmailHistoryEntry {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    clientName: row.client_name,
    emailKind: row.email_kind,
    sentAt: row.sent_at,
  };
}

export async function fetchEmailHistory(userId: string): Promise<EmailHistoryEntry[]> {
  const { data, error } = await supabase
    .from('invoice_email_history')
    .select(EMAIL_HISTORY_SELECT)
    .eq('user_id', userId)
    .order('sent_at', { ascending: false });

  if (error) {
    if (isMissingEmailHistoryTableError(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => toEmailHistoryEntry(row as DbEmailHistory));
}

export async function insertEmailHistory(
  userId: string,
  entry: {
    invoiceId: string | null;
    invoiceNumber: string;
    clientName: string;
    emailKind: EmailTemplateKind;
    sentAt: string;
  }
): Promise<EmailHistoryEntry | null> {
  const { data, error } = await supabase
    .from('invoice_email_history')
    .insert({
      user_id: userId,
      invoice_id: entry.invoiceId,
      invoice_number: entry.invoiceNumber,
      client_name: entry.clientName,
      email_kind: entry.emailKind,
      sent_at: entry.sentAt,
    })
    .select(EMAIL_HISTORY_SELECT)
    .single();

  if (error) {
    if (isMissingEmailHistoryTableError(error)) return null;
    throw error;
  }

  return toEmailHistoryEntry(data as DbEmailHistory);
}

function isMissingReminderControlColumnError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('reminders_paused') ||
    message.includes('reminder_snooze_until') ||
    message.includes('reminder_interval_days_override') ||
    message.includes('late_reminder_interval_days_override')
  );
}

function isMissingPublicTokenColumnError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('public_token') ||
    message.includes('paid_at') ||
    message.includes('email_send_count') ||
    message.includes('last_email_sent_at') ||
    message.includes('last_email_sent_kind')
  );
}

async function selectInvoicesForUser(userId: string, invoiceId?: string) {
  const run = (columns: string) => {
    let query = supabase.from('invoices').select(columns).eq('user_id', userId);
    if (invoiceId) query = query.eq('id', invoiceId);
    return query;
  };

  let result = await run(INVOICE_SELECT);
  if (result.error && isMissingReminderControlColumnError(result.error)) {
    result = await run(INVOICE_SELECT_TOKEN);
  }
  if (result.error && isMissingPublicTokenColumnError(result.error)) {
    result = await run(INVOICE_SELECT_BASE);
  }

  return result;
}

async function refetchInvoice(userId: string, invoiceId: string): Promise<Invoice> {
  const result = await selectInvoicesForUser(userId, invoiceId);
  if (result.error) throw result.error;
  const row = (result.data ?? [])[0];
  if (!row) throw new Error('Invoice not found');
  return toInvoice(row as unknown as DbInvoice);
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
  reminder_interval_days?: number;
  late_reminder_interval_days?: number;
  paypal_client_id?: string;
  paypal_client_secret?: string;
  paypal_sandbox?: boolean;
  logo: string | null;
  next_invoice_number: number;
  email_templates?: EmailTemplates;
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
    recurringCalendarExclusions: row.recurring_calendar_exclusions ?? [],
    address: row.address ?? '',
    reminderIntervalDays:
      row.reminder_interval_days != null ? Number(row.reminder_interval_days) : null,
    lateReminderIntervalDays:
      row.late_reminder_interval_days != null
        ? Number(row.late_reminder_interval_days)
        : null,
  };
}

function clientSelectColumns(
  config: ClientDbConfig,
  includeRecurringLineItems: boolean,
  includeRecurringCalendarExclusions = false
): string {
  if (!config.extended) {
    return config.selectColumns;
  }

  let columns = config.selectColumns;
  if (includeRecurringLineItems && !columns.includes('recurring_line_items')) {
    columns = `${columns}, recurring_line_items`;
  }
  if (includeRecurringCalendarExclusions && !columns.includes('recurring_calendar_exclusions')) {
    columns = `${columns}, recurring_calendar_exclusions`;
  }
  return columns;
}

function clientToRow(
  userId: string,
  client: Omit<Client, 'id'>,
  config: ClientDbConfig,
  includeRecurringLineItems: boolean,
  includeRecurringCalendarExclusions = false
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
    if (includeRecurringCalendarExclusions) {
      row.recurring_calendar_exclusions = client.recurringCalendarExclusions;
    }
    row.address = client.address;
    row.reminder_interval_days = client.reminderIntervalDays;
    row.late_reminder_interval_days = client.lateReminderIntervalDays;
  }

  return row;
}

function isMissingClientReminderColumnError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('reminder_interval_days') || message.includes('late_reminder_interval_days')
  );
}

function clientToRowWithoutReminderColumns(row: Record<string, unknown>) {
  const next = { ...row };
  delete next.reminder_interval_days;
  delete next.late_reminder_interval_days;
  return next;
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

function isMissingRecurringCalendarExclusionsColumnError(error: {
  message?: string;
} | null): boolean {
  return Boolean(error?.message?.includes('recurring_calendar_exclusions'));
}

async function resolveRecurringCalendarExclusionsSupport(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('clients')
    .select('recurring_calendar_exclusions')
    .eq('user_id', userId)
    .limit(1);

  return !error;
}

async function resolveClientExtendedWriteOptions(userId: string): Promise<{
  includeRecurringLineItems: boolean;
  includeRecurringCalendarExclusions: boolean;
}> {
  const includeRecurringLineItems = await resolveRecurringLineItemsSupport(userId);
  const includeRecurringCalendarExclusions =
    includeRecurringLineItems &&
    (await resolveRecurringCalendarExclusionsSupport(userId));

  return { includeRecurringLineItems, includeRecurringCalendarExclusions };
}

function isMissingRecurringColumnError(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes('recurring_line_items'));
}

async function fetchClients(userId: string): Promise<Client[]> {
  const config = await resolveClientDbConfig(userId);
  const { includeRecurringLineItems, includeRecurringCalendarExclusions } =
    await resolveClientExtendedWriteOptions(userId);
  const { data, error } = await supabase
    .from('clients')
    .select(
      clientSelectColumns(
        config,
        includeRecurringLineItems,
        includeRecurringCalendarExclusions
      )
    )
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
    publicToken: row.public_token ?? null,
    paidAt: row.paid_at ?? null,
    emailSendCount: Number(row.email_send_count ?? 0),
    lastEmailSentAt: row.last_email_sent_at ?? null,
    lastEmailSentKind: row.last_email_sent_kind ?? null,
    remindersPaused: row.reminders_paused ?? false,
    reminderSnoozeUntil: row.reminder_snooze_until ?? null,
    reminderIntervalDaysOverride:
      row.reminder_interval_days_override != null
        ? Number(row.reminder_interval_days_override)
        : null,
    lateReminderIntervalDaysOverride:
      row.late_reminder_interval_days_override != null
        ? Number(row.late_reminder_interval_days_override)
        : null,
    createdAt: row.created_at,
  };
}

function resolveEmailTemplates(
  userId: string,
  rawTemplates?: EmailTemplates | null
): EmailTemplates {
  if (hasStoredEmailTemplates(rawTemplates)) {
    return migrateEmailTemplates(rawTemplates);
  }

  const localTemplates = loadEmailTemplatesFromStorage(userId);
  if (localTemplates) return localTemplates;

  return migrateEmailTemplates(rawTemplates);
}

function toSettings(userId: string, row: DbSettings): Settings {
  return {
    businessName: row.business_name,
    email: row.email,
    businessAddress: row.business_address ?? '',
    mailingAddress: row.mailing_address ?? '',
    paymentDetails: row.payment_details,
    defaultTaxRate: Number(row.default_tax_rate),
    defaultDueDays: Number(row.default_due_days ?? 14),
    reminderIntervalDays: Number(row.reminder_interval_days ?? 5),
    lateReminderIntervalDays: Number(row.late_reminder_interval_days ?? 3),
    paypalClientId: String(row.paypal_client_id ?? ''),
    paypalClientSecret: String(row.paypal_client_secret ?? ''),
    paypalSandbox: row.paypal_sandbox ?? true,
    logo: row.logo,
    emailTemplates: resolveEmailTemplates(userId, row.email_templates),
  };
}

function isMissingEmailTemplatesColumnError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('email_templates') || message.includes('email templates');
}

function isMissingReminderIntervalColumnError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('reminder_interval_days');
}

function isMissingLateReminderIntervalColumnError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('late_reminder_interval_days');
}

function isMissingPayPalColumnError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('paypal_client_id') ||
    message.includes('paypal_client_secret') ||
    message.includes('paypal_sandbox')
  );
}

const USER_SETTINGS_SELECT_WITH_TEMPLATES =
  'business_name, email, business_address, mailing_address, payment_details, default_tax_rate, default_due_days, reminder_interval_days, late_reminder_interval_days, paypal_client_id, paypal_client_secret, paypal_sandbox, logo, next_invoice_number, email_templates';

const USER_SETTINGS_SELECT_NO_PAYPAL =
  'business_name, email, business_address, mailing_address, payment_details, default_tax_rate, default_due_days, reminder_interval_days, late_reminder_interval_days, logo, next_invoice_number, email_templates';

const USER_SETTINGS_SELECT_BASE =
  'business_name, email, business_address, mailing_address, payment_details, default_tax_rate, default_due_days, reminder_interval_days, late_reminder_interval_days, paypal_client_id, paypal_client_secret, paypal_sandbox, logo, next_invoice_number';

const USER_SETTINGS_SELECT_BASE_NO_PAYPAL =
  'business_name, email, business_address, mailing_address, payment_details, default_tax_rate, default_due_days, reminder_interval_days, late_reminder_interval_days, logo, next_invoice_number';

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
    publicToken: null,
    paidAt: null,
    emailSendCount: 0,
    lastEmailSentAt: null,
    lastEmailSentKind: null,
    ...emptyInvoiceReminderSettings(),
    createdAt,
  };
}

async function ensureUserSettings(userId: string): Promise<DbSettings> {
  const upsert = { user_id: userId };

  let { data, error } = await supabase
    .from('user_settings')
    .upsert(upsert, { onConflict: 'user_id' })
    .select(USER_SETTINGS_SELECT_WITH_TEMPLATES)
    .single();

  if (error && isMissingPayPalColumnError(error)) {
    ({ data, error } = await supabase
      .from('user_settings')
      .upsert(upsert, { onConflict: 'user_id' })
      .select(USER_SETTINGS_SELECT_NO_PAYPAL)
      .single());
  }

  if (error && isMissingEmailTemplatesColumnError(error)) {
    ({ data, error } = await supabase
      .from('user_settings')
      .upsert(upsert, { onConflict: 'user_id' })
      .select(USER_SETTINGS_SELECT_BASE)
      .single());
  }

  if (error && isMissingPayPalColumnError(error)) {
    ({ data, error } = await supabase
      .from('user_settings')
      .upsert(upsert, { onConflict: 'user_id' })
      .select(USER_SETTINGS_SELECT_BASE_NO_PAYPAL)
      .single());
  }

  if (error) throw error;
  if (!data) throw new Error('Failed to load user settings');
  return data as unknown as DbSettings;
}

export async function syncOverdueInvoiceStatuses(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, due_date')
    .eq('user_id', userId)
    .eq('status', 'unpaid');

  if (error) throw error;

  const overdueIds = (data ?? [])
    .filter((row) => isInvoicePastDue({ dueDate: row.due_date as string | null }))
    .map((row) => row.id as string);

  if (overdueIds.length === 0) return;

  const { error: updateError } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('user_id', userId)
    .in('id', overdueIds);

  if (updateError) throw updateError;
}

export async function fetchAppData(userId: string): Promise<AppData> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated. Please sign in again.');

  await syncOverdueInvoiceStatuses(userId);

  const invoicesRes = await selectInvoicesForUser(userId);

  const [clients, calendarRes, settingsRow, emailHistory] = await Promise.all([
    fetchClients(userId),
    supabase
      .from('calendar_entries')
      .select(CALENDAR_ENTRY_SELECT)
      .eq('user_id', userId)
      .order('entry_date', { ascending: true }),
    ensureUserSettings(userId),
    fetchEmailHistory(userId),
  ]);

  if (invoicesRes.error) throw invoicesRes.error;
  if (calendarRes.error) throw calendarRes.error;

  return {
    clients,
    invoices: ((invoicesRes.data ?? []) as unknown as DbInvoice[]).map(toInvoice),
    calendarEntries: (calendarRes.data ?? []).map((row) =>
      toCalendarEntry(row as DbCalendarEntry)
    ),
    recurringCalendarExclusions: [],
    emailHistory,
    settings: toSettings(userId, settingsRow),
    nextInvoiceNumber: settingsRow.next_invoice_number,
  };
}

export async function upsertSettings(userId: string, settings: Settings): Promise<void> {
  const emailTemplates = prepareEmailTemplatesForStorage(settings.emailTemplates);
  const row: Record<string, unknown> = {
    user_id: userId,
    business_name: settings.businessName,
    email: settings.email,
    business_address: settings.businessAddress,
    mailing_address: settings.mailingAddress,
    payment_details: settings.paymentDetails,
    default_tax_rate: settings.defaultTaxRate,
    default_due_days: settings.defaultDueDays,
    reminder_interval_days: settings.reminderIntervalDays,
    late_reminder_interval_days: settings.lateReminderIntervalDays,
    paypal_client_id: settings.paypalClientId,
    paypal_client_secret: settings.paypalClientSecret,
    paypal_sandbox: settings.paypalSandbox,
    logo: settings.logo,
    email_templates: emailTemplates,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' });

  if (error && isMissingEmailTemplatesColumnError(error)) {
    delete row.email_templates;
    ({ error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' }));
  }

  if (error && isMissingReminderIntervalColumnError(error)) {
    delete row.reminder_interval_days;
    ({ error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' }));
  }

  if (error && isMissingLateReminderIntervalColumnError(error)) {
    delete row.late_reminder_interval_days;
    ({ error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' }));
  }

  if (error && isMissingPayPalColumnError(error)) {
    delete row.paypal_client_id;
    delete row.paypal_client_secret;
    delete row.paypal_sandbox;
    ({ error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' }));
  }

  if (error) throw error;
}

export async function insertClient(
  userId: string,
  client: Omit<Client, 'id'>
): Promise<Client> {
  const config = await resolveClientDbConfig(userId);
  let { includeRecurringLineItems, includeRecurringCalendarExclusions } =
    await resolveClientExtendedWriteOptions(userId);
  let row = clientToRow(
    userId,
    client,
    config,
    includeRecurringLineItems,
    includeRecurringCalendarExclusions
  );
  let selectColumns = clientSelectColumns(
    config,
    includeRecurringLineItems,
    includeRecurringCalendarExclusions
  );

  let { data, error } = await supabase
    .from('clients')
    .insert(row)
    .select(selectColumns)
    .single();

  if (
    error &&
    includeRecurringCalendarExclusions &&
    isMissingRecurringCalendarExclusionsColumnError(error)
  ) {
    includeRecurringCalendarExclusions = false;
    row = clientToRow(userId, client, config, includeRecurringLineItems, false);
    selectColumns = clientSelectColumns(config, includeRecurringLineItems, false);
    ({ data, error } = await supabase
      .from('clients')
      .insert(row)
      .select(selectColumns)
      .single());
  }

  if (error && includeRecurringLineItems && isMissingRecurringColumnError(error)) {
    includeRecurringLineItems = false;
    includeRecurringCalendarExclusions = false;
    row = clientToRow(userId, client, config, false, false);
    selectColumns = clientSelectColumns(config, false, false);
    ({ data, error } = await supabase
      .from('clients')
      .insert(row)
      .select(selectColumns)
      .single());
  }

  if (error && isMissingClientReminderColumnError(error)) {
    row = clientToRowWithoutReminderColumns(row);
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
  let { includeRecurringLineItems, includeRecurringCalendarExclusions } =
    await resolveClientExtendedWriteOptions(userId);
  let row = clientToRow(
    userId,
    client,
    config,
    includeRecurringLineItems,
    includeRecurringCalendarExclusions
  );
  let selectColumns = clientSelectColumns(
    config,
    includeRecurringLineItems,
    includeRecurringCalendarExclusions
  );

  let { data, error } = await supabase
    .from('clients')
    .update(row)
    .eq('user_id', userId)
    .eq('id', client.id)
    .select(selectColumns)
    .single();

  if (
    error &&
    includeRecurringCalendarExclusions &&
    isMissingRecurringCalendarExclusionsColumnError(error)
  ) {
    includeRecurringCalendarExclusions = false;
    row = clientToRow(userId, client, config, includeRecurringLineItems, false);
    selectColumns = clientSelectColumns(config, includeRecurringLineItems, false);
    ({ data, error } = await supabase
      .from('clients')
      .update(row)
      .eq('user_id', userId)
      .eq('id', client.id)
      .select(selectColumns)
      .single());
  }

  if (error && includeRecurringLineItems && isMissingRecurringColumnError(error)) {
    includeRecurringLineItems = false;
    includeRecurringCalendarExclusions = false;
    row = clientToRow(userId, client, config, false, false);
    selectColumns = clientSelectColumns(config, false, false);
    ({ data, error } = await supabase
      .from('clients')
      .update(row)
      .eq('user_id', userId)
      .eq('id', client.id)
      .select(selectColumns)
      .single());
  }

  if (error && isMissingClientReminderColumnError(error)) {
    row = clientToRowWithoutReminderColumns(row);
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
        recurringCalendarExclusions: [],
        address: '',
        reminderIntervalDays: null,
        lateReminderIntervalDays: null,
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

  let data: DbInvoice;
  if (!isNew) {
    let result = await supabase
      .from('invoices')
      .update(updateFields)
      .eq('user_id', userId)
      .eq('id', id)
      .select(INVOICE_SELECT)
      .single();
    if (result.error && isMissingPublicTokenColumnError(result.error)) {
      result = await supabase
        .from('invoices')
        .update(updateFields)
        .eq('user_id', userId)
        .eq('id', id)
        .select(INVOICE_SELECT_BASE)
        .single();
    }
    if (result.error) throw result.error;
    data = result.data;
  } else {
    let result = await supabase.from('invoices').insert(row).select(INVOICE_SELECT).single();
    if (result.error && isMissingPublicTokenColumnError(result.error)) {
      result = await supabase.from('invoices').insert(row).select(INVOICE_SELECT_BASE).single();
    }
    if (result.error) throw result.error;
    data = result.data;
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

export async function updateInvoiceReminderSettingsRow(
  userId: string,
  invoiceId: string,
  settings: InvoiceReminderSettings
): Promise<Invoice> {
  const updateFields = {
    reminders_paused: settings.remindersPaused,
    reminder_snooze_until: settings.reminderSnoozeUntil,
    reminder_interval_days_override: settings.reminderIntervalDaysOverride,
    late_reminder_interval_days_override: settings.lateReminderIntervalDaysOverride,
  };

  const { error: updateError } = await supabase
    .from('invoices')
    .update(updateFields)
    .eq('user_id', userId)
    .eq('id', invoiceId);

  if (updateError) {
    if (isMissingReminderControlColumnError(updateError)) {
      throw new Error(
        'Run supabase/migrate-invoice-reminder-controls.sql to enable per-invoice reminder controls.'
      );
    }
    throw updateError;
  }

  return refetchInvoice(userId, invoiceId);
}

export async function updateInvoiceStatusRow(
  userId: string,
  invoiceId: string,
  status: Invoice['status']
): Promise<Invoice> {
  const updateFields: Record<string, unknown> = { status };
  if (status === 'paid') {
    updateFields.paid_at = new Date().toISOString().split('T')[0];
  } else {
    updateFields.paid_at = null;
  }

  let result = await supabase
    .from('invoices')
    .update(updateFields)
    .eq('user_id', userId)
    .eq('id', invoiceId)
    .select(INVOICE_SELECT)
    .single();

  if (result.error && isMissingPublicTokenColumnError(result.error)) {
    const fallbackFields = { status };
    result = await supabase
      .from('invoices')
      .update(fallbackFields)
      .eq('user_id', userId)
      .eq('id', invoiceId)
      .select(INVOICE_SELECT_BASE)
      .single();
  }

  if (result.error) throw result.error;
  return toInvoice(result.data);
}

export async function recordInvoiceEmailSent(
  userId: string,
  invoiceId: string,
  kind: EmailTemplateKind
): Promise<Invoice> {
  const { data: current, error: fetchError } = await supabase
    .from('invoices')
    .select('email_send_count')
    .eq('user_id', userId)
    .eq('id', invoiceId)
    .single();

  if (fetchError && isMissingPublicTokenColumnError(fetchError)) {
    const fallback = await supabase
      .from('invoices')
      .select(INVOICE_SELECT_BASE)
      .eq('user_id', userId)
      .eq('id', invoiceId)
      .single();
    if (fallback.error) throw fallback.error;
    return toInvoice(fallback.data);
  }

  if (fetchError) throw fetchError;

  const nextCount = Number(current?.email_send_count ?? 0) + 1;
  const sentAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      email_send_count: nextCount,
      last_email_sent_at: sentAt,
      last_email_sent_kind: kind,
    })
    .eq('user_id', userId)
    .eq('id', invoiceId);

  if (updateError) {
    if (isMissingPublicTokenColumnError(updateError)) {
      const fallback = await selectInvoicesForUser(userId, invoiceId);
      if (fallback.error) throw fallback.error;
      const row = (fallback.data ?? [])[0];
      if (!row) throw new Error('Invoice not found');
      return toInvoice(row as unknown as DbInvoice);
    }
    throw updateError;
  }

  return refetchInvoice(userId, invoiceId);
}

export async function ensureInvoicePublicToken(
  userId: string,
  invoiceId: string
): Promise<Invoice> {
  let result = await selectInvoicesForUser(userId, invoiceId);

  if (result.error && isMissingPublicTokenColumnError(result.error)) {
    throw new Error(
      'Run supabase/migrate-invoice-payment-flow.sql to enable public invoice payment links.'
    );
  }

  if (result.error) throw result.error;

  const row = (result.data ?? [])[0];
  if (!row) throw new Error('Invoice not found');

  const current = toInvoice(row as unknown as DbInvoice);
  if (current.publicToken) {
    return current;
  }

  const publicToken = crypto.randomUUID();
  const { error: updateError } = await supabase
    .from('invoices')
    .update({ public_token: publicToken })
    .eq('user_id', userId)
    .eq('id', invoiceId);

  if (updateError) {
    if (isMissingPublicTokenColumnError(updateError)) {
      throw new Error(
        'Run supabase/migrate-invoice-payment-flow.sql to enable public invoice payment links.'
      );
    }
    throw updateError;
  }

  return refetchInvoice(userId, invoiceId);
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

export async function unbillCalendarEntryIds(
  userId: string,
  invoiceId: string,
  entryIds: string[]
): Promise<CalendarEntry[]> {
  if (entryIds.length === 0) return [];

  const { data, error } = await supabase
    .from('calendar_entries')
    .update({ invoice_id: null })
    .eq('user_id', userId)
    .eq('invoice_id', invoiceId)
    .in('id', entryIds)
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
