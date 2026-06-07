import { PanelShell } from '@/components/PanelShell';
import { StatusLabel } from '@/components/StatusLabel';
import { calculateTotal, formatCurrency } from '@/lib/calculations';
import { resolveStatus } from '@/lib/invoice';
import type { Client, Invoice } from '@/types';

interface ClientPanelProps {
  client: Client;
  invoices: Invoice[];
  onClose: () => void;
  onOpenInvoice: (id: string) => void;
}

export function ClientPanel({ client, invoices, onClose, onOpenInvoice }: ClientPanelProps) {
  const history = invoices.filter((i) => i.clientId === client.id);

  return (
    <PanelShell title={client.name} onClose={onClose}>
      <div className="p-6 space-y-5 text-[13px]">
        <div className="space-y-1">
          {client.company && <div className="text-muted-foreground">{client.company}</div>}
          {client.email && <div className="text-muted-foreground">{client.email}</div>}
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
            Invoices
          </div>
          {history.length === 0 ? (
            <div className="text-muted-foreground">None yet.</div>
          ) : (
            <div className="border border-border rounded overflow-hidden">
              {history.map((inv) => {
                const status = resolveStatus(inv);
                const { total } = calculateTotal(
                  inv.lineItems,
                  inv.taxEnabled,
                  inv.taxRate
                );
                return (
                  <button
                    key={inv.id}
                    onClick={() => onOpenInvoice(inv.id)}
                    className="w-full grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2 border-b last:border-b-0 border-border hover:bg-secondary text-left"
                  >
                    <span className="font-mono text-muted-foreground">{inv.number}</span>
                    <span className="tabular-nums">{formatCurrency(total)}</span>
                    <StatusLabel status={status} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
