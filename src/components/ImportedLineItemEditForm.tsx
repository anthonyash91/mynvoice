import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { DateInput } from '@/components/DateInput';
import { DurationInput } from '@/components/DurationInput';
import { Field } from '@/components/Field';
import { FormFooter } from '@/components/FormFooter';
import { HourlyRateCombobox } from '@/components/HourlyRateCombobox';
import { ReadOnlyValue } from '@/components/ReadOnlyValue';
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
            <Field label="Date">
              <DateInput value={date} onChange={setDate} />
            </Field>
            <Field label="Description">
              <TextInput
                value={description}
                onChange={setDescription}
                placeholder="Description"
              />
            </Field>
            <Field label="Amount">
              <TextInput
                type="number"
                value={fixedAmount}
                onChange={setFixedAmount}
                placeholder="0"
              />
            </Field>
          </div>
        ) : (
          <>
            <div className="grid min-w-0 grid-cols-[7.5rem_1fr] gap-2">
              <Field label="Date">
                <DateInput value={date} onChange={setDate} />
              </Field>
              <Field label="Description">
                <TextInput
                  value={description}
                  onChange={setDescription}
                  placeholder="Description"
                />
              </Field>
            </div>

            {rateOptions.length > 0 && (
              <Field label="Hourly rate">
                <HourlyRateCombobox
                  options={rateOptions}
                  selectedId={selectedRateId}
                  onSelectedIdChange={setSelectedRateId}
                />
              </Field>
            )}

            <div className="grid min-w-0 grid-cols-[1fr_5.5rem_5.5rem] gap-2">
              <Field label="Time">
                <DurationInput quantity={duration} onChange={setDuration} />
              </Field>
              <Field label="Rate">
                <ReadOnlyValue
                  value={selectedRate ? formatCurrency(selectedRate.rate) : '—'}
                  align="end"
                />
              </Field>
              <Field label="Total">
                <ReadOnlyValue value={formatCurrency(total)} align="end" />
              </Field>
            </div>
          </>
        )}
      </div>
      <FormFooter bordered={false} className="mt-3">
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={save}
          disabled={saving || !canSave}
          loading={saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </FormFooter>
    </div>
  );
}
