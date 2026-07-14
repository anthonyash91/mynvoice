import { migrateEmailTemplates } from '@/lib/emailTemplates';
import type { Settings } from '@/types';

export function needsSettingsSetup(settings: Settings): boolean {
  return !settings.businessName.trim() || !settings.email.trim();
}

export function defaultSettings(): Settings {
  return {
    businessName: '',
    email: '',
    businessAddress: '',
    mailingAddress: '',
    paymentDetails: '',
    defaultTaxRate: 0,
    defaultDueDays: 14,
    reminderIntervalDays: 5,
    lateReminderIntervalDays: 3,
    paypalClientId: '',
    paypalClientSecret: '',
    paypalSandbox: true,
    logo: null,
    emailTemplates: migrateEmailTemplates(),
  };
}
