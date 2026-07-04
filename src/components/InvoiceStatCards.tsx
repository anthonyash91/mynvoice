import { formatCurrency } from '@/lib/calculations';
import type { InvoiceDashboardStats } from '@/lib/invoice';
import { cn } from '@/lib/utils';

interface InvoiceStatCardsProps {
  stats: InvoiceDashboardStats;
}

interface StatCardProps {
  label: string;
  count: number;
  amount: number;
  amountClassName?: string;
}

function StatCard({ label, count, amount, amountClassName }: StatCardProps) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-4 py-3 min-w-0">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[24px] font-medium tabular-nums leading-none">{count}</p>
      <p className={cn('mt-2 text-[13px] tabular-nums font-medium', amountClassName)}>
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

export function InvoiceStatCards({ stats }: InvoiceStatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 px-8 pt-6 sm:grid-cols-3">
      <StatCard label="Total invoices" count={stats.total.count} amount={stats.total.amount} />
      <StatCard
        label="Pending"
        count={stats.pending.count}
        amount={stats.pending.amount}
        amountClassName="text-[#0071E3]"
      />
      <StatCard
        label="Paid"
        count={stats.paid.count}
        amount={stats.paid.amount}
        amountClassName="text-[#34C759]"
      />
    </div>
  );
}
