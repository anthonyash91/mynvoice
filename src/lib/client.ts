import type { Client, ClientRate } from '@/types';
import { emptyRecurringLineItem } from '@/lib/recurring';

export { emptyRecurringLineItem };

export type ClientDraft = Omit<Client, 'id'>;

export function emptyClientDraft(): ClientDraft {
  return {
    companyName: '',
    owner: '',
    primaryEmail: '',
    hourlyRate: 0,
    additionalEmails: [],
    additionalRates: [],
    recurringLineItems: [],
    recurringCalendarExclusions: [],
    address: '',
    reminderIntervalDays: null,
    lateReminderIntervalDays: null,
  };
}

export function clientDisplayName(client: Pick<Client, 'owner' | 'companyName'>): string {
  return client.companyName.trim() || client.owner.trim();
}

export function clientInvoiceName(client: Pick<Client, 'owner' | 'companyName'>): string {
  return client.companyName.trim() || client.owner.trim();
}

export function clientSecondaryName(
  client: Pick<Client, 'owner' | 'companyName'>
): string | null {
  const company = client.companyName.trim();
  const owner = client.owner.trim();
  if (company && owner) return owner;
  return null;
}

export function emptyClientRate(): ClientRate {
  return { id: crypto.randomUUID(), label: '', rate: 0 };
}

export interface ClientRateLine {
  label?: string;
  rate: number;
}

function splitAddressParts(address: string): string[] {
  const parts = address
    .replace(/\r?\n/g, ',')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const last = parts[parts.length - 1];
  if (last && /^\d{5}(-\d{4})?$/.test(last)) {
    parts.pop();
  }

  return parts;
}

function extractZipCode(address: string): string | null {
  const parts = address
    .replace(/\r?\n/g, ',')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d{5}(-\d{4})?$/.test(parts[i])) return parts[i];
  }

  for (let i = parts.length - 1; i >= 0; i--) {
    const match = parts[i].match(/(\d{5}(?:-\d{4})?)\s*$/);
    if (match) return match[1];
  }

  return null;
}

function formatCityState(city: string, statePart: string): string | null {
  const state = statePart.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return null;
}

function cityStateFromParts(parts: string[]): string | null {
  if (parts.length >= 2) {
    return formatCityState(parts[parts.length - 2], parts[parts.length - 1]);
  }

  if (parts.length === 1) {
    const only = parts[0].replace(/\s+\d{5}(-\d{4})?$/, '').trim();
    const match = only.match(/^(.+?)\s+([A-Za-z]{2})$/);
    if (match) return `${match[1]}, ${match[2].toUpperCase()}`;
    return only || null;
  }

  return null;
}

function withZipCode(line: string | null | undefined, zipCode: string | null): string | undefined {
  if (line && zipCode) return `${line} ${zipCode}`;
  if (line) return line;
  if (zipCode) return zipCode;
  return undefined;
}

export interface ClientAddressSummary {
  street?: string;
  cityState?: string;
  zipCode?: string;
}

export function clientAddressSummary(address: string): ClientAddressSummary | null {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const zipCode = extractZipCode(trimmed);
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (lines.length >= 2) {
    const street = lines.slice(0, -1).join(', ');
    const cityState = withZipCode(
      cityStateFromParts(splitAddressParts(lines[lines.length - 1])),
      zipCode
    );
    if (street || cityState) {
      return {
        street: street || undefined,
        cityState,
        zipCode: zipCode ?? undefined,
      };
    }
  }

  const parts = splitAddressParts(trimmed);
  if (parts.length >= 3) {
    return {
      street: parts[0],
      cityState: withZipCode(
        formatCityState(parts[parts.length - 2], parts[parts.length - 1]),
        zipCode
      ),
      zipCode: zipCode ?? undefined,
    };
  }

  const cityState = withZipCode(cityStateFromParts(parts), zipCode);
  if (cityState) {
    return { cityState, zipCode: zipCode ?? undefined };
  }

  if (parts.length === 1) {
    return { street: parts[0], zipCode: zipCode ?? undefined };
  }

  return null;
}

export interface ClientHourlyRateOption {
  id: string;
  label: string;
  rate: number;
}

export function clientHourlyRateOptions(
  client: Pick<Client, 'hourlyRate' | 'additionalRates'>
): ClientHourlyRateOption[] {
  const options: ClientHourlyRateOption[] = [];

  if (client.hourlyRate > 0) {
    options.push({
      id: 'primary',
      label: 'Hourly rate',
      rate: client.hourlyRate,
    });
  }

  for (const additional of client.additionalRates) {
    if (additional.rate > 0 || additional.label.trim()) {
      options.push({
        id: additional.id,
        label: additional.label.trim() || 'Additional rate',
        rate: additional.rate,
      });
    }
  }

  if (options.length === 0) {
    options.push({
      id: 'primary',
      label: 'Hourly rate',
      rate: client.hourlyRate,
    });
  }

  return options;
}

export function clientHourlyRateSelection(
  client: Pick<Client, 'hourlyRate' | 'additionalRates'>,
  rate: number
): { options: ClientHourlyRateOption[]; selectedId: string } {
  const options = clientHourlyRateOptions(client);
  const match = options.find((option) => option.rate === rate);
  if (match) return { options, selectedId: match.id };

  return {
    options: [{ id: 'logged', label: 'Logged rate', rate }, ...options],
    selectedId: 'logged',
  };
}

export function clientRateLines(
  client: Pick<Client, 'hourlyRate' | 'additionalRates'>
): ClientRateLine[] {
  const lines: ClientRateLine[] = [];
  if (client.hourlyRate > 0) {
    lines.push({ rate: client.hourlyRate });
  }
  for (const r of client.additionalRates) {
    if (r.rate > 0 || r.label.trim()) {
      lines.push({ label: r.label.trim() || undefined, rate: r.rate });
    }
  }
  return lines;
}

function normalizeOptionalInterval(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 1) return null;
  return Math.floor(value);
}

export function normalizeClientDraft(draft: ClientDraft): ClientDraft {
  return {
    ...draft,
    companyName: draft.companyName.trim(),
    owner: draft.owner.trim(),
    primaryEmail: draft.primaryEmail.trim(),
    address: draft.address.trim(),
    reminderIntervalDays: normalizeOptionalInterval(draft.reminderIntervalDays),
    lateReminderIntervalDays: normalizeOptionalInterval(draft.lateReminderIntervalDays),
    additionalEmails: draft.additionalEmails.map((e) => e.trim()).filter(Boolean),
    additionalRates: draft.additionalRates
      .map((r) => ({ ...r, label: r.label.trim(), rate: Number(r.rate) || 0 }))
      .filter((r) => r.label || r.rate > 0),
    recurringLineItems: draft.recurringLineItems
      .map((item) => ({
        ...item,
        description: item.description.trim(),
        quantity: item.entryType === 'fixed' ? 1 : Number(item.quantity) || 0,
        rate: Number(item.rate) || 0,
        dayOfMonth: Math.min(31, Math.max(1, Math.round(item.dayOfMonth) || 1)),
      }))
      .filter((item) => item.description && item.rate > 0),
  };
}

export function clientMatchesQuery(
  client: Client,
  query: string
): boolean {
  const q = query.toLowerCase();
  return (
    client.owner.toLowerCase().includes(q) ||
    client.companyName.toLowerCase().includes(q) ||
    client.primaryEmail.toLowerCase().includes(q)
  );
}
