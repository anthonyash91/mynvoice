import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { CalendarEntryStatus } from '@/components/CalendarEntryStatus';
import { ClientCombobox } from '@/components/ClientCombobox';
import { DurationInput } from '@/components/DurationInput';
import { HourlyRateCombobox } from '@/components/HourlyRateCombobox';
import { LineItemTypeCombobox } from '@/components/LineItemTypeCombobox';
import { LineItemTypeBadge } from '@/components/LineItemTypeBadge';
import { lineItemKindFromCalendarEntry } from '@/lib/lineItem';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { FormFooter } from '@/components/FormFooter';
import { PanelShell } from '@/components/PanelShell';
import { TextInput } from '@/components/TextInput';
import {
  clientDisplayName,
  clientHourlyRateOptions,
  clientHourlyRateSelection,
  clientInvoiceName,
} from '@/lib/client';
import {
  calendarEntryAmount,
  calendarEntryType,
  formatCalendarDayLabel,
  isCalendarEntryBilled,
  isCalendarEntryFixed,
} from '@/lib/calendar';
import { formatCurrency } from '@/lib/calculations';
import { formatDurationQuantity } from '@/lib/duration';
import { cn } from '@/lib/utils';
import type { CalendarEntry, CalendarEntryType, Client, Invoice } from '@/types';

interface CalendarDayPanelProps {
  date: string;
  clients: Client[];
  invoices: Invoice[];
  entries: CalendarEntry[];
  onClose: () => void;
  onAdd: (entry: Omit<CalendarEntry, 'id'>) => Promise<unknown>;
  onUpdate: (entry: CalendarEntry) => Promise<unknown>;
  onDelete: (entryId: string) => Promise<void>;
}

function defaultClientState(clients: Client[]) {
  if (clients.length === 1) {
    const only = clients[0];
    return {
      clientId: only.id,
      clientQuery: clientInvoiceName(only),
    };
  }

  return {
    clientId: '',
    clientQuery: '',
  };
}

