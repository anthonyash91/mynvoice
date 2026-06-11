import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { EmailTemplatePreview } from '@/components/EmailTemplatePreview';
import { Field } from '@/components/Field';
import { FormFooter } from '@/components/FormFooter';
import { SectionHeader } from '@/components/SectionHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextInput } from '@/components/TextInput';
import { ViewHeader } from '@/components/ViewHeader';
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_META,
  EMAIL_TEMPLATE_VARIABLES,
  migrateEmailTemplates,
  prepareEmailTemplatesForStorage,
} from '@/lib/emailTemplates';
import type { EmailTemplateKind, EmailTemplates, Settings } from '@/types';

const templateKinds: EmailTemplateKind[] = ['unpaid', 'reminder', 'late', 'payment_received'];

interface TemplatesViewProps {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
  onClose: () => void;
}

export function TemplatesView({ settings, onSave, onClose }: TemplatesViewProps) {
  const [draft, setDraft] = useState<Settings>({
    ...settings,
    emailTemplates: migrateEmailTemplates(settings.emailTemplates),
  });
  const [activeKind, setActiveKind] = useState<EmailTemplateKind>('unpaid');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDraft({
      ...settings,
      emailTemplates: migrateEmailTemplates(settings.emailTemplates),
    });
  }, [settings]);

  const updateTemplate = (
    kind: EmailTemplateKind,
    patch: Partial<EmailTemplates[EmailTemplateKind]>
  ) => {
    setDraft((prev) => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates,
        [kind]: {
          ...prev.emailTemplates[kind],
          ...patch,
        },
      },
    }));
  };

  const resetActiveTemplate = () => {
    updateTemplate(activeKind, DEFAULT_EMAIL_TEMPLATES[activeKind]);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const emailTemplates = prepareEmailTemplatesForStorage(draft.emailTemplates);
      await onSave({
        ...settings,
        ...draft,
        emailTemplates,
      });
      setDraft((prev) => ({ ...prev, emailTemplates }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save templates');
    } finally {
      setSaving(false);
    }
  };

  const activeTemplate = draft.emailTemplates[activeKind];

  return (
    <div className="inline-flex h-full w-[920px] max-w-[calc(100vw-220px)] flex-col">
      <ViewHeader inPanel onClose={onClose} title="Templates" />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <SegmentedControl
            value={activeKind}
            onChange={setActiveKind}
            options={templateKinds.map((kind) => ({
              value: kind,
              label: EMAIL_TEMPLATE_META[kind].label,
            }))}
          />
          <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
            {EMAIL_TEMPLATE_META[activeKind].description} Use CSS classes in HTML and style them in
            the CSS panel. Placeholders like{' '}
            <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">
              {'{{variable}}'}
            </code>{' '}
            work in subject, HTML, and CSS. Link variables use sample URLs in preview; real URLs are
            filled when you send an invoice.
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2">
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
              <Field label="Subject">
                <TextInput
                  value={activeTemplate.subject}
                  onChange={(value) => updateTemplate(activeKind, { subject: value })}
                />
              </Field>

              <Field label="HTML">
                <textarea
                  value={activeTemplate.html}
                  onChange={(event) => updateTemplate(activeKind, { html: event.target.value })}
                  spellCheck={false}
                  className="min-h-[14rem] w-full resize-y rounded border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                />
              </Field>

              <Field label="CSS">
                <textarea
                  value={activeTemplate.css}
                  onChange={(event) => updateTemplate(activeKind, { css: event.target.value })}
                  spellCheck={false}
                  className="min-h-[14rem] w-full resize-y rounded border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                />
              </Field>

              <div>
                <SectionHeader title="Variables" />
                <div className="flex flex-wrap gap-1.5">
                  {EMAIL_TEMPLATE_VARIABLES.map((variable) => (
                    <code
                      key={variable.key}
                      className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {`{{${variable.key}}}`}
                    </code>
                  ))}
                </div>
              </div>
            </div>

            <FormFooter className="shrink-0 items-center gap-2 px-6 py-4">
              <Button variant="primary" onClick={save} disabled={saving} loading={saving} saved={saved}>
                Save templates
              </Button>
              <Button variant="ghost" onClick={resetActiveTemplate}>
                Reset template
              </Button>
              {saveError && <span className="text-[12px] text-destructive">{saveError}</span>}
            </FormFooter>
          </div>

          <div className="flex min-h-0 flex-col bg-background">
            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
                Live preview
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <EmailTemplatePreview template={activeTemplate} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
