import { useState } from 'react';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { SectionHeader } from '@/components/SectionHeader';
import { TextInput } from '@/components/TextInput';
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
      <SectionHeader title="Automatic reminders" description={display.tooltip} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={saving}
          loading={saving}
          onClick={() => apply({ remindersPaused: !invoice.remindersPaused })}
        >
          {invoice.remindersPaused ? 'Resume reminders' : 'Pause reminders'}
        </Button>

        {!invoice.remindersPaused && (
          <>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => snoozeForDays(7)}>
              Snooze 7 days
            </Button>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => snoozeForDays(14)}>
              Snooze 14 days
            </Button>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => snoozeForDays(30)}>
              Snooze 30 days
            </Button>
          </>
        )}

        {invoice.reminderSnoozeUntil && (
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => apply({ reminderSnoozeUntil: null })}
          >
            Clear snooze
            {blocked && !invoice.remindersPaused
              ? ` (until ${formatDateLong(invoice.reminderSnoozeUntil)})`
              : ''}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={`Reminder interval (days)${
            invoice.reminderIntervalDaysOverride == null ? '' : ' — override'
          }`}
          hint={
            <>
              Global: {globalUnpaid} days
              {clientUnpaid != null ? ` · Client: ${clientUnpaid} days` : ''}
            </>
          }
        >
          <TextInput
            type="number"
            disabled={saving}
            value={
              invoice.reminderIntervalDaysOverride != null
                ? String(invoice.reminderIntervalDaysOverride)
                : ''
            }
            placeholder={String(resolved.reminderIntervalDays)}
            onChange={(value) => {
              const parsed = value === '' ? null : Math.max(1, Number(value) || 1);
              void apply({ reminderIntervalDaysOverride: parsed });
            }}
          />
        </Field>

        <Field
          label={`Late notice interval (days)${
            invoice.lateReminderIntervalDaysOverride == null ? '' : ' — override'
          }`}
          hint={
            <>
              Global: {globalLate} days
              {clientLate != null ? ` · Client: ${clientLate} days` : ''}
            </>
          }
        >
          <TextInput
            type="number"
            disabled={saving}
            value={
              invoice.lateReminderIntervalDaysOverride != null
                ? String(invoice.lateReminderIntervalDaysOverride)
                : ''
            }
            placeholder={String(resolved.lateReminderIntervalDays)}
            onChange={(value) => {
              const parsed = value === '' ? null : Math.max(1, Number(value) || 1);
              void apply({ lateReminderIntervalDaysOverride: parsed });
            }}
          />
        </Field>
      </div>

      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
