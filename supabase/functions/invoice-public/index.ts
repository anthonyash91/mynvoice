import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateInvoicePdfBase64 } from '../_shared/invoicePdf.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_SETTINGS_PUBLIC_SELECT =
  'business_name, email, business_address, mailing_address, payment_details, default_tax_rate, default_due_days, logo';

type EmailTemplate = {
  subject: string;
  html: string;
  css: string;
};

type EmailTemplates = {
  unpaid?: EmailTemplate;
  reminder?: EmailTemplate;
  late?: EmailTemplate;
  payment_received?: EmailTemplate;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

function calculateTotal(
  lineItems: Array<{ quantity: number; rate: number }>,
  taxEnabled: boolean,
  taxRate: number
): number {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const tax = taxEnabled ? subtotal * (taxRate / 100) : 0;
  return subtotal + tax;
}

function interpolate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => context[key] ?? '');
}

function assembleEmailDocument(html: string, css: string): string {
  const trimmedHtml = html.trim();
  const trimmedCss = css.trim();
  const styleBlock = trimmedCss ? `<style>${trimmedCss}</style>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${styleBlock}
</head>
<body>
${trimmedHtml}
</body>
</html>`;
}

function renderTemplate(template: EmailTemplate, context: Record<string, string>) {
  const html = interpolate(template.html, context);
  const css = interpolate(template.css, context);
  return {
    subject: interpolate(template.subject, context),
    html: assembleEmailDocument(html, css),
  };
}

function defaultPaymentReceivedTemplate(): EmailTemplate {
  return {
    subject: 'Payment received for invoice {{invoiceNumber}}',
    html: `<div class="email-outer"><div class="email-shell"><div class="email-card"><div class="email-header"><span class="email-badge">Payment received</span><div class="email-headline">Thank you — your payment was received</div><p class="email-intro">Hi {{clientName}}, we have received your payment for invoice <strong>{{invoiceNumber}}</strong> on {{paymentDate}}.</p></div><div class="email-body"><div class="email-details"><div class="email-amount">{{total}}</div><div class="email-meta">Payment received {{paymentDate}}</div></div></div><div class="email-footer"><p class="email-business">{{businessName}}</p></div></div></div></div>`,
    css: `body { margin:0; background:#f5f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#111; } .email-shell { padding:40px 16px; display:flex; justify-content:center; } .email-card { max-width:520px; width:100%; background:#fff; border:1px solid #e5e5e5; } .email-header,.email-body,.email-footer { padding:28px; } .email-badge { display:inline-block; padding:4px 10px; border-radius:999px; background:rgba(52,199,89,0.12); color:#34C759; font-size:11px; text-transform:uppercase; } .email-headline { margin-top:14px; font-size:22px; font-weight:500; } .email-intro { color:#6e6e73; font-size:14px; line-height:1.55; } .email-amount { font-size:24px; font-weight:500; color:#34C759; } .email-meta { margin-top:12px; color:#6e6e73; font-size:12px; }`,
  };
}

