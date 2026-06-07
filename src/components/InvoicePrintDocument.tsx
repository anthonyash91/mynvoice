import { StatusLabel } from '@/components/StatusLabel';
import { clientDisplayName, clientSecondaryName } from '@/lib/client';
import { resolveStatus } from '@/lib/invoice';
import {
  buildRateBreakdown,
  calculateTotal,
  formatCurrency,
  formatDateLong,
} from '@/lib/calculations';
import { formatDurationQuantity, formatInvoiceQuantity } from '@/lib/duration';
import { splitStreetAndCityLines } from '@/lib/address';
import { LINE_ITEM_KIND_LABEL, lineItemKindFromLineItem } from '@/lib/lineItem';
import type { Client, Invoice, LineItem, Settings } from '@/types';

function formatLineItemQtyRate(item: LineItem): string {
  if (lineItemKindFromLineItem(item) === 'recurring' && item.entryType === 'fixed') {
    return LINE_ITEM_KIND_LABEL.recurring;
  }
  if (item.entryType === 'fixed') {
    return '—';
  }
  return `${formatInvoiceQuantity(item.quantity)} × ${formatCurrency(item.rate)}/hr`;
}

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
  const rateBreakdown = buildRateBreakdown(invoice.lineItems);
  const status = resolveStatus(invoice);
  const [addressLineOne, addressLineTwo] = splitStreetAndCityLines(settings.businessAddress);

  return (
    <article className="invoice-print text-[13px]">
      <header className="invoice-print-header invoice-print-pdf-avoid-break">
        <div className="invoice-print-header-main">
          <div className="invoice-print-header-column">
            <div className="invoice-print-header-line invoice-print-strong">
              {settings.businessName}
            </div>
            <div className="invoice-print-header-line invoice-print-muted">{settings.email}</div>
            <div className="invoice-print-header-line invoice-print-muted">{addressLineOne}</div>
            <div className="invoice-print-header-line invoice-print-muted whitespace-pre-line">
              {addressLineTwo}
            </div>
          </div>
          <div className="invoice-print-header-column invoice-print-header-column-right">
            <div className="invoice-print-header-line invoice-print-strong invoice-print-header-amount">
              {formatCurrency(totals.total)}
            </div>
            <div className="invoice-print-header-line">
              <StatusLabel status={status} />
            </div>
            <div className="invoice-print-header-line invoice-print-label">Invoice</div>
            <div className="invoice-print-header-line invoice-print-mono">{invoice.number}</div>
          </div>
        </div>
      </header>

      <section className="invoice-print-section invoice-print-grid-2 invoice-print-pdf-avoid-break">
        <div>
          <div className="invoice-print-label invoice-print-label-spaced">Billed to</div>
          <div className="invoice-print-strong">
            {client ? clientDisplayName(client) : invoice.clientName}
          </div>
          {client && clientSecondaryName(client) && (
            <div className="invoice-print-muted">{clientSecondaryName(client)}</div>
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
          {invoice.dueDate && (
            <div>
              <div className="invoice-print-label">Due</div>
              <div>{formatDateLong(invoice.dueDate)}</div>
            </div>
          )}
        </div>
      </section>

      <section className="invoice-print-section invoice-print-lines-section">
        <div className="invoice-print-lines-header">
          <div>Description</div>
          <div aria-hidden="true" />
          <div>Qty/Rate</div>
          <div>Amount</div>
        </div>
        {invoice.lineItems.map((item) => (
          <div key={item.id} className="invoice-print-line-row invoice-print-pdf-avoid-break">
            <div className="invoice-print-description">{item.description}</div>
            <div aria-hidden="true" />
            <div className="invoice-print-num invoice-print-qty-rate">
              {formatLineItemQtyRate(item)}
            </div>
            <div className="invoice-print-num invoice-print-amount">
              {formatCurrency(item.quantity * item.rate)}
            </div>
          </div>
        ))}
      </section>

      {rateBreakdown.length > 0 && (
        <section className="invoice-print-rate-breakdown-wrap invoice-print-pdf-avoid-break">
          <div className="invoice-print-rate-breakdown">
            <div className="invoice-print-rate-breakdown-header">
              <div>Rate</div>
              <div>Hours</div>
              <div>Total</div>
            </div>
            {rateBreakdown.map((row) => (
              <div
                key={`${row.isRecurring ? 'recurring-' : ''}${row.entryType}-${row.rate}`}
                className="invoice-print-rate-breakdown-row"
              >
                <div className="invoice-print-num">
                  {row.entryType === 'fixed'
                    ? formatCurrency(row.rate)
                    : `${formatCurrency(row.rate)}/hr`}
                </div>
                <div className="invoice-print-num">
                  {row.hours === null
                    ? row.isRecurring
                      ? LINE_ITEM_KIND_LABEL.recurring
                      : '—'
                    : formatDurationQuantity(row.hours)}
                </div>
                <div className="invoice-print-num">{formatCurrency(row.total)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="invoice-print-totals-wrap invoice-print-pdf-avoid-break">
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
        <section className="invoice-print-footer invoice-print-pdf-avoid-break">
          <div className="invoice-print-label invoice-print-label-spaced">Notes</div>
          <p className="invoice-print-body">{invoice.notes}</p>
        </section>
      )}

      {(settings.paymentDetails || settings.logo) && (
        <section
          className={`invoice-print-footer invoice-print-pdf-avoid-break${
            settings.paymentDetails ? ' invoice-print-footer-gap' : ''
          }`}
        >
          <div
            className={`invoice-print-footer-content${
              settings.logo ? ' invoice-print-footer-content-with-logo' : ''
            }${
              settings.logo && !settings.paymentDetails
                ? ' invoice-print-footer-content-logo-only'
                : ''
            }`}
          >
            {settings.paymentDetails && (
              <>
                <div className="invoice-print-label invoice-print-label-spaced">Payment</div>
                <p className="invoice-print-body invoice-print-muted">{settings.paymentDetails}</p>
              </>
            )}
            {settings.logo && (
              <div className="invoice-print-footer-logo-wrap" aria-hidden="true">
                <img
                  src={settings.logo}
                  alt=""
                  className="invoice-print-logo invoice-print-footer-logo"
                />
              </div>
            )}
          </div>
        </section>
      )}
    </article>
  );
}
