import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send } from 'lucide-react';
import { Button } from '@/components/Button';
import { InvoicePrintDocument } from '@/components/InvoicePrintDocument';
import { PayPalCheckout } from '@/components/PayPalCheckout';
import { StatusLabel } from '@/components/StatusLabel';
import { cn } from '@/lib/utils';
import { migrateEmailTemplates } from '@/lib/emailTemplates';
import {
  confirmPublicPayment,
  fetchConfirmPaymentPreview,
  fetchPublicInvoice,
  markPublicPaymentSent,
  mergePublicInvoicePayload,
  publicClientToClient,
  publicInvoiceToInvoice,
  type ConfirmPaymentPreview,
  type PublicInvoicePayload,
} from '@/lib/publicInvoice';
import { formatUnknownError } from '@/lib/errors';
import { resolveStatus } from '@/lib/invoice';
import { generateEmailInvoicePdfBase64, INVOICE_PDF_CAPTURE_WIDTH_PX } from '@/lib/pdf';
import type { Settings } from '@/types';

type PublicRoute =
  | { kind: 'invoice'; token: string }
  | { kind: 'payment-sent'; token: string }
  | { kind: 'confirm-payment'; token: string };

interface PublicInvoiceAppProps {
  route: PublicRoute;
}

function toSettings(payload: PublicInvoicePayload): Settings {
  return {
    businessName: payload.settings.businessName,
    email: payload.settings.email,
    businessAddress: payload.settings.businessAddress,
    mailingAddress: payload.settings.mailingAddress,
    paymentDetails: payload.settings.paymentDetails,
    defaultTaxRate: payload.settings.defaultTaxRate,
    defaultDueDays: payload.settings.defaultDueDays,
    reminderIntervalDays: 5,
    lateReminderIntervalDays: 3,
    paypalClientId: payload.settings.paypal.clientId,
    paypalClientSecret: '',
    paypalSandbox: payload.settings.paypal.sandbox,
    logo: payload.settings.logo,
    emailTemplates: migrateEmailTemplates(),
  };
}

