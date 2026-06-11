import {
  buildEmailTemplateContext,
  emailTemplateForSend,
  normalizeEmailTemplates,
  renderEmailTemplate,
} from '@/lib/emailTemplates';
import { hasFunctionInvokeFailure, readFunctionInvokeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Client, EmailTemplateKind, Invoice, Settings } from '@/types';

export function invoiceEmailRecipients(client: Client): string[] {
  const emails = [client.primaryEmail, ...client.additionalEmails]
    .map((email) => email.trim())
    .filter(Boolean);

  return [...new Set(emails)];
}

export function invoiceEmailFrom(settings: Settings): string {
  const email = settings.email.trim();
  const name = settings.businessName.trim();

  if (email && name) {
    return `${name} <${email}>`;
  }

  return email;
}

export function validateInvoiceEmail(
  client: Client | null,
  settings: Settings
): string | null {
  if (!settings.email.trim()) {
    return 'Add your business email in Settings before sending invoices.';
  }

  if (!client) {
    return 'Link this invoice to a client before sending.';
  }

  if (invoiceEmailRecipients(client).length === 0) {
    return 'Add a primary email to this client before sending.';
  }

  return null;
}

interface SendInvoiceEmailTracking {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  emailKind: EmailTemplateKind;
}

interface SendInvoiceEmailInput {
  invoiceId?: string;
  to: string[];
  from: string;
  subject: string;
  html: string;
  pdfBase64?: string;
  filename: string;
  tracking?: SendInvoiceEmailTracking;
}

const MAX_INVOICE_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<void> {
  if (input.pdfBase64) {
    const approxBytes = Math.ceil((input.pdfBase64.length * 3) / 4);
    if (approxBytes > MAX_INVOICE_ATTACHMENT_BYTES) {
      const sizeMb = (approxBytes / (1024 * 1024)).toFixed(1);
      throw new Error(
        `PDF attachment is too large (${sizeMb} MB). Try a shorter invoice or remove the logo, then send again.`
      );
    }
  }

  const { data, error, response } = await supabase.functions.invoke('send-invoice', {
    body: {
      ...input,
      invoiceId: input.invoiceId ?? input.tracking?.invoiceId,
      pdfBase64: input.pdfBase64?.trim() || undefined,
    },
  });

  if (hasFunctionInvokeFailure(data, error)) {
    const failureMessage = await readFunctionInvokeError(
      data,
      error,
      'Failed to send invoice email.',
      response
    );
    throw new Error(failureMessage);
  }
}

export async function sendInvoiceWithPdf(
  invoice: Invoice,
  client: Client,
  settings: Settings,
  pdfBase64: string | undefined,
  templateKind: EmailTemplateKind
): Promise<void> {
  const validationError = validateInvoiceEmail(client, settings);
  if (validationError) {
    throw new Error(validationError);
  }

  if (!invoice.publicToken?.trim()) {
    throw new Error(
      'This invoice does not have a public link yet. Run supabase/migrate-invoice-payment-flow.sql in Supabase, then send again.'
    );
  }

  const templates = normalizeEmailTemplates(settings.emailTemplates);
  const context = buildEmailTemplateContext(invoice, client, settings);

  if (!context.invoiceLink?.trim() || !context.paymentSentLink?.trim()) {
    throw new Error(
      'Invoice links are empty. Set VITE_APP_URL in .env (e.g. http://localhost:5173), restart the dev server, then send again.'
    );
  }

  const rendered = renderEmailTemplate(templates[templateKind], context);

  await sendInvoiceEmail({
    invoiceId: invoice.id,
    to: invoiceEmailRecipients(client),
    from: invoiceEmailFrom(settings),
    subject: rendered.subject,
    html: rendered.html,
    pdfBase64: pdfBase64?.trim() || undefined,
    filename: `${invoice.number}.pdf`,
    tracking: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientName: invoice.clientName,
      emailKind: templateKind,
    },
  });
}

export function resolveSendTemplateKind(
  resolvedStatus: ReturnType<typeof import('@/lib/invoice').resolveStatus>,
  purpose: 'invoice' | 'reminder'
): EmailTemplateKind {
  return emailTemplateForSend(resolvedStatus, purpose);
}
