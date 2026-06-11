import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/Button';

export function EmptyState({
  message,
  action,
  padding = 'panel',
  className,
}: {
  message: ReactNode;
  action?: { label: string; onClick: () => void };
  padding?: 'panel' | 'table' | 'compact';
  className?: string;
}) {
  const paddingClass =
    padding === 'panel'
      ? 'px-6 py-16'
      : padding === 'table'
        ? 'px-8 pt-4 pb-2.5'
        : 'px-6 pt-4 pb-2.5';

  return (
    <div className={cn(paddingClass, 'text-[13px] text-muted-foreground', className)}>
      {message}
      {action && (
        <>
          {' '}
          <Button variant="link" size="sm" onClick={action.onClick} className="h-auto px-0 py-0">
            {action.label}
          </Button>
        </>
      )}
    </div>
  );
}
