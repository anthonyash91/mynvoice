import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import { ViewHeader } from '@/components/ViewHeader';
import {
  billedCalendarEntries,
  dayOfMonth,
  formatMonthYear,
  isToday,
  monthGridCells,
  nonRecurringUnbilledCalendarEntries,
  recurringUnbilledCalendarEntries,
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
  const ensuredMonthsRef = useRef(new Set<string>());
  const ensureRecurringRef = useRef(onEnsureRecurringForMonth);

  ensureRecurringRef.current = onEnsureRecurringForMonth;

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
    if (ensuredMonthsRef.current.has(key)) return;

    ensuredMonthsRef.current.add(key);
    void ensureRecurringRef.current(year, month);
  }, [year, month]);

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
            const recurringUnbilled = recurringUnbilledCalendarEntries(dayEntries);
            const nonRecurringUnbilled = nonRecurringUnbilledCalendarEntries(dayEntries);
            const unbilledTotal = unbilledCalendarTotal(dayEntries);
            const hasBilled = billedEntries.length > 0;
            const hasUnbilled = nonRecurringUnbilled.length > 0;
            const hasRecurring = recurringUnbilled.length > 0;
            const centerRecurringBetween = hasBilled && hasUnbilled && hasRecurring;
            const badgeClass =
              'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-medium leading-none tabular-nums';
            const badgeTooltipClass = 'block h-5 shrink-0 leading-none';
            const showRightRail = hasBilled || hasUnbilled || hasRecurring;

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
                  'relative min-h-24 p-1 pt-1 pl-1.5 pr-1 pb-1 text-left transition-colors hover:bg-secondary/60',
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
                {unbilledTotal > 0 && (
                  <span className="absolute bottom-1 left-1.5 inline-flex h-5 shrink-0 items-center text-[10px] font-medium leading-none text-muted-foreground tabular-nums">
                    {formatCurrency(unbilledTotal)}
                  </span>
                )}
                {showRightRail && (
                  <div className="absolute top-1 bottom-1 right-1 flex flex-col items-end">
                    {hasBilled && (
                      <Tooltip content="Billed" className={badgeTooltipClass}>
                        <span
                          className={cn(
                            badgeClass,
                            'border border-[#0071E3]/25 bg-[#0071E3]/10 text-[#0071E3]'
                          )}
                        >
                          {billedEntries.length}
                        </span>
                      </Tooltip>
                    )}
                    {centerRecurringBetween && (
                      <div className="flex min-h-0 flex-1 items-center justify-end">
                        <Tooltip content="Recurring" className={badgeTooltipClass}>
                          <span
                            className={cn(
                              badgeClass,
                              'border border-violet-500/25 bg-violet-500/10 text-violet-700'
                            )}
                          >
                            {recurringUnbilled.length}
                          </span>
                        </Tooltip>
                      </div>
                    )}
                    {hasBilled && (hasRecurring || hasUnbilled) && !centerRecurringBetween && (
                      <div className="min-h-0 flex-1" />
                    )}
                    {hasUnbilled && hasRecurring && !hasBilled && (
                      <div className="mt-auto flex flex-col items-end gap-1">
                        <Tooltip content="Recurring" className={badgeTooltipClass}>
                          <span
                            className={cn(
                              badgeClass,
                              'border border-violet-500/25 bg-violet-500/10 text-violet-700'
                            )}
                          >
                            {recurringUnbilled.length}
                          </span>
                        </Tooltip>
                        <Tooltip content="Unbilled" className={badgeTooltipClass}>
                          <span
                            className={cn(
                              badgeClass,
                              'border border-border bg-secondary text-muted-foreground'
                            )}
                          >
                            {nonRecurringUnbilled.length}
                          </span>
                        </Tooltip>
                      </div>
                    )}
                    {hasUnbilled && (!hasRecurring || centerRecurringBetween) && (
                      <Tooltip
                        content="Unbilled"
                        className={cn(badgeTooltipClass, !hasBilled && !hasRecurring && 'mt-auto')}
                      >
                        <span
                          className={cn(
                            badgeClass,
                            'border border-border bg-secondary text-muted-foreground'
                          )}
                        >
                          {nonRecurringUnbilled.length}
                        </span>
                      </Tooltip>
                    )}
                    {hasRecurring && !(hasUnbilled && !hasBilled) && !centerRecurringBetween && (
                      <Tooltip
                        content="Recurring"
                        className={cn(
                          badgeTooltipClass,
                          !hasBilled && 'mt-auto'
                        )}
                      >
                        <span
                          className={cn(
                            badgeClass,
                            'border border-violet-500/25 bg-violet-500/10 text-violet-700'
                          )}
                        >
                          {recurringUnbilled.length}
                        </span>
                      </Tooltip>
                    )}
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
