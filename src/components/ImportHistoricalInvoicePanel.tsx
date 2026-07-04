import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { ClientCombobox } from '@/components/ClientCombobox';
import { DateInput } from '@/components/DateInput';
import { Field } from '@/components/Field';
import { FormFooter } from '@/components/FormFooter';
import { SectionHeader } from '@/components/SectionHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Textarea } from '@/components/Textarea';
import { TextInput } from '@/components/TextInput';
import { ViewHeader } from '@/components/ViewHeader';
import { Switch } from '@/components/ui/switch';
import { calculateTotal, formatCurrency } from '@/lib/calculations';
import { clientInvoiceName } from '@/lib/client';
import {
  HISTORICAL_CSV_TEMPLATE,
  newFixedHistoricalLineItem,
  normalizeHistoricalLineItem,
  parseHistoricalCsv,
  validateHistoricalInput,
} from '@/lib/historicalInvoice';
import type {
  BulkHistoricalImportResult,
  Client,
  HistoricalInvoiceInput,
  Invoice,
  InvoiceStoredStatus,
  LineItem,
} from '@/types';

type ImportMode = 'single' | 'bulk';

const STATUS_OPTIONS: { value: InvoiceStoredStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'draft', label: 'Draft' },
  { value: 'payment_sent', label: 'Payment sent' },
];

function emptyLineItem(): LineItem {
  return newFixedHistoricalLineItem('', 0);
}

interface ImportHistoricalInvoicePanelProps {
  clients: Client[];
  editingInvoice?: Invoice;
  onClose: () => void;
  onImport: (input: HistoricalInvoiceInput) => Promise<Invoice>;
  onUpdate?: (invoiceId: string, input: HistoricalInvoiceInput) => Promise<Invoice>;
  onBulkImport: (csvText: string) => Promise<BulkHistoricalImportResult>;
}

