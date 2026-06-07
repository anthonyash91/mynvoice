import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendInvoiceRequest {
  to?: string[];
  from?: string;
  subject?: string;
  html?: string;
  pdfBase64?: string;
  filename?: string;
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
    const pdfBase64 = body.pdfBase64?.trim() ?? '';
    const filename = body.filename?.trim() || 'invoice.pdf';

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

    return jsonResponse({ ok: true, id: resendData.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return jsonResponse({ error: message }, 500);
  }
});
