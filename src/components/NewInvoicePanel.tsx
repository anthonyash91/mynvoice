import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { Button } from '@/components/Button';
import { ClientCombobox } from '@/components/ClientCombobox';
import { DateInput } from '@/components/DateInput';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { FormFooter } from '@/components/FormFooter';
import { IconButton } from '@/components/IconButton';
import { SectionHeader } from '@/components/SectionHeader';
import { Textarea } from '@/components/Textarea';
import { Tooltip } from '@/components/Tooltip';
import { Switch } from '@/components/ui/switch';
import type {
  CalendarEntry,
  Client,
  Invoice,
  InvoiceDraft,
  LineItem,
  RecurringCalendarExclusion,
  Settings,
} from '@/types';
import { calculateTotal, formatCurrency, formatDate, formatDateLong } from '@/lib/calculations';
import { formatDurationQuantity } from '@/lib/duration';
import { clientInvoiceName } from '@/lib/client';
import { ImportedLineItemEditForm } from '@/components/ImportedLineItemEditForm';
import { LineItemTypeBadge } from '@/components/LineItemTypeBadge';
import { lineItemKindFromLineItem } from '@/lib/lineItem';
import {
  addableCalendarEntriesForInvoice,
  calendarEntriesToLineItems,
  calendarEntryToLineItem,
  formatCalendarEntryAmount,
  isEmptyFixedCalendarEntry,
  isRecurringCalendarEntry,
  syncRecurringImportedLineItems,
} from '@/lib/calendar';
import { nextInvoiceNumberForClient, resolveClientIdForInvoice } from '@/lib/invoice';
import {
  missingRecurringLineItems,
  recurringLineItemToCalendarEntry,
} from '@/lib/recurring';
import { recurringExclusionsForClient } from '@/lib/recurringExclusions';
import { cn } from '@/lib/utils';

