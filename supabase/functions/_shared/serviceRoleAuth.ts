import { createClient } from 'npm:@supabase/supabase-js@2';

function configuredServiceRoleKeys(): string[] {
  return [
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    Deno.env.get('SERVICE_ROLE_KEY'),
  ]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean);
}

function bearerToken(req: Request): string {
  const authHeader = req.headers.get('Authorization') ?? '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Authorize cron / service callers for reminder automation.
 *
 * Accepts:
 * 1. Exact match against the auto-injected or manually configured service-role key
 * 2. Any JWT that Supabase accepts as service_role (validates via Auth Admin API)
 *
 * This avoids hard failures when Vault stores an older-but-still-valid service_role JWT
 * that differs from the currently injected SUPABASE_SERVICE_ROLE_KEY string.
 */
export async function authorizeServiceRoleRequest(
  req: Request,
  supabaseUrl: string
): Promise<{ ok: true; serviceRoleKey: string } | { ok: false; status: number; error: string }> {
  const configuredKeys = configuredServiceRoleKeys();
  if (configuredKeys.length === 0) {
    return {
      ok: false,
      status: 500,
      error:
        'Service role key is not configured. Deploy to Supabase (auto-injected) or set SERVICE_ROLE_KEY for local/cron use.',
    };
  }

  const token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized.' };
  }

  // Prefer the auto-injected cloud key when available.
  const preferredKey = configuredKeys[0];

  if (configuredKeys.includes(token)) {
    return { ok: true, serviceRoleKey: preferredKey };
  }

  const payload = decodeJwtPayload(token);
  if (payload?.role !== 'service_role') {
    return { ok: false, status: 401, error: 'Unauthorized.' };
  }

  try {
    const probe = createClient(supabaseUrl, token, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      return { ok: false, status: 401, error: 'Unauthorized.' };
    }
    // Use the injected/preferred key for subsequent privileged DB work.
    return { ok: true, serviceRoleKey: preferredKey };
  } catch {
    return { ok: false, status: 401, error: 'Unauthorized.' };
  }
}
