import { ChevronLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '@/components/IconButton';
import { cn } from '@/lib/utils';

export function PanelShell({
  title,
  onClose,
  backArrow,
  fillWidth = false,
  children,
}: {
  title: string;
  onClose: () => void;
  backArrow?: boolean;
  fillWidth?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex h-full max-w-full shrink-0 flex-col',
        fillWidth ? 'w-full min-w-0' : 'w-[360px]'
      )}
    >
      <div className="flex h-14 w-full shrink-0 items-center justify-between overflow-hidden border-b border-border px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {backArrow ? (
            <IconButton
              icon={ChevronLeft}
              size="md"
              aria-label="Back"
              onClick={onClose}
            />
          ) : (
            <IconButton icon={X} size="md" aria-label="Close panel" onClick={onClose} />
          )}
          <span className="min-w-0 truncate text-[15px] font-medium leading-none">{title}</span>
        </div>
      </div>
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
