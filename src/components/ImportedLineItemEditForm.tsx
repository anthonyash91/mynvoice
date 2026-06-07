import { useEffect, useMemo, useState } from 'react';
import { DurationInput } from '@/components/DurationInput';
import { HourlyRateCombobox } from '@/components/HourlyRateCombobox';
import { TextInput } from '@/components/TextInput';
import {
  clientHourlyRateOptions,
  clientHourlyRateSelection,
} from '@/lib/client';
import { isCalendarEntryFixed } from '@/lib/calendar';
import { formatCurrency } from '@/lib/calculations';
import type { CalendarEntry, CalendarEntryType, Client, LineItem } from '@/types';

interface ImportedLineItemEditFormProps {
  item: LineItem;
  calendarEntry: CalendarEntry;
  client: Client;
  onSave: (entry: CalendarEntry) => Promise<void>;
  onCancel: () => void;
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[12px] uppercase leading-none tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function TotalInput({ value }: { value: string }) {
  return (
    <input
      type="text"
      readOnly
      disabled
      value={value}
      className="h-8 w-full cursor-default rounded border border-border bg-background px-3 text-right text-[13px] tabular-nums outline-none disabled:opacity-100"
    />
  );
}

export function ImportedLineItemEditForm({
  item,
  calendarEntry,
  client,
  onSave,
  onCancel,
}: ImportedLineItemEditFormProps) {
  const entryType: CalendarEntryType = item.entryType ?? calendarEntry.entryType ?? 'hourly';
  const isFixed = entryType === 'fixed';
  const [date, setDate] = useState(item.sourceDate ?? calendarEntry.date);
  const [description, setDescription] = useState(item.description);
  const [duration, setDuration] = useState(isFixed ? 0 : item.quantity);
  const [fixedAmount, setFixedAmount] = useState(isFixed ? String(item.rate) : '');
  const [selectedRateId, setSelectedRateId] = useState('primary');
  const [saving, setSaving] = useState(false);

  const rateOptions = useMemo(() => {
    if (isFixed) return [];
    if (!isCalendarEntryFixed(calendarEntry) && calendarEntry.rate === item.rate) {
      return clientHourlyRateSelection(client, calendarEntry.rate).options;
    }
    return clientHourlyRateOptions(client);
  }, [client, calendarEntry, isFixed, item.rate]);

  const selectedRate =
    rateOptions.find((option) => option.id === selectedRateId) ?? rateOptions[0];
  const parsedFixedAmount = Number(fixedAmount) || 0;
  const rate = isFixed ? parsedFixedAmount : (selectedRate?.rate ?? 0);
  const quantity = isFixed ? 1 : duration;
  const total = isFixed ? parsedFixedAmount : duration * rate;
  const canSave = isFixed
    ? parsedFixedAmount > 0
    : Boolean(selectedRate && duration > 0);

  useEffect(() => {
    if (isFixed || rateOptions.length === 0) return;
    const { selectedId } = clientHourlyRateSelection(client, item.rate);
    setSelectedRateId(selectedId);
  }, [client, isFixed, item.rate, rateOptions.length]);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        ...calendarEntry,
        date,
        description: description.trim(),
        quantity,
        rate,
        entryType,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="box-border min-w-0 w-full bg-secondary/30 px-3 pb-3 pt-2.5"
      data-line-item-edit-form
    >
      <div className="min-w-0 space-y-3">
        {isFixed ? (
          <div className="grid min-w-0 grid-cols-[7.5rem_1fr_5.5rem] gap-2">
            <div className="min-w-0">
              <FormLabel>Date</FormLabel>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 w-full rounded border border-border bg-background px-2 text-[13px] tabular-nums outline-none focus:border-primary"
              />
            </div>
            <div className="min-w-0">
              <FormLabel>Description</FormLabel>
              <TextInput
                value={description}
                onChange={setDescription}
                placeholder="Description"
              />
            </div>
            <div className="min-w-0">
              <FormLabel>Amount</FormLabel>
              <TextInput
                type="number"
                value={fixedAmount}
                onChange={setFixedAmount}
                placeholder="0"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid min-w-0 grid-cols-[7.5rem_1fr] gap-2">
              <div className="min-w-0">
                <FormLabel>Date</FormLabel>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 w-full rounded border border-border bg-background px-2 text-[13px] tabular-nums outline-none focus:border-primary"
                />
              </div>
              <div className="min-w-0">
                <FormLabel>Description</FormLabel>
                <TextInput
                  value={description}
                  onChange={setDescription}
                  placeholder="Description"
                />
              </div>
            </div>

            {rateOptions.length > 0 && (
              <div className="min-w-0">
                <FormLabel>Hourly rate</FormLabel>
                <HourlyRateCombobox
                  options={rateOptions}
                  selectedId={selectedRateId}
                  onSelectedIdChange={setSelectedRateId}
                />
              </div>
            )}

            <div className="grid min-w-0 grid-cols-[1fr_5.5rem_5.5rem] gap-2">
              <div className="min-w-0">
                <FormLabel>Time</FormLabel>
                <DurationInput quantity={duration} onChange={setDuration} />
              </div>
              <div className="min-w-0">
                <FormLabel>Rate</FormLabel>
                <div className="flex h-8 items-center justify-end rounded border border-border bg-background px-2 text-[13px] tabular-nums text-muted-foreground">
                  {selectedRate ? formatCurrency(selectedRate.rate) : '—'}
                </div>
              </div>
              <div className="min-w-0">
                <FormLabel>Total</FormLabel>
                <TotalInput value={formatCurrency(total)} />
              </div>
            </div>
          </>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-8 px-3 text-[13px] text-foreground rounded hover:bg-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !canSave}
          className="h-8 px-3 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
