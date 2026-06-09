import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Check,
  Download,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { InvoicePrintDocument } from '@/components/InvoicePrintDocument';
import { StatusIcon } from '@/components/StatusLabel';
import { invoiceEmailRecipients, validateInvoiceEmail } from '@/lib/email';
import { INVOICE_STORED_STATUSES, resolveStatus, statusLabel } from '@/lib/invoice';
import { downloadInvoicePdf, generateInvoicePdfBase64 } from '@/lib/pdf';
import { cn } from '@/lib/utils';
import type { Client, Invoice, InvoiceStoredStatus, Settings } from '@/types';

type SentAction = 'invoice' | 'reminder' | null;

interface InvoiceActionsMenuProps {
  invoice: Invoice;
  client: Client | null;
  settings: Settings;
  onEdit: () => void;
  onChangeStatus: (status: InvoiceStoredStatus) => Promise<void>;
  onSendInvoice: (pdfBase64: string, purpose: 'invoice' | 'reminder') => Promise<void>;
  onVisitPublicInvoice: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onErrorsChange?: (errors: {
    sendError: string | null;
    actionError: string | null;
    sendValidationError: string | null;
  }) => void;
  pdfSourceSelector?: string;
  align?: 'left' | 'right';
  buttonClassName?: string;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Failed to send invoice.';
}

function MenuSeparator() {
  return <div className="my-1 border-t border-border" role="separator" />;
}

