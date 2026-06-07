import { useState } from 'react';
import { CheckCircle2, Download, Send, Trash2, X } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { InvoicePrintDocument } from '@/components/InvoicePrintDocument';
import { StatusLabel } from '@/components/StatusLabel';
import { downloadInvoicePdf } from '@/lib/pdf';
import { resolveStatus } from '@/lib/invoice';
import type { Client, Invoice, Settings } from '@/types';

interface InvoicePanelProps {
  invoice: Invoice;
  client: Client | null;
  settings: Settings;
  onClose: () => void;
  onMarkSent: () => void;
  onMarkPaid: () => void;
  onDelete: () => Promise<void>;
}

export function InvoicePanel({
  invoice,
  client,
  settings,
  onClose,
  onMarkSent,
  onMarkPaid,
  onDelete,
}: InvoicePanelProps) {
  const confirm = useConfirm();
  const status = resolveStatus(invoice);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${invoice.number}?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="inline-flex flex-col h-full max-w-full">
      <div className="h-14 w-full px-6 border-b border-border flex items-center justify-between no-print shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="font-mono text-[13px] leading-none">{invoice.number}</span>
          <StatusLabel status={status} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {status === 'draft' && (
            <button
              onClick={onMarkSent}
              className="h-7 px-2 text-[13px] text-foreground rounded hover:bg-secondary flex items-center gap-1"
            >
              <Send className="h-3.5 w-3.5" /> Mark as Sent
            </button>
          )}
          {(status === 'sent' || status === 'overdue') && (
            <button
              onClick={onMarkPaid}
              className="h-7 px-2 text-[13px] text-foreground rounded hover:bg-secondary flex items-center gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Paid
            </button>
          )}
          <button
            onClick={() => downloadInvoicePdf(invoice.number)}
            className="h-7 px-2 text-[13px] text-foreground rounded hover:bg-secondary flex items-center gap-1"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button
            onClick={remove}
            disabled={deleting}
            className="h-7 px-2 text-[13px] text-destructive rounded hover:bg-secondary flex items-center gap-1 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="invoice-print-viewport flex-1 overflow-auto">
        <InvoicePrintDocument invoice={invoice} client={client} settings={settings} />
      </div>
    </div>
  );
}
