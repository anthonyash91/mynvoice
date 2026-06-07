import { ViewHeader } from '@/components/ViewHeader';
import { StatusLabel } from '@/components/StatusLabel';
import { calculateTotal, formatCurrency, formatDate } from '@/lib/calculations';
import { resolveStatus } from '@/lib/invoice';
import type { Invoice } from '@/types';

interface InvoicesViewProps {
  invoices: Invoice[];
  onOpenInvoice: (id: string) => void;
  onNewInvoice: () => void;
}

export function InvoicesView({ invoices, onOpenInvoice, onNewInvoice }: InvoicesViewProps) {
  const rows = [...invoices].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div>
      <ViewHeader title="Invoices" subtitle={`${rows.length} total`} />

      {rows.length === 0 ? (
        <div className="px-8 py-16 text-[13px] text-muted-foreground">
          No invoices yet.{' '}
          <button onClick={onNewInvoice} className="text-primary hover:underline">
            Create the first one.
          </button>
        </div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left font-normal px-8 py-2.5">Client</th>
              <th className="text-left font-normal py-2.5">Invoice</th>
              <th className="text-right font-normal py-2.5">Amount</th>
              <th className="text-left font-normal pl-8 py-2.5">Due</th>
              <th className="text-left font-normal px-8 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => {
              const status = resolveStatus(inv);
              const { total } = calculateTotal(inv.lineItems, inv.taxEnabled, inv.taxRate);
              return (
                <tr
                  key={inv.id}
                  onClick={() => onOpenInvoice(inv.id)}
                  className="cursor-pointer border-b border-border hover:bg-secondary"
                >
                  <td className="px-8 py-2.5">{inv.clientName}</td>
                  <td className="py-2.5 font-mono text-muted-foreground">{inv.number}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatCurrency(total)}</td>
                  <td className="pl-8 py-2.5 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                  <td className="px-8 py-2.5">
                    <StatusLabel status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