function MenuLabel({ children }: { children: string }) {
  return (
    <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function InvoiceActionsMenu({
  invoice,
  client,
  settings,
  onEdit,
  onChangeStatus,
  onSendInvoice,
  onVisitPublicInvoice,
  onDelete,
  onErrorsChange,
  pdfSourceSelector,
  align = 'right',
  buttonClassName,
}: InvoiceActionsMenuProps) {
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const [sendingAction, setSendingAction] = useState<SentAction>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sentAction, setSentAction] = useState<SentAction>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<InvoiceStoredStatus | null>(null);
  const [pdfCaptureActive, setPdfCaptureActive] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MENU_MIN_WIDTH = 224;

  const pdfSelector = pdfSourceSelector ?? `#invoice-pdf-${invoice.id}`;
  const usesHiddenPdfCapture = !pdfSourceSelector;

  useLayoutEffect(() => {
    if (!menuOpen || !wrapperRef.current) return;

    const updatePosition = () => {
      const trigger = wrapperRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      let left = align === 'right' ? rect.right - MENU_MIN_WIDTH : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - MENU_MIN_WIDTH - 8));

      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left,
        minWidth: MENU_MIN_WIDTH,
        zIndex: 100,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [menuOpen, align]);

  useEffect(() => {
    if (!menuOpen) return;

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-confirm-dialog]')) return;
      setMenuOpen(false);
    };

    const closeOnScroll = () => setMenuOpen(false);

    document.addEventListener('mousedown', closeMenu);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
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

  const isFirstSend = invoice.emailSendCount === 0;
  const canSendReminder = invoice.status === 'unpaid';

  useEffect(() => {
    onErrorsChange?.({
      sendError,
      actionError,
      sendValidationError,
    });
  }, [sendError, actionError, sendValidationError, onErrorsChange]);

  const activatePdfCapture = async () => {
    if (!usesHiddenPdfCapture) return;
    setPdfCaptureActive(true);
    await waitForPaint();
  };

  const deactivatePdfCapture = () => {
    if (!usesHiddenPdfCapture) return;
    setPdfCaptureActive(false);
  };

  const sendWithPurpose = async (purpose: 'invoice' | 'reminder') => {
    if (sendValidationError) {
      setSendError(sendValidationError);
      return;
    }

    setSendingAction(purpose);
    setSendError(null);
    setActionError(null);
    setSentAction(null);

    try {
      await activatePdfCapture();
      const pdfBase64 = await generateInvoicePdfBase64(pdfSelector);
      await onSendInvoice(pdfBase64, purpose);
      setSentAction(purpose);
      if (sentTimeoutRef.current) clearTimeout(sentTimeoutRef.current);
      sentTimeoutRef.current = setTimeout(() => setSentAction(null), 3000);
    } catch (err) {
      setSendError(getErrorMessage(err));
    } finally {
      deactivatePdfCapture();
      setSendingAction(null);
    }
  };

  const handleStatusChange = async (nextStatus: InvoiceStoredStatus) => {
    if (nextStatus === invoice.status) return;

    setActionError(null);
    setStatusUpdating(nextStatus);
    try {
      await onChangeStatus(nextStatus);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleDownload = async () => {
    try {
      await activatePdfCapture();
      await downloadInvoicePdf(invoice.number, pdfSelector);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to download invoice.');
    } finally {
      deactivatePdfCapture();
    }
  };

  const handleVisitPublic = async () => {
    setActionError(null);
    try {
      await onVisitPublicInvoice();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to open public invoice.');
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    const ok = await confirm({
      title: `Delete ${invoice.number}?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    setActionError(null);
    setDeleting(true);
    try {
      await onDelete();
      setMenuOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete invoice.');
    } finally {
      setDeleting(false);
    }
  };

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

  const menuItemClass =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed';

  const stopRowClick = (event: ReactMouseEvent) => {
    event.stopPropagation();
  };

  return (
    <>
      {pdfCaptureActive && (
        <div className="pointer-events-none fixed -left-[10000px] top-0" aria-hidden="true">
          <InvoicePrintDocument
            invoice={invoice}
            client={client}
            settings={settings}
            printId={`invoice-pdf-${invoice.id}`}
          />
        </div>
      )}

      <div
        className="relative shrink-0"
        ref={wrapperRef}
        onClick={stopRowClick}
        onMouseDown={stopRowClick}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Actions"
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground',
            buttonClassName
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={menuStyle}
              className="max-h-[min(24rem,calc(100vh-6rem))] overflow-y-auto rounded border border-border bg-background py-1 shadow-sm"
            >
            <MenuLabel>Status</MenuLabel>
            {INVOICE_STORED_STATUSES.map((storedStatus) => {
              const isCurrent = invoice.status === storedStatus;
              const isUpdating = statusUpdating === storedStatus;

              return (
                <button
                  key={storedStatus}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  onClick={() => handleStatusChange(storedStatus)}
                  disabled={Boolean(statusUpdating)}
                  className={cn(
                    menuItemClass,
                    isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {isUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <StatusIcon status={storedStatus} className="h-3.5 w-3.5" />
                  )}
                  <span className="min-w-0 flex-1">
                    {statusLabel(storedStatus)}
                    {storedStatus === 'unpaid' && resolveStatus(invoice) === 'overdue' && isCurrent && (
                      <span className="ml-1 text-[11px] text-[#FF3B30]">(past due)</span>
                    )}
                  </span>
                  {isCurrent && !isUpdating && (
                    <Check className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
              );
            })}

            <MenuSeparator />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
              className={cn(menuItemClass, 'text-foreground')}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              Edit
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => sendWithPurpose('invoice')}
              disabled={Boolean(sendingAction) || Boolean(sendValidationError)}
              title={
                sendValidationError ??
                `${isFirstSend ? 'Send' : 'Resend'} to ${recipientSummary ?? 'client'}`
              }
              className={cn(
                menuItemClass,
                sentAction === 'invoice' ? 'text-[#34C759]' : 'text-foreground'
              )}
            >
              {renderSentState('invoice', isFirstSend ? 'Send invoice' : 'Resend invoice')}
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => sendWithPurpose('reminder')}
              disabled={
                Boolean(sendingAction) || !canSendReminder || Boolean(sendValidationError)
              }
              title={
                !canSendReminder
                  ? 'Reminders are available for unpaid invoices.'
                  : (sendValidationError ?? `Send reminder to ${recipientSummary ?? 'client'}`)
              }
              className={cn(
                menuItemClass,
                sentAction === 'reminder' ? 'text-[#34C759]' : 'text-foreground'
              )}
            >
              {renderSentState('reminder', 'Send reminder')}
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => void handleDownload()}
              className={cn(menuItemClass, 'text-foreground')}
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              Download invoice
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => void handleVisitPublic()}
              className={cn(menuItemClass, 'text-foreground')}
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              Visit public invoice
            </button>

            {onDelete && (
              <>
                <MenuSeparator />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className={cn(menuItemClass, 'text-destructive')}
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
            </div>,
            document.body
          )}

      </div>
    </>
  );
}
