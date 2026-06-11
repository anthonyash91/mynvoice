import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FormFooterProps {
  align?: 'end' | 'between';
  bordered?: boolean;
  className?: string;
  left?: ReactNode;
  children: ReactNode;
}

export function FormFooter({
  align = 'end',
  bordered = true,
  className,
  left,
  children,
}: FormFooterProps) {
  return (
    <div
      className={cn(
        'flex gap-2',
        bordered && 'border-t border-border pt-[22px]',
        align === 'between' ? 'justify-between' : 'justify-end',
        className
      )}
    >
      {left}
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
