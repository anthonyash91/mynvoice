export interface StoredPayPalSettings {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  /** True when PayPal columns are missing or could not be written to the database. */
  dbUnavailable?: boolean;
}

const STORAGE_PREFIX = 'mynvoice-paypal-settings';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function loadPayPalSettingsFromStorage(userId: string): StoredPayPalSettings | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPayPalSettings>;
    if (typeof parsed.sandbox !== 'boolean') return null;
    return {
      clientId: String(parsed.clientId ?? ''),
      clientSecret: String(parsed.clientSecret ?? ''),
      sandbox: parsed.sandbox,
      dbUnavailable: parsed.dbUnavailable === true,
    };
  } catch {
    return null;
  }
}

export function savePayPalSettingsToStorage(
  userId: string,
  settings: Pick<StoredPayPalSettings, 'clientId' | 'clientSecret' | 'sandbox'> & {
    dbUnavailable?: boolean;
  }
): void {
  try {
    const payload: StoredPayPalSettings = {
      clientId: settings.clientId,
      clientSecret: settings.clientSecret,
      sandbox: settings.sandbox,
      dbUnavailable: settings.dbUnavailable === true,
    };
    localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // Ignore quota errors; database remains the primary store when available.
  }
}
