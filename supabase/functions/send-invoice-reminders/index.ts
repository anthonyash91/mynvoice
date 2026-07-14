import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateInvoicePdfBase64 } from '../_shared/invoicePdf.ts';
import {
  appOrigin,
  buildInvoiceEmailContext,
  clientDisplayName,
  clientRecipients,
  defaultLateTemplate,
  defaultReminderTemplate,
  isValidEmail,
  renderEmailTemplate,
  sendResendEmail,
} from '../_shared/edgeEmail.ts';
import {
  automaticRemindersBlocked,
  daysSince,
  localTodayDateString,
  resolveLateReminderIntervalDays,
  resolveUnpaidReminderIntervalDays,
} from '../_shared/reminders.ts';
import { authorizeServiceRoleRequest } from '../_shared/serviceRoleAuth.ts';

type EmailTemplate = {
  subject: string;
  html: string;
  css: string;
};

type EmailTemplates = {
  reminder?: EmailTemplate;
  late?: EmailTemplate;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INVOICE_SELECT =
  'id, user_id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, public_token, email_send_count, last_email_sent_at, last_email_sent_kind, reminders_paused, reminder_snooze_until, reminder_interval_days_override, late_reminder_interval_days_override, is_historical';

const INVOICE_SELECT_LEGACY =
  'id, user_id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, public_token, email_send_count, last_email_sent_at, last_email_sent_kind';

function isMissingHistoricalColumnError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('is_historical');
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
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

async function fetchClientForInvoice(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  clientId: string | null
): Promise<Record<string, unknown> | null> {
  if (!clientId) return null;

  const renamed = await supabase
    .from('clients')
    .select(
      'owner, company_name, primary_email, additional_emails, address, reminder_interval_days, late_reminder_interval_days'
    )
    .eq('id', clientId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!renamed.error && renamed.data) {
    return renamed.data as Record<string, unknown>;
  }

  const renamedLegacyIntervals = await supabase
    .from('clients')
    .select('owner, company_name, primary_email, additional_emails, address')
    .eq('id', clientId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!renamedLegacyIntervals.error && renamedLegacyIntervals.data) {
    return renamedLegacyIntervals.data as Record<string, unknown>;
  }

  const legacy = await supabase
    .from('clients')
    .select('name, company, email, additional_emails, address')
    .eq('id', clientId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!legacy.error && legacy.data) {
    return legacy.data as Record<string, unknown>;
  }

  return null;
}

function reminderTemplate(settings: Record<string, unknown>): EmailTemplate {
  const templates = (settings.email_templates as EmailTemplates | null) ?? {};
  const stored = templates.reminder;
  if (stored?.subject?.trim() && stored?.html?.trim()) {
    return {
      subject: stored.subject,
      html: stored.html,
      css: stored.css ?? '',
    };
  }
  return defaultReminderTemplate();
}

function lateTemplate(settings: Record<string, unknown>): EmailTemplate {
  const templates = (settings.email_templates as EmailTemplates | null) ?? {};
  const stored = templates.late;
  if (stored?.subject?.trim() && stored?.html?.trim()) {
    return {
      subject: stored.subject,
      html: stored.html,
      css: stored.css ?? '',
    };
  }
  return defaultLateTemplate();
}

async function loadSettings(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  settingsCache: Map<string, Record<string, unknown>>
): Promise<Record<string, unknown> | null> {
  let settings = settingsCache.get(userId);
  if (settings) return settings;

  const { data, error } = await supabase
    .from('user_settings')
    .select(
      'business_name, email, business_address, payment_details, email_templates, reminder_interval_days, late_reminder_interval_days'
    )
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  settings = data as Record<string, unknown>;
  settingsCache.set(userId, settings);
  return settings;
}

async function sendAutomatedInvoiceEmail(input: {
  supabase: ReturnType<typeof createClient>;
  resendApiKey: string;
  invoice: Record<string, unknown>;
  settings: Record<string, unknown>;
  client: Record<string, unknown> | null;
  template: EmailTemplate;
  emailKind: 'reminder' | 'late';
}): Promise<string | null> {
  const userId = String(input.invoice.user_id);
  const ownerEmail = String(input.settings.email ?? '').trim();
  const fromName = String(input.settings.business_name ?? '').trim();
  if (!ownerEmail || !isValidEmail(ownerEmail)) {
    return 'Owner email is not configured.';
  }

  const clientRow = input.client ?? (await fetchClientForInvoice(
    input.supabase,
    userId,
    input.invoice.client_id as string | null
  ));
  const recipients = clientRecipients(clientRow);
  if (recipients.length === 0) {
    return 'Client has no email recipients.';
  }

  let publicToken = String(input.invoice.public_token ?? '').trim();
  if (!publicToken) {
    publicToken = crypto.randomUUID();
    const { error: tokenError } = await input.supabase
      .from('invoices')
      .update({ public_token: publicToken })
      .eq('id', input.invoice.id)
      .eq('user_id', userId);
    if (tokenError) return 'Failed to create public invoice link.';
    input.invoice.public_token = publicToken;
  }

  const displayName = clientDisplayName(clientRow, String(input.invoice.client_name));
  const context = buildInvoiceEmailContext(
    input.invoice,
    input.settings,
    displayName,
    publicToken,
    { forOutgoingEmail: true, client: clientRow }
  );
  if (!context.paymentSentLink) {
    return 'APP_URL is not configured.';
  }

  const rendered = renderEmailTemplate(input.template, context);
  const from = fromName ? `${fromName} <${ownerEmail}>` : ownerEmail;
  const pdfBase64 = generateInvoicePdfBase64({
    invoice: {
      number: String(input.invoice.number),
      issue_date: String(input.invoice.issue_date),
      due_date: input.invoice.due_date as string | null | undefined,
      line_items: (input.invoice.line_items as Array<Record<string, unknown>>) ?? [],
      notes: input.invoice.notes as string | null | undefined,
      tax_enabled: Boolean(input.invoice.tax_enabled),
      tax_rate: Number(input.invoice.tax_rate ?? 0),
      status: String(input.invoice.status),
      client_name: String(input.invoice.client_name),
    },
    settings: {
      business_name: input.settings.business_name as string | null | undefined,
      email: input.settings.email as string | null | undefined,
      business_address: input.settings.business_address as string | null | undefined,
      payment_details: input.settings.payment_details as string | null | undefined,
    },
    client: clientRow
      ? {
          companyName: String(clientRow.company_name ?? clientRow.company ?? ''),
          owner: String(clientRow.owner ?? clientRow.name ?? ''),
          primaryEmail: String(clientRow.primary_email ?? clientRow.email ?? ''),
          address: String(clientRow.address ?? ''),
        }
      : null,
    clientDisplayName: displayName,
  });

  try {
    await sendResendEmail({
      apiKey: input.resendApiKey,
      from,
      to: recipients,
      subject: rendered.subject,
      html: rendered.html,
      pdfBase64,
      filename: `${String(input.invoice.number)}.pdf`,
    });
  } catch (err) {
    return err instanceof Error ? err.message : 'Failed to send email.';
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await input.supabase
    .from('invoices')
    .update({
      email_send_count: Number(input.invoice.email_send_count ?? 0) + 1,
      last_email_sent_at: sentAt,
      last_email_sent_kind: input.emailKind,
    })
    .eq('id', input.invoice.id)
    .eq('user_id', userId);

  if (updateError) {
    return 'Email sent but failed to update send count.';
  }

  await input.supabase.from('invoice_email_history').insert({
    user_id: userId,
    invoice_id: input.invoice.id,
    invoice_number: String(input.invoice.number),
    client_name: String(input.invoice.client_name),
    email_kind: input.emailKind,
    sent_at: sentAt,
  });

  return null;
}

async function fetchDueInvoices(
  supabase: ReturnType<typeof createClient>,
  status: 'unpaid' | 'overdue'
) {
  let result = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('status', status)
    .eq('is_historical', false)
    .gt('email_send_count', 0)
    .not('last_email_sent_at', 'is', null);

  if (result.error && isMissingHistoricalColumnError(result.error)) {
    result = await supabase
      .from('invoices')
      .select(INVOICE_SELECT)
      .eq('status', status)
      .gt('email_send_count', 0)
      .not('last_email_sent_at', 'is', null);
  }

  if (result.error && isMissingReminderControlColumnError(result.error)) {
    result = await supabase
      .from('invoices')
      .select(INVOICE_SELECT_LEGACY)
      .eq('status', status)
      .gt('email_send_count', 0)
      .not('last_email_sent_at', 'is', null);
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY is not configured.' }, 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      return jsonResponse({ error: 'Supabase environment is not configured.' }, 500);
    }

    const auth = await authorizeServiceRoleRequest(req, supabaseUrl);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status);
    }

    if (!appOrigin()) {
      return jsonResponse({ error: 'APP_URL is not configured.' }, 500);
    }

    const supabase = createClient(supabaseUrl, auth.serviceRoleKey);
    const settingsCache = new Map<string, Record<string, unknown>>();
    const clientCache = new Map<string, Record<string, unknown> | null>();
    const failures: Array<{ invoiceId: string; reason: string }> = [];
    let sent = 0;
    let skipped = 0;

    const { data: newlyOverdue, error: markOverdueError } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .eq('status', 'unpaid')
      .not('due_date', 'is', null)
      .lt('due_date', localTodayDateString())
      .select('id');

    if (markOverdueError) throw markOverdueError;

    const justMarkedOverdue = new Set((newlyOverdue ?? []).map((row) => String(row.id)));

    const { data: unpaidInvoices, error: unpaidError } = await fetchDueInvoices(
      supabase,
      'unpaid'
    );

    if (unpaidError) throw unpaidError;

    for (const invoice of unpaidInvoices ?? []) {
      if (automaticRemindersBlocked(invoice)) {
        skipped += 1;
        continue;
      }

      const userId = String(invoice.user_id);
      const settings = await loadSettings(supabase, userId, settingsCache);
      if (!settings) {
        failures.push({
          invoiceId: String(invoice.id),
          reason: 'Missing user settings.',
        });
        continue;
      }

      const clientId = invoice.client_id ? String(invoice.client_id) : '';
      let client = clientCache.get(`${userId}:${clientId}`);
      if (client === undefined) {
        client = await fetchClientForInvoice(supabase, userId, clientId || null);
        clientCache.set(`${userId}:${clientId}`, client);
      }

      const intervalDays = resolveUnpaidReminderIntervalDays(invoice, client, settings);
      const lastSentAt = String(invoice.last_email_sent_at ?? '');
      if (!lastSentAt || daysSince(lastSentAt) < intervalDays) {
        skipped += 1;
        continue;
      }

      const failure = await sendAutomatedInvoiceEmail({
        supabase,
        resendApiKey,
        invoice,
        settings,
        client,
        template: reminderTemplate(settings),
        emailKind: 'reminder',
      });

      if (failure) {
        failures.push({ invoiceId: String(invoice.id), reason: failure });
        continue;
      }

      sent += 1;
    }

    const { data: overdueInvoices, error: overdueError } = await fetchDueInvoices(
      supabase,
      'overdue'
    );

    if (overdueError) throw overdueError;

    for (const invoice of overdueInvoices ?? []) {
      if (automaticRemindersBlocked(invoice)) {
        skipped += 1;
        continue;
      }

      const userId = String(invoice.user_id);
      const settings = await loadSettings(supabase, userId, settingsCache);
      if (!settings) {
        failures.push({
          invoiceId: String(invoice.id),
          reason: 'Missing user settings.',
        });
        continue;
      }

      const clientId = invoice.client_id ? String(invoice.client_id) : '';
      let client = clientCache.get(`${userId}:${clientId}`);
      if (client === undefined) {
        client = await fetchClientForInvoice(supabase, userId, clientId || null);
        clientCache.set(`${userId}:${clientId}`, client);
      }

      const lateIntervalDays = resolveLateReminderIntervalDays(invoice, client, settings);
      const lastSentAt = String(invoice.last_email_sent_at ?? '');
      const justMarked = justMarkedOverdue.has(String(invoice.id));

      if (!justMarked && (!lastSentAt || daysSince(lastSentAt) < lateIntervalDays)) {
        skipped += 1;
        continue;
      }

      const failure = await sendAutomatedInvoiceEmail({
        supabase,
        resendApiKey,
        invoice,
        settings,
        client,
        template: lateTemplate(settings),
        emailKind: 'late',
      });

      if (failure) {
        failures.push({ invoiceId: String(invoice.id), reason: failure });
        continue;
      }

      sent += 1;
    }

    return jsonResponse({
      ok: true,
      markedOverdue: justMarkedOverdue.size,
      sent,
      skipped,
      failures,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return jsonResponse({ error: message }, 500);
  }
});
