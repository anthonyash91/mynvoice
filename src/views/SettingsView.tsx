import { useEffect, useState, type ChangeEvent } from 'react';
import { Field } from '@/components/Field';
import { TextInput } from '@/components/TextInput';
import { ViewHeader } from '@/components/ViewHeader';
import { cn } from '@/lib/utils';
import type { Settings } from '@/types';

type AddressTab = 'business' | 'mailing';

interface SettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
  onClose: () => void;
}

export function SettingsView({ settings, onSave, onClose }: SettingsViewProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const [addressTab, setAddressTab] = useState<AddressTab>('business');

  useEffect(() => {
    setDraft(settings);
    setLogoFileName(null);
    setLogoInputKey((k) => k + 1);
  }, [
    settings.businessName,
    settings.email,
    settings.businessAddress,
    settings.mailingAddress,
    settings.paymentDetails,
    settings.defaultTaxRate,
    settings.logo,
  ]);

  const resetLogoInput = () => setLogoInputKey((k) => k + 1);

  const upload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFileName(file.name);
    const input = e.target;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((d) => ({ ...d, logo: reader.result as string }));
      input.value = '';
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inline-flex flex-col h-full w-[360px] max-w-full shrink-0">
      <ViewHeader inPanel onClose={onClose} title="Settings" />
      <div className="flex-1 overflow-auto px-6 py-6 space-y-5 min-w-0">
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

        <Field label="Address">
          <div className="flex rounded border border-border p-0.5 mb-1.5">
            {(['business', 'mailing'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAddressTab(tab)}
                className={cn(
                  'flex-1 h-7 text-[12px] rounded-sm transition-colors',
                  addressTab === tab
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'business' ? 'Business' : 'Mailing'}
              </button>
            ))}
          </div>
          <textarea
            key={addressTab}
            value={addressTab === 'business' ? draft.businessAddress : draft.mailingAddress}
            onChange={(e) =>
              setDraft({
                ...draft,
                [addressTab === 'business' ? 'businessAddress' : 'mailingAddress']:
                  e.target.value,
              })
            }
            rows={3}
            placeholder="Street, city, state, zip"
            className="w-full px-3 py-2 text-[13px] border border-border rounded bg-background outline-none focus:border-primary resize-none"
          />
        </Field>

        <Field label="Payment details">
          <textarea
            value={draft.paymentDetails}
            onChange={(e) => setDraft({ ...draft, paymentDetails: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 text-[13px] border border-border rounded bg-background outline-none focus:border-primary resize-none"
          />
        </Field>

        <Field label="Default tax rate (%)">
          <TextInput
            type="number"
            value={draft.defaultTaxRate ? String(draft.defaultTaxRate) : ''}
            onChange={(v) => setDraft({ ...draft, defaultTaxRate: v ? Number(v) : 0 })}
            placeholder="Optional"
          />
        </Field>

        <Field label="Logo" className="pb-[2px]">
          <div className="flex items-center gap-3 min-w-0">
            {draft.logo && (
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded border border-border">
                <img
                  key={draft.logo.slice(0, 64)}
                  src={draft.logo}
                  alt=""
                  width={32}
                  height={32}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <input
              key={logoInputKey}
              id="logo-upload"
              type="file"
              accept="image/*"
              onChange={upload}
              className="sr-only"
            />
            <label
              htmlFor="logo-upload"
              className="shrink-0 h-8 px-3 inline-flex items-center text-[13px] border border-border rounded bg-background hover:bg-secondary cursor-pointer"
            >
              Choose file
            </label>
            {logoFileName && (
              <span
                className="min-w-0 max-w-[140px] truncate text-[13px] text-muted-foreground"
                title={logoFileName}
              >
                {logoFileName}
              </span>
            )}
            {draft.logo && (
              <button
                onClick={() => {
                  setDraft({ ...draft, logo: null });
                  setLogoFileName(null);
                  resetLogoInput();
                }}
                className="shrink-0 text-[13px] text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            )}
          </div>
        </Field>

        <div className="pt-[22px] border-t border-border flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="h-8 px-3 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-[13px] text-[#34C759]">Saved.</span>}
        </div>
      </div>
    </div>
  );
}
