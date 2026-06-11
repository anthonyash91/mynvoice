import { useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { FormFooter } from '@/components/FormFooter';
import { SaveFeedback } from '@/components/SaveFeedback';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Textarea } from '@/components/Textarea';
import { TextInput } from '@/components/TextInput';
import { ViewHeader } from '@/components/ViewHeader';
import { useConfirm } from '@/hooks/useConfirm';
import type { Settings } from '@/types';

type AddressTab = 'business' | 'mailing';

interface SettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
  onClose: () => void;
}

export function SettingsView({ settings, onSave, onClose }: SettingsViewProps) {
  const confirm = useConfirm();
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
    settings.defaultDueDays,
    settings.reminderIntervalDays,
    settings.lateReminderIntervalDays,
    settings.paypalClientId,
    settings.paypalClientSecret,
    settings.paypalSandbox,
    settings.logo,
    settings.emailTemplates,
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
      <div className="flex-1 overflow-auto px-6 pt-5 pb-6 space-y-5 min-w-0">
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
          <SegmentedControl
            value={addressTab}
            onChange={setAddressTab}
            options={[
              { value: 'business', label: 'Business' },
              { value: 'mailing', label: 'Mailing' },
            ]}
            className="mb-1.5"
          />
          <Textarea
            key={addressTab}
            value={addressTab === 'business' ? draft.businessAddress : draft.mailingAddress}
            onChange={(value) =>
              setDraft({
                ...draft,
                [addressTab === 'business' ? 'businessAddress' : 'mailingAddress']: value,
              })
            }
            rows={3}
            placeholder="Street, city, state, zip"
          />
        </Field>

        <Field label="Payment details">
          <Textarea
            value={draft.paymentDetails}
            onChange={(paymentDetails) => setDraft({ ...draft, paymentDetails })}
            rows={4}
          />
        </Field>

        <Field label="PayPal Client ID">
          <TextInput
            value={draft.paypalClientId}
            onChange={(v) => setDraft({ ...draft, paypalClientId: v })}
            placeholder="From PayPal Developer Dashboard"
          />
        </Field>

        <Field label="PayPal Client Secret">
          <TextInput
            type="password"
            value={draft.paypalClientSecret}
            onChange={(v) => setDraft({ ...draft, paypalClientSecret: v })}
            placeholder="Stored securely; used server-side only"
          />
        </Field>

        <Field
          label="PayPal sandbox mode"
          hint="When enabled, clients pay with sandbox accounts. Turn off for live payments."
        >
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={draft.paypalSandbox}
              onChange={(e) => setDraft({ ...draft, paypalSandbox: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Use PayPal sandbox for testing
          </label>
        </Field>

        <Field label="Default tax rate (%)">
          <TextInput
            type="number"
            value={draft.defaultTaxRate ? String(draft.defaultTaxRate) : ''}
            onChange={(v) => setDraft({ ...draft, defaultTaxRate: v ? Number(v) : 0 })}
            placeholder="Optional"
          />
        </Field>

        <Field
          label="Default due date (days)"
          hint="Days after the issue date on new invoices."
        >
          <TextInput
            type="number"
            value={String(draft.defaultDueDays)}
            onChange={(v) => setDraft({ ...draft, defaultDueDays: v === '' ? 0 : Number(v) })}
            placeholder="14"
          />
        </Field>

        <Field
          label="Payment reminder interval (days)"
          hint="Unpaid invoices receive an automatic reminder email this many days after the last send."
        >
          <TextInput
            type="number"
            value={String(draft.reminderIntervalDays)}
            onChange={(v) =>
              setDraft({
                ...draft,
                reminderIntervalDays: v === '' ? 1 : Math.max(1, Number(v)),
              })
            }
            placeholder="5"
          />
        </Field>

        <Field
          label="Late notice interval (days)"
          hint="Overdue invoices receive an automatic late notice this many days after the last send."
        >
          <TextInput
            type="number"
            value={String(draft.lateReminderIntervalDays)}
            onChange={(v) =>
              setDraft({
                ...draft,
                lateReminderIntervalDays: v === '' ? 1 : Math.max(1, Number(v)),
              })
            }
            placeholder="3"
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
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Remove logo?',
                    description: 'Your logo will be removed when you save settings.',
                    confirmLabel: 'Remove',
                  });
                  if (!ok) return;
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

        <FormFooter className="items-center gap-3">
          <Button variant="primary" onClick={save} disabled={saving} loading={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <SaveFeedback visible={saved} />
        </FormFooter>
      </div>
    </div>
  );
}
