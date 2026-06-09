export function paypalApiBase(sandbox: boolean): string {
  return sandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

export function formatPayPalAmount(total: number): string {
  return total.toFixed(2);
}

export async function getPayPalAccessToken(input: {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
}): Promise<string> {
  const credentials = btoa(`${input.clientId}:${input.clientSecret}`);
  const response = await fetch(`${paypalApiBase(input.sandbox)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(data.error_description || 'Failed to authenticate with PayPal.');
  }

  if (!data.access_token) {
    throw new Error('PayPal did not return an access token.');
  }

  return data.access_token;
}

export async function createPayPalOrder(input: {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
}): Promise<string> {
  const accessToken = await getPayPalAccessToken(input);
  const response = await fetch(`${paypalApiBase(input.sandbox)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.invoiceId,
          description: `Invoice ${input.invoiceNumber}`,
          amount: {
            currency_code: 'USD',
            value: formatPayPalAmount(input.amount),
          },
        },
      ],
    }),
  });

  const data = (await response.json()) as { id?: string; message?: string };
  if (!response.ok) {
    throw new Error(data.message || 'Failed to create PayPal order.');
  }

  if (!data.id) {
    throw new Error('PayPal did not return an order id.');
  }

  return data.id;
}

type PayPalCaptureAmount = {
  value?: string;
  currency_code?: string;
};

type PayPalCapturePurchaseUnit = {
  reference_id?: string;
  payments?: {
    captures?: Array<{
      status?: string;
      amount?: PayPalCaptureAmount;
    }>;
  };
};

export async function capturePayPalOrder(input: {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  orderId: string;
}): Promise<{
  status: string;
  amount: number;
  referenceId: string | null;
}> {
  const accessToken = await getPayPalAccessToken(input);
  const response = await fetch(
    `${paypalApiBase(input.sandbox)}/v2/checkout/orders/${input.orderId}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = (await response.json()) as {
    status?: string;
    purchase_units?: PayPalCapturePurchaseUnit[];
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message || 'Failed to capture PayPal payment.');
  }

  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];
  const amount = Number(capture?.amount?.value ?? 0);

  return {
    status: capture?.status ?? data.status ?? 'UNKNOWN',
    amount,
    referenceId: purchaseUnit?.reference_id ?? null,
  };
}
