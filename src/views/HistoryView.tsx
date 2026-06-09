import { ViewHeader } from '@/components/ViewHeader';
import { formatDateTime } from '@/lib/calculations';
import { emailKindSentLabel } from '@/lib/emailTemplates';
import { cn } from '@/lib/utils';
import type { EmailHistoryEntry } from '@/types';

interface HistoryViewProps {
  entries: EmailHistoryEntry[];
  onOpenInvoice: (id: string) => void;
  onClose: () => void;
}

const thClass = 'text-left font-normal py-2.5 px-4 whitespace-nowrap';
const tdClass = 'py-2.5 px-4 text-left max-w-0 whitespace-nowrap truncate';

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
          <div className="px-6 pt-4 pb-2.5 text-[13px] text-muted-foreground">
            No emails sent yet. Send an invoice to see it here.
          </div>
        ) : (
          <table className="w-full table-fixed text-[13px]">
            <colgroup>
              {Array.from({ length: 4 }, (_, index) => (
                <col key={index} />
              ))}
            </colgroup>
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className={cn(thClass, 'pl-6')}>Sent</th>
                <th className={thClass}>Invoice</th>
                <th className={thClass}>Client</th>
                <th className={cn(thClass, 'pr-6')}>Type</th>
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
                    <td className={cn(tdClass, 'pl-6 text-muted-foreground tabular-nums')}>
                      {formatDateTime(entry.sentAt)}
                    </td>
                    <td
                      className={cn(
                        tdClass,
                        'font-mono',
                        entry.invoiceId ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {entry.invoiceNumber}
                    </td>
                    <td className={cn(tdClass, 'text-muted-foreground')}>{entry.clientName}</td>
                    <td className={cn(tdClass, 'pr-6 text-muted-foreground')}>
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
