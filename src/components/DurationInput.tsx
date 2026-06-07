import { useEffect, useState } from 'react';
import {
  parseDurationField,
  quantityFromHoursMinutes,
  splitQuantityToHoursMinutes,
} from '@/lib/duration';
import { cn } from '@/lib/utils';

interface DurationInputProps {
  quantity: number;
  onChange: (quantity: number) => void;
  compact?: boolean;
}

function DurationField({
  value,
  onChange,
  onBlur,
  label,
  compact,
  min,
  max,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  label: string;
  compact: boolean;
  min?: number;
  max?: number;
  'aria-label': string;
}) {
  return (
    <div className={cn('relative', compact ? 'w-12 min-w-0' : 'min-w-0 flex-1')}>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="0"
        aria-label={ariaLabel}
        className={cn(
          'w-full tabular-nums outline-none',
          compact
            ? 'h-7 bg-transparent pl-1 pr-4 text-[13px]'
            : 'h-8 rounded border border-border bg-background pl-3 pr-9 text-[13px] focus:border-primary'
        )}
      />
      <span
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          compact ? 'right-1 text-[10px]' : 'right-2.5 text-[12px]'
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function DurationInput({ quantity, onChange, compact = false }: DurationInputProps) {
  const split = splitQuantityToHoursMinutes(quantity);
  const [hours, setHours] = useState(String(split.hours));
  const [minutes, setMinutes] = useState(String(split.minutes));

  useEffect(() => {
    const next = splitQuantityToHoursMinutes(quantity);
    setHours(String(next.hours));
    setMinutes(String(next.minutes));
  }, [quantity]);

  const emit = (hoursValue: string, minutesValue: string) => {
    const h = parseDurationField(hoursValue);
    const m = Math.min(59, parseDurationField(minutesValue));
    onChange(quantityFromHoursMinutes(h, m));
  };

  const handleMinutesBlur = () => {
    const m = Math.min(59, parseDurationField(minutes));
    setMinutes(String(m));
    emit(hours, String(m));
  };

  if (compact) {
    return (
      <div className="flex w-full min-w-0 items-center gap-1 tabular-nums">
        <DurationField
          compact
          value={hours}
          onChange={(value) => {
            setHours(value);
            emit(value, minutes);
          }}
          label="h"
          aria-label="Hours"
          min={0}
        />
        <DurationField
          compact
          value={minutes}
          onChange={(value) => {
            setMinutes(value);
            emit(hours, value);
          }}
          onBlur={handleMinutesBlur}
          label="m"
          aria-label="Minutes"
          min={0}
          max={59}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 gap-2">
      <DurationField
        compact={false}
        value={hours}
        onChange={(value) => {
          setHours(value);
          emit(value, minutes);
        }}
        label="hr"
        aria-label="Hours"
        min={0}
      />
      <DurationField
        compact={false}
        value={minutes}
        onChange={(value) => {
          setMinutes(value);
          emit(hours, value);
        }}
        onBlur={handleMinutesBlur}
        label="min"
        aria-label="Minutes"
        min={0}
        max={59}
      />
    </div>
  );
}
