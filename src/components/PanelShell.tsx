import { ChevronLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';

export function PanelShell({
  title,
  onClose,
  backArrow,
  children,
}: {
  title: string;
  onClose: () => void;
  backArrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full w-[360px] max-w-full shrink-0 flex-col">
      <div className="flex h-14 w-full shrink-0 items-center justify-between overflow-hidden border-b border-border px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {backArrow ? (
            <button
              onClick={onClose}
              className="inline-flex shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="inline-flex shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="min-w-0 truncate text-[15px] font-medium leading-none">{title}</span>
        </div>
      </div>
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
