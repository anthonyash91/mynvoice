import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field } from '@/components/Field';
import { TextInput } from '@/components/TextInput';
import { emptyClientRate, type ClientDraft } from '@/lib/client';

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
  const set = (patch: Partial<ClientDraft>) => onChange({ ...draft, ...patch });
  const [showAdditionalEmails, setShowAdditionalEmails] = useState(
    draft.additionalEmails.length > 0
  );
  const [showAdditionalRates, setShowAdditionalRates] = useState(
    draft.additionalRates.length > 0
  );

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
                  onClick={() => {
                    const additionalEmails = draft.additionalEmails.filter((_, i) => i !== index);
                    set({ additionalEmails });
                    if (additionalEmails.length === 0) setShowAdditionalEmails(false);
                  }}
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
                  onClick={() => {
                    const additionalRates = draft.additionalRates.filter((r) => r.id !== rate.id);
                    set({ additionalRates });
                    if (additionalRates.length === 0) setShowAdditionalRates(false);
                  }}
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
