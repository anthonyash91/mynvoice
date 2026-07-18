import { useCallback, useState } from 'react';
import { ChevronLeft, Trash2, X } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { InvoiceActionsMenu } from '@/components/InvoiceActionsMenu';
import { InvoiceReminderControls } from '@/components/InvoiceReminderControls';
import { InvoicePrintDocument } from '@/components/InvoicePrintDocument';
import { StatusLabel } from '@/components/StatusLabel';
import { resolveStatus, isHistoricalInvoice } from '@/lib/invoice';
import type {
  Client,
  Invoice,
  InvoiceReminderSettings,
  InvoiceStoredStatus,
  Settings,
} from '@/types';

interface InvoicePanelProps {
  invoice: Invoice;
  client: Client | null;
  settings: Settings;
  onClose: () => void;
  onBack?: () => void;
  onEdit: () => void;
  onChangeStatus: (
    status: InvoiceStoredStatus,
    pdfBase64?: string
  ) => Promise<void>;
  onSendInvoice: (pdfBase64: string, purpose: 'invoice' | 'reminder') => Promise<void>;
  onVisitPublicInvoice: () => Promise<void>;
  onUpdateReminderSettings: (settings: InvoiceReminderSettings) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function InvoicePanel({
  invoice,
  client,
  settings,
  onClose,
  onBack,
  onEdit,
  onChangeStatus,
  onSendInvoice,
  onVisitPublicInvoice,
  onUpdateReminderSettings,
  onDelete,
}: InvoicePanelProps) {
  const confirm = useConfirm();
  const status = resolveStatus(invoice);
  const historical = isHistoricalInvoice(invoice);
  const [deleting, setDeleting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendValidationError, setSendValidationError] = useState<string | null>(null);

  const handleErrorsChange = useCallback(
    (errors: {
      sendError: string | null;
      actionError: string | null;
      sendValidationError: string | null;
    }) => {
      setSendError(errors.sendError);
      setActionError(errors.actionError);
      setSendValidationError(errors.sendValidationError);
    },
    []
  );

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
      <div className="w-full border-b border-border no-print shrink-0">
        <div className="h-14 w-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to history"
                className="inline-flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="inline-flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="font-mono text-[13px] leading-none">{invoice.number}</span>
            <StatusLabel status={status} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <InvoiceActionsMenu
              invoice={invoice}
              client={client}
              settings={settings}
              onEdit={onEdit}
              onChangeStatus={onChangeStatus}
              onSendInvoice={onSendInvoice}
              onVisitPublicInvoice={onVisitPublicInvoice}
              onErrorsChange={handleErrorsChange}
            />
            <button
              onClick={remove}
              disabled={deleting}
              className="h-7 px-2 text-[13px] text-destructive rounded hover:bg-secondary flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
        {(sendError || actionError || sendValidationError) && (
          <div className="px-6 pb-3 text-[12px] leading-snug">
            {sendError && <p className="text-destructive">{sendError}</p>}
            {actionError && <p className="text-destructive">{actionError}</p>}
            {!sendError && !actionError && sendValidationError && (
              <p className="text-muted-foreground">{sendValidationError}</p>
            )}
          </div>
        )}
        {historical && (
          <div className="px-6 pb-3 text-[12px] text-muted-foreground">
            Historical record — no emails will be sent for this invoice.
          </div>
        )}
      </div>

      <InvoiceReminderControls
        invoice={invoice}
        client={client}
        settings={settings}
        onUpdate={onUpdateReminderSettings}
      />

      <div className="invoice-print-viewport flex-1 overflow-auto">
        <InvoicePrintDocument invoice={invoice} client={client} settings={settings} />
      </div>
    </div>
  );
}
