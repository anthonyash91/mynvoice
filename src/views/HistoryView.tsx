import { EmptyState } from '@/components/EmptyState';
import { ViewHeader } from '@/components/ViewHeader';
import { formatDateTime } from '@/lib/calculations';
import { emailKindSentLabel } from '@/lib/emailTemplates';
import { tableTdClass, tableThClass } from '@/lib/tableStyles';
import { cn } from '@/lib/utils';
import type { EmailHistoryEntry } from '@/types';

interface HistoryViewProps {
  entries: EmailHistoryEntry[];
  onOpenInvoice: (id: string) => void;
  onClose: () => void;
}

export function HistoryView({ entries, onOpenInvoice, onClose }: HistoryViewProps) {
  const rows = [...entries].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );

  return (
    <div className="inline-flex flex-col h-full min-w-0 max-w-full">
      <ViewHeader
        inPanel
        onClose={onClose}
        title="History"
        subtitle={`${rows.length} email${rows.length === 1 ? '' : 's'} sent`}
      />

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <EmptyState
            message="No emails sent yet. Send an invoice to see it here."
            padding="compact"
          />
        ) : (
          <table className="w-full table-fixed text-[13px]">
            <colgroup>
              {Array.from({ length: 4 }, (_, index) => (
                <col key={index} />
              ))}
            </colgroup>
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className={cn(tableThClass, 'pl-6')}>Sent</th>
                <th className={tableThClass}>Invoice</th>
                <th className={tableThClass}>Client</th>
                <th className={cn(tableThClass, 'pr-6')}>Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const openInvoice = () => {
                  if (entry.invoiceId) onOpenInvoice(entry.invoiceId);
                };

                return (
                  <tr
                    key={entry.id}
                    onClick={openInvoice}
                    className={cn(
                      'border-b border-border',
                      entry.invoiceId && 'cursor-pointer hover:bg-secondary'
                    )}
                  >
                    <td className={cn(tableTdClass, 'pl-6 text-muted-foreground tabular-nums')}>
                      {formatDateTime(entry.sentAt)}
                    </td>
                    <td
                      className={cn(
                        tableTdClass,
                        'font-mono',
                        entry.invoiceId ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {entry.invoiceNumber}
                    </td>
                    <td className={cn(tableTdClass, 'text-muted-foreground')}>
                      {entry.clientName}
                    </td>
                    <td className={cn(tableTdClass, 'pr-6 text-muted-foreground')}>
                      {emailKindSentLabel(entry.emailKind)}
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
