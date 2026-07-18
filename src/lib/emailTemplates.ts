import {
  calculateTotal,
  formatCurrency,
  formatDateLong,
  formatDateTime,
} from '@/lib/calculations';
import { clientDisplayName } from '@/lib/client';
import {
  DEFAULT_EMAIL_TEMPLATE_CSS,
  DEFAULT_EMAIL_TEMPLATE_HTML,
  DEFAULT_EMAIL_TEMPLATE_SUBJECTS,
} from '@/lib/emailTemplateDefaults';
import {
  appOrigin,
  ownerConfirmPaymentUrl,
  publicInvoiceUrl,
  publicPaymentSentUrl,
} from '@/lib/appUrl';
import {
  formatPaymentDate,
  invoiceEmailSendCountForTemplate,
  invoiceNextReminderDate,
} from '@/lib/invoice';
import type {
  Client,
  EmailTemplate,
  EmailTemplateKind,
  EmailTemplates,
  Invoice,
  InvoiceStatus,
  Settings,
} from '@/types';

export const EMAIL_TEMPLATE_VARIABLES = [
  { key: 'clientName', label: 'Client name' },
  { key: 'invoiceNumber', label: 'Invoice number' },
  { key: 'issueDate', label: 'Issue date' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'dueDateLine', label: 'Due date sentence' },
  { key: 'total', label: 'Invoice total' },
  { key: 'businessName', label: 'Business name' },
  { key: 'invoiceLink', label: 'Public invoice page' },
  { key: 'paymentSentLink', label: 'Payment has been sent link' },
  { key: 'confirmPaymentLink', label: 'Owner confirm payment link' },
  { key: 'paymentDate', label: 'Date marked paid' },
  { key: 'emailSendCount', label: 'Emails sent (including this one)' },
  { key: 'nextReminderDate', label: 'Next automatic reminder date' },
] as const;

const EMAIL_KIND_SENT_LABELS: Record<EmailTemplateKind, string> = {
  unpaid: 'Initial email',
  reminder: 'Reminder email',
  late: 'Late email',
  payment_received: 'Payment received email',
};

export function emailKindSentLabel(kind: EmailTemplateKind): string {
  return EMAIL_KIND_SENT_LABELS[kind];
}

export function invoiceEmailSentTooltip(
  count: number,
  sentAt: string | null,
  kind: EmailTemplateKind | null
): string {
  if (count <= 0 || !sentAt) return '';
  const when = formatDateTime(sentAt);
  if (kind) return `Last sent ${when} — ${emailKindSentLabel(kind)}`;
  return `Last sent ${when}`;
}

export const EMAIL_TEMPLATE_META: Record<
  EmailTemplateKind,
  { label: string; description: string }
> = {
  unpaid: {
    label: 'Unpaid',
    description: 'New invoices and resends while payment is not yet late.',
  },
  reminder: {
    label: 'Reminder',
    description: 'Friendly reminder that payment is still outstanding.',
  },
  late: {
    label: 'Late',
    description: 'Urgent notice after the due date has passed.',
  },
  payment_received: {
    label: 'Payment received',
    description: 'Sent to the client when you confirm their payment.',
  },
};

const SAMPLE_PUBLIC_TOKEN = '00000000-0000-4000-8000-000000000001';
const SAMPLE_OWNER_CONFIRM_TOKEN = '00000000-0000-4000-8000-000000000002';

export const SAMPLE_EMAIL_TEMPLATE_CONTEXT: Record<string, string> = {
  clientName: 'Acme Studio',
  invoiceNumber: 'INV-024',
  issueDate: 'June 1, 2026',
  dueDate: 'June 15, 2026',
  dueDateLine: 'Payment is due June 15, 2026.',
  total: '$1,240.00',
  businessName: 'Anthony Mercer',
  paymentDate: 'June 7, 2026',
  emailSendCount: '2',
  nextReminderDate: 'June 12, 2026',
  invoiceLink: '',
  paymentSentLink: '',
  confirmPaymentLink: '',
};

