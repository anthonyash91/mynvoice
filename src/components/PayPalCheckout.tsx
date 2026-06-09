import { useEffect, useRef, useState } from 'react';
import { capturePayPalPayment, createPayPalOrder } from '@/lib/publicInvoice';

interface PayPalWindow {
  Buttons: (config: {
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError?: (error: unknown) => void;
  }) => { render: (container: HTMLElement) => Promise<void> };
}

declare global {
  interface Window {
    paypal?: PayPalWindow;
  }
}

let paypalScriptPromise: Promise<void> | null = null;

function loadPayPalScript(clientId: string): Promise<void> {
  if (window.paypal) return Promise.resolve();

  if (!paypalScriptPromise) {
    paypalScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PayPal.'));
      document.body.appendChild(script);
    });
  }

  return paypalScriptPromise;
}

interface PayPalCheckoutProps {
  token: string;
  clientId: string;
  disabled?: boolean;
  onPaid: () => void;
  onError: (message: string) => void;
}

export function PayPalCheckout({
  token,
  clientId,
  disabled = false,
  onPaid,
  onError,
}: PayPalCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadPayPalScript(clientId);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Failed to load PayPal.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, onError]);

  useEffect(() => {
    if (!ready || disabled || !containerRef.current || !window.paypal) return;

    const container = containerRef.current;
    container.innerHTML = '';

    window.paypal
      .Buttons({
        createOrder: async () => {
          const response = await createPayPalOrder(token);
          return response.orderId;
        },
        onApprove: async (data) => {
          await capturePayPalPayment(token, data.orderID);
          onPaid();
        },
        onError: (error) => {
          onError(error instanceof Error ? error.message : 'PayPal checkout failed.');
        },
      })
      .render(container);

    return () => {
      container.innerHTML = '';
    };
  }, [ready, disabled, token, onPaid, onError]);

  if (loading) {
    return <p className="text-[13px] text-muted-foreground">Loading PayPal…</p>;
  }

  return <div ref={containerRef} className="max-w-[320px]" />;
}
