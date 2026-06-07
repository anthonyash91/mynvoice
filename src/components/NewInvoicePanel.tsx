import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { ClientCombobox } from '@/components/ClientCombobox';
import { Field } from '@/components/Field';
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
import { calculateTotal, formatCurrency, formatDate } from '@/lib/calculations';
import { formatDurationQuantity } from '@/lib/duration';
import { clientInvoiceName } from '@/lib/client';
import { ImportedLineItemEditForm } from '@/components/ImportedLineItemEditForm';
import { LineItemTypeBadge } from '@/components/LineItemTypeBadge';
import { lineItemKindFromLineItem } from '@/lib/lineItem';
import {
  calendarEntriesToLineItems,
  calendarEntryToLineItem,
  invoiceCalendarEntries,
  isEmptyFixedCalendarEntry,
  isLineItemVisibleOnInvoice,
  syncImportedLineItems,
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
  onClose: () => void;
  onSave: (draft: InvoiceDraft, status: 'draft' | 'unpaid') => Promise<void>;
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
      <div className="text-left tabular-nums">{formatCurrency(amount)}</div>
    </>
  );
}

export function NewInvoicePanel({
  clients,
  invoices,
  calendarEntries,
  recurringCalendarExclusions,
  settings,
  onClose,
  onSave,
  onAddCalendarEntry,
  onUpdateCalendarEntry,
  onDeleteCalendarEntry,
}: NewInvoicePanelProps) {
  const confirm = useConfirm();
  const [clientQuery, setClientQuery] = useState('');
  const [clientId, setClientId] = useState('');
  const suggestedNumber = useMemo(
    () => nextInvoiceNumberForClient(invoices, clients, clientId, clientQuery),
    [invoices, clients, clientId, clientQuery]
  );
  const [number, setNumber] = useState(suggestedNumber);
  const [numberEdited, setNumberEdited] = useState(false);
  const [issueDate, setIssueDate] = useState(today());
  const [dueOn, setDueOn] = useState(true);
  const [dueDate, setDueDate] = useState(daysFromNow(settings.defaultDueDays));
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [addingFixedItem, setAddingFixedItem] = useState(false);
  const [excludedCalendarEntryIds, setExcludedCalendarEntryIds] = useState<Set<string>>(
    () => new Set()
  );
  const [notes, setNotes] = useState('');
  const [taxOn, setTaxOn] = useState(Boolean(settings.defaultTaxRate));
  const [taxRate, setTaxRate] = useState(settings.defaultTaxRate);

  const resolvedClientId = useMemo(
    () => resolveClientIdForInvoice(clients, clientId, clientQuery),
    [clients, clientId, clientQuery]
  );
  const selectedClient = clients.find((c) => c.id === clientId);
  const invoiceClient = clients.find((c) => c.id === resolvedClientId);
  const prevClientRef = useRef(resolvedClientId);
  const applyingRecurringRef = useRef(false);

  useEffect(() => {
    if (!numberEdited) setNumber(suggestedNumber);
  }, [suggestedNumber, numberEdited]);

  useEffect(() => {
    if (!resolvedClientId) {
      setLineItems([]);
      setEditingLineItemId(null);
      prevClientRef.current = resolvedClientId;
      return;
    }

    if (prevClientRef.current !== resolvedClientId) {
      setEditingLineItemId(null);
      setExcludedCalendarEntryIds(new Set());
      const clientEntries = invoiceCalendarEntries(
        calendarEntries,
        resolvedClientId,
        issueDate
      );
      setLineItems(calendarEntriesToLineItems(clientEntries));
      prevClientRef.current = resolvedClientId;
      return;
    }

    setLineItems((prev) =>
      syncImportedLineItems(
        prev,
        calendarEntries,
        resolvedClientId,
        issueDate,
        excludedCalendarEntryIds
      )
    );
  }, [resolvedClientId, issueDate, calendarEntries, excludedCalendarEntryIds]);

  useEffect(() => {
    if (!resolvedClientId || !issueDate || !invoiceClient) return;

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
  ]);

  const visibleLineItems = useMemo(
    () =>
      lineItems.filter(
        (item) =>
          item.id === editingLineItemId ||
          isLineItemVisibleOnInvoice(item, calendarEntries, resolvedClientId, issueDate)
      ),
    [lineItems, calendarEntries, resolvedClientId, issueDate, editingLineItemId]
  );

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
        setExcludedCalendarEntryIds((ids) => {
          const next = new Set(ids);
          next.add(item.sourceCalendarEntryId!);
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

  return (
    <div className="inline-flex flex-col h-full max-w-full">
      <div className="flex h-14 w-full shrink-0 items-center justify-between overflow-hidden border-b border-border px-6 no-print">
        <div className="flex h-full min-w-0 flex-1 items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="inline-flex h-7 shrink-0 items-center text-[15px] font-medium leading-none">
            New invoice
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
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full h-8 px-3 text-[13px] border border-border rounded bg-background outline-none focus:border-primary"
            />
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
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
            Line items
          </div>
          {visibleLineItems.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No line items to show.</p>
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
                <div className="text-left">Amount</div>
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
                isImported && isEditing && editCalendarEntry && editClient;

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
                            className="h-7 w-full bg-transparent text-left outline-none tabular-nums"
                          />
                        </>
                      )}
                      <div className="flex items-center justify-end gap-1.5">
                        {isImported && (
                          <button
                            type="button"
                            onClick={() => setEditingLineItemId(item.id)}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                            aria-label="Edit line item"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeLineItem(item)}
                          disabled={visibleLineItems.length === 1}
                          className="rounded py-0.5 pl-0.5 pr-3 text-muted-foreground hover:text-destructive disabled:opacity-30"
                          aria-label="Remove line item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={addFixedItem}
            disabled={!resolvedClientId || addingFixedItem}
            className="mt-2 flex items-center gap-1 text-[13px] text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {addingFixedItem ? 'Adding…' : 'Add fixed item'}
          </button>
        </div>

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment terms, a thank-you, anything else."
            rows={3}
            className="w-full px-3 py-2 text-[13px] border border-border rounded bg-background outline-none focus:border-primary resize-none"
          />
        </Field>

        <div className="flex justify-end">
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

        <div className="flex justify-end gap-2 border-t border-border pt-[22px]">
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="h-8 px-3 text-[13px] text-foreground rounded hover:bg-secondary disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            onClick={() => handleSave('unpaid')}
            disabled={saving}
            className="h-8 px-3 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
