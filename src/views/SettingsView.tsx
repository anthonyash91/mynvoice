import { useEffect, useState, type ChangeEvent } from 'react';
import { Field } from '@/components/Field';
import { TextInput } from '@/components/TextInput';
import { ViewHeader } from '@/components/ViewHeader';
import type { Settings } from '@/types';

interface SettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsView({ settings, onSave }: SettingsViewProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const upload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, logo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const save = () => {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div>
      <ViewHeader title="Settings" />
      <div className="px-8 py-6 max-w-2xl space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Business name">
            <TextInput
              value={draft.businessName}
              onChange={(v) => setDraft({ ...draft, businessName: v })}
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={draft.email}
              onChange={(v) => setDraft({ ...draft, email: v })}
            />
          </Field>
        </div>

        <Field label="Payment details">
          <textarea
            value={draft.paymentDetails}
            onChange={(e) => setDraft({ ...draft, paymentDetails: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 text-[13px] border border-border rounded bg-background outline-none focus:border-primary resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Default tax rate (%)">
            <TextInput
              type="number"
              value={draft.defaultTaxRate ? String(draft.defaultTaxRate) : ''}
              onChange={(v) => setDraft({ ...draft, defaultTaxRate: v ? Number(v) : 0 })}
              placeholder="Optional"
            />
          </Field>
          <Field label="Logo">
            <div className="flex items-center gap-3">
              {draft.logo && (
                <img
                  src={draft.logo}
                  alt=""
                  className="h-8 w-8 object-contain border border-border rounded"
                />
              )}
              <input type="file" accept="image/*" onChange={upload} className="text-[13px]" />
              {draft.logo && (
                <button
                  onClick={() => setDraft({ ...draft, logo: null })}
                  className="text-[13px] text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
          </Field>
        </div>

        <div className="pt-3 border-t border-border flex items-center gap-3">
          <button
            onClick={save}
            className="h-8 px-3 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium"
          >
            Save
          </button>
          {saved && <span className="text-[13px] text-[#34C759]">Saved.</span>}
        </div>
      </div>
    </div>
  );
}
