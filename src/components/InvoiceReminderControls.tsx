import { useState } from 'react';
import { Field } from '@/components/Field';
import { formatDateLong } from '@/lib/calculations';
import {
  automaticRemindersBlocked,
  invoiceReminderDisplay,
  localTodayDateString,
  resolveReminderIntervals,
} from '@/lib/invoice';
import type { Client, Invoice, InvoiceReminderSettings, Settings } from '@/types';

interface InvoiceReminderControlsProps {
  invoice: Invoice;
  client: Client | null;
  settings: Settings;
  onUpdate: (settings: InvoiceReminderSettings) => Promise<void>;
}

function addDaysToDateString(base: string, days: number): string {
  const [year, month, day] = base.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localTodayDateString(date);
}

export function InvoiceReminderControls({
  invoice,
  client,
  settings,
  onUpdate,
}: InvoiceReminderControlsProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (invoice.status !== 'unpaid' && invoice.status !== 'overdue') {
    return null;
  }

  const resolved = resolveReminderIntervals(invoice, settings, client);
  const display = invoiceReminderDisplay(invoice, settings, { client });
  const blocked = automaticRemindersBlocked(invoice);

  const apply = async (patch: Partial<InvoiceReminderSettings>) => {
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        remindersPaused: patch.remindersPaused ?? invoice.remindersPaused,
        reminderSnoozeUntil:
          patch.reminderSnoozeUntil !== undefined
            ? patch.reminderSnoozeUntil
            : invoice.reminderSnoozeUntil,
        reminderIntervalDaysOverride:
          patch.reminderIntervalDaysOverride !== undefined
            ? patch.reminderIntervalDaysOverride
            : invoice.reminderIntervalDaysOverride,
        lateReminderIntervalDaysOverride:
          patch.lateReminderIntervalDaysOverride !== undefined
            ? patch.lateReminderIntervalDaysOverride
            : invoice.lateReminderIntervalDaysOverride,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reminder settings.');
    } finally {
      setSaving(false);
    }
  };

  const snoozeForDays = async (days: number) => {
    const today = localTodayDateString();
    await apply({
      remindersPaused: false,
      reminderSnoozeUntil: addDaysToDateString(today, days),
    });
  };

  const globalUnpaid = settings.reminderIntervalDays;
  const globalLate = settings.lateReminderIntervalDays;
  const clientUnpaid = client?.reminderIntervalDays;
  const clientLate = client?.lateReminderIntervalDays;

  return (
    <div className="border-b border-border px-6 py-4 no-print shrink-0 space-y-4">
      <div>
        <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-1">
          Automatic reminders
        </div>
        <p className="text-[12px] leading-snug text-muted-foreground">{display.tooltip}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => apply({ remindersPaused: !invoice.remindersPaused })}
          className="h-7 px-3 text-[13px] rounded border border-border hover:bg-secondary disabled:opacity-50"
        >
          {invoice.remindersPaused ? 'Resume reminders' : 'Pause reminders'}
        </button>

        {!invoice.remindersPaused && (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => snoozeForDays(7)}
              className="h-7 px-3 text-[13px] rounded border border-border hover:bg-secondary disabled:opacity-50"
            >
              Snooze 7 days
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => snoozeForDays(14)}
              className="h-7 px-3 text-[13px] rounded border border-border hover:bg-secondary disabled:opacity-50"
            >
              Snooze 14 days
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => snoozeForDays(30)}
              className="h-7 px-3 text-[13px] rounded border border-border hover:bg-secondary disabled:opacity-50"
            >
              Snooze 30 days
            </button>
          </>
        )}

        {invoice.reminderSnoozeUntil && (
          <button
            type="button"
            disabled={saving}
            onClick={() => apply({ reminderSnoozeUntil: null })}
            className="h-7 px-3 text-[13px] text-muted-foreground rounded hover:bg-secondary disabled:opacity-50"
          >
            Clear snooze
            {blocked && !invoice.remindersPaused
              ? ` (until ${formatDateLong(invoice.reminderSnoozeUntil)})`
              : ''}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={`Reminder interval (days)${
            invoice.reminderIntervalDaysOverride == null ? '' : ' — override'
          }`}
        >
          <input
            type="number"
            disabled={saving}
            value={
              invoice.reminderIntervalDaysOverride != null
                ? String(invoice.reminderIntervalDaysOverride)
                : ''
            }
            placeholder={String(resolved.reminderIntervalDays)}
            onChange={(e) => {
              const value = e.target.value;
              const parsed = value === '' ? null : Math.max(1, Number(value) || 1);
              void apply({ reminderIntervalDaysOverride: parsed });
            }}
            className="w-full h-8 px-3 text-[13px] border border-border rounded bg-background outline-none focus:border-primary disabled:opacity-50"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Global: {globalUnpaid} days
            {clientUnpaid != null ? ` · Client: ${clientUnpaid} days` : ''}
          </p>
        </Field>

        <Field
          label={`Late notice interval (days)${
            invoice.lateReminderIntervalDaysOverride == null ? '' : ' — override'
          }`}
        >
          <input
            type="number"
            disabled={saving}
            value={
              invoice.lateReminderIntervalDaysOverride != null
                ? String(invoice.lateReminderIntervalDaysOverride)
                : ''
            }
            placeholder={String(resolved.lateReminderIntervalDays)}
            onChange={(e) => {
              const value = e.target.value;
              const parsed = value === '' ? null : Math.max(1, Number(value) || 1);
              void apply({ lateReminderIntervalDaysOverride: parsed });
            }}
            className="w-full h-8 px-3 text-[13px] border border-border rounded bg-background outline-none focus:border-primary disabled:opacity-50"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Global: {globalLate} days
            {clientLate != null ? ` · Client: ${clientLate} days` : ''}
          </p>
        </Field>
      </div>

      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
