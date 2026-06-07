import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, CheckCircle2, ChevronDown, Download, Send, Trash2, X } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { InvoicePrintDocument } from '@/components/InvoicePrintDocument';
import { StatusLabel } from '@/components/StatusLabel';
import { invoiceEmailRecipients, validateInvoiceEmail } from '@/lib/email';
import { downloadInvoicePdf, generateInvoicePdfBase64 } from '@/lib/pdf';
import { resolveStatus } from '@/lib/invoice';
import { cn } from '@/lib/utils';
import type { Client, Invoice, Settings } from '@/types';

interface InvoicePanelProps {
  invoice: Invoice;
  client: Client | null;
  settings: Settings;
  onClose: () => void;
  onSendInvoice: (pdfBase64: string, purpose: 'invoice' | 'reminder') => Promise<void>;
  onMarkPaid: () => void;
  onDelete: () => Promise<void>;
}

type SentAction = 'invoice' | 'reminder' | null;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Failed to send invoice.';
}

export function InvoicePanel({
  invoice,
  client,
  settings,
  onClose,
  onSendInvoice,
  onMarkPaid,
  onDelete,
}: InvoicePanelProps) {
  const confirm = useConfirm();
  const status = resolveStatus(invoice);
  const [deleting, setDeleting] = useState(false);
  const [sendingAction, setSendingAction] = useState<SentAction>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sentAction, setSentAction] = useState<SentAction>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [menuOpen]);

  useEffect(
    () => () => {
      if (sentTimeoutRef.current) clearTimeout(sentTimeoutRef.current);
    },
    []
  );

  const sendValidationError = useMemo(
    () => validateInvoiceEmail(client, settings),
    [client, settings]
  );

  const recipientSummary = useMemo(() => {
    if (!client) return null;
    const recipients = invoiceEmailRecipients(client);
    if (recipients.length === 0) return null;
    return recipients.join(', ');
  }, [client]);

  const canSendReminder = status === 'unpaid';
  const sendInvoiceLabel = status === 'overdue' ? 'Send overdue notice' : 'Send invoice';

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

  const sendWithPurpose = async (purpose: 'invoice' | 'reminder') => {
    if (sendValidationError) {
      setSendError(sendValidationError);
      return;
    }

    setSendingAction(purpose);
    setSendError(null);
    setSentAction(null);

    try {
      const pdfBase64 = await generateInvoicePdfBase64();
      await onSendInvoice(pdfBase64, purpose);
      setSentAction(purpose);
      if (sentTimeoutRef.current) clearTimeout(sentTimeoutRef.current);
      sentTimeoutRef.current = setTimeout(() => setSentAction(null), 3000);
    } catch (err) {
      setSendError(getErrorMessage(err));
    } finally {
      setSendingAction(null);
    }
  };

  const markPaid = () => {
    onMarkPaid();
  };

  const downloadPdf = () => {
    void downloadInvoicePdf(invoice.number);
  };

  const canMarkPaid =
    status === 'unpaid' || status === 'overdue' || status === 'payment_sent';

  const renderSentState = (action: 'invoice' | 'reminder', idleLabel: string) => {
    const isSending = sendingAction === action;
    const isSent = sentAction === action;

    return (
      <>
        {isSent ? (
          <Check className="h-3.5 w-3.5 shrink-0" />
        ) : action === 'reminder' ? (
          <Bell className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Send className="h-3.5 w-3.5 shrink-0" />
        )}
        {isSending ? 'Sending…' : isSent ? 'Sent' : idleLabel}
      </>
    );
  };

  return (
    <div className="inline-flex flex-col h-full max-w-full">
      <div className="w-full border-b border-border no-print shrink-0">
        <div className="h-14 w-full px-6 flex items-center justify-between">
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
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="h-7 px-2 text-[13px] text-foreground rounded hover:bg-secondary flex items-center gap-1"
              >
                Actions
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] rounded border border-border bg-background py-1"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => sendWithPurpose('invoice')}
                    disabled={Boolean(sendingAction) || Boolean(sendValidationError)}
                    title={sendValidationError ?? `Send to ${recipientSummary ?? 'client'}`}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-secondary disabled:opacity-50',
                      sentAction === 'invoice' ? 'text-[#34C759]' : 'text-foreground'
                    )}
                  >
                    {renderSentState('invoice', sendInvoiceLabel)}
                  </button>
                  {canSendReminder && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => sendWithPurpose('reminder')}
                      disabled={Boolean(sendingAction) || Boolean(sendValidationError)}
                      title={sendValidationError ?? `Send reminder to ${recipientSummary ?? 'client'}`}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-secondary disabled:opacity-50',
                        sentAction === 'reminder' ? 'text-[#34C759]' : 'text-foreground'
                      )}
                    >
                      {renderSentState('reminder', 'Send reminder')}
                    </button>
                  )}
                  {canMarkPaid && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={markPaid}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-secondary"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Mark as paid
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={downloadPdf}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-secondary"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    Download PDF
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={remove}
              disabled={deleting}
              className="h-7 px-2 text-[13px] text-destructive rounded hover:bg-secondary flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
        {(sendError || sendValidationError) && (
          <div className="px-6 pb-3 text-[12px] leading-snug">
            {sendError && <p className="text-destructive">{sendError}</p>}
            {!sendError && sendValidationError && (
              <p className="text-muted-foreground">{sendValidationError}</p>
            )}
          </div>
        )}
      </div>

      <div className="invoice-print-viewport flex-1 overflow-auto">
        <InvoicePrintDocument invoice={invoice} client={client} settings={settings} />
      </div>
    </div>
  );
}
