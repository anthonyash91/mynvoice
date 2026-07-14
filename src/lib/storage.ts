import { defaultSettings } from '@/lib/settings';
import type { AppData } from '../types';

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
