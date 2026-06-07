export function appOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export function publicInvoiceUrl(publicToken: string): string {
  return `${appOrigin()}/i/${publicToken}`;
}

export function publicPaymentSentUrl(publicToken: string): string {
  return `${appOrigin()}/i/${publicToken}/payment-sent`;
}

export function ownerConfirmPaymentUrl(ownerConfirmToken: string): string {
  return `${appOrigin()}/confirm-payment/${ownerConfirmToken}`;
}
