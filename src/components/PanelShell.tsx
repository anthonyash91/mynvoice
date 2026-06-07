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
    <div className="inline-flex flex-col h-full max-w-full">
      <div className="h-14 w-full px-6 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {backArrow ? (
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="text-[15px] font-medium leading-none whitespace-nowrap">{title}</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto min-w-[360px]">{children}</div>
    </div>
  );
}
