import {
  buildEmailTemplateContext,
  emailTemplateForSend,
  normalizeEmailTemplates,
  renderEmailTemplate,
} from '@/lib/emailTemplates';
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
  to: string[];
  from: string;
  subject: string;
  html: string;
  pdfBase64: string;
  filename: string;
  tracking?: SendInvoiceEmailTracking;
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-invoice', {
    body: input,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send invoice email.');
  }

  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: string }).error;
    throw new Error(message || 'Failed to send invoice email.');
  }
}

export async function sendInvoiceWithPdf(
  invoice: Invoice,
  client: Client,
  settings: Settings,
  pdfBase64: string,
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
    to: invoiceEmailRecipients(client),
    from: invoiceEmailFrom(settings),
    subject: rendered.subject,
    html: rendered.html,
    pdfBase64,
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
