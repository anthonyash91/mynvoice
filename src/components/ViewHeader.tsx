import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function ViewHeader({
  title,
  subtitle,
  action,
  inPanel = false,
  onClose,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  inPanel?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        'h-14 w-full border-b border-border flex items-center justify-between shrink-0',
        inPanel ? 'px-6' : 'px-8'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onClose && (
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <h1 className="text-[15px] font-medium leading-none">{title}</h1>
        {subtitle && (
          <span className="text-[13px] text-muted-foreground leading-none">{subtitle}</span>
        )}
      </div>
      {action && <div className="flex items-center shrink-0">{action}</div>}
    </div>
  );
}
