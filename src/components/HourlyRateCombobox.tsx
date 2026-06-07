import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import type { ClientHourlyRateOption } from '@/lib/client';

function rateOptionLabel(option: ClientHourlyRateOption) {
  return (
    <>
      {option.label}
      <span className="text-muted-foreground">
        {' '}
        · {formatCurrency(option.rate)}/hr
      </span>
    </>
  );
}

function rateOptionText(option: ClientHourlyRateOption) {
  return `${option.label} · ${formatCurrency(option.rate)}/hr`;
}

interface HourlyRateComboboxProps {
  options: ClientHourlyRateOption[];
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
}

export function HourlyRateCombobox({
  options,
  selectedId,
  onSelectedIdChange,
}: HourlyRateComboboxProps) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.id === selectedId) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!fieldRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const selectOption = (option: ClientHourlyRateOption) => {
    onSelectedIdChange(option.id);
    setOpen(false);
  };

  return (
    <div ref={fieldRef} className="relative">
      <div className="relative">
        <input
          readOnly
          value={selected ? rateOptionText(selected) : ''}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder="Select rate…"
          className="w-full h-8 pl-3 pr-8 text-[13px] border border-border rounded bg-background outline-none focus:border-primary cursor-pointer"
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 border border-border rounded bg-popover overflow-hidden shadow-sm">
          <div className="max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-muted-foreground">No rates found</div>
            ) : (
              options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(option)}
                  className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-secondary"
                >
                  {rateOptionLabel(option)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
