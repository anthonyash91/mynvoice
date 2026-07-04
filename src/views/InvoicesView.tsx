import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Send } from 'lucide-react';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { InvoiceActionsMenu } from '@/components/InvoiceActionsMenu';
import { ViewHeader } from '@/components/ViewHeader';
import { StatusLabel } from '@/components/StatusLabel';
import { Tooltip } from '@/components/Tooltip';
import { calculateTotal, formatCurrency, formatDate } from '@/lib/calculations';
import { invoiceEmailSentTooltip } from '@/lib/emailTemplates';
import {
  invoiceDueDisplay,
  invoiceReminderDisplay,
  resolveStatus,
  isHistoricalInvoice,
  sortInvoices,
  type InvoiceListSortDirection,
  type InvoiceListSortKey,
} from '@/lib/invoice';
import {
  tableRowHoverClass,
  tableTdClass,
  tableThClass,
  tableTooltipCellClass,
} from '@/lib/tableStyles';
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
  onImportHistorical: () => void;
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

function defaultDirectionForSortKey(key: InvoiceListSortKey): InvoiceListSortDirection {
  return key === 'date' || key === 'amount' ? 'desc' : 'asc';
}

interface SortableHeaderProps {
  label: string;
  sortKey: InvoiceListSortKey;
  activeKey: InvoiceListSortKey;
  direction: InvoiceListSortDirection;
  onSort: (key: InvoiceListSortKey) => void;
  className?: string;
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: SortableHeaderProps) {
  const active = activeKey === sortKey;

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm transition-colors',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active && 'text-foreground'
        )}
      >
        <span>{label}</span>
        {active &&
          (direction === 'asc' ? (
            <ArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
          ))}
      </button>
    </th>
  );
}

export function InvoicesView({
  invoices,
  clients,
  settings,
  reminderIntervalDays,
  lateReminderIntervalDays,
  onOpenInvoice,
  onNewInvoice,
  onImportHistorical,
  onEditInvoice,
  onChangeInvoiceStatus,
  onSendInvoice,
  onVisitPublicInvoice,
  onDeleteInvoice,
}: InvoicesViewProps) {
  const [sortKey, setSortKey] = useState<InvoiceListSortKey>('date');
  const [sortDirection, setSortDirection] = useState<InvoiceListSortDirection>('desc');

  const handleSort = (key: InvoiceListSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(defaultDirectionForSortKey(key));
  };

  const rows = useMemo(
    () => sortInvoices(invoices, sortKey, sortDirection),
    [invoices, sortKey, sortDirection]
  );

  return (
    <div>
      <ViewHeader
        title="Invoices"
        subtitle={`${rows.length} total`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onImportHistorical}>
              Import historical
            </Button>
            <Button variant="primary" size="sm" onClick={onNewInvoice}>
              New invoice
            </Button>
          </div>
        }
      />

      <table className="w-full table-fixed text-[13px]">
        <colgroup>
          {Array.from({ length: 9 }, (_, index) => (
            <col key={index} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <SortableHeader
              label="Client"
              sortKey="client"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
              className={cn(tableThClass, 'pl-8')}
            />
            <SortableHeader
              label="Invoice"
              sortKey="number"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
              className={tableThClass}
            />
            <SortableHeader
              label="Date"
              sortKey="date"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
              className={tableThClass}
            />
            <SortableHeader
              label="Amount"
              sortKey="amount"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
              className={tableThClass}
            />
            <th className={tableThClass}>Due</th>
            <th className={tableThClass}>Sent</th>
            <th className={tableThClass}>Reminder</th>
            <th className={tableThClass}>Status</th>
            <th className={cn(tableThClass, 'pr-8')}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9}>
                <EmptyState
                  message="No invoices yet."
                  action={{ label: 'Create the first one.', onClick: onNewInvoice }}
                  padding="compact"
                  className="px-8"
                />
              </td>
            </tr>
          ) : (
            rows.map((inv) => {
              const client = clients.find((item) => item.id === inv.clientId) ?? null;
              const status = resolveStatus(inv);
              const { total } = calculateTotal(inv.lineItems, inv.taxEnabled, inv.taxRate);
              const historical = isHistoricalInvoice(inv);
              const sentTooltip = historical
                ? 'Historical import — never sent from MyNvoice.'
                : invoiceEmailSentTooltip(
                    inv.emailSendCount,
                    inv.lastEmailSentAt,
                    inv.lastEmailSentKind
                  );
              const sentCount = historical ? (
                <span className="text-muted-foreground">—</span>
              ) : (
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
                  className={tableRowHoverClass}
                >
                  <td className={cn(tableTdClass, 'pl-8')}>
                    <span className="block truncate">{inv.clientName}</span>
                    {historical && (
                      <span className="text-[11px] text-muted-foreground">Historical</span>
                    )}
                  </td>
                  <td className={cn(tableTdClass, 'font-mono text-muted-foreground')}>{inv.number}</td>
                  <td className={cn(tableTdClass, 'text-muted-foreground')}>
                    {formatDate(inv.issueDate)}
                  </td>
                  <td className={cn(tableTdClass, 'tabular-nums font-semibold')}>
                    {formatCurrency(total)}
                  </td>
                  <td className={cn(tableTdClass, 'tabular-nums text-muted-foreground')}>
                    <Tooltip content={due.tooltip} className={tableTooltipCellClass}>
                      {dueLabel}
                    </Tooltip>
                  </td>
                  <td className={cn(tableTdClass, 'text-muted-foreground')}>
                    {sentTooltip ? (
                      <Tooltip content={sentTooltip} className={tableTooltipCellClass}>
                        {sentCount}
                      </Tooltip>
                    ) : (
                      sentCount
                    )}
                  </td>
                  <td className={cn(tableTdClass, 'tabular-nums text-muted-foreground')}>
                    <Tooltip content={reminder.tooltip} className={tableTooltipCellClass}>
                      {reminderLabel}
                    </Tooltip>
                  </td>
                  <td className={tableTdClass}>
                    <span className="block truncate">
                      <StatusLabel status={status} />
                    </span>
                  </td>
                  <td className={cn(tableTdClass, 'pr-8')}>
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
