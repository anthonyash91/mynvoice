import { useMemo } from 'react';
import {
  assembleEmailDocument,
  buildSampleEmailTemplateContext,
  interpolateEmailTemplate,
  wrapEmailDocument,
} from '@/lib/emailTemplates';
import type { EmailTemplate } from '@/types';

interface EmailTemplatePreviewProps {
  template: EmailTemplate;
}

export function EmailTemplatePreview({ template }: EmailTemplatePreviewProps) {
  const sampleContext = useMemo(() => buildSampleEmailTemplateContext(), []);

  const subject = useMemo(
    () => interpolateEmailTemplate(template.subject, sampleContext),
    [template.subject, sampleContext]
  );

  const html = useMemo(() => {
    const interpolatedHtml = interpolateEmailTemplate(template.html, sampleContext);
    const interpolatedCss = interpolateEmailTemplate(template.css, sampleContext);
    const hasStructuredTemplate = Boolean(template.html.trim() || template.css.trim());

    if (hasStructuredTemplate) {
      return assembleEmailDocument(interpolatedHtml, interpolatedCss);
    }

    return wrapEmailDocument(interpolatedHtml);
  }, [template.html, template.css, sampleContext]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border bg-background px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Subject</div>
        <div className="mt-1 text-[13px] leading-snug text-foreground">{subject}</div>
      </div>
      <div className="min-h-0 flex-1 bg-[#f5f5f7] p-4">
        <iframe
          title="Email template preview"
          srcDoc={html}
          className="h-full min-h-[28rem] w-full rounded border border-border bg-white"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
