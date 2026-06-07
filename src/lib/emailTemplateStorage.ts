import { migrateEmailTemplates } from '@/lib/emailTemplates';
import type { EmailTemplates } from '@/types';

const STORAGE_PREFIX = 'mynvoice-email-templates';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function loadEmailTemplatesFromStorage(userId: string): EmailTemplates | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EmailTemplates>;
    return migrateEmailTemplates(parsed);
  } catch {
    return null;
  }
}

export function saveEmailTemplatesToStorage(userId: string, templates: EmailTemplates): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(templates));
  } catch {
    // Ignore quota errors; database remains the primary store.
  }
}
