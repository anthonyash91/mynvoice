import { cn } from '@/lib/utils';

export function ReadOnlyValue({
  value,
  align = 'start',
  className,
}: {
  value: string;
  align?: 'start' | 'end';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center rounded border border-border bg-background px-2 text-[13px] tabular-nums text-muted-foreground',
        align === 'end' ? 'justify-end' : 'justify-start',
        className
      )}
    >
      {value}
    </div>
  );
}
