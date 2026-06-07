import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CalendarEntryType } from '@/types';

const LINE_ITEM_TYPE_OPTIONS: { id: CalendarEntryType; label: string }[] = [
  { id: 'hourly', label: 'Hourly' },
  { id: 'fixed', label: 'Fixed' },
];

interface LineItemTypeComboboxProps {
  value: CalendarEntryType;
  onChange: (value: CalendarEntryType) => void;
}

export function LineItemTypeCombobox({ value, onChange }: LineItemTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const selected =
    LINE_ITEM_TYPE_OPTIONS.find((option) => option.id === value) ??
    LINE_ITEM_TYPE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!fieldRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const selectOption = (option: CalendarEntryType) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div ref={fieldRef} className="relative">
      <div className="relative">
        <input
          readOnly
          value={selected.label}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          aria-label="Line item type"
          className="w-full h-8 pl-3 pr-8 text-[13px] border border-border rounded bg-background outline-none focus:border-primary cursor-pointer"
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 border border-border rounded bg-popover overflow-hidden shadow-sm">
          {LINE_ITEM_TYPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectOption(option.id)}
              className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-secondary"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
