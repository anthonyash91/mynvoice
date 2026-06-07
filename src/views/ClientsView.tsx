import { Plus } from 'lucide-react';
import { ViewHeader } from '@/components/ViewHeader';
import type { Client } from '@/types';

interface ClientsViewProps {
  clients: Client[];
  getInvoiceCount: (clientId: string) => number;
  onOpenClient: (id: string) => void;
  onAddClient: () => void;
}

export function ClientsView({
  clients,
  getInvoiceCount,
  onOpenClient,
  onAddClient,
}: ClientsViewProps) {
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <ViewHeader
        title="Clients"
        subtitle={`${sorted.length} total`}
        action={
          <button
            onClick={onAddClient}
            className="h-7 px-2.5 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Client
          </button>
        }
      />

      {sorted.length === 0 ? (
        <div className="px-8 py-16 text-[13px] text-muted-foreground">No clients yet.</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left font-normal px-8 py-2.5">Name</th>
              <th className="text-left font-normal py-2.5">Company</th>
              <th className="text-left font-normal py-2.5">Email</th>
              <th className="text-right font-normal px-8 py-2.5">Invoices</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((client) => (
              <tr
                key={client.id}
                onClick={() => onOpenClient(client.id)}
                className="cursor-pointer border-b border-border hover:bg-secondary"
              >
                <td className="px-8 py-2.5">{client.name}</td>
                <td className="py-2.5 text-muted-foreground">{client.company || '—'}</td>
                <td className="py-2.5 text-muted-foreground">{client.email || '—'}</td>
                <td className="px-8 py-2.5 text-right tabular-nums">
                  {getInvoiceCount(client.id)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
