import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionHeader({
  title,
  description,
  compact = false,
  className,
}: {
  title: string;
  description?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className={cn(
          'text-[12px] uppercase tracking-wider text-muted-foreground',
          compact ? 'mb-0' : 'mb-2'
        )}
      >
        {title}
      </div>
      {description && (
        <p className="mb-3 text-[12px] leading-snug text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
