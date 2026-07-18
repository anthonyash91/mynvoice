export function appOrigin(): string {
  // Prefer the live browser origin so local email links match the actual Vite port
  // (VITE_APP_URL may point at :5173 while another app already owns that port).
  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || import.meta.env.DEV) {
      return window.location.origin.replace(/\/$/, '');
    }
  }

  const configured = import.meta.env.VITE_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }

  return '';
}

export function publicInvoiceUrl(publicToken: string): string {
  return `${appOrigin()}/i/${publicToken}`;
}

/** Query form avoids nested SPA paths that 404 on some hosts when `/i/:token` works. */
export function publicPaymentSentUrl(publicToken: string): string {
  return `${appOrigin()}/i/${publicToken}?payment=sent`;
}

export function ownerConfirmPaymentUrl(ownerConfirmToken: string): string {
  return `${appOrigin()}/confirm-payment/${ownerConfirmToken}`;
}