/** Sample context for template preview — includes demo payment links. */
export function buildSampleEmailTemplateContext(): Record<string, string> {
  const origin = appOrigin() || 'https://your-app.example.com';

  return {
    ...SAMPLE_EMAIL_TEMPLATE_CONTEXT,
    invoiceLink: `${origin}/i/${SAMPLE_PUBLIC_TOKEN}`,
    paymentSentLink: `${origin}/i/${SAMPLE_PUBLIC_TOKEN}?payment=sent`,
    confirmPaymentLink: `${origin}/confirm-payment/${SAMPLE_OWNER_CONFIRM_TOKEN}`,
  };
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  unpaid: {
    subject: DEFAULT_EMAIL_TEMPLATE_SUBJECTS.unpaid,
    html: DEFAULT_EMAIL_TEMPLATE_HTML.unpaid,
    css: DEFAULT_EMAIL_TEMPLATE_CSS.unpaid,
  },
  reminder: {
    subject: DEFAULT_EMAIL_TEMPLATE_SUBJECTS.reminder,
    html: DEFAULT_EMAIL_TEMPLATE_HTML.reminder,
    css: DEFAULT_EMAIL_TEMPLATE_CSS.reminder,
  },
  late: {
    subject: DEFAULT_EMAIL_TEMPLATE_SUBJECTS.late,
    html: DEFAULT_EMAIL_TEMPLATE_HTML.late,
    css: DEFAULT_EMAIL_TEMPLATE_CSS.late,
  },
  payment_received: {
    subject: DEFAULT_EMAIL_TEMPLATE_SUBJECTS.payment_received,
    html: DEFAULT_EMAIL_TEMPLATE_HTML.payment_received,
    css: DEFAULT_EMAIL_TEMPLATE_CSS.payment_received,
  },
};

const LEGACY_PLAIN_DEFAULTS = new Set([
  `Hi {{clientName}},

Please find attached invoice {{invoiceNumber}} for {{total}}.

{{dueDateLine}}

If you have any questions, reply to this email.

{{businessName}}`,
  `Hi {{clientName}},

This is a friendly reminder that invoice {{invoiceNumber}} for {{total}} is still outstanding.

{{dueDateLine}}

Please let us know if you have any questions.

{{businessName}}`,
  `Hi {{clientName}},

Invoice {{invoiceNumber}} for {{total}} is now past due. The payment due date was {{dueDate}}.

Please send payment immediately. The invoice is attached for your reference.

{{businessName}}`,
]);

function isLegacyTableTemplate(html: string): boolean {
  return /<table[^>]*class="email-/i.test(html);
}

function shouldUpgradeToDefault(template?: Partial<EmailTemplate>): boolean {
  if (template?.html?.trim() || template?.css?.trim()) return false;

  const body = template?.body?.trim();
  if (!body) return true;
  if (isHtmlEmailBody(body)) return false;
  return LEGACY_PLAIN_DEFAULTS.has(body);
}

function splitLegacyHtmlDocument(document: string): { html: string; css: string } {
  const trimmed = document.trim();
  const cssBlocks: string[] = [];
  const withoutStyles = trimmed.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => {
    if (css.trim()) cssBlocks.push(css.trim());
    return '';
  });

  const bodyMatch = withoutStyles.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return { html: bodyMatch[1].trim(), css: cssBlocks.join('\n\n') };
  }

  if (isHtmlEmailBody(withoutStyles)) {
    const html = withoutStyles
      .replace(/<!DOCTYPE[^>]*>/i, '')
      .replace(/<head[\s\S]*?<\/head>/i, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '')
      .trim();
    return { html, css: cssBlocks.join('\n\n') };
  }

  return { html: trimmed, css: cssBlocks.join('\n\n') };
}

const EMAIL_TEMPLATE_KINDS: EmailTemplateKind[] = [
  'unpaid',
  'reminder',
  'late',
  'payment_received',
];

export function hasStoredEmailTemplates(templates?: Partial<EmailTemplates> | null): boolean {
  if (!templates) return false;

  return EMAIL_TEMPLATE_KINDS.some((kind) => {
    const template = templates[kind];
    if (!template) return false;
    return Boolean(
      template.subject?.trim() ||
        template.html?.trim() ||
        template.css?.trim() ||
        template.body?.trim()
    );
  });
}

