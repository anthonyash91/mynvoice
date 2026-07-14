import { defaultSettings } from '@/lib/settings';
import type { AppData } from '../types';

const LEGACY_SEED_STORAGE_KEY = 'mynvoice-data';
const LEGACY_IMPORT_PREFIX = 'mynvoice-local-imported';

/** Remove pre-auth demo seed data that used to live in localStorage. */
export function clearLegacyLocalSeedData(): void {
  try {
    localStorage.removeItem(LEGACY_SEED_STORAGE_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_IMPORT_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch {
    // Ignore quota / privacy-mode errors.
  }
}

export function emptyAppData(): AppData {
  return {
    clients: [],
    invoices: [],
    calendarEntries: [],
    recurringCalendarExclusions: [],
    emailHistory: [],
    settings: defaultSettings(),
    nextInvoiceNumber: 1,
  };
}
