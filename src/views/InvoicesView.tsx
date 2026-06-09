import { Send } from 'lucide-react';
import { InvoiceActionsMenu } from '@/components/InvoiceActionsMenu';
import { ViewHeader } from '@/components/ViewHeader';
import { StatusLabel } from '@/components/StatusLabel';
import { Tooltip } from '@/components/Tooltip';
import { calculateTotal, formatCurrency, formatDate } from '@/lib/calculations';
import { invoiceEmailSentTooltip } from '@/lib/emailTemplates';
import { invoiceDueDisplay, invoiceReminderDisplay, resolveStatus } from '@/lib/invoice';
import { cn } from '@/lib/utils';
import type { Client, Invoice, InvoiceStoredStatus, Settings } from '@/types';

interface InvoicesViewProps {
  invoices: Invoice[];
  clients: Client[];
  settings: Settings;
  reminderIntervalDays: number;
  lateReminderIntervalDays: number;
  onOpenInvoice: (id: string) => void;
  onNewInvoice: () => void;
  onEditInvoice: (id: string) => void;
  onChangeInvoiceStatus: (id: string, status: InvoiceStoredStatus) => Promise<void>;
  onSendInvoice: (
    id: string,
    pdfBase64: string,
    purpose: 'invoice' | 'reminder'
  ) => Promise<void>;
  onVisitPublicInvoice: (id: string) => Promise<void>;
  onDeleteInvoice: (id: string) => Promise<void>;
}

const thClass = 'text-left font-normal py-2.5 px-4 whitespace-nowrap';
const tdClass = 'py-2.5 px-4 text-left max-w-0 whitespace-nowrap truncate';
const tooltipCellClass = 'block min-w-0 max-w-full truncate';

export function InvoicesView({
  invoices,
  clients,
  settings,
  reminderIntervalDays,
  lateReminderIntervalDays,
  onOpenInvoice,
  onNewInvoice,
  onEditInvoice,
  onChangeInvoiceStatus,
  onSendInvoice,
  onVisitPublicInvoice,
  onDeleteInvoice,
}: InvoicesViewProps) {
  const rows = [...invoices].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div>
      <ViewHeader title="Invoices" subtitle={`${rows.length} total`} />

      <table className="w-full table-fixed text-[13px]">
        <colgroup>
          {Array.from({ length: 9 }, (_, index) => (
            <col key={index} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className={cn(thClass, 'pl-8')}>Client</th>
            <th className={thClass}>Invoice</th>
            <th className={thClass}>Date</th>
            <th className={thClass}>Amount</th>
            <th className={thClass}>Due</th>
            <th className={thClass}>Sent</th>
            <th className={thClass}>Reminder</th>
            <th className={thClass}>Status</th>
            <th className={cn(thClass, 'pr-8')}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-8 pt-4 pb-2.5 text-muted-foreground">
                No invoices yet.{' '}
                <button onClick={onNewInvoice} className="text-primary hover:underline">
                  Create the first one.
                </button>
              </td>
            </tr>
          ) : (
            rows.map((inv) => {
              const client = clients.find((item) => item.id === inv.clientId) ?? null;
              const status = resolveStatus(inv);
              const { total } = calculateTotal(inv.lineItems, inv.taxEnabled, inv.taxRate);
              const sentTooltip = invoiceEmailSentTooltip(
                inv.emailSendCount,
                inv.lastEmailSentAt,
                inv.lastEmailSentKind
              );
              const sentCount = (
                <span
                  className={cn(
                    'inline-flex max-w-full items-center gap-1 truncate',
                    sentTooltip && 'border-b border-dotted border-muted-foreground/50'
                  )}
                >
                  <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="tabular-nums font-semibold">
                    {inv.emailSendCount} ×
                  </span>
                </span>
              );
              const due = invoiceDueDisplay(inv);
              const dueLabel = (
                <span className="border-b border-dotted border-muted-foreground/50">
                  {due.label}
                </span>
              );
              const reminder = invoiceReminderDisplay(
                inv,
                {
                  reminderIntervalDays,
                  lateReminderIntervalDays,
                },
                { client }
              );
              const reminderLabel = (
                <span className="border-b border-dotted border-muted-foreground/50">
                  {reminder.label}
                </span>
              );
              return (
                <tr
                  key={inv.id}
                  onClick={() => onOpenInvoice(inv.id)}
                  className="cursor-pointer border-b border-border hover:bg-secondary"
                >
                  <td className={cn(tdClass, 'pl-8')}>{inv.clientName}</td>
                  <td className={cn(tdClass, 'font-mono text-muted-foreground')}>{inv.number}</td>
                  <td className={cn(tdClass, 'text-muted-foreground')}>
                    {formatDate(inv.issueDate)}
                  </td>
                  <td className={cn(tdClass, 'tabular-nums font-semibold')}>
                    {formatCurrency(total)}
                  </td>
                  <td className={cn(tdClass, 'tabular-nums text-muted-foreground')}>
                    <Tooltip content={due.tooltip} className={tooltipCellClass}>
                      {dueLabel}
                    </Tooltip>
                  </td>
                  <td className={cn(tdClass, 'text-muted-foreground')}>
                    {sentTooltip ? (
                      <Tooltip content={sentTooltip} className={tooltipCellClass}>
                        {sentCount}
                      </Tooltip>
                    ) : (
                      sentCount
                    )}
                  </td>
                  <td className={cn(tdClass, 'tabular-nums text-muted-foreground')}>
                    <Tooltip content={reminder.tooltip} className={tooltipCellClass}>
                      {reminderLabel}
                    </Tooltip>
                  </td>
                  <td className={tdClass}>
                    <span className="block truncate">
                      <StatusLabel status={status} />
                    </span>
                  </td>
                  <td className={cn(tdClass, 'pr-8')}>
                    <InvoiceActionsMenu
                      invoice={inv}
                      client={client}
                      settings={settings}
                      onEdit={() => onEditInvoice(inv.id)}
                      onChangeStatus={(nextStatus) => onChangeInvoiceStatus(inv.id, nextStatus)}
                      onSendInvoice={(pdfBase64, purpose) =>
                        onSendInvoice(inv.id, pdfBase64, purpose)
                      }
                      onVisitPublicInvoice={() => onVisitPublicInvoice(inv.id)}
                      onDelete={() => onDeleteInvoice(inv.id)}
                      align="right"
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
