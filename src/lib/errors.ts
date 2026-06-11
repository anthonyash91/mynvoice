function messageFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;

  if ('error' in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error.trim();
  }

  if ('message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }

  return null;
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    const contentType = response.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = (await response.text()).trim();
    if (!text) return null;

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { message: text.slice(0, 500) };
    }
  } catch {
    return null;
  }
}

function statusFallback(response: Response | undefined, fallback: string): string | null {
  if (!response) return null;

  if (response.status === 413) {
    return 'Request payload too large for the email service. The app will retry with a server-generated PDF on the next attempt after you refresh.';
  }

  if (response.status === 401) {
    return 'Your session expired. Sign in again, then resend the invoice.';
  }

  if (response.status >= 500) {
    return `${fallback} Server error (${response.status}). Check that RESEND_API_KEY is set in Supabase secrets.`;
  }

  const statusLabel = [response.status, response.statusText].filter(Boolean).join(' ');
  if (statusLabel) {
    return `${fallback} (${statusLabel})`;
  }

  return null;
}

export function formatUnknownError(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();

  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }

  return fallback;
}

export function hasFunctionInvokeFailure(data: unknown, error: unknown): boolean {
  if (error) return true;
  return (
    data !== null &&
    typeof data === 'object' &&
    'error' in data &&
    Boolean((data as { error?: unknown }).error)
  );
}

/** Read the real error message from a Supabase Edge Function invoke result. */
export async function readFunctionInvokeError(
  data: unknown,
  error: unknown,
  fallback: string,
  response?: Response
): Promise<string> {
  const fromData = messageFromBody(data);
  if (fromData) return fromData;

  const responseToRead =
    response ??
    (error && typeof error === 'object' && 'context' in error
      ? (error as { context?: Response }).context
      : undefined);

  if (responseToRead) {
    try {
      if (!responseToRead.bodyUsed) {
        const body = await readResponseBody(responseToRead.clone());
        const fromBody = messageFromBody(body);
        if (fromBody) return fromBody;
      }
    } catch {
      // Ignore response parsing failures and fall back below.
    }

    const statusMessage = statusFallback(responseToRead, fallback);
    if (statusMessage) return statusMessage;
  }

  const generic = formatUnknownError(error, fallback);
  if (generic === 'Edge Function returned a non-2xx status code') {
    return `${fallback} Verify RESEND_API_KEY, your verified sender in Resend, and Settings → Email.`;
  }

  return generic;
}