function PublicInvoicePage({
  payload,
  token,
  paymentJustMarked,
  promptPaymentSent = false,
  loadError = null,
}: {
  payload: PublicInvoicePayload;
  token: string;
  paymentJustMarked: boolean;
  promptPaymentSent?: boolean;
  loadError?: string | null;
}) {
  const [data, setData] = useState(payload);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [marked, setMarked] = useState(
    paymentJustMarked || payload.invoice.status === 'payment_sent'
  );

  const invoice = publicInvoiceToInvoice(data.invoice);
  const client = publicClientToClient(data.client, data.invoice);
  const settings = toSettings(data);
  const status = resolveStatus(invoice);
  const canPayOnline = status !== 'paid' && status !== 'payment_sent';
  const canMarkPaymentSent = canPayOnline;
  const paypal = data.settings.paypal;
  const showPaymentSentPrompt = promptPaymentSent && canMarkPaymentSent && !marked;

  const handleMarkPaymentSent = async () => {
    if (!token) return;

    setMarking(true);
    setMarkError(null);
    try {
      const updated = await markPublicPaymentSent(token);
      setData((prev) => mergePublicInvoicePayload(prev, updated));
      setMarked(true);
    } catch (err) {
      setMarkError(err instanceof Error ? err.message : 'Failed to update payment status.');
    } finally {
      setMarking(false);
    }
  };

  const markPaymentSentSection = canMarkPaymentSent ? (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-sm',
        showPaymentSentPrompt ? 'border-[rgba(0,113,227,0.32)]' : 'border-border'
      )}
    >
      {showPaymentSentPrompt && (
        <div className="border-b border-[rgba(0,113,227,0.14)] bg-[rgba(0,113,227,0.07)] px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0071E3]">
            Confirm your payment
          </p>
          <p className="mt-2 text-[16px] font-medium leading-snug text-foreground">
            Let {settings.businessName} know your payment is on the way.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#424245]">
            Click the button below only after you have sent a bank transfer or completed payment
            another way. They will confirm once the funds arrive.
          </p>
        </div>
      )}

      <div className={cn('px-5', showPaymentSentPrompt ? 'py-5' : 'py-4')}>
        {!showPaymentSentPrompt && paypal.enabled && (
          <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
            Paying by bank transfer or another method?
          </p>
        )}
        <Button
          variant={showPaymentSentPrompt ? 'primary' : 'outline'}
          size="lg"
          icon={Send}
          loading={marking}
          onClick={handleMarkPaymentSent}
          className={cn(
            showPaymentSentPrompt && 'h-12 w-full text-[15px] font-semibold shadow-sm'
          )}
        >
          Payment has been sent
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="mx-auto max-w-[860px] px-4 py-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
              Invoice
            </div>
            <div className="text-[15px] font-medium text-foreground">{invoice.number}</div>
          </div>
          <StatusLabel status={status} />
        </div>

        {loadError && (
          <div className="mb-4 rounded border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
            {loadError}
          </div>
        )}

        {showPaymentSentPrompt && <div className="mb-5">{markPaymentSentSection}</div>}

        {(marked || status === 'payment_sent') && (
          <div className="mb-4 rounded border border-[rgba(255,149,0,0.22)] bg-[rgba(255,149,0,0.08)] px-4 py-3 text-[13px] text-foreground">
            Payment marked as sent. {settings.businessName} has been notified and will confirm once
            received.
          </div>
        )}

        {status === 'paid' && (
          <div className="mb-4 rounded border border-[rgba(52,199,89,0.22)] bg-[rgba(52,199,89,0.08)] px-4 py-3 text-[13px] text-foreground">
            This invoice is paid. Thank you.
          </div>
        )}

        {markError && (
          <div className="mb-4 rounded border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
            {markError}
          </div>
        )}

        {payError && (
          <div className="mb-4 rounded border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
            {payError}
          </div>
        )}

        {canPayOnline && paypal.enabled && paypal.clientId && (
          <div className="mb-4 rounded border border-border bg-white px-4 py-4 shadow-sm">
            <div className="mb-3 text-[12px] uppercase tracking-wider text-muted-foreground">
              Pay with PayPal
            </div>
            <PayPalCheckout
              token={token}
              clientId={paypal.clientId}
              onPaid={async () => {
                setPayError(null);
                const updated = await fetchPublicInvoice(token);
                setData(updated);
              }}
              onError={(message) => setPayError(message)}
            />
          </div>
        )}

        {!showPaymentSentPrompt && markPaymentSentSection && (
          <div className="mb-4">{markPaymentSentSection}</div>
        )}

        <div className="rounded border border-border bg-white p-6 shadow-sm">
          <InvoicePrintDocument invoice={invoice} client={client} settings={settings} />
        </div>
      </div>
    </div>
  );
}

