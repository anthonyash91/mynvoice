import { cn } from '@/lib/utils';

export interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  spellCheck?: boolean;
  className?: string;
}

export function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled,
  spellCheck,
  className,
}: TextareaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      spellCheck={spellCheck}
      className={cn(
        'w-full resize-none rounded border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary',
        className
      )}
    />
  );
}
