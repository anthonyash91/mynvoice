import { createClient } from 'npm:@supabase/supabase-js@2';
import { clientDisplayName } from '../_shared/edgeEmail.ts';
import { generateInvoicePdfBase64 } from '../_shared/invoicePdf.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendInvoiceTracking {
  invoiceId?: string;
  invoiceNumber?: string;
  clientName?: string;
  emailKind?: string;
}

interface SendInvoiceRequest {
  invoiceId?: string;
  to?: string[];
  from?: string;
  subject?: string;
  html?: string;
  pdfBase64?: string;
  filename?: string;
  tracking?: SendInvoiceTracking;
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractEmailAddress(from: string): string | null {
  const match = from.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();

  const trimmed = from.trim();
  return isValidEmail(trimmed) ? trimmed : null;
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

function normalizeClientForPdf(client: Record<string, unknown> | null) {
  if (!client) return null;

  if ('company_name' in client || 'owner' in client) {
    return {
      companyName: String(client.company_name ?? ''),
      owner: String(client.owner ?? ''),
      primaryEmail: String(client.primary_email ?? ''),
      address: String(client.address ?? ''),
    };
  }

  return {
    companyName: String(client.company ?? ''),
    owner: String(client.name ?? ''),
    primaryEmail: String(client.email ?? ''),
    address: String(client.address ?? ''),
  };
}

async function buildInvoicePdfBase64(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  invoiceId: string
): Promise<string> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      'id, client_id, client_name, number, issue_date, due_date, line_items, notes, tax_enabled, tax_rate, status'
    )
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .single();

  if (error || !invoice) {
    throw new Error('Invoice not found.');
  }

  const [{ data: settings, error: settingsError }, clientRow] = await Promise.all([
    supabase
      .from('user_settings')
      .select('business_name, email, business_address, payment_details')
      .eq('user_id', userId)
      .single(),
    fetchClientForInvoice(supabase, userId, invoice.client_id as string | null),
  ]);

  if (settingsError) throw settingsError;

  return generateInvoicePdfBase64({
    invoice: {
      number: String(invoice.number),
      issue_date: String(invoice.issue_date),
      due_date: invoice.due_date as string | null | undefined,
      line_items: (invoice.line_items as Array<Record<string, unknown>>) ?? [],
      notes: invoice.notes as string | null | undefined,
      tax_enabled: Boolean(invoice.tax_enabled),
      tax_rate: Number(invoice.tax_rate ?? 0),
      status: String(invoice.status),
      client_name: String(invoice.client_name),
    },
    settings: {
      business_name: settings.business_name as string | null | undefined,
      email: settings.email as string | null | undefined,
      business_address: settings.business_address as string | null | undefined,
      payment_details: settings.payment_details as string | null | undefined,
    },
    client: normalizeClientForPdf(clientRow),
    clientDisplayName: clientDisplayName(clientRow, String(invoice.client_name)),
  });
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Supabase environment is not configured.' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header.' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized.' }, 401);
    }

    const body = (await req.json()) as SendInvoiceRequest;
    const to = (body.to ?? []).map((email) => email.trim()).filter(Boolean);
    const from = body.from?.trim() ?? '';
    const subject = body.subject?.trim() ?? '';
    const html = body.html?.trim() ?? '';
    const filename = body.filename?.trim() || 'invoice.pdf';
    const invoiceId = body.invoiceId?.trim() ?? body.tracking?.invoiceId?.trim() ?? '';

    let pdfBase64 = body.pdfBase64?.trim() ?? '';
    if (!pdfBase64 && invoiceId) {
      try {
        pdfBase64 = await buildInvoicePdfBase64(supabase, user.id, invoiceId);
      } catch (pdfError) {
        const message =
          pdfError instanceof Error ? pdfError.message : 'Failed to generate invoice PDF.';
        return jsonResponse({ error: message }, 500);
      }
    }

    if (to.length === 0) {
      return jsonResponse({ error: 'At least one recipient is required.' }, 400);
    }

    if (!from) {
      return jsonResponse({ error: 'Sender address is required.' }, 400);
    }

    if (!extractEmailAddress(from)) {
      return jsonResponse({ error: 'Sender address is invalid.' }, 400);
    }

    if (!subject) {
      return jsonResponse({ error: 'Subject is required.' }, 400);
    }

    if (!html) {
      return jsonResponse({ error: 'Email body is required.' }, 400);
    }

    const invalidRecipient = to.find((email) => !isValidEmail(email));
    if (invalidRecipient) {
      return jsonResponse({ error: `Invalid recipient: ${invalidRecipient}` }, 400);
    }

    const payload: Record<string, unknown> = {
      from,
      to,
      subject,
      html,
    };

    if (pdfBase64) {
      payload.attachments = [
        {
          filename,
          content: pdfBase64,
        },
      ];
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resendData = (await resendResponse.json()) as { id?: string; message?: string };

    if (!resendResponse.ok) {
      return jsonResponse(
        {
          error: resendData.message || 'Resend rejected the email request.',
        },
        resendResponse.status
      );
    }

    const tracking = body.tracking;
    if (
      tracking?.invoiceId &&
      tracking.invoiceNumber &&
      tracking.clientName &&
      tracking.emailKind
    ) {
      const { error: historyError } = await supabase.from('invoice_email_history').insert({
        user_id: user.id,
        invoice_id: tracking.invoiceId,
        invoice_number: tracking.invoiceNumber,
        client_name: tracking.clientName,
        email_kind: tracking.emailKind,
        sent_at: new Date().toISOString(),
      });

      if (historyError) {
        console.error('Failed to record invoice email history:', historyError.message);
      }
    }

    return jsonResponse({ ok: true, id: resendData.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return jsonResponse({ error: message }, 500);
  }
});
