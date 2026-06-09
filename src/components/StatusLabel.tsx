import {
  AlertCircle,
  BanknoteArrowUp,
  CheckCircle2,
  CircleDashed,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InvoiceStatus, InvoiceStoredStatus } from '@/types';
import { statusLabel } from '@/lib/invoice';

const STATUS_COLORS: Record<InvoiceStatus, string | null> = {
  paid: '#34C759',
  overdue: '#FF3B30',
  unpaid: '#0071E3',
  payment_sent: '#FF9500',
  draft: null,
};

const STATUS_ICONS: Record<InvoiceStoredStatus, LucideIcon> = {
  draft: CircleDashed,
  unpaid: Clock,
  overdue: AlertCircle,
  payment_sent: BanknoteArrowUp,
  paid: CheckCircle2,
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

export function StatusIcon({
  status,
  className,
}: {
  status: InvoiceStoredStatus;
  className?: string;
}) {
  const Icon = STATUS_ICONS[status];
  const color = STATUS_COLORS[status];

  return (
    <Icon
      className={cn('shrink-0', className, color === null && 'text-muted-foreground')}
      style={color ? { color } : undefined}
      aria-hidden="true"
    />
  );
}
