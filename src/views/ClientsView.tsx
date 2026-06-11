import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { ViewHeader } from '@/components/ViewHeader';
import { useConfirm } from '@/hooks/useConfirm';
import { formatCurrency } from '@/lib/calculations';
import {
  clientAddressSummary,
  clientDisplayName,
  clientRateLines,
  clientSecondaryName,
} from '@/lib/client';
import type { Client } from '@/types';

interface ClientsViewProps {
  clients: Client[];
  getInvoiceCount: (clientId: string) => number;
  onOpenClient: (id: string) => void;
  onAddClient: () => void;
  onDeleteClient: (id: string) => Promise<void>;
  onClose: () => void;
}

export function ClientsView({
  clients,
  getInvoiceCount,
  onOpenClient,
  onAddClient,
  onDeleteClient,
  onClose,
}: ClientsViewProps) {
  const confirm = useConfirm();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const sorted = [...clients].sort((a, b) =>
    clientDisplayName(a).localeCompare(clientDisplayName(b))
  );

  const remove = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: `Delete ${clientDisplayName(client)}?`,
      description: 'Their invoices will be kept but unlinked.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeletingId(client.id);
    try {
      await onDeleteClient(client.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="inline-flex flex-col h-full min-w-max max-w-full">
      <ViewHeader
        inPanel
        onClose={onClose}
        title="Clients"
        subtitle={`${sorted.length} total`}
        action={
          <Button variant="primary" size="sm" icon={Plus} onClick={onAddClient} className="shrink-0">
            Add Client
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        {sorted.length === 0 ? (
          <EmptyState message="No clients yet." />
        ) : (
          <table className="w-max text-[13px] border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left font-normal pl-6 pr-8 py-2.5">Name</th>
                <th className="text-left font-normal pl-2 pr-6 py-2.5 whitespace-nowrap">Rate(s)</th>
                <th className="text-left font-normal pl-2 pr-6 py-2.5">Address</th>
                <th className="w-full min-w-[50px] py-2.5" aria-hidden />
                <th className="w-10 pr-6 py-2.5" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {sorted.map((client) => {
                const rates = clientRateLines(client);
                const invoiceCount = getInvoiceCount(client.id);
                const addressSummary = clientAddressSummary(client.address);
                const secondaryName = clientSecondaryName(client);
                return (
                <tr
                  key={client.id}
                  onClick={() => onOpenClient(client.id)}
                  className="cursor-pointer border-b border-border hover:bg-secondary"
                >
                  <td className="pl-6 pr-8 py-2.5">
                    <div className="truncate">
                      {clientDisplayName(client)}
                      <span className="text-muted-foreground tabular-nums">
                        {' '}
                        ({invoiceCount})
                      </span>
                    </div>
                    {secondaryName && (
                      <div className="text-muted-foreground truncate">{secondaryName}</div>
                    )}
                  </td>
                  <td className="w-0 pl-2 pr-6 py-2.5 tabular-nums whitespace-nowrap">
                    {rates.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {rates.map((line, index) => (
                          <div key={index}>
                            {line.label ? (
                              <>
                                <span className="text-muted-foreground">{line.label} </span>
                                {formatCurrency(line.rate)}/hr
                              </>
                            ) : (
                              <>{formatCurrency(line.rate)}/hr</>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="pl-2 pr-6 py-2.5">
                    {addressSummary ? (
                      <>
                        {addressSummary.street && (
                          <div className="truncate">{addressSummary.street}</div>
                        )}
                        {addressSummary.cityState && (
                          <div
                            className={
                              addressSummary.street
                                ? 'text-muted-foreground truncate'
                                : 'truncate'
                            }
                          >
                            {addressSummary.cityState}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="w-full min-w-[50px] py-2.5" aria-hidden />
                  <td className="w-10 pr-6 py-2.5">
                    <IconButton
                      icon={Trash2}
                      variant="destructive"
                      aria-label={`Delete ${clientDisplayName(client)}`}
                      onClick={(e) => remove(client, e)}
                      disabled={deletingId === client.id}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
