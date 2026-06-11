import { cn } from '@/lib/utils';

export interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function DateInput({ value, onChange, disabled, className }: DateInputProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'h-8 w-full rounded border border-border bg-background px-2 text-[13px] tabular-nums outline-none focus:border-primary disabled:opacity-50',
        className
      )}
    />
  );
}
