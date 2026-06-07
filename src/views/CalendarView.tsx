import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ViewHeader } from '@/components/ViewHeader';
import {
  billedCalendarEntries,
  dayOfMonth,
  formatMonthYear,
  isToday,
  monthGridCells,
  unbilledCalendarTotal,
  weekdayLabels,
} from '@/lib/calendar';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import type { CalendarEntry } from '@/types';

interface CalendarViewProps {
  entries: CalendarEntry[];
  onOpenDay: (date: string) => void;
  onEnsureRecurringForMonth: (year: number, month: number) => Promise<void>;
}

export function CalendarView({
  entries,
  onOpenDay,
  onEnsureRecurringForMonth,
}: CalendarViewProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const ensuringMonthRef = useRef<string | null>(null);

  const cells = useMemo(() => monthGridCells(year, month), [year, month]);
  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return map;
  }, [entries]);

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  useEffect(() => {
    const key = `${year}-${month}`;
    if (ensuringMonthRef.current === key) return;

    ensuringMonthRef.current = key;
    void onEnsureRecurringForMonth(year, month).finally(() => {
      if (ensuringMonthRef.current === key) {
        ensuringMonthRef.current = null;
      }
    });
  }, [year, month, onEnsureRecurringForMonth]);

  return (
    <div>
      <ViewHeader
        title="Calendar"
        subtitle={`${entries.length} logged`}
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[9rem] text-center text-[13px] font-medium">
              {formatMonthYear(year, month)}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div className="px-8 py-6">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded border border-border bg-border">
          {weekdayLabels().map((label) => (
            <div
              key={label}
              className="bg-secondary px-2 py-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {cells.map((cell) => {
            const dayEntries = entriesByDate.get(cell.date) ?? [];
            const billedEntries = billedCalendarEntries(dayEntries);
            const unbilledTotal = unbilledCalendarTotal(dayEntries);

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => onOpenDay(cell.date)}
                aria-label={
                  dayEntries.length > 0
                    ? `${dayOfMonth(cell.date)}, ${dayEntries.length} line items, ${billedEntries.length} billed, ${formatCurrency(unbilledTotal)} unbilled`
                    : String(dayOfMonth(cell.date))
                }
                className={cn(
                  'relative min-h-[4.5rem] p-1 pt-1 pl-1.5 pr-1 pb-1 text-left transition-colors hover:bg-secondary/60',
                  cell.inMonth ? 'bg-background' : 'bg-background/60',
                  isToday(cell.date) && 'ring-1 ring-inset ring-primary/40'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 left-1.5 text-[11px] font-bold leading-none',
                    isToday(cell.date)
                      ? 'text-primary'
                      : cell.inMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground/40'
                  )}
                >
                  {dayOfMonth(cell.date)}
                </span>
                {billedEntries.length > 0 && (
                  <span className="absolute top-1 right-1.5 text-[10px] font-medium leading-none text-muted-foreground/45 tabular-nums">
                    {billedEntries.length}
                  </span>
                )}
                {dayEntries.length > 0 && (
                  <div className="absolute bottom-1 left-1.5 right-1 flex items-center">
                    {unbilledTotal > 0 && (
                      <span className="text-[10px] font-medium leading-none text-muted-foreground tabular-nums">
                        {formatCurrency(unbilledTotal)}
                      </span>
                    )}
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-secondary px-1 text-[10px] font-medium leading-none text-muted-foreground tabular-nums">
                      {dayEntries.length}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
