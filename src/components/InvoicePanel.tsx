import { CheckCircle2, Download, Send, X } from 'lucide-react';
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
}

export function InvoicePanel({
  invoice,
  client,
  settings,
  onClose,
  onMarkSent,
  onMarkPaid,
}: InvoicePanelProps) {
  const status = resolveStatus(invoice);

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 px-6 border-b border-border flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <span className="font-mono text-[13px]">{invoice.number}</span>
          <StatusLabel status={status} />
        </div>
        <div className="flex items-center gap-1">
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
        </div>
      </div>

      <div className="invoice-print-viewport flex-1 overflow-auto">
        <InvoicePrintDocument invoice={invoice} client={client} settings={settings} />
      </div>
    </div>
  );
}
