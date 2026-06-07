import { cn } from '@/lib/utils';

function StatusBullet() {
  return <span className="px-1 text-muted-foreground/70">·</span>;
}

export function CalendarEntryStatus({
  billed,
  invoiceNumber,
  leadingBullet = true,
}: {
  billed: boolean;
  invoiceNumber?: string;
  leadingBullet?: boolean;
}) {
  return (
    <span className="inline-flex shrink-0 items-center text-[11px] leading-none">
      {leadingBullet && <StatusBullet />}
      <span className={cn(billed ? 'text-[#0071E3]' : 'text-muted-foreground')}>
        {billed ? (
          <>
            Billed
            {invoiceNumber && (
              <>
                <StatusBullet />
                {invoiceNumber}
              </>
            )}
          </>
        ) : (
          'Unbilled'
        )}
      </span>
    </span>
  );
}