function resolveTemplateField(
  kind: EmailTemplateKind,
  field: 'subject' | 'html' | 'css',
  value: string | undefined
): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  return DEFAULT_EMAIL_TEMPLATES[kind][field];
}

function resolveTemplateCss(kind: EmailTemplateKind, value: string | undefined): string {
  if (value !== undefined) return value;
  return DEFAULT_EMAIL_TEMPLATES[kind].css;
}

function migrateTemplate(
  kind: EmailTemplateKind,
  template?: Partial<EmailTemplate>
): EmailTemplate {
  if (shouldUpgradeToDefault(template)) {
    return DEFAULT_EMAIL_TEMPLATES[kind];
  }

  if (template?.html?.trim() || template?.css?.trim()) {
    const html = template.html?.trim() || '';

    if (isLegacyTableTemplate(html)) {
      return DEFAULT_EMAIL_TEMPLATES[kind];
    }

    return {
      subject: resolveTemplateField(kind, 'subject', template.subject),
      html: resolveTemplateField(kind, 'html', template.html),
      css: resolveTemplateCss(kind, template.css),
    };
  }

  const body = template?.body?.trim() || '';
  if (isHtmlEmailBody(body)) {
    const { html, css } = splitLegacyHtmlDocument(body);

    if (isLegacyTableTemplate(html)) {
      return DEFAULT_EMAIL_TEMPLATES[kind];
    }

    return {
      subject: resolveTemplateField(kind, 'subject', template?.subject),
      html: html || DEFAULT_EMAIL_TEMPLATES[kind].html,
      css: css || DEFAULT_EMAIL_TEMPLATES[kind].css,
    };
  }

  return {
    subject: resolveTemplateField(kind, 'subject', template?.subject),
    html: body,
    css: '',
  };
}

function prepareTemplate(
  kind: EmailTemplateKind,
  template?: Partial<EmailTemplate>
): EmailTemplate {
  return {
    subject: resolveTemplateField(kind, 'subject', template?.subject),
    html: resolveTemplateField(kind, 'html', template?.html),
    css: resolveTemplateCss(kind, template?.css),
  };
}

/** Load-time migration: upgrades legacy formats and fills missing fields. */
export function migrateEmailTemplates(templates?: Partial<EmailTemplates> | null): EmailTemplates {
  return {
    unpaid: migrateTemplate('unpaid', templates?.unpaid),
    reminder: migrateTemplate('reminder', templates?.reminder),
    late: migrateTemplate('late', templates?.late),
    payment_received: migrateTemplate('payment_received', templates?.payment_received),
  };
}

/** Save-time normalization: preserves user edits, only fills blanks. */
export function prepareEmailTemplatesForStorage(
  templates?: Partial<EmailTemplates> | null
): EmailTemplates {
  return {
    unpaid: prepareTemplate('unpaid', templates?.unpaid),
    reminder: prepareTemplate('reminder', templates?.reminder),
    late: prepareTemplate('late', templates?.late),
    payment_received: prepareTemplate('payment_received', templates?.payment_received),
  };
}

export function normalizeEmailTemplates(templates?: Partial<EmailTemplates> | null): EmailTemplates {
  return migrateEmailTemplates(templates);
}

export function buildEmailTemplateContext(
  invoice: Invoice,
  client: Client | null,
  settings: Settings,
  options?: { forOutgoingEmail?: boolean }
): Record<string, string> {
  const forOutgoingEmail = options?.forOutgoingEmail ?? true;
  const totals = calculateTotal(invoice.lineItems, invoice.taxEnabled, invoice.taxRate);
  const clientName = client ? clientDisplayName(client) : invoice.clientName;
  const dueDate = invoice.dueDate ? formatDateLong(invoice.dueDate) : '';
  const dueDateLine = invoice.dueDate ? `Payment is due ${dueDate}.` : '';

  const publicToken = invoice.publicToken ?? '';
  const invoiceLink = publicToken ? publicInvoiceUrl(publicToken) : '';
  const paymentSentLink = publicToken ? publicPaymentSentUrl(publicToken) : '';

  return {
    clientName,
    invoiceNumber: invoice.number,
    issueDate: formatDateLong(invoice.issueDate),
    dueDate: dueDate || '—',
    dueDateLine,
    total: formatCurrency(totals.total),
    businessName: settings.businessName.trim() || settings.email.trim(),
    invoiceLink,
    paymentSentLink,
    confirmPaymentLink: '',
    paymentDate: formatPaymentDate(invoice.paidAt),
    emailSendCount: invoiceEmailSendCountForTemplate(invoice, forOutgoingEmail),
    nextReminderDate: invoiceNextReminderDate(
      invoice,
      {
        reminderIntervalDays: settings.reminderIntervalDays,
        lateReminderIntervalDays: settings.lateReminderIntervalDays,
      },
      { forOutgoingEmail, client }
    ),
  };
}

