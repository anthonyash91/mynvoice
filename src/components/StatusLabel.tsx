import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/types';
import { statusLabel } from '@/lib/invoice';

const STATUS_COLORS: Record<InvoiceStatus, string | null> = {
  paid: '#34C759',
  overdue: '#FF3B30',
  unpaid: '#0071E3',
  payment_sent: '#FF9500',
  draft: null,
};

export function StatusLabel({ status }: { status: InvoiceStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      className={cn('text-[13px] leading-none', color === null && 'text-muted-foreground')}
      style={color ? { color } : undefined}
    >
      {statusLabel(status)}
    </span>
  );
}