export function CalendarDayPanel({
  date,
  clients,
  invoices,
  entries,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
}: CalendarDayPanelProps) {
  const confirm = useConfirm();
  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b))),
    [clients]
  );
  const dayEntries = useMemo(
    () => entries.filter((entry) => entry.date === date),
    [entries, date]
  );

  const defaults = defaultClientState(sortedClients);
  const [clientId, setClientId] = useState(defaults.clientId);
  const [clientQuery, setClientQuery] = useState(defaults.clientQuery);
  const [description, setDescription] = useState('');
  const [entryType, setEntryType] = useState<CalendarEntryType>('hourly');
  const [duration, setDuration] = useState(0);
  const [fixedAmount, setFixedAmount] = useState('');
  const [selectedRateId, setSelectedRateId] = useState('primary');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editingEntry = editingId
    ? dayEntries.find((entry) => entry.id === editingId)
    : undefined;
  const selectedClient = sortedClients.find((c) => c.id === clientId);
  const rateOptions = useMemo(() => {
    if (!selectedClient || entryType !== 'hourly') return [];
    if (
      editingEntry &&
      editingEntry.clientId === selectedClient.id &&
      !isCalendarEntryFixed(editingEntry)
    ) {
      return clientHourlyRateSelection(selectedClient, editingEntry.rate).options;
    }
    return clientHourlyRateOptions(selectedClient);
  }, [selectedClient, editingEntry, entryType]);
  const selectedRate =
    rateOptions.find((option) => option.id === selectedRateId) ?? rateOptions[0];
  const parsedFixedAmount = Number(fixedAmount) || 0;
  const lineItemTotal =
    entryType === 'fixed'
      ? parsedFixedAmount
      : selectedRate && duration > 0
        ? duration * selectedRate.rate
        : 0;
  const canSave =
    entryType === 'fixed'
      ? Boolean(clientId && parsedFixedAmount > 0)
      : Boolean(clientId && selectedRate && duration > 0);

  useEffect(() => {
    if (editingId || entryType !== 'hourly') return;
    if (rateOptions.length > 0) {
      setSelectedRateId(rateOptions[0].id);
    }
  }, [clientId, rateOptions, editingId, entryType]);

  const resetAddForm = () => {
    const next = defaultClientState(sortedClients);
    setClientId(next.clientId);
    setClientQuery(next.clientQuery);
    setDescription('');
    setEntryType('hourly');
    setDuration(0);
    setFixedAmount('');
    setEditingId(null);
  };

  const startEdit = (entry: CalendarEntry) => {
    if (isCalendarEntryBilled(entry)) return;

    const client = sortedClients.find((c) => c.id === entry.clientId);
    const type = calendarEntryType(entry);

    setEditingId(entry.id);
    setClientId(entry.clientId);
    setClientQuery(client ? clientInvoiceName(client) : '');
    setDescription(entry.description);
    setEntryType(type);

    if (type === 'fixed') {
      setFixedAmount(entry.rate ? String(entry.rate) : '');
      setDuration(0);
      return;
    }

    const { selectedId } = client
      ? clientHourlyRateSelection(client, entry.rate)
      : { selectedId: 'primary' };

    setDuration(entry.quantity);
    setFixedAmount('');
    setSelectedRateId(selectedId);
  };

  const handleCancel = () => {
    resetAddForm();
    onClose();
  };

  const saveEntry = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload =
        entryType === 'fixed'
          ? {
              clientId,
              date,
              description: description.trim(),
              quantity: 1,
              rate: parsedFixedAmount,
              entryType: 'fixed' as const,
            }
          : {
              clientId,
              date,
              description: description.trim(),
              quantity: duration,
              rate: selectedRate!.rate,
              entryType: 'hourly' as const,
            };

      if (editingId) {
        await onUpdate({ id: editingId, ...payload });
        resetAddForm();
      } else {
        await onAdd(payload);
        setDescription('');
        setDuration(0);
        setFixedAmount('');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (entry: CalendarEntry) => {
    if (isCalendarEntryBilled(entry)) return;

    const client = clients.find((c) => c.id === entry.clientId);
    const label =
      entry.description.trim() || (client ? clientDisplayName(client) : 'this line item');
    const ok = await confirm({
      title: 'Delete line item?',
      description: `Remove "${label}" from ${formatCalendarDayLabel(date)}. This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    setDeletingId(entry.id);
    try {
      await onDelete(entry.id);
      if (editingId === entry.id) resetAddForm();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PanelShell title={formatCalendarDayLabel(date)} onClose={onClose}>
      <div className="box-border w-full min-w-0 space-y-[22px] px-6 pt-5 pb-6">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
            Entries
          </div>
          {dayEntries.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No line items for this day yet.</p>
          ) : (
            <div className="w-full min-w-0 space-y-2">
              {dayEntries.map((entry) => {
                const client = clients.find((c) => c.id === entry.clientId);
                const billed = isCalendarEntryBilled(entry);
                const invoice = entry.invoiceId
                  ? invoices.find((item) => item.id === entry.invoiceId)
                  : undefined;
                const isEditing = editingId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'box-border flex w-full min-w-0 max-w-full items-start justify-between gap-3 rounded border border-border p-3 transition-colors',
                      isEditing && 'border-primary/40 bg-secondary/50 ring-1 ring-inset ring-primary/30'
                    )}
                  >
                    <div
                      role={billed ? undefined : 'button'}
                      tabIndex={billed ? undefined : 0}
                      onClick={() => startEdit(entry)}
                      onKeyDown={(e) => {
                        if (billed) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          startEdit(entry);
                        }
                      }}
                      className={cn(
                        'min-w-0 flex-1 overflow-hidden',
                        !billed && 'cursor-pointer hover:opacity-80'
                      )}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        <div className="min-w-0 truncate text-[13px] font-medium">
                          {client ? clientDisplayName(client) : 'Client'}
                        </div>
                        <LineItemTypeBadge kind={lineItemKindFromCalendarEntry(entry)} />
                      </div>
                      <div className="break-words text-[13px] text-muted-foreground whitespace-normal [overflow-wrap:anywhere]">
                        {isCalendarEntryFixed(entry)
                          ? entry.description
                          : entry.description || 'Work logged'}
                      </div>
                      {!isCalendarEntryFixed(entry) && (
                        <div className="text-[12px] text-muted-foreground tabular-nums">
                          {formatDurationQuantity(entry.quantity)} × {formatCurrency(entry.rate)}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {!billed && (
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => startEdit(entry)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Edit entry"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry)}
                            disabled={deletingId === entry.id}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                            aria-label="Delete entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="text-[13px] font-medium tabular-nums leading-none">
                          {formatCurrency(calendarEntryAmount(entry))}
                        </div>
                        <CalendarEntryStatus
                          billed={billed}
                          invoiceNumber={invoice?.number}
                          leadingBullet={false}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-full min-w-0 space-y-4 border-t border-border pt-[17px]">
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
            {editingId ? 'Edit line item' : 'Add line item'}
          </div>

          {sortedClients.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Add a client first.</p>
          ) : (
            <>
              <Field label="Client">
                <ClientCombobox
                  clients={sortedClients}
                  clientId={clientId}
                  clientQuery={clientQuery}
                  onClientIdChange={(id) => {
                    setClientId(id);
                    if (editingId && id !== editingEntry?.clientId) {
                      const client = sortedClients.find((c) => c.id === id);
                      if (client) {
                        const options = clientHourlyRateOptions(client);
                        setSelectedRateId(options[0]?.id ?? 'primary');
                      }
                    }
                  }}
                  onClientQueryChange={setClientQuery}
                />
              </Field>

              {selectedClient && (
                <Field label="Line item type">
                  <LineItemTypeCombobox value={entryType} onChange={setEntryType} />
                </Field>
              )}

              {selectedClient && entryType === 'hourly' && rateOptions.length > 0 && (
                <Field label="Hourly rate">
                  <HourlyRateCombobox
                    options={rateOptions}
                    selectedId={selectedRateId}
                    onSelectedIdChange={setSelectedRateId}
                  />
                </Field>
              )}

              <Field label="Description">
                <TextInput
                  value={description}
                  onChange={setDescription}
                  placeholder="e.g. Design revisions"
                />
              </Field>

              {entryType === 'hourly' ? (
                <Field label="Time">
                  <DurationInput quantity={duration} onChange={setDuration} />
                </Field>
              ) : (
                <Field label="Amount">
                  <TextInput
                    type="number"
                    value={fixedAmount}
                    onChange={setFixedAmount}
                    placeholder="0"
                  />
                </Field>
              )}

              <div className="mt-[17px] mb-[17px] flex justify-between text-[13px]">
                <span className="text-muted-foreground">
                  {entryType === 'fixed' ? (
                    parsedFixedAmount > 0 ? 'Fixed amount' : 'Total'
                  ) : selectedRate && duration > 0 ? (
                    <>
                      {formatDurationQuantity(duration)} × {formatCurrency(selectedRate.rate)}/hr
                    </>
                  ) : (
                    'Total'
                  )}
                </span>
                <span className="font-medium tabular-nums">{formatCurrency(lineItemTotal)}</span>
              </div>

              <FormFooter>
                <Button onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={saveEntry}
                  disabled={saving || !canSave}
                  loading={saving}
                  icon={editingId ? undefined : Plus}
                >
                  {editingId
                    ? saving
                      ? 'Saving…'
                      : 'Save changes'
                    : saving
                      ? 'Adding…'
                      : 'Add entry'}
                </Button>
              </FormFooter>
            </>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