function ownerNotificationHtml(context: Record<string, string>): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin:0; padding:32px 16px; background:#f5f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#111; }
    .card { max-width:520px; margin:0 auto; background:#fff; border:1px solid #e5e5e5; padding:28px; }
    .badge { display:inline-block; padding:4px 10px; border-radius:999px; background:rgba(255,149,0,0.14); color:#FF9500; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; }
    h1 { margin:14px 0 0; font-size:22px; font-weight:500; }
    p { font-size:14px; line-height:1.55; color:#6e6e73; }
    .amount { font-size:24px; font-weight:500; color:#111; margin:16px 0; }
    .cta { display:block; text-align:center; margin-top:20px; padding:12px 16px; border-radius:8px; background:#34C759; color:#fff !important; text-decoration:none; font-weight:500; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Payment sent</span>
    <h1>Client marked payment as sent</h1>
    <p>${context.clientName} indicated that payment has been sent for invoice ${context.invoiceNumber}.</p>
    <div class="amount">${context.total}</div>
    <p>Confirm once the payment has arrived in your account.</p>
    <a class="cta" href="${context.confirmPaymentLink}">Payment has been received</a>
  </div>
</body>
</html>`;
}

async function sendResendEmail(input: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  pdfBase64?: string;
  filename?: string;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  };

  if (input.pdfBase64) {
    payload.attachments = [
      {
        filename: input.filename?.trim() || 'invoice.pdf',
        content: input.pdfBase64,
      },
    ];
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { message?: string };
  if (!response.ok) {
    throw new Error(data.message || 'Resend rejected the email request.');
  }
}

function appOrigin(): string {
  const configured = Deno.env.get('APP_URL')?.trim() || Deno.env.get('VITE_APP_URL')?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return '';
}

function buildContext(
  invoice: Record<string, unknown>,
  settings: Record<string, unknown>,
  clientName: string,
  publicToken: string,
  ownerConfirmToken = ''
): Record<string, string> {
  const lineItems = (invoice.line_items as Array<{ quantity: number; rate: number }>) ?? [];
  const total = calculateTotal(
    lineItems,
    Boolean(invoice.tax_enabled),
    Number(invoice.tax_rate ?? 0)
  );
  const dueDate = invoice.due_date ? formatDateLong(String(invoice.due_date)) : '—';
  const dueDateLine = invoice.due_date
    ? `Payment is due ${formatDateLong(String(invoice.due_date))}.`
    : '';

  const origin = appOrigin();
  const invoiceLink = origin ? `${origin}/i/${publicToken}` : '';
  const paymentSentLink = origin ? `${origin}/i/${publicToken}/payment-sent` : '';
  const confirmPaymentLink = ownerConfirmToken && origin
    ? `${origin}/confirm-payment/${ownerConfirmToken}`
    : '';
  const paidAt = invoice.paid_at ? String(invoice.paid_at) : '';
  const paymentDate = paidAt ? formatDateLong(paidAt) : '—';

  return {
    clientName,
    invoiceNumber: String(invoice.number),
    issueDate: formatDateLong(String(invoice.issue_date)),
    dueDate,
    dueDateLine,
    total: formatCurrency(total),
    businessName: String(settings.business_name || settings.email || '').trim(),
    invoiceLink,
    paymentSentLink,
    confirmPaymentLink,
    paymentDate,
  };
}

function clientDisplayName(client: Record<string, unknown> | null, fallback: string): string {
  if (!client) return fallback;
  const company = String(client.company_name ?? client.company ?? '').trim();
  const owner = String(client.owner ?? client.name ?? '').trim();
  if (company && owner) return `${owner} · ${company}`;
  return company || owner || fallback;
}

function clientRecipients(client: Record<string, unknown> | null): string[] {
  if (!client) return [];
  const emails = [
    String(client.primary_email ?? client.email ?? '').trim(),
    ...((client.additional_emails as string[] | undefined) ?? []).map((email) => email.trim()),
  ].filter(Boolean);
  return [...new Set(emails)];
}

type PublicClient = {
  companyName: string;
  owner: string;
  primaryEmail: string;
  additionalEmails: string[];
  address: string;
};

function normalizePublicClient(
  client: Record<string, unknown> | null,
  invoiceClientName: string
): PublicClient {
  const companyName = String(client?.company_name ?? client?.company ?? '').trim();
  const owner = String(client?.owner ?? client?.name ?? '').trim();
  const invoiceName = invoiceClientName.trim();

  return {
    companyName,
    owner: owner || (companyName ? '' : invoiceName),
    primaryEmail: String(client?.primary_email ?? client?.email ?? '').trim(),
    additionalEmails: (client?.additional_emails as string[]) ?? [],
    address: String(client?.address ?? '').trim(),
  };
}

async function fetchClientForInvoice(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  clientId: string | null
): Promise<Record<string, unknown> | null> {
  if (!clientId) return null;

  const renamed = await supabase
    .from('clients')
    .select('owner, company_name, primary_email, additional_emails, address')
    .eq('id', clientId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!renamed.error && renamed.data) {
    return renamed.data as Record<string, unknown>;
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

function toPublicPayload(
  invoice: Record<string, unknown>,
  settings: Record<string, unknown>,
  client: Record<string, unknown> | null
) {
  const invoiceClientName = String(invoice.client_name);

  return {
    invoice: {
      clientId: String(invoice.client_id ?? ''),
      clientName: invoiceClientName,
      number: String(invoice.number),
      issueDate: String(invoice.issue_date),
      dueDate: invoice.due_date ? String(invoice.due_date) : null,
      lineItems: invoice.line_items,
      notes: String(invoice.notes ?? ''),
      taxEnabled: Boolean(invoice.tax_enabled),
      taxRate: Number(invoice.tax_rate ?? 0),
      status: String(invoice.status),
      createdAt: String(invoice.created_at),
    },
    settings: {
      businessName: String(settings.business_name ?? ''),
      email: String(settings.email ?? ''),
      businessAddress: String(settings.business_address ?? ''),
      mailingAddress: String(settings.mailing_address ?? ''),
      paymentDetails: String(settings.payment_details ?? ''),
      defaultTaxRate: Number(settings.default_tax_rate ?? 0),
      defaultDueDays: Number(settings.default_due_days ?? 14),
      logo: (settings.logo as string | null) ?? null,
    },
    client: normalizePublicClient(client, invoiceClientName),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // Auto-injected on deploy. For local serve, set SERVICE_ROLE_KEY (SUPABASE_* names are reserved).
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          error:
            'Service role key is not configured. Deploy to Supabase (auto-injected) or set SERVICE_ROLE_KEY for local dev.',
        },
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = (await req.json()) as { action?: string; token?: string };
    const action = body.action?.trim();
    const token = body.token?.trim();

    if (!action || !token) {
      return jsonResponse({ error: 'Action and token are required.' }, 400);
    }

    if (action === 'get') {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(
          'id, user_id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, public_token, created_at'
        )
        .eq('public_token', token)
        .maybeSingle();

      if (error) throw error;
      if (!invoice) return jsonResponse({ error: 'Invoice not found.' }, 404);

      const [{ data: settings, error: settingsError }, client] = await Promise.all([
        supabase
          .from('user_settings')
          .select(USER_SETTINGS_PUBLIC_SELECT)
          .eq('user_id', invoice.user_id)
          .single(),
        fetchClientForInvoice(supabase, String(invoice.user_id), invoice.client_id as string | null),
      ]);

      if (settingsError) throw settingsError;

      return jsonResponse({
        ok: true,
        ...toPublicPayload(invoice, settings, client),
      });
    }

    if (action === 'mark_payment_sent') {
      if (!resendApiKey) {
        return jsonResponse({ error: 'RESEND_API_KEY is not configured.' }, 500);
      }

      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(
          'id, user_id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, public_token, owner_confirm_token, created_at'
        )
        .eq('public_token', token)
        .maybeSingle();

      if (error) throw error;
      if (!invoice) return jsonResponse({ error: 'Invoice not found.' }, 404);

      if (invoice.status === 'paid') {
        return jsonResponse({ error: 'This invoice is already marked as paid.' }, 400);
      }

      const ownerConfirmToken = invoice.owner_confirm_token ?? crypto.randomUUID();
      const shouldNotifyOwner = invoice.status !== 'payment_sent';

      if (shouldNotifyOwner) {
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            status: 'payment_sent',
            owner_confirm_token: ownerConfirmToken,
          })
          .eq('id', invoice.id);

        if (updateError) throw updateError;
        invoice.status = 'payment_sent';
        invoice.owner_confirm_token = ownerConfirmToken;
      }

      const [{ data: settings, error: settingsError }, client] = await Promise.all([
        supabase
          .from('user_settings')
          .select(USER_SETTINGS_PUBLIC_SELECT)
          .eq('user_id', invoice.user_id)
          .single(),
        fetchClientForInvoice(supabase, String(invoice.user_id), invoice.client_id as string | null),
      ]);

      if (settingsError) throw settingsError;

      const ownerEmail = String(settings.email ?? '').trim();
      if (shouldNotifyOwner && ownerEmail && isValidEmail(ownerEmail)) {
        const context = buildContext(
          invoice,
          settings,
          clientDisplayName(client, String(invoice.client_name)),
          String(invoice.public_token),
          ownerConfirmToken
        );

        const fromName = String(settings.business_name ?? '').trim();
        const from = fromName ? `${fromName} <${ownerEmail}>` : ownerEmail;

        await sendResendEmail({
          apiKey: resendApiKey,
          from,
          to: [ownerEmail],
          subject: `Payment sent for invoice ${context.invoiceNumber}`,
          html: ownerNotificationHtml(context),
        });
      }

      return jsonResponse({
        ok: true,
        notifiedOwner: shouldNotifyOwner,
        ...toPublicPayload(invoice, settings, client),
      });
    }

    if (action === 'confirm_payment') {
      if (!resendApiKey) {
        return jsonResponse({ error: 'RESEND_API_KEY is not configured.' }, 500);
      }

      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(
          'id, user_id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status, public_token, owner_confirm_token, created_at'
        )
        .eq('owner_confirm_token', token)
        .maybeSingle();

      if (error) throw error;
      if (!invoice) return jsonResponse({ error: 'Confirmation link is invalid or expired.' }, 404);

      if (invoice.status === 'paid') {
        return jsonResponse({
          ok: true,
          alreadyPaid: true,
          invoiceNumber: invoice.number,
          clientName: String(invoice.client_name),
        });
      }

      const paidAt = new Date().toISOString().split('T')[0];
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: paidAt })
        .eq('id', invoice.id);

      if (updateError) throw updateError;
      invoice.status = 'paid';
      invoice.paid_at = paidAt;

      const [{ data: settings, error: settingsError }, clientRow] = await Promise.all([
        supabase
          .from('user_settings')
          .select(`${USER_SETTINGS_PUBLIC_SELECT}, email_templates`)
          .eq('user_id', invoice.user_id)
          .single(),
        fetchClientForInvoice(supabase, String(invoice.user_id), invoice.client_id as string | null),
      ]);

      if (settingsError) throw settingsError;

      const recipients = clientRecipients(clientRow);
      if (recipients.length > 0) {
        const templates = (settings.email_templates as EmailTemplates | null) ?? {};
        const template = templates.payment_received ?? defaultPaymentReceivedTemplate();
        const displayName = clientDisplayName(clientRow, String(invoice.client_name));
        const context = buildContext(
          invoice,
          settings,
          displayName,
          String(invoice.public_token ?? '')
        );
        const rendered = renderTemplate(template, context);
        const ownerEmail = String(settings.email ?? '').trim();
        const fromName = String(settings.business_name ?? '').trim();
        const from = fromName && ownerEmail ? `${fromName} <${ownerEmail}>` : ownerEmail;

        if (from && isValidEmail(ownerEmail)) {
          const publicClient = normalizePublicClient(clientRow, String(invoice.client_name));
          const pdfBase64 = generateInvoicePdfBase64({
            invoice: {
              number: String(invoice.number),
              issue_date: String(invoice.issue_date),
              due_date: invoice.due_date as string | null | undefined,
              line_items: (invoice.line_items as Array<Record<string, unknown>>) ?? [],
              notes: invoice.notes as string | null | undefined,
              tax_enabled: Boolean(invoice.tax_enabled),
              tax_rate: Number(invoice.tax_rate ?? 0),
              status: 'paid',
              client_name: String(invoice.client_name),
            },
            settings: {
              business_name: settings.business_name as string | null | undefined,
              email: settings.email as string | null | undefined,
              business_address: settings.business_address as string | null | undefined,
              payment_details: settings.payment_details as string | null | undefined,
            },
            client: publicClient,
            clientDisplayName: displayName,
          });

          await sendResendEmail({
            apiKey: resendApiKey,
            from,
            to: recipients,
            subject: rendered.subject,
            html: rendered.html,
            pdfBase64,
            filename: `${String(invoice.number)}.pdf`,
          });
        }
      }

      return jsonResponse({
        ok: true,
        invoiceNumber: invoice.number,
        clientName: clientDisplayName(clientRow, String(invoice.client_name)),
      });
    }

    return jsonResponse({ error: 'Unknown action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return jsonResponse({ error: message }, 500);
  }
});
