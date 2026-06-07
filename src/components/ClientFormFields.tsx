import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field } from '@/components/Field';
import { TextInput } from '@/components/TextInput';
import { useConfirm } from '@/hooks/useConfirm';
import { formatCurrency } from '@/lib/calculations';
import { emptyClientRate, emptyRecurringLineItem, type ClientDraft } from '@/lib/client';

interface ClientFormFieldsProps {
  draft: ClientDraft;
  onChange: (draft: ClientDraft) => void;
}

function AddLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] text-muted-foreground hover:text-foreground flex items-center gap-1"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export function ClientFormFields({ draft, onChange }: ClientFormFieldsProps) {
  const confirm = useConfirm();
  const set = (patch: Partial<ClientDraft>) => onChange({ ...draft, ...patch });

  const removeEmail = async (index: number) => {
    const email = draft.additionalEmails[index]?.trim();
    if (email) {
      const ok = await confirm({
        title: 'Remove email?',
        description: `Remove ${email} from this client.`,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
    }

    const additionalEmails = draft.additionalEmails.filter((_, i) => i !== index);
    set({ additionalEmails });
    if (additionalEmails.length === 0) setShowAdditionalEmails(false);
  };

  const removeRate = async (rateId: string) => {
    const rate = draft.additionalRates.find((item) => item.id === rateId);
    if (!rate) return;

    if (rate.label.trim() || rate.rate > 0) {
      const label = rate.label.trim() || `${formatCurrency(rate.rate)}/hr`;
      const ok = await confirm({
        title: 'Remove rate?',
        description: `Remove ${label} from this client.`,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
    }

    const additionalRates = draft.additionalRates.filter((item) => item.id !== rateId);
    set({ additionalRates });
    if (additionalRates.length === 0) setShowAdditionalRates(false);
  };
  const [showAdditionalEmails, setShowAdditionalEmails] = useState(
    draft.additionalEmails.length > 0
  );
  const [showAdditionalRates, setShowAdditionalRates] = useState(
    draft.additionalRates.length > 0
  );
  const [showRecurringLineItems, setShowRecurringLineItems] = useState(
    draft.recurringLineItems.length > 0
  );

  const removeRecurringLineItem = async (itemId: string) => {
    const item = draft.recurringLineItems.find((entry) => entry.id === itemId);
    if (!item) return;

    if (item.description.trim() || item.rate > 0) {
      const label = item.description.trim() || 'this recurring line item';
      const ok = await confirm({
        title: 'Remove recurring line item?',
        description: `Remove ${label} from this client.`,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
    }

    const recurringLineItems = draft.recurringLineItems.filter(
      (entry) => entry.id !== itemId
    );
    set({ recurringLineItems });
    if (recurringLineItems.length === 0) setShowRecurringLineItems(false);
  };

  return (
    <div className="space-y-4">
      <Field label="Company name">
        <TextInput
          value={draft.companyName}
          onChange={(v) => set({ companyName: v })}
          placeholder="Chen Studio"
        />
      </Field>

      <Field label="Owner">
        <TextInput
          value={draft.owner}
          onChange={(v) => set({ owner: v })}
          placeholder="Mia Chen"
        />
      </Field>

      <Field label="Primary email">
        <TextInput
          type="email"
          value={draft.primaryEmail}
          onChange={(v) => set({ primaryEmail: v })}
          placeholder="mia@chenstudio.co"
        />
      </Field>

      {showAdditionalEmails ? (
        <div>
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
            Additional emails
          </div>
          <div className="space-y-2">
            {draft.additionalEmails.map((email, index) => (
              <div key={index} className="flex gap-2">
                <TextInput
                  type="email"
                  value={email}
                  onChange={(v) => {
                    const additionalEmails = [...draft.additionalEmails];
                    additionalEmails[index] = v;
                    set({ additionalEmails });
                  }}
                  placeholder="billing@company.com"
                />
                <button
                  type="button"
                  onClick={() => removeEmail(index)}
                  className="text-muted-foreground hover:text-destructive shrink-0 px-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <AddLink
              label="Add email"
              onClick={() => set({ additionalEmails: [...draft.additionalEmails, ''] })}
            />
          </div>
        </div>
      ) : (
        <AddLink
          label="Add email"
          onClick={() => {
            setShowAdditionalEmails(true);
            set({ additionalEmails: [''] });
          }}
        />
      )}

      <Field label="Hourly rate">
        <TextInput
          type="number"
          value={draft.hourlyRate ? String(draft.hourlyRate) : ''}
          onChange={(v) => set({ hourlyRate: v ? Number(v) : 0 })}
          placeholder="150"
        />
      </Field>

      {showAdditionalRates ? (
        <div>
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
            Additional rates
          </div>
          <div className="space-y-2">
            {draft.additionalRates.map((rate) => (
              <div key={rate.id} className="flex gap-2 items-center">
                <TextInput
                  value={rate.label}
                  onChange={(v) =>
                    set({
                      additionalRates: draft.additionalRates.map((r) =>
                        r.id === rate.id ? { ...r, label: v } : r
                      ),
                    })
                  }
                  placeholder="Rate name"
                />
                <TextInput
                  type="number"
                  value={rate.rate ? String(rate.rate) : ''}
                  onChange={(v) =>
                    set({
                      additionalRates: draft.additionalRates.map((r) =>
                        r.id === rate.id ? { ...r, rate: v ? Number(v) : 0 } : r
                      ),
                    })
                  }
                  placeholder="200"
                />
                <button
                  type="button"
                  onClick={() => removeRate(rate.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0 px-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <AddLink
              label="Add rate"
              onClick={() =>
                set({ additionalRates: [...draft.additionalRates, emptyClientRate()] })
              }
            />
          </div>
        </div>
      ) : (
        <AddLink
          label="Add rate"
          onClick={() => {
            setShowAdditionalRates(true);
            set({ additionalRates: [emptyClientRate()] });
          }}
        />
      )}

      {showRecurringLineItems ? (
        <div>
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
            Recurring line items
          </div>
          <p className="mb-2 text-[12px] leading-snug text-muted-foreground">
            Added automatically to new invoices once per month on the chosen day.
          </p>
          <div className="space-y-2">
            {draft.recurringLineItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_4.5rem_5rem_auto] gap-2 items-center"
              >
                <TextInput
                  value={item.description}
                  onChange={(v) =>
                    set({
                      recurringLineItems: draft.recurringLineItems.map((entry) =>
                        entry.id === item.id ? { ...entry, description: v } : entry
                      ),
                    })
                  }
                  placeholder="Description"
                />
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={item.dayOfMonth ? String(item.dayOfMonth) : ''}
                  onChange={(e) =>
                    set({
                      recurringLineItems: draft.recurringLineItems.map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              dayOfMonth: Math.min(
                                31,
                                Math.max(1, Number(e.target.value) || 1)
                              ),
                            }
                          : entry
                      ),
                    })
                  }
                  placeholder="Day"
                  className="h-8 w-full rounded border border-border bg-background px-3 text-center text-[13px] outline-none focus:border-primary"
                />
                <TextInput
                  type="number"
                  value={item.rate ? String(item.rate) : ''}
                  onChange={(v) =>
                    set({
                      recurringLineItems: draft.recurringLineItems.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, rate: v ? Number(v) : 0 }
                          : entry
                      ),
                    })
                  }
                  placeholder="Amount"
                />
                <button
                  type="button"
                  onClick={() => removeRecurringLineItem(item.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0 px-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <AddLink
              label="Add recurring line item"
              onClick={() =>
                set({
                  recurringLineItems: [
                    ...draft.recurringLineItems,
                    emptyRecurringLineItem(),
                  ],
                })
              }
            />
          </div>
        </div>
      ) : (
        <AddLink
          label="Add recurring line item"
          onClick={() => {
            setShowRecurringLineItems(true);
            set({ recurringLineItems: [emptyRecurringLineItem()] });
          }}
        />
      )}

      <Field label="Address">
        <textarea
          value={draft.address}
          onChange={(e) => set({ address: e.target.value })}
          rows={3}
          placeholder="Street, city, state, zip"
          className="w-full px-3 py-2 text-[13px] border border-border rounded bg-background outline-none focus:border-primary resize-none"
        />
      </Field>
    </div>
  );
}