export function ImportHistoricalInvoicePanel({
  clients,
  editingInvoice,
  onClose,
  onImport,
  onUpdate,
  onBulkImport,
}: ImportHistoricalInvoicePanelProps) {
  const isEditMode = Boolean(editingInvoice);
  const [mode, setMode] = useState<ImportMode>('single');
  const [clientId, setClientId] = useState(editingInvoice?.clientId ?? '');
  const [clientQuery, setClientQuery] = useState(editingInvoice?.clientName ?? '');
  const [number, setNumber] = useState(editingInvoice?.number ?? '');
  const [issueDate, setIssueDate] = useState(editingInvoice?.issueDate ?? '');
  const [dueDate, setDueDate] = useState(editingInvoice?.dueDate ?? '');
  const [dueOn, setDueOn] = useState(Boolean(editingInvoice?.dueDate));
  const [status, setStatus] = useState<InvoiceStoredStatus>(editingInvoice?.status ?? 'paid');
  const [paidAt, setPaidAt] = useState(editingInvoice?.paidAt ?? '');
  const [lineItems, setLineItems] = useState<LineItem[]>(
    editingInvoice?.lineItems.length
      ? editingInvoice.lineItems.map(normalizeHistoricalLineItem)
      : [emptyLineItem()]
  );
  const [notes, setNotes] = useState(editingInvoice?.notes ?? '');
  const [taxEnabled, setTaxEnabled] = useState(editingInvoice?.taxEnabled ?? false);
  const [taxRate, setTaxRate] = useState(
    editingInvoice?.taxRate ? String(editingInvoice.taxRate) : ''
  );
  const [csvText, setCsvText] = useState(HISTORICAL_CSV_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkHistoricalImportResult | null>(null);

  useEffect(() => {
    if (!editingInvoice) return;
    setClientId(editingInvoice.clientId);
    setClientQuery(editingInvoice.clientName);
    setNumber(editingInvoice.number);
    setIssueDate(editingInvoice.issueDate);
    setDueDate(editingInvoice.dueDate ?? '');
    setDueOn(Boolean(editingInvoice.dueDate));
    setStatus(editingInvoice.status);
    setPaidAt(editingInvoice.paidAt ?? '');
    setLineItems(
      editingInvoice.lineItems.length
        ? editingInvoice.lineItems.map(normalizeHistoricalLineItem)
        : [emptyLineItem()]
    );
    setNotes(editingInvoice.notes);
    setTaxEnabled(editingInvoice.taxEnabled);
    setTaxRate(editingInvoice.taxRate ? String(editingInvoice.taxRate) : '');
    setMode('single');
  }, [editingInvoice]);

  useEffect(() => {
    if (status === 'paid' && !paidAt && issueDate) {
      setPaidAt(issueDate);
    }
  }, [status, paidAt, issueDate]);

  const selectedClient = clients.find((client) => client.id === clientId);
  const clientName = selectedClient ? clientInvoiceName(selectedClient) : clientQuery.trim();

  const totals = useMemo(
    () =>
      calculateTotal(
        lineItems,
        taxEnabled,
        taxEnabled && taxRate ? Number(taxRate) : 0
      ),
    [lineItems, taxEnabled, taxRate]
  );

  const parsedCsv = useMemo(() => parseHistoricalCsv(csvText), [csvText]);

  const buildInput = (): HistoricalInvoiceInput => ({
    clientId,
    clientName,
    number: number.trim(),
    issueDate,
    dueDate: dueOn ? dueDate || null : null,
    lineItems: lineItems.filter((item) => item.description.trim()),
    notes,
    taxEnabled,
    taxRate: taxEnabled && taxRate ? Number(taxRate) : 0,
    status,
    paidAt: status === 'paid' ? paidAt || issueDate : null,
    createdAt: issueDate,
  });

  const saveSingle = async () => {
    const input = buildInput();
    const validationError = validateHistoricalInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isEditMode && editingInvoice && onUpdate) {
        await onUpdate(editingInvoice.id, input);
      } else {
        await onImport(input);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      if (!isEditMode) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save historical invoice.');
    } finally {
      setSaving(false);
    }
  };

  const runBulkImport = async () => {
    setSaving(true);
    setError(null);
    setBulkResult(null);
    try {
      if (parsedCsv.invoices.length === 0) {
        setError(
          parsedCsv.errors.length > 0
            ? parsedCsv.errors.join('\n')
            : 'No invoices found in CSV.'
        );
        return;
      }
      const result = await onBulkImport(csvText);
      setBulkResult(result);
      const messages: string[] = [];
      if (parsedCsv.errors.length > 0) {
        messages.push(
          `Skipped ${parsedCsv.errors.length} row${parsedCsv.errors.length === 1 ? '' : 's'} with parse errors:\n${parsedCsv.errors.join('\n')}`
        );
      }
      if (result.errors.length > 0) {
        messages.push(result.errors.join('\n'));
      }
      if (messages.length > 0) {
        setError(messages.join('\n\n'));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk import failed.');
    } finally {
      setSaving(false);
    }
  };

  const updateLineItem = (id: string, patch: Partial<LineItem>) => {
    setLineItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <div className="inline-flex h-full w-[420px] max-w-full flex-col">
      <ViewHeader
        inPanel
        onClose={onClose}
        title={isEditMode ? 'Edit historical invoice' : 'Import historical'}
      />

      <div className="flex-1 overflow-auto px-6 pt-5 pb-6 space-y-5 min-w-0">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Historical invoices are record-only. They never send emails, never appear on public
          payment pages, and are excluded from automated reminders.
        </p>

        {!isEditMode && (
          <SegmentedControl<ImportMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single', label: 'Single' },
              { value: 'bulk', label: 'Bulk CSV' },
            ]}
          />
        )}

        {mode === 'single' ? (
          <>
            <Field label="Client">
              <ClientCombobox
                clients={clients}
                clientId={clientId}
                clientQuery={clientQuery}
                onClientIdChange={setClientId}
                onClientQueryChange={setClientQuery}
              />
            </Field>

            <Field label="Invoice number">
              <TextInput value={number} onChange={setNumber} placeholder="INV-2019-001" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Issue date">
                <DateInput value={issueDate} onChange={setIssueDate} />
              </Field>
              <Field label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InvoiceStoredStatus)}
                  className="h-8 w-full rounded border border-border bg-background px-2 text-[13px]"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Due date">
              <div className="flex h-8 items-center gap-2 border border-border rounded bg-background px-2">
                {dueOn ? (
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                  />
                ) : (
                  <span className="flex-1 text-[13px] text-muted-foreground">None</span>
                )}
                <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Switch checked={dueOn} onCheckedChange={setDueOn} />
                  Due date
                </label>
              </div>
            </Field>

            {status === 'paid' && (
              <Field label="Paid date" hint="When the client actually paid — no email will be sent.">
                <DateInput value={paidAt} onChange={setPaidAt} />
              </Field>
            )}

            <SectionHeader
              title="Line items"
              description="Fixed amounts only — enter the total for each line."
            />
            <div className="space-y-3">
              {lineItems.map((item) => (
                <div key={item.id} className="rounded border border-border p-3 space-y-2">
                  <TextInput
                    value={item.description}
                    onChange={(value) => updateLineItem(item.id, { description: value })}
                    placeholder="Description"
                  />
                  <TextInput
                    type="number"
                    value={item.rate ? String(item.rate) : ''}
                    onChange={(value) =>
                      updateLineItem(item.id, {
                        entryType: 'fixed',
                        quantity: 1,
                        rate: value ? Number(value) : 0,
                      })
                    }
                    placeholder="Amount"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setLineItems((items) =>
                          items.length > 1 ? items.filter((row) => row.id !== item.id) : items
                        )
                      }
                      className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={() => setLineItems((items) => [...items, emptyLineItem()])}
              >
                Add line item
              </Button>
            </div>

            <Field label="Tax">
              <div className="flex h-8 items-center gap-2 border border-border rounded bg-background px-2">
                <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
                  Enable tax
                </label>
                {taxEnabled && (
                  <div className="max-w-[88px]">
                    <TextInput
                      type="number"
                      value={taxRate}
                      onChange={setTaxRate}
                      placeholder="Rate %"
                    />
                  </div>
                )}
                <span className="ml-auto text-[13px] font-medium tabular-nums">
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </Field>

            <Field label="Notes">
              <Textarea value={notes} onChange={setNotes} rows={3} />
            </Field>
          </>
        ) : (
          <>
            <Field
              label="CSV file"
              hint="Required: client, number, issue_date, status, description, amount. Fixed invoices use one amount column — no quantity or rate needed."
            >
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setCsvText(String(reader.result ?? ''));
                  reader.readAsText(file);
                  e.target.value = '';
                }}
                className="block w-full text-[13px] file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-[13px]"
              />
            </Field>

            <Field label="CSV data">
              <Textarea
                value={csvText}
                onChange={setCsvText}
                rows={12}
                className="font-mono text-[12px]"
              />
            </Field>

            <div className="rounded border border-border bg-secondary/40 px-3 py-2 text-[12px] text-muted-foreground">
              <p>
                {parsedCsv.invoices.length} invoice
                {parsedCsv.invoices.length === 1 ? '' : 's'} ready
                {parsedCsv.errors.length > 0
                  ? ` · ${parsedCsv.errors.length} row${parsedCsv.errors.length === 1 ? '' : 's'} skipped`
                  : ''}
              </p>
              <p className="mt-1">Repeat the same client + number on multiple rows for extra line items.</p>
            </div>

            {parsedCsv.errors.length > 0 && (
              <div className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive whitespace-pre-wrap max-h-40 overflow-auto">
                {parsedCsv.errors.join('\n')}
              </div>
            )}

            {bulkResult && (
              <div className="rounded border border-border px-3 py-2 text-[12px] space-y-1">
                <p className="text-foreground">
                  Imported {bulkResult.imported.length} invoice
                  {bulkResult.imported.length === 1 ? '' : 's'}.
                </p>
                {bulkResult.errors.length > 0 && (
                  <div className="text-destructive whitespace-pre-wrap">
                    {bulkResult.errors.join('\n')}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="text-[12px] text-destructive whitespace-pre-wrap">{error}</p>}
      </div>

      <FormFooter className="px-6">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={mode === 'single' ? saveSingle : runBulkImport}
          disabled={saving || (mode === 'bulk' && parsedCsv.invoices.length === 0)}
          loading={saving}
          saved={saved}
          savedLabel={mode === 'bulk' ? 'Imported' : 'Saved'}
        >
          {mode === 'single'
            ? isEditMode
              ? 'Save changes'
              : 'Import invoice'
            : 'Import CSV'}
        </Button>
      </FormFooter>
    </div>
  );
}
