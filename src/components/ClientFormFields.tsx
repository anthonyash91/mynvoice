import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AddLink } from '@/components/AddLink';
import { Field } from '@/components/Field';
import { IconButton } from '@/components/IconButton';
import { SectionHeader } from '@/components/SectionHeader';
import { Textarea } from '@/components/Textarea';
import { TextInput } from '@/components/TextInput';
import { useConfirm } from '@/hooks/useConfirm';
import { formatCurrency } from '@/lib/calculations';
import { emptyClientRate, emptyRecurringLineItem, type ClientDraft } from '@/lib/client';

interface ClientFormFieldsProps {
  draft: ClientDraft;
  onChange: (draft: ClientDraft) => void;
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
          placeholder="Acme Co"
        />
      </Field>

      <Field label="Owner">
        <TextInput
          value={draft.owner}
          onChange={(v) => set({ owner: v })}
          placeholder="Jane Smith"
        />
      </Field>

      <Field label="Primary email">
        <TextInput
          type="email"
          value={draft.primaryEmail}
          onChange={(v) => set({ primaryEmail: v })}
          placeholder="jane@acme.co"
        />
      </Field>

      {showAdditionalEmails ? (
        <div>
          <SectionHeader title="Additional emails" />
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
                <IconButton
                  icon={Trash2}
                  variant="destructive"
                  aria-label="Remove email"
                  onClick={() => removeEmail(index)}
                />
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
          <SectionHeader title="Additional rates" />
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
                <IconButton
                  icon={Trash2}
                  variant="destructive"
                  aria-label="Remove rate"
                  onClick={() => removeRate(rate.id)}
                />
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
          <SectionHeader
            title="Recurring line items"
            description="Added automatically to new invoices once per month on the chosen day."
          />
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
                <IconButton
                  icon={Trash2}
                  variant="destructive"
                  aria-label="Remove recurring line item"
                  onClick={() => removeRecurringLineItem(item.id)}
                />
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
        <Textarea
          value={draft.address}
          onChange={(address) => set({ address })}
          rows={3}
          placeholder="Street, city, state, zip"
        />
      </Field>

      <div>
        <SectionHeader
          title="Reminder intervals"
          description="Optional overrides for this client. Leave blank to use your global Settings intervals."
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment reminder (days)">
            <TextInput
              type="number"
              value={
                draft.reminderIntervalDays != null ? String(draft.reminderIntervalDays) : ''
              }
              onChange={(v) =>
                set({
                  reminderIntervalDays: v === '' ? null : Math.max(1, Number(v) || 1),
                })
              }
              placeholder="Use global default"
            />
          </Field>
          <Field label="Late notice (days)">
            <TextInput
              type="number"
              value={
                draft.lateReminderIntervalDays != null
                  ? String(draft.lateReminderIntervalDays)
                  : ''
              }
              onChange={(v) =>
                set({
                  lateReminderIntervalDays: v === '' ? null : Math.max(1, Number(v) || 1),
                })
              }
              placeholder="Use global default"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
