import { Paperclip, X } from 'lucide-react';
import { IconButton } from '@/components/IconButton';
import { formatFileSize, openLineItemAttachment } from '@/lib/attachments';
import { cn } from '@/lib/utils';
import type { LineItemAttachment } from '@/types';

interface AttachmentChipsProps {
  attachments: LineItemAttachment[];
  uploading?: boolean;
  onRemove?: (attachmentId: string) => void;
  onError: (message: string) => void;
  className?: string;
}

export function AttachmentChips({
  attachments,
  uploading = false,
  onRemove,
  onError,
  className,
}: AttachmentChipsProps) {
  if (attachments.length === 0 && !uploading) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {attachments.map((attachment) => (
        <span
          key={attachment.id}
          className={cn(
            'inline-flex min-w-0 max-w-full items-center gap-1 rounded border border-border bg-secondary pl-1.5 text-[12px]',
            !onRemove && 'pr-1.5'
          )}
        >
          <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openLineItemAttachment(attachment).catch((err) =>
                onError(err instanceof Error ? err.message : 'Failed to open attachment.')
              );
            }}
            title={attachment.fileName}
            className="min-w-0 truncate hover:underline"
          >
            {attachment.fileName}
          </button>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {formatFileSize(attachment.size)}
          </span>
          {onRemove && (
            <IconButton
              icon={X}
              variant="destructive"
              aria-label={`Remove ${attachment.fileName}`}
              onClick={() => onRemove(attachment.id)}
              className="py-0.5"
            />
          )}
        </span>
      ))}
      {uploading && <span className="text-[12px] text-muted-foreground">Uploading…</span>}
    </div>
  );
}
