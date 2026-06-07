import { calculateTotal, formatCurrency, formatDateLong } from '@/lib/calculations';
import type { Client, Invoice, Settings } from '@/types';

interface InvoicePrintDocumentProps {
  invoice: Invoice;
  client: Client | null;
  settings: Settings;
}

export function InvoicePrintDocument({
  invoice,
  client,
  settings,
}: InvoicePrintDocumentProps) {
  const totals = calculateTotal(invoice.lineItems, invoice.taxEnabled, invoice.taxRate);

  return (
    <article className="invoice-print text-[13px]">
      <header className="invoice-print-header">
        <div>
          {settings.logo && (
            <img src={settings.logo} alt="" className="invoice-print-logo" />
          )}
          <div className="invoice-print-strong">{settings.businessName}</div>
          <div className="invoice-print-muted">{settings.email}</div>
          {settings.businessAddress && (
            <div className="invoice-print-muted whitespace-pre-line">{settings.businessAddress}</div>
          )}
        </div>
        <div className="invoice-print-right">
          <div className="invoice-print-label">Invoice</div>
          <div className="invoice-print-mono">{invoice.number}</div>
        </div>
      </header>

      <section className="invoice-print-section invoice-print-grid-2">
        <div>
          <div className="invoice-print-label invoice-print-label-spaced">Billed to</div>
          <div className="invoice-print-strong">
            {client?.owner || client?.companyName || invoice.clientName}
          </div>
          {client?.companyName && client?.owner && (
            <div className="invoice-print-muted">{client.companyName}</div>
          )}
          {client?.primaryEmail && (
            <div className="invoice-print-muted">{client.primaryEmail}</div>
          )}
          {client?.address && <div className="invoice-print-muted">{client.address}</div>}
        </div>
        <div className="invoice-print-right invoice-print-dates">
          <div>
            <div className="invoice-print-label">Issued</div>
            <div>{formatDateLong(invoice.issueDate)}</div>
          </div>
          <div>
            <div className="invoice-print-label">Due</div>
            <div>{formatDateLong(invoice.dueDate)}</div>
          </div>
        </div>
      </section>

      <section className="invoice-print-section">
        <div className="invoice-print-lines-header">
          <div>Description</div>
          <div>Qty</div>
          <div>Rate</div>
          <div>Amount</div>
        </div>
        {invoice.lineItems.map((item) => (
          <div key={item.id} className="invoice-print-line-row">
            <div>{item.description}</div>
            <div className="invoice-print-num">{item.quantity}</div>
            <div className="invoice-print-num">{formatCurrency(item.rate)}</div>
            <div className="invoice-print-num">
              {formatCurrency(item.quantity * item.rate)}
            </div>
          </div>
        ))}
      </section>

      <section className="invoice-print-totals-wrap">
        <div className="invoice-print-totals">
          <div className="invoice-print-total-row">
            <span className="invoice-print-muted">Subtotal</span>
            <span className="invoice-print-num">{formatCurrency(totals.subtotal)}</span>
          </div>
          {invoice.taxEnabled && (
            <div className="invoice-print-total-row">
              <span className="invoice-print-muted">Tax ({invoice.taxRate}%)</span>
              <span className="invoice-print-num">{formatCurrency(totals.tax)}</span>
            </div>
          )}
          <div className="invoice-print-total-row invoice-print-total-grand">
            <span className="invoice-print-strong">Total due</span>
            <span className="invoice-print-strong invoice-print-num">
              {formatCurrency(totals.total)}
            </span>
          </div>
        </div>
      </section>

      {invoice.notes && (
        <section className="invoice-print-footer">
          <div className="invoice-print-label invoice-print-label-spaced">Notes</div>
          <p className="invoice-print-body">{invoice.notes}</p>
        </section>
      )}

      {settings.paymentDetails && (
        <section className="invoice-print-footer invoice-print-footer-gap">
          <div className="invoice-print-label invoice-print-label-spaced">Payment</div>
          <p className="invoice-print-body invoice-print-muted">{settings.paymentDetails}</p>
        </section>
      )}
    </article>
  );
}
