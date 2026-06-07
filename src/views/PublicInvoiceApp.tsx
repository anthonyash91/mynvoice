import { useEffect, useState } from 'react';
import { InvoicePrintDocument } from '@/components/InvoicePrintDocument';
import { StatusLabel } from '@/components/StatusLabel';
import { migrateEmailTemplates } from '@/lib/emailTemplates';
import {
  confirmPublicPayment,
  fetchPublicInvoice,
  markPublicPaymentSent,
  mergePublicInvoicePayload,
  publicClientToClient,
  publicInvoiceToInvoice,
  type PublicInvoicePayload,
} from '@/lib/publicInvoice';
import { resolveStatus } from '@/lib/invoice';
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
    ...payload.settings,
    emailTemplates: migrateEmailTemplates(),
  };
}

function PublicInvoicePage({
  payload,
  token,
  paymentJustMarked,
}: {
  payload: PublicInvoicePayload;
  token: string;
  paymentJustMarked: boolean;
}) {
  const [data, setData] = useState(payload);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [marked, setMarked] = useState(
    paymentJustMarked || payload.invoice.status === 'payment_sent'
  );

  const invoice = publicInvoiceToInvoice(data.invoice);
  const client = publicClientToClient(data.client, data.invoice);
  const settings = toSettings(data);
  const status = resolveStatus(invoice);
  const canMarkPaymentSent = status !== 'paid' && status !== 'payment_sent';

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

        {canMarkPaymentSent && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleMarkPaymentSent}
              disabled={marking}
              className="h-9 rounded bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {marking ? 'Updating…' : 'Payment has been sent'}
            </button>
          </div>
        )}

        <div className="rounded border border-border bg-white p-6 shadow-sm">
          <InvoicePrintDocument invoice={invoice} client={client} settings={settings} />
        </div>
      </div>
    </div>
  );
}

function ConfirmPaymentPage({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    invoiceNumber: string;
    clientName: string;
    alreadyPaid: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await confirmPublicPayment(token);
        if (cancelled) return;
        setResult(response);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to confirm payment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded border border-border bg-white p-8 shadow-sm">
        {loading && <p className="text-[13px] text-muted-foreground">Confirming payment…</p>}
        {error && <p className="text-[13px] text-destructive">{error}</p>}
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

        if (route.kind === 'payment-sent' && initial.invoice.status !== 'paid') {
          try {
            const updated = await markPublicPaymentSent(route.token);
            if (!cancelled) setPayload(mergePublicInvoicePayload(initial, updated));
            return;
          } catch (markErr) {
            if (!cancelled) {
              setPayload(initial);
              setError(
                markErr instanceof Error
                  ? markErr.message
                  : 'Failed to record payment. You can try again below.'
              );
            }
            return;
          }
        }

        setPayload(initial);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Invoice not found.');
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
      paymentJustMarked={route.kind === 'payment-sent'}
    />
  );
}

export function getPublicRoute(): PublicRoute | null {
  const { pathname } = window.location;

  const paymentSentMatch = pathname.match(/^\/i\/([0-9a-f-]{36})\/payment-sent\/?$/i);
  if (paymentSentMatch) {
    return { kind: 'payment-sent', token: paymentSentMatch[1] };
  }

  const invoiceMatch = pathname.match(/^\/i\/([0-9a-f-]{36})\/?$/i);
  if (invoiceMatch) {
    return { kind: 'invoice', token: invoiceMatch[1] };
  }

  const confirmMatch = pathname.match(/^\/confirm-payment\/([0-9a-f-]{36})\/?$/i);
  if (confirmMatch) {
    return { kind: 'confirm-payment', token: confirmMatch[1] };
  }

  return null;
}