interface NewInvoicePanelProps {
  clients: Client[];
  invoices: Invoice[];
  calendarEntries: CalendarEntry[];
  recurringCalendarExclusions: RecurringCalendarExclusion[];
  settings: Settings;
  editingInvoice?: Invoice;
  onClose: () => void;
  onSave: (draft: InvoiceDraft, status: 'draft' | 'unpaid') => Promise<void>;
  onUpdate?: (draft: InvoiceDraft) => Promise<void>;
  onAddCalendarEntry: (entry: Omit<CalendarEntry, 'id'>) => Promise<CalendarEntry>;
  onUpdateCalendarEntry: (entry: CalendarEntry) => Promise<unknown>;
  onDeleteCalendarEntry: (entryId: string) => Promise<unknown>;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function resolveEditCalendarEntry(
  item: LineItem,
  calendarEntries: CalendarEntry[],
  fallbackDate: string,
  clientId: string
): CalendarEntry | null {
  if (!item.sourceCalendarEntryId || !clientId) return null;

  const existing = calendarEntries.find((entry) => entry.id === item.sourceCalendarEntryId);
  if (existing) return existing;

  return {
    id: item.sourceCalendarEntryId,
    clientId,
    date: item.sourceDate ?? fallbackDate,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    entryType: item.entryType ?? 'hourly',
    recurringLineItemId: item.sourceRecurringLineItemId ?? null,
  };
}

const LINE_ITEMS_GRID = 'grid-cols-[1fr_4.75rem_5.5rem_52px]';

function LineItemTypeCell({ kind }: { kind: ReturnType<typeof lineItemKindFromLineItem> }) {
  return (
    <div className="justify-self-start">
      <LineItemTypeBadge kind={kind} />
    </div>
  );
}

function importedLineItemRateLabel(item: LineItem): string {
  const isFixed = item.entryType === 'fixed';
  if (item.sourceRecurringLineItemId && isFixed) {
    return 'Recurring';
  }
  return isFixed
    ? formatCurrency(item.rate)
    : `x ${formatCurrency(item.rate)}/hr`;
}

function ImportedInvoiceLineItem({ item }: { item: LineItem }) {
  const descriptionRef = useRef<HTMLDivElement>(null);
  const isFixed = item.entryType === 'fixed';
  const amount = isFixed ? item.rate : item.quantity * item.rate;

  return (
    <>
      <Tooltip
        content={item.description}
        onlyWhenTruncated
        measureTruncationRef={descriptionRef}
        className="min-w-0"
      >
        <div className="min-w-0">
          <div ref={descriptionRef} className="truncate">
            {item.description}
          </div>
          {item.sourceDate && (
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground tabular-nums">
              {formatDate(item.sourceDate)}
              {!isFixed && ` · ${formatDurationQuantity(item.quantity)}`}
              {` · ${importedLineItemRateLabel(item)}`}
            </div>
          )}
        </div>
      </Tooltip>
      <LineItemTypeCell kind={lineItemKindFromLineItem(item)} />
      <div className="text-left tabular-nums pl-1">{formatCurrency(amount)}</div>
    </>
  );
}

export function NewInvoicePanel({
  clients,
  invoices,
  calendarEntries,
  recurringCalendarExclusions,
  settings,
  editingInvoice,
  onClose,
  onSave,
  onUpdate,
  onAddCalendarEntry,
  onUpdateCalendarEntry,
  onDeleteCalendarEntry,
}: NewInvoicePanelProps) {
  const confirm = useConfirm();
  const isEditMode = Boolean(editingInvoice);
  const [clientQuery, setClientQuery] = useState(editingInvoice?.clientName ?? '');
  const [clientId, setClientId] = useState(editingInvoice?.clientId ?? '');
  const suggestedNumber = useMemo(
    () => nextInvoiceNumberForClient(invoices, clients, clientId, clientQuery),
    [invoices, clients, clientId, clientQuery]
  );
  const [number, setNumber] = useState(editingInvoice?.number ?? suggestedNumber);
  const [numberEdited, setNumberEdited] = useState(Boolean(editingInvoice));
  const [issueDate, setIssueDate] = useState(editingInvoice?.issueDate ?? today());
  const [dueOn, setDueOn] = useState(editingInvoice ? Boolean(editingInvoice.dueDate) : true);
  const [dueDate, setDueDate] = useState(
    editingInvoice?.dueDate ?? daysFromNow(settings.defaultDueDays)
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(editingInvoice?.lineItems ?? []);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [editingCalendarEntryId, setEditingCalendarEntryId] = useState<string | null>(null);
  const [addingFixedItem, setAddingFixedItem] = useState(false);
  const [excludedCalendarEntryIds, setExcludedCalendarEntryIds] = useState<Set<string>>(
    () => new Set()
  );
  const [notes, setNotes] = useState(editingInvoice?.notes ?? '');
  const [taxOn, setTaxOn] = useState(
    editingInvoice ? editingInvoice.taxEnabled : Boolean(settings.defaultTaxRate)
  );
  const [taxRate, setTaxRate] = useState(
    editingInvoice ? editingInvoice.taxRate : settings.defaultTaxRate
  );

  const resolvedClientId = useMemo(
    () => resolveClientIdForInvoice(clients, clientId, clientQuery),
    [clients, clientId, clientQuery]
  );
  const selectedClient = clients.find((c) => c.id === clientId);
  const invoiceClient = clients.find((c) => c.id === resolvedClientId);
  const prevClientRef = useRef(editingInvoice?.clientId ?? resolvedClientId);
  const applyingRecurringRef = useRef(false);

  useEffect(() => {
    if (isEditMode || numberEdited) return;
    setNumber(suggestedNumber);
  }, [suggestedNumber, numberEdited, isEditMode]);

  useEffect(() => {
    if (isEditMode) return;

    if (!resolvedClientId) {
      setLineItems([]);
      setEditingLineItemId(null);
      prevClientRef.current = resolvedClientId;
      return;
    }

    if (prevClientRef.current !== resolvedClientId) {
      setEditingLineItemId(null);
      setExcludedCalendarEntryIds(new Set());
      setLineItems([]);
      prevClientRef.current = resolvedClientId;
    }
  }, [resolvedClientId, isEditMode]);

  useEffect(() => {
    if (!resolvedClientId || !issueDate) return;

    setLineItems((prev) =>
      syncRecurringImportedLineItems(
        prev,
        calendarEntries,
        resolvedClientId,
        issueDate,
        excludedCalendarEntryIds,
        editingInvoice?.id
      )
    );
  }, [
    resolvedClientId,
    issueDate,
    calendarEntries,
    excludedCalendarEntryIds,
    editingInvoice?.id,
  ]);

  useEffect(() => {
    if (isEditMode || !resolvedClientId || !issueDate || !invoiceClient) return;

    let cancelled = false;

    (async () => {
      const missing = missingRecurringLineItems(
        invoiceClient.recurringLineItems,
        resolvedClientId,
        issueDate,
        invoices,
        calendarEntries,
        recurringExclusionsForClient(invoiceClient, recurringCalendarExclusions)
      );
      if (missing.length === 0 || applyingRecurringRef.current) return;

      applyingRecurringRef.current = true;
      try {
        for (const recurring of missing) {
          if (cancelled) return;
          await onAddCalendarEntry(
            recurringLineItemToCalendarEntry(recurring, resolvedClientId, issueDate)
          );
        }
      } finally {
        applyingRecurringRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    resolvedClientId,
    issueDate,
    invoiceClient,
    invoices,
    calendarEntries,
    recurringCalendarExclusions,
    onAddCalendarEntry,
    isEditMode,
  ]);

  const visibleLineItems = useMemo(
    () =>
      lineItems.filter(
        (item) =>
          item.id === editingLineItemId ||
          item.description.trim().length > 0 ||
          item.rate > 0 ||
          Boolean(item.sourceCalendarEntryId)
      ),
    [lineItems, editingLineItemId]
  );

  const addableCalendarEntries = useMemo(() => {
    if (!resolvedClientId) return [];
    return addableCalendarEntriesForInvoice(
      calendarEntries,
      resolvedClientId,
      lineItems,
      excludedCalendarEntryIds,
      issueDate,
      editingInvoice?.id
    );
  }, [
    resolvedClientId,
    calendarEntries,
    lineItems,
    excludedCalendarEntryIds,
    issueDate,
    editingInvoice?.id,
  ]);

  const totals = calculateTotal(visibleLineItems, taxOn, taxRate);

  const buildDraft = (): InvoiceDraft => ({
    clientId,
    clientName: selectedClient ? clientInvoiceName(selectedClient) : clientQuery.trim(),
    number,
    issueDate,
    dueDate: dueOn ? dueDate : null,
    lineItems: lineItems.filter((i) => i.description.trim() || i.rate > 0),
    notes,
    taxEnabled: taxOn,
    taxRate,
  });

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setLineItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const addCalendarEntryToInvoice = (entry: CalendarEntry) => {
    setEditingCalendarEntryId((id) => (id === entry.id ? null : id));
    const lineItem = calendarEntryToLineItem(entry);
    setLineItems((prev) =>
      [...prev, lineItem].sort((a, b) => (a.sourceDate ?? '').localeCompare(b.sourceDate ?? ''))
    );
    setExcludedCalendarEntryIds((ids) => {
      if (!ids.has(entry.id)) return ids;
      const next = new Set(ids);
      next.delete(entry.id);
      return next;
    });
  };

  const addAllCalendarEntriesToInvoice = () => {
    const imported = calendarEntriesToLineItems(addableCalendarEntries);
    setLineItems((prev) => {
      const merged = [...prev, ...imported].sort((a, b) =>
        (a.sourceDate ?? '').localeCompare(b.sourceDate ?? '')
      );
      return merged;
    });
    setExcludedCalendarEntryIds((ids) => {
      const next = new Set(ids);
      for (const entry of addableCalendarEntries) {
        next.delete(entry.id);
      }
      return next;
    });
  };

  const addFixedItem = async () => {
    if (!resolvedClientId || addingFixedItem) return;

    setAddingFixedItem(true);
    try {
      const created = await onAddCalendarEntry({
        clientId: resolvedClientId,
        date: issueDate,
        description: '',
        quantity: 1,
        rate: 0,
        entryType: 'fixed',
      });
      const lineItem = calendarEntryToLineItem(created);
      setLineItems((prev) => {
        const kept = prev.filter(
          (item) =>
            item.sourceCalendarEntryId || item.description.trim() || item.rate > 0
        );
        const withoutDuplicate = kept.filter(
          (item) => item.sourceCalendarEntryId !== created.id
        );
        return [...withoutDuplicate, lineItem].sort((a, b) =>
          (a.sourceDate ?? '').localeCompare(b.sourceDate ?? '')
        );
      });
      setEditingCalendarEntryId(null);
      setEditingLineItemId(lineItem.id);
    } finally {
      setAddingFixedItem(false);
    }
  };

  const removeLineItem = async (item: LineItem) => {
    const ok = await confirm({
      title: 'Remove line item?',
      description: item.description.trim()
        ? `Remove "${item.description.trim()}" from this invoice.`
        : 'Remove this line item from the invoice.',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setEditingLineItemId((id) => (id === item.id ? null : id));
    if (item.sourceCalendarEntryId) {
      const entry = calendarEntries.find(
        (calendarEntry) => calendarEntry.id === item.sourceCalendarEntryId
      );
      if (entry && isEmptyFixedCalendarEntry(entry)) {
        await onDeleteCalendarEntry(entry.id);
      } else {
        const isRecurring =
          (entry && isRecurringCalendarEntry(entry)) ||
          Boolean(item.sourceRecurringLineItemId);
        setExcludedCalendarEntryIds((ids) => {
          const next = new Set(ids);
          if (isRecurring) {
            next.add(item.sourceCalendarEntryId!);
          } else {
            next.delete(item.sourceCalendarEntryId!);
          }
          return next;
        });
      }
    }
    setLineItems((arr) => arr.filter((i) => i.id !== item.id));
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (status: 'draft' | 'unpaid') => {
    const draft = buildDraft();
    if (!draft.clientName.trim()) return;
    setSaving(true);
    try {
      await onSave(draft, status);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const draft = buildDraft();
    if (!draft.clientName.trim() || !onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inline-flex flex-col h-full max-w-full">
      <div className="flex h-14 w-full shrink-0 items-center justify-between overflow-hidden border-b border-border px-6 no-print">
        <div className="flex h-full min-w-0 flex-1 items-center gap-3">
          <IconButton
            icon={X}
            size="md"
            variant="ghost"
            aria-label="Close panel"
            onClick={onClose}
            className="h-7 w-7 rounded"
          />
          <span className="inline-flex h-7 shrink-0 items-center text-[15px] font-medium leading-none">
            {isEditMode ? 'Edit invoice' : 'New invoice'}
          </span>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center font-mono text-[15px] font-normal leading-none text-muted-foreground">
          {number}
        </span>
      </div>

      <div className="flex-1 overflow-auto px-6 pt-5 pb-6 space-y-6 min-w-[400px]">
        <Field label="Client">
          <ClientCombobox
            clients={clients}
            clientId={clientId}
            clientQuery={clientQuery}
            onClientIdChange={setClientId}
            onClientQueryChange={setClientQuery}
            onSelect={() => setNumberEdited(false)}
          />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Issue date">
            <DateInput value={issueDate} onChange={setIssueDate} />
          </Field>
          <Field label="Due date">
            <div className="flex h-8 items-center gap-2 border border-border rounded bg-background px-2 focus-within:border-primary">
              {dueOn ? (
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="min-w-0 flex-1 h-full bg-transparent text-[13px] outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 px-1 text-[13px] text-muted-foreground">None</span>
              )}
              <Switch
                checked={dueOn}
                onCheckedChange={setDueOn}
                id="due-date"
                aria-label="Set a due date"
              />
            </div>
          </Field>
          <Field label="Invoice number">
            <input
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                setNumberEdited(true);
              }}
              className="w-full h-8 px-3 text-[13px] font-mono border border-border rounded bg-background outline-none focus:border-primary"
            />
          </Field>
        </div>

        <div>
          {resolvedClientId && (
            <div className="mb-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <SectionHeader title="Add from calendar" compact />
                {addableCalendarEntries.length > 1 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={addAllCalendarEntriesToInvoice}
                    className="h-auto px-0 py-0 text-[12px]"
                  >
                    Add all
                  </Button>
                )}
              </div>
              {addableCalendarEntries.length === 0 ? (
                <EmptyState
                  message="No unbilled calendar entries are available for this client in the current or prior billing month."
                  padding="compact"
                  className="px-0 py-0"
                />
              ) : (
                <div className="rounded border border-border divide-y divide-border">
                  {addableCalendarEntries.map((entry) => {
                    const isEditingEntry = editingCalendarEntryId === entry.id;
                    const editClient =
                      clients.find((c) => c.id === entry.clientId) ??
                      invoiceClient ??
                      selectedClient;

                    return (
                      <div key={entry.id} className="text-[13px]">
                        {isEditingEntry && editClient ? (
                          <ImportedLineItemEditForm
                            item={calendarEntryToLineItem(entry)}
                            calendarEntry={entry}
                            client={editClient}
                            onSave={async (updated) => {
                              await onUpdateCalendarEntry(updated);
                              setEditingCalendarEntryId(null);
                            }}
                            onCancel={() => setEditingCalendarEntryId(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="truncate">
                                {entry.description.trim() || 'Work logged'}
                              </div>
                              <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                                {formatDateLong(entry.date)} · {formatCalendarEntryAmount(entry)}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLineItemId(null);
                                  setEditingCalendarEntryId(entry.id);
                                }}
                                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                aria-label="Edit calendar entry"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => addCalendarEntryToInvoice(entry)}
                                className="flex items-center gap-1 rounded px-2 py-1 text-[12px] text-primary hover:bg-secondary"
                              >
                                <Plus className="h-3 w-3" />
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <SectionHeader title="Line items" />
          {visibleLineItems.length === 0 ? (
            <EmptyState message="No line items to show." padding="compact" className="px-0 py-0" />
          ) : (
            <div className="min-w-0 rounded border border-border">
              <div
                className={cn(
                  'grid gap-3 pl-3 pr-0 py-1.5 text-[12px] text-muted-foreground border-b border-border bg-secondary',
                  LINE_ITEMS_GRID
                )}
              >
                <div>Description</div>
                <div>Type</div>
                <div className="text-left pl-1">Amount</div>
                <div />
              </div>
              {visibleLineItems.map((item) => {
              const isImported = Boolean(item.sourceCalendarEntryId);
              const isFixed = item.entryType === 'fixed';
              const amount = isFixed ? item.rate : item.quantity * item.rate;
              const editCalendarEntry = isImported
                ? resolveEditCalendarEntry(
                    item,
                    calendarEntries,
                    issueDate,
                    resolvedClientId
                  )
                : null;
              const editClient = editCalendarEntry
                ? clients.find((c) => c.id === editCalendarEntry.clientId) ??
                  invoiceClient ??
                  selectedClient
                : null;
              const isEditing = editingLineItemId === item.id;
              const showEditForm =
                isEditing &&
                editCalendarEntry &&
                editClient &&
                isEmptyFixedCalendarEntry(editCalendarEntry);

              return (
                <div
                  key={item.id}
                  className="border-b last:border-b-0 border-border text-[13px]"
                >
                  {showEditForm ? (
                    <ImportedLineItemEditForm
                      item={item}
                      calendarEntry={editCalendarEntry}
                      client={editClient}
                      onSave={async (entry) => {
                        await onUpdateCalendarEntry(entry);
                        setLineItems((prev) =>
                          prev.map((lineItem) =>
                            lineItem.id === item.id
                              ? calendarEntryToLineItem(entry, lineItem.id)
                              : lineItem
                          )
                        );
                        setEditingLineItemId(null);
                      }}
                      onCancel={async () => {
                        if (
                          editCalendarEntry &&
                          isEmptyFixedCalendarEntry(editCalendarEntry)
                        ) {
                          await onDeleteCalendarEntry(editCalendarEntry.id);
                          setLineItems((prev) =>
                            prev.filter((lineItem) => lineItem.id !== item.id)
                          );
                        }
                        setEditingLineItemId(null);
                      }}
                    />
                  ) : (
                    <div
                      className={cn(
                        'grid gap-3 pl-3 pr-0 pt-[8px] pb-[9.5px] items-center',
                        LINE_ITEMS_GRID
                      )}
                    >
                      {isImported ? (
                        <ImportedInvoiceLineItem item={item} />
                      ) : (
                        <>
                          <input
                            value={item.description}
                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            placeholder="e.g. Brand identity — logo & marks"
                            className="h-7 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/60"
                          />
                          <LineItemTypeCell kind={lineItemKindFromLineItem(item)} />
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={amount || ''}
                            onChange={(e) =>
                              updateItem(item.id, { rate: Number(e.target.value) || 0 })
                            }
                            className="h-7 w-full bg-transparent pl-1 text-left outline-none tabular-nums"
                          />
                        </>
                      )}
                      <div className="flex items-center justify-end gap-1.5">
                        <IconButton
                          icon={Trash2}
                          variant="destructive"
                          aria-label="Remove line item"
                          onClick={() => removeLineItem(item)}
                          className="pr-3"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )}
          <Button
            variant="link"
            size="sm"
            icon={Plus}
            onClick={addFixedItem}
            disabled={!resolvedClientId || addingFixedItem}
            className="mt-2 h-auto px-0 py-0"
          >
            {addingFixedItem ? 'Adding…' : 'Add fixed item'}
          </Button>
        </div>

        <Field label="Notes (optional)">
          <Textarea
            value={notes}
            onChange={setNotes}
            placeholder="Payment terms, a thank-you, anything else."
            rows={3}
          />
        </Field>

        <div className="flex justify-end pb-[6px]">
          <div className="w-72 space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Switch checked={taxOn} onCheckedChange={setTaxOn} id="tax" />
                <label htmlFor="tax" className="cursor-pointer shrink-0">
                  Tax
                </label>
                <div className="flex w-14 shrink-0 items-center gap-0.5">
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                    disabled={!taxOn}
                    tabIndex={taxOn ? 0 : -1}
                    aria-hidden={!taxOn}
                    className={cn(
                      'h-6 w-12 rounded border border-border bg-background px-1.5 text-right outline-none transition-opacity',
                      !taxOn && 'pointer-events-none opacity-0'
                    )}
                  />
                  <span className={cn('transition-opacity', !taxOn && 'opacity-0')}>%</span>
                </div>
              </div>
              <span className="shrink-0 tabular-nums">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-border">
              <span className="font-medium">Total</span>
              <span className="font-medium tabular-nums">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        <FormFooter>
          {isEditMode ? (
            <Button variant="primary" onClick={handleUpdate} disabled={saving} loading={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          ) : (
            <>
              <Button onClick={() => handleSave('draft')} disabled={saving} loading={saving}>
                {saving ? 'Saving…' : 'Save as Draft'}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSave('unpaid')}
                disabled={saving}
                loading={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </FormFooter>
      </div>
    </div>
  );
}
