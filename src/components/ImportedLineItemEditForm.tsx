import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { AttachmentChips } from '@/components/AttachmentChips';
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
import {
  ATTACHMENT_ACCEPT,
  attachmentsTotalBytes,
  deleteAttachmentFiles,
  lineItemAttachments,
  mergeAttachments,
  uploadAttachmentFiles,
} from '@/lib/attachments';
import { isCalendarEntryFixed } from '@/lib/calendar';
import { formatCurrency } from '@/lib/calculations';
import type {
  CalendarEntry,
  CalendarEntryType,
  Client,
  LineItem,
  LineItemAttachment,
} from '@/types';

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
  const [attachments, setAttachments] = useState<LineItemAttachment[]>(() =>
    mergeAttachments(lineItemAttachments(calendarEntry), lineItemAttachments(item))
  );
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  /** Files uploaded in this form that no saved entry references yet. */
  const unsavedUploadPathsRef = useRef<Set<string>>(new Set());

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
  const canSave =
    !uploading && (isFixed ? parsedFixedAmount > 0 : Boolean(selectedRate && duration > 0));

  useEffect(() => {
    if (isFixed || rateOptions.length === 0) return;
    const { selectedId } = clientHourlyRateSelection(client, item.rate);
    setSelectedRateId(selectedId);
  }, [client, isFixed, item.rate, rateOptions.length]);

  const attachFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setAttachmentError(null);
    try {
      const error = await uploadAttachmentFiles(
        files,
        attachmentsTotalBytes(attachments),
        (attachment) => {
          unsavedUploadPathsRef.current.add(attachment.path);
          setAttachments((prev) => [...prev, attachment]);
        }
      );
      setAttachmentError(error);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (attachmentId: string) => {
    const removed = attachments.find((attachment) => attachment.id === attachmentId);
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    // Never saved, so nothing else can reference it. Saved files are cleaned up on save.
    if (removed && unsavedUploadPathsRef.current.delete(removed.path)) {
      void deleteAttachmentFiles([removed.path]);
    }
  };

  const cancel = () => {
    void deleteAttachmentFiles([...unsavedUploadPathsRef.current]);
    unsavedUploadPathsRef.current = new Set();
    onCancel();
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setAttachmentError(null);
    try {
      await onSave({
        ...calendarEntry,
        date,
        description: description.trim(),
        quantity,
        rate,
        entryType,
        attachments,
      });
      unsavedUploadPathsRef.current = new Set();
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Failed to save line item.');
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

        <Field label="Receipts">
          <div className="space-y-2">
            <AttachmentChips
              attachments={attachments}
              uploading={uploading}
              onRemove={removeAttachment}
              onError={setAttachmentError}
            />
            <Button
              variant="link"
              size="sm"
              icon={Paperclip}
              onClick={() => attachmentInputRef.current?.click()}
              disabled={uploading || saving}
              className="h-auto px-0 py-0"
            >
              Attach receipt
            </Button>
            {attachmentError && (
              <p className="text-[12px] leading-snug text-destructive">{attachmentError}</p>
            )}
            <input
              ref={attachmentInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                void attachFiles(files);
              }}
            />
          </div>
        </Field>
      </div>
      <FormFooter bordered={false} className="mt-3">
        <Button onClick={cancel} disabled={saving}>
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
