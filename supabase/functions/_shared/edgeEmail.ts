import {
  automaticRemindersBlocked,
  resolveLateReminderIntervalDays,
  resolveUnpaidReminderIntervalDays,
} from './reminders.ts';

type EmailTemplate = {
  subject: string;
  html: string;
  css: string;
};

export function interpolate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => context[key] ?? '');
}

export function assembleEmailDocument(html: string, css: string): string {
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

export function renderEmailTemplate(template: EmailTemplate, context: Record<string, string>) {
  const html = interpolate(template.html, context);
  const css = interpolate(template.css, context);
  return {
    subject: interpolate(template.subject, context),
    html: assembleEmailDocument(html, css),
  };
}

export function defaultLateTemplate(): EmailTemplate {
  return {
    subject: 'Overdue: Invoice {{invoiceNumber}} from {{businessName}}',
    html: `<div class="email-outer"><div class="email-shell"><div class="email-card"><div class="email-header"><span class="email-badge">Overdue</span><div class="email-headline">Payment is past due</div><p class="email-intro">Hi {{clientName}}, invoice <strong>{{invoiceNumber}}</strong> for {{total}} is now overdue. Please send payment immediately.</p><p class="email-intro">{{dueDateLine}}</p></div><div class="email-body"><div class="email-details"><div class="email-amount">{{total}}</div><div class="email-meta">Due {{dueDate}}</div></div><a class="email-cta" href="{{paymentSentLink}}">Payment has been sent</a></div><div class="email-footer"><p class="email-business">{{businessName}}</p><p class="email-note">The invoice PDF is attached for your reference.</p></div></div></div></div>`,
    css: `body { margin:0; background:#f5f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#111; } .email-shell { padding:40px 16px; display:flex; justify-content:center; } .email-card { max-width:520px; width:100%; background:#fff; border:1px solid #e5e5e5; } .email-header,.email-body,.email-footer { padding:28px; } .email-badge { display:inline-block; padding:4px 10px; border-radius:999px; background:rgba(255,59,48,0.12); color:#FF3B30; font-size:11px; text-transform:uppercase; } .email-headline { margin-top:14px; font-size:22px; font-weight:500; } .email-intro { color:#6e6e73; font-size:14px; line-height:1.55; } .email-amount { font-size:24px; font-weight:500; color:#111; } .email-meta { margin-top:12px; color:#6e6e73; font-size:12px; } .email-cta { display:block; text-align:center; margin-top:20px; padding:12px 16px; border-radius:8px; background:#FF3B30; color:#fff !important; text-decoration:none; font-weight:500; } .email-business { margin:0; font-size:13px; font-weight:500; } .email-note { margin:8px 0 0; color:#6e6e73; font-size:12px; line-height:1.5; }`,
  };
}

export function defaultReminderTemplate(): EmailTemplate {
  return {
    subject: 'Reminder: Invoice {{invoiceNumber}} from {{businessName}}',
    html: `<div class="email-outer"><div class="email-shell"><div class="email-card"><div class="email-header"><span class="email-badge">Payment reminder</span><div class="email-headline">Friendly payment reminder</div><p class="email-intro">Hi {{clientName}}, invoice <strong>{{invoiceNumber}}</strong> for {{total}} is still outstanding.</p><p class="email-intro">{{dueDateLine}}</p></div><div class="email-body"><div class="email-details"><div class="email-amount">{{total}}</div><div class="email-meta">Due {{dueDate}}</div></div><a class="email-cta" href="{{paymentSentLink}}">Payment has been sent</a></div><div class="email-footer"><p class="email-business">{{businessName}}</p><p class="email-note">If you have already sent payment, thank you — you can ignore this reminder.</p></div></div></div></div>`,
    css: `body { margin:0; background:#f5f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#111; } .email-shell { padding:40px 16px; display:flex; justify-content:center; } .email-card { max-width:520px; width:100%; background:#fff; border:1px solid #e5e5e5; } .email-header,.email-body,.email-footer { padding:28px; } .email-badge { display:inline-block; padding:4px 10px; border-radius:999px; background:rgba(255,149,0,0.14); color:#FF9500; font-size:11px; text-transform:uppercase; } .email-headline { margin-top:14px; font-size:22px; font-weight:500; } .email-intro { color:#6e6e73; font-size:14px; line-height:1.55; } .email-amount { font-size:24px; font-weight:500; color:#111; } .email-meta { margin-top:12px; color:#6e6e73; font-size:12px; } .email-cta { display:block; text-align:center; margin-top:20px; padding:12px 16px; border-radius:8px; background:#FF9500; color:#fff !important; text-decoration:none; font-weight:500; } .email-business { margin:0; font-size:13px; font-weight:500; } .email-note { margin:8px 0 0; color:#6e6e73; font-size:12px; line-height:1.5; }`,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDateLong(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function localDateStringFromMs(ms: number): string {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function utcDateStringFromMs(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextCronRunUtcMs(now = Date.now()): number {
  const nowDate = new Date(now);
  const runToday = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate(),
    9,
    0,
    0,
    0
  );
  if (now < runToday) return runToday;
  return runToday + MS_PER_DAY;
}

function reminderIntervalForInvoice(
  invoice: Record<string, unknown>,
  client: Record<string, unknown> | null,
  settings: Record<string, unknown>
): number | null {
  const status = String(invoice.status ?? '');
  if (status === 'overdue') {
    return resolveLateReminderIntervalDays(invoice, client, settings);
  }
  if (status === 'unpaid' || status === 'draft') {
    return resolveUnpaidReminderIntervalDays(invoice, client, settings);
  }
  return null;
}

function invoiceNextReminderDate(
  invoice: Record<string, unknown>,
  settings: Record<string, unknown>,
  client: Record<string, unknown> | null,
  forOutgoingEmail = false,
  now = Date.now()
): string {
  const interval = reminderIntervalForInvoice(invoice, client, settings);
  if (interval === null || automaticRemindersBlocked(invoice, new Date(now))) return '—';

  const emailSendCount = Number(invoice.email_send_count ?? 0);
  const lastEmailSentAt = invoice.last_email_sent_at
    ? String(invoice.last_email_sent_at)
    : null;

  if (forOutgoingEmail) {
    return formatDateLong(localDateStringFromMs(now + interval * MS_PER_DAY));
  }

  if (emailSendCount <= 0 || !lastEmailSentAt) return '—';

  const lastSentMs = new Date(lastEmailSentAt).getTime();
  const daysSinceLastSend = Math.floor((now - lastSentMs) / MS_PER_DAY);
  const daysLeft = Math.max(0, interval - daysSinceLastSend);

  const dateStr =
    daysLeft === 0
      ? utcDateStringFromMs(nextCronRunUtcMs(now))
      : localDateStringFromMs(lastSentMs + interval * MS_PER_DAY);

  return formatDateLong(dateStr);
}

function invoiceEmailSendCountForTemplate(
  invoice: Record<string, unknown>,
  forOutgoingEmail = false
): string {
  const count = Number(invoice.email_send_count ?? 0);
  return String(Math.max(0, forOutgoingEmail ? count + 1 : count));
}

export function calculateTotal(
  lineItems: Array<{ quantity: number; rate: number }>,
  taxEnabled: boolean,
  taxRate: number
): number {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const tax = taxEnabled ? subtotal * (taxRate / 100) : 0;
  return subtotal + tax;
}

export function appOrigin(): string {
  const configured = Deno.env.get('APP_URL')?.trim() || Deno.env.get('VITE_APP_URL')?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return '';
}

export function buildInvoiceEmailContext(
  invoice: Record<string, unknown>,
  settings: Record<string, unknown>,
  clientName: string,
  publicToken: string,
  options?: { forOutgoingEmail?: boolean; client?: Record<string, unknown> | null }
): Record<string, string> {
  const forOutgoingEmail = options?.forOutgoingEmail ?? false;
  const client = options?.client ?? null;
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
  const invoiceLink = origin && publicToken ? `${origin}/i/${publicToken}` : '';
  const paymentSentLink =
    origin && publicToken ? `${origin}/i/${publicToken}/payment-sent` : '';

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
    confirmPaymentLink: '',
    paymentDate: '—',
    emailSendCount: invoiceEmailSendCountForTemplate(invoice, forOutgoingEmail),
    nextReminderDate: invoiceNextReminderDate(
      invoice,
      settings,
      client,
      forOutgoingEmail
    ),
  };
}

export function clientDisplayName(
  client: Record<string, unknown> | null,
  fallback: string
): string {
  if (!client) return fallback;
  const company = String(client.company_name ?? client.company ?? '').trim();
  const owner = String(client.owner ?? client.name ?? '').trim();
  if (company && owner) return `${owner} · ${company}`;
  return company || owner || fallback;
}

export function clientRecipients(client: Record<string, unknown> | null): string[] {
  if (!client) return [];
  const emails = [
    String(client.primary_email ?? client.email ?? '').trim(),
    ...((client.additional_emails as string[] | undefined) ?? []).map((email) => email.trim()),
  ].filter(Boolean);
  return [...new Set(emails)];
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function sendResendEmail(input: {
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
