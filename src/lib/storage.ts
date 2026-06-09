import { normalizeEmailTemplates } from '@/lib/emailTemplates';
import { emptyInvoiceReminderSettings } from '@/lib/invoice';
import type { AppData } from '../types';

const DEFAULT_CLIENT_REMINDER_FIELDS = {
  reminderIntervalDays: null,
  lateReminderIntervalDays: null,
} as const;

const STORAGE_KEY = 'mynvoice-data';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function seedData(): AppData {
  const clients = [
    {
      id: 'c1',
      companyName: 'Chen Studio',
      owner: 'Mia Chen',
      primaryEmail: 'mia@chenstudio.co',
      hourlyRate: 150,
      additionalEmails: [],
      additionalRates: [],
      recurringLineItems: [],
      recurringCalendarExclusions: [],
      address: '',
      ...DEFAULT_CLIENT_REMINDER_FIELDS,
    },
    {
      id: 'c2',
      companyName: 'Northline Media',
      owner: 'James Okonkwo',
      primaryEmail: 'james@northline.io',
      hourlyRate: 175,
      additionalEmails: [],
      additionalRates: [],
      recurringLineItems: [],
      recurringCalendarExclusions: [],
      address: '',
      ...DEFAULT_CLIENT_REMINDER_FIELDS,
    },
    {
      id: 'c3',
      companyName: 'Whitfield Consulting',
      owner: 'Sarah Whitfield',
      primaryEmail: 'sarah@whitfield.com',
      hourlyRate: 350,
      additionalEmails: [],
      additionalRates: [],
      recurringLineItems: [],
      recurringCalendarExclusions: [],
      address: '',
      ...DEFAULT_CLIENT_REMINDER_FIELDS,
    },
    {
      id: 'c4',
      companyName: 'Park & Associates',
      owner: 'David Park',
      primaryEmail: 'david@parkassoc.com',
      hourlyRate: 125,
      additionalEmails: [],
      additionalRates: [],
      recurringLineItems: [],
      recurringCalendarExclusions: [],
      address: '',
      ...DEFAULT_CLIENT_REMINDER_FIELDS,
    },
  ];

  return {
    clients,
    calendarEntries: [],
    recurringCalendarExclusions: [],
    emailHistory: [],
    settings: {
      businessName: 'Anthony Mercer',
      email: 'hello@anthonymercer.com',
      businessAddress: '',
      mailingAddress: '',
      paymentDetails: 'Bank transfer — Chase ****4821\nRouting: 021000021',
      defaultTaxRate: 0,
      defaultDueDays: 14,
      reminderIntervalDays: 5,
      lateReminderIntervalDays: 3,
      paypalClientId: '',
      paypalClientSecret: '',
      paypalSandbox: true,
      logo: null,
      emailTemplates: normalizeEmailTemplates(),
    },
    nextInvoiceNumber: 5,
    invoices: [
      {
        id: 'inv1',
        clientId: 'c1',
        clientName: 'Mia Chen',
        number: 'INV-001',
        issueDate: daysFromNow(-45),
        dueDate: daysFromNow(-15),
        lineItems: [
          { id: 'li1', description: 'Brand Identity — logo, color system, guidelines', quantity: 1, rate: 2400 },
        ],
        notes: 'Payment due within 30 days. Thank you for the collaboration.',
        taxEnabled: false,
        taxRate: 0,
        status: 'paid',
        publicToken: null,
        paidAt: daysFromNow(-30),
        emailSendCount: 2,
        lastEmailSentAt: daysFromNow(-32) + 'T14:30:00.000Z',
        lastEmailSentKind: 'payment_received',
        ...emptyInvoiceReminderSettings(),
        createdAt: daysFromNow(-45),
      },
      {
        id: 'inv2',
        clientId: 'c2',
        clientName: 'James Okonkwo',
        number: 'INV-002',
        issueDate: daysFromNow(-20),
        dueDate: daysFromNow(-5),
        lineItems: [
          { id: 'li2', description: 'Website copy — 8 pages', quantity: 8, rate: 175 },
          { id: 'li3', description: 'SEO metadata review', quantity: 1, rate: 400 },
        ],
        notes: '',
        taxEnabled: false,
        taxRate: 0,
        status: 'unpaid',
        publicToken: null,
        paidAt: null,
        emailSendCount: 1,
        lastEmailSentAt: daysFromNow(-18) + 'T09:15:00.000Z',
        lastEmailSentKind: 'unpaid',
        ...emptyInvoiceReminderSettings(),
        createdAt: daysFromNow(-20),
      },
      {
        id: 'inv3',
        clientId: 'c3',
        clientName: 'Sarah Whitfield',
        number: 'INV-003',
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(20),
        lineItems: [
          { id: 'li4', description: 'Q2 strategy consultation — 6 sessions', quantity: 6, rate: 350 },
        ],
        notes: 'Sessions billed at completion of each engagement.',
        taxEnabled: true,
        taxRate: 8.5,
        createdAt: daysFromNow(-10),
        status: 'unpaid',
        publicToken: null,
        paidAt: null,
        emailSendCount: 0,
        lastEmailSentAt: null,
        lastEmailSentKind: null,
        ...emptyInvoiceReminderSettings(),
      },
      {
        id: 'inv4',
        clientId: 'c4',
        clientName: 'David Park',
        number: 'INV-004',
        issueDate: today(),
        dueDate: daysFromNow(30),
        lineItems: [
          { id: 'li5', description: 'Product UI audit — 12 screens', quantity: 12, rate: 125 },
        ],
        notes: '',
        taxEnabled: false,
        taxRate: 0,
        status: 'draft',
        publicToken: null,
        paidAt: null,
        emailSendCount: 0,
        lastEmailSentAt: null,
        lastEmailSentKind: null,
        ...emptyInvoiceReminderSettings(),
        createdAt: today(),
      },
    ],
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const data = seedData();
      saveData(data);
      return data;
    }
    return JSON.parse(raw) as AppData;
  } catch {
    const data = seedData();
    saveData(data);
    return data;
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
