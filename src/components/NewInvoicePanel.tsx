import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Field } from '@/components/Field';
import { Switch } from '@/components/ui/switch';
import type { Client, InvoiceDraft, LineItem, Settings } from '@/types';
import { calculateTotal, formatCurrency } from '@/lib/calculations';

interface NewInvoicePanelProps {
  clients: Client[];
  settings: Settings;
  initialNumber: string;
  onClose: () => void;
  onSave: (draft: InvoiceDraft, status: 'draft' | 'sent') => void;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function emptyLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0 };
}

export function NewInvoicePanel({
  clients,
  settings,
  initialNumber,
  onClose,
  onSave,
}: NewInvoicePanelProps) {
  const [number] = useState(initialNumber);
  const [clientQuery, setClientQuery] = useState('');
  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(daysFromNow(14));
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);
  const [notes, setNotes] = useState('');
  const [taxOn, setTaxOn] = useState(Boolean(settings.defaultTaxRate));
  const [taxRate, setTaxRate] = useState(settings.defaultTaxRate);

  const selectedClient = clients.find((c) => c.id === clientId);
  const suggestions = useMemo(() => {
    if (!clientQuery || clientId) return [];
    const q = clientQuery.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [clientQuery, clients, clientId]);

  const totals = calculateTotal(lineItems, taxOn, taxRate);

  const buildDraft = (): InvoiceDraft => ({
    clientId,
    clientName: selectedClient?.name ?? clientQuery.trim(),
    number,
    issueDate,
    dueDate,
    lineItems: lineItems.filter((i) => i.description.trim() || i.rate > 0),
    notes,
    taxEnabled: taxOn,
    taxRate,
  });

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setLineItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const handleSave = (status: 'draft' | 'sent') => {
    const draft = buildDraft();
    if (!draft.clientName.trim()) return;
    onSave(draft, status);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 px-6 border-b border-border flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <span className="text-[15px] font-medium">New invoice</span>
          <span className="font-mono text-[13px] text-muted-foreground">{number}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
        <Field label="Client">
          {selectedClient ? (
            <div className="flex items-center justify-between border border-border rounded px-3 py-1.5 text-[13px]">
              <span>
                {selectedClient.name}
                {selectedClient.company && (
                  <span className="text-muted-foreground"> · {selectedClient.company}</span>
                )}
              </span>
              <button
                onClick={() => {
                  setClientId('');
                  setClientQuery('');
                }}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Start typing a name…"
                className="w-full h-8 px-3 text-[13px] border border-border rounded bg-background outline-none focus:border-primary"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 border border-border rounded bg-popover overflow-hidden">
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClientId(c.id);
                        setClientQuery(c.name);
                      }}
                      className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-secondary"
                    >
                      {c.name}
                      {c.company && (
                        <span className="text-muted-foreground"> · {c.company}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-8 px-3 text-[13px] border border-border rounded bg-background outline-none focus:border-primary"
            />
          </Field>
          <Field label="Invoice number">
            <input
              value={number}
              readOnly
              className="w-full h-8 px-3 text-[13px] font-mono border border-border rounded bg-secondary outline-none"
            />
          </Field>
        </div>

        <div>
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
            Line items
          </div>
          <div className="border border-border rounded overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_100px_100px_28px] gap-2 px-3 py-1.5 text-[12px] text-muted-foreground border-b border-border bg-secondary">
              <div>Description</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Rate</div>
              <div className="text-right">Amount</div>
              <div />
            </div>
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_80px_100px_100px_28px] gap-2 px-3 py-1 items-center border-b last:border-b-0 border-border text-[13px]"
              >
                <input
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder="e.g. Brand identity — logo & marks"
                  className="h-7 bg-transparent outline-none placeholder:text-muted-foreground/60"
                />
                <input
                  type="number"
                  min={0}
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(item.id, { quantity: Number(e.target.value) || 0 })
                  }
                  className="h-7 text-right bg-transparent outline-none tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.rate}
                  onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) || 0 })}
                  className="h-7 text-right bg-transparent outline-none tabular-nums"
                />
                <div className="text-right tabular-nums">
                  {formatCurrency(item.quantity * item.rate)}
                </div>
                <button
                  onClick={() =>
                    setLineItems((arr) => arr.filter((i) => i.id !== item.id))
                  }
                  disabled={lineItems.length === 1}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLineItems((arr) => [...arr, emptyLineItem()])}
            className="mt-2 text-[13px] text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add line
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
                <label htmlFor="tax" className="cursor-pointer">
                  Tax
                </label>
                {taxOn && (
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                    className="w-12 h-6 px-1.5 text-right border border-border rounded bg-background outline-none"
                  />
                )}
                {taxOn && <span>%</span>}
              </div>
              <span className="tabular-nums">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-border">
              <span className="font-medium">Total</span>
              <span className="font-medium tabular-nums">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={() => handleSave('draft')}
            className="h-8 px-3 text-[13px] text-foreground rounded hover:bg-secondary"
          >
            Save as Draft
          </button>
          <button
            onClick={() => handleSave('sent')}
            className="h-8 px-3 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium"
          >
            Preview & Send
          </button>
        </div>
      </div>
    </div>
  );
}