function ConfirmPaymentPage({ token }: { token: string }) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ConfirmPaymentPreview | null>(null);
  const [result, setResult] = useState<{
    invoiceNumber: string;
    clientName: string;
    alreadyPaid: boolean;
  } | null>(null);

  const paidPrintId = 'confirm-payment-invoice-pdf';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetchConfirmPaymentPreview(token);
        if (cancelled) return;

        if (response.alreadyPaid) {
          setResult({
            invoiceNumber: response.invoiceNumber,
            clientName: response.clientName,
            alreadyPaid: true,
          });
        } else {
          setPreview(response);
        }
      } catch (err) {
        if (cancelled) return;
        setError(formatUnknownError(err, 'Failed to load confirmation details.'));
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);

    try {
      if (!preview?.payload || !document.getElementById(paidPrintId)) {
        throw new Error('Invoice preview is not ready. Refresh and try again.');
      }

      await document.fonts.ready;
      const pdfBase64 = await generateEmailInvoicePdfBase64(`#${paidPrintId}`);
      if (!pdfBase64.trim()) {
        throw new Error('Failed to create the paid invoice PDF. Refresh and try again.');
      }

      const response = await confirmPublicPayment(token, pdfBase64);
      setPreview(null);
      setResult(response);
    } catch (err) {
      setError(formatUnknownError(err, 'Failed to confirm payment.'));
    } finally {
      setConfirming(false);
    }
  };

  const paidInvoice =
    preview?.payload != null
      ? {
          ...publicInvoiceToInvoice(preview.payload.invoice),
          status: 'paid' as const,
          paidAt: new Date().toISOString().split('T')[0],
        }
      : null;
  const paidClient = preview?.payload
    ? publicClientToClient(preview.payload.client, preview.payload.invoice)
    : null;
  const paidSettings = preview?.payload ? toSettings(preview.payload) : null;

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4">
      {paidInvoice &&
        paidSettings &&
        createPortal(
          <div
            className="invoice-print-capture-root"
            style={{ width: INVOICE_PDF_CAPTURE_WIDTH_PX }}
            aria-hidden="true"
          >
            <InvoicePrintDocument
              invoice={paidInvoice}
              client={paidClient}
              settings={paidSettings}
              printId={paidPrintId}
            />
          </div>,
          document.body
        )}

      <div className="w-full max-w-md rounded border border-border bg-white p-8 shadow-sm">
        {loadingPreview && (
          <p className="text-[13px] text-muted-foreground">Loading confirmation…</p>
        )}

        {error && <p className="text-[13px] text-destructive">{error}</p>}

        {preview && !result && (
          <div className="space-y-4">
            <div>
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
                Confirm payment
              </div>
              <h1 className="mt-2 text-[20px] font-medium text-foreground">
                Invoice {preview.invoiceNumber}
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">Client: {preview.clientName}</p>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The client marked payment as sent. Confirm only after you have received the funds.
              This will mark the invoice as paid and notify the client.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="h-9 w-full rounded border border-border bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {confirming ? 'Confirming…' : 'Confirm payment received'}
            </button>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
              Payment confirmed
            </div>
            <h1 className="text-[20px] font-medium text-foreground">
              {result.alreadyPaid ? 'Already marked paid' : 'Payment has been received'}
            </h1>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {result.alreadyPaid
                ? `Invoice ${result.invoiceNumber} was already marked as paid.`
                : `Invoice ${result.invoiceNumber} for ${result.clientName} is now marked as paid. The client has been notified.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PublicInvoiceApp({ route }: PublicInvoiceAppProps) {
  const [loading, setLoading] = useState(route.kind !== 'confirm-payment');
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PublicInvoicePayload | null>(null);

  useEffect(() => {
    if (route.kind === 'confirm-payment') return;

    let cancelled = false;

    (async () => {
      try {
        const initial = await fetchPublicInvoice(route.token);
        if (cancelled) return;
        setPayload(initial);
      } catch (err) {
        if (!cancelled) {
          setError(formatUnknownError(err, 'Invoice not found.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route]);

  if (route.kind === 'confirm-payment') {
    return <ConfirmPaymentPage token={route.token} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-muted-foreground">
        Loading invoice…
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md rounded border border-border bg-white p-8 text-[13px] text-destructive shadow-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-muted-foreground">
        Invoice not found.
      </div>
    );
  }

  return (
    <PublicInvoicePage
      payload={payload}
      token={route.token}
      paymentJustMarked={false}
      promptPaymentSent={route.kind === 'payment-sent'}
      loadError={error}
    />
  );
}

export function getPublicRoute(): PublicRoute | null {
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);
  const paymentSentQuery =
    params.get('payment') === 'sent' || params.get('action') === 'payment-sent';

  // Legacy nested path (still accepted for older emails)
  const paymentSentMatch = pathname.match(/^\/i\/([0-9a-f-]{36})\/payment-sent\/?$/i);
  if (paymentSentMatch) {
    return { kind: 'payment-sent', token: paymentSentMatch[1] };
  }

  const invoiceMatch = pathname.match(/^\/i\/([0-9a-f-]{36})\/?$/i);
  if (invoiceMatch) {
    return {
      kind: paymentSentQuery ? 'payment-sent' : 'invoice',
      token: invoiceMatch[1],
    };
  }

  const confirmMatch = pathname.match(/^\/confirm-payment\/([0-9a-f-]{36})\/?$/i);
  if (confirmMatch) {
    return { kind: 'confirm-payment', token: confirmMatch[1] };
  }

  return null;
}
