import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FieldHint({
  children,
  size = 'md',
  className,
}: {
  children: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'mt-1 text-muted-foreground',
        size === 'sm' ? 'text-[11px]' : 'text-[12px]',
        className
      )}
    >
      {children}
    </p>
  );
}
