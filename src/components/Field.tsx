import type { ReactNode } from 'react';
import { FieldHint } from '@/components/FieldHint';
import { cn } from '@/lib/utils';

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('w-full min-w-0', className)}>
      <div className="mb-1.5 text-[12px] uppercase leading-none tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}