export function buildOwnerNotificationContext(
  invoice: Invoice,
  client: Client | null,
  settings: Settings,
  ownerConfirmToken: string
): Record<string, string> {
  return {
    ...buildEmailTemplateContext(invoice, client, settings),
    confirmPaymentLink: ownerConfirmPaymentUrl(ownerConfirmToken),
  };
}

export function isHtmlEmailBody(body: string): boolean {
  return /^\s*<!DOCTYPE html|^\s*<html[\s>]/i.test(body.trim());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plainTextToHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  if (paragraphs.length === 0) {
    return '<p class="email-plain-empty"></p>';
  }

  return paragraphs
    .map(
      (paragraph) =>
        `<p class="email-plain-paragraph">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`
    )
    .join('');
}

function injectCssIntoDocument(document: string, css: string): string {
  const trimmedCss = css.trim();
  if (!trimmedCss) return document;

  if (/<\/head>/i.test(document)) {
    return document.replace(/<\/head>/i, `<style>${trimmedCss}</style></head>`);
  }

  if (/<body[\s>]/i.test(document)) {
    return document.replace(/<body([^>]*)>/i, `<body$1><style>${trimmedCss}</style>`);
  }

  return document;
}

export function assembleEmailDocument(html: string, css: string): string {
  const trimmedHtml = html.trim();
  const trimmedCss = css.trim();

  if (isHtmlEmailBody(trimmedHtml)) {
    return trimmedCss ? injectCssIntoDocument(trimmedHtml, trimmedCss) : trimmedHtml;
  }

  const styleBlock = trimmedCss ? `<style>${trimmedCss}</style>` : '';

  if (!trimmedHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${styleBlock}
</head>
<body></body>
</html>`;
  }

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

export function wrapEmailDocument(body: string): string {
  if (isHtmlEmailBody(body)) {
    return body;
  }

  return assembleEmailDocument(
    `<div class="email-plain-wrap">${plainTextToHtml(body)}</div>`,
    `.email-plain-wrap {
  max-width: 520px;
  margin: 0 auto;
  padding: 28px;
  background: #ffffff;
  border: 1px solid #e5e5e5;
  font-size: 14px;
  line-height: 1.55;
}
.email-plain-paragraph {
  margin: 0 0 16px;
}
.email-plain-empty {
  margin: 0;
}
body {
  margin: 0;
  padding: 32px 16px;
  background-color: #f5f5f7;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  color: #111111;
}`
  );
}

export function interpolateEmailTemplate(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => context[key] ?? '');
}

export function renderEmailTemplate(
  template: EmailTemplate,
  context: Record<string, string>
): { subject: string; html: string } {
  const subject = interpolateEmailTemplate(template.subject, context);
  const html = interpolateEmailTemplate(template.html, context);
  const css = interpolateEmailTemplate(template.css, context);

  const hasStructuredTemplate = Boolean(template.html.trim() || template.css.trim());

  return {
    subject,
    html: hasStructuredTemplate ? assembleEmailDocument(html, css) : wrapEmailDocument(html),
  };
}

export function emailTemplateForSend(
  resolvedStatus: InvoiceStatus,
  purpose: 'invoice' | 'reminder'
): EmailTemplateKind {
  if (purpose === 'reminder') return 'reminder';
  if (resolvedStatus === 'overdue') return 'late';
  return 'unpaid';
}
