import type { EmailTemplateKind } from '@/types';

type EmailThemeCopy = {
  badge: string;
  headline: string;
  intro: string;
  footerNote: string;
  detailsMeta?: string;
  showPaymentActions?: boolean;
};

const COPY: Record<EmailTemplateKind, EmailThemeCopy> = {
  unpaid: {
    badge: 'Invoice',
    headline: 'Your invoice is attached',
    intro:
      'Hi {{clientName}}, please find invoice <strong class="email-invoice-number">{{invoiceNumber}}</strong> attached to this email.',
    footerNote: 'Reply to this email if you have any questions.',
    showPaymentActions: true,
  },
  reminder: {
    badge: 'Payment reminder',
    headline: 'Friendly payment reminder',
    intro:
      'Hi {{clientName}}, invoice <strong class="email-invoice-number">{{invoiceNumber}}</strong> is still outstanding.',
    footerNote: 'If you have already sent payment, thank you — you can ignore this reminder.',
    showPaymentActions: true,
  },
  late: {
    badge: 'Overdue',
    headline: 'Payment is past due',
    intro:
      'Hi {{clientName}}, invoice <strong class="email-invoice-number">{{invoiceNumber}}</strong> is now overdue. Please send payment immediately.',
    footerNote: 'The invoice PDF is attached for your reference.',
    showPaymentActions: true,
  },
  payment_received: {
    badge: 'Payment received',
    headline: 'Thank you — your payment was received',
    intro:
      'Hi {{clientName}}, we have received your payment for invoice <strong class="email-invoice-number">{{invoiceNumber}}</strong> on {{paymentDate}}.',
    footerNote: 'Thank you for your business.',
    detailsMeta: 'Payment received {{paymentDate}}',
  },
};

function paymentActionsHtml(): string {
  return `<div class="email-actions">
  <a href="{{paymentSentLink}}" class="email-cta">Payment has been sent</a>
  <a href="{{invoiceLink}}" class="email-cta-secondary">View invoice online</a>
</div>`;
}

function buildEmailHtml(kind: EmailTemplateKind): string {
  const copy = COPY[kind];
  const actions = copy.showPaymentActions ? `\n      ${paymentActionsHtml()}\n` : '';
  const detailsMeta = copy.detailsMeta ?? 'Issued {{issueDate}} · {{dueDateLine}}';

  return `<div class="email-outer">
  <div class="email-shell">
    <div class="email-card">
      <div class="email-header">
        <span class="email-badge">${copy.badge}</span>
        <div class="email-headline">${copy.headline}</div>
        <p class="email-intro">${copy.intro}</p>
      </div>
      <div class="email-body">
        <div class="email-details">
          <div class="email-details-grid">
            <div class="email-label">Amount due</div>
            <div class="email-label email-label-right">Due date</div>
            <div class="email-amount">{{total}}</div>
            <div class="email-due">{{dueDate}}</div>
          </div>
          <div class="email-meta">${detailsMeta}</div>
        </div>${actions}
      </div>
      <div class="email-footer">
        <p class="email-footer-note">${copy.footerNote}</p>
        <p class="email-business">{{businessName}}</p>
      </div>
    </div>
  </div>
</div>`;
}

function buildEmailCss(kind: EmailTemplateKind): string {
  const themes: Record<
    EmailTemplateKind,
    {
      accent: string;
      badgeBg: string;
      detailBg: string;
      detailBorder: string;
    }
  > = {
    unpaid: {
      accent: '#0071E3',
      badgeBg: 'rgba(0,113,227,0.10)',
      detailBg: '#f5f5f7',
      detailBorder: '#e5e5e5',
    },
    reminder: {
      accent: '#FF9500',
      badgeBg: 'rgba(255,149,0,0.14)',
      detailBg: 'rgba(255,149,0,0.08)',
      detailBorder: 'rgba(255,149,0,0.22)',
    },
    late: {
      accent: '#FF3B30',
      badgeBg: 'rgba(255,59,48,0.10)',
      detailBg: 'rgba(255,59,48,0.06)',
      detailBorder: 'rgba(255,59,48,0.20)',
    },
    payment_received: {
      accent: '#34C759',
      badgeBg: 'rgba(52,199,89,0.12)',
      detailBg: 'rgba(52,199,89,0.08)',
      detailBorder: 'rgba(52,199,89,0.22)',
    },
  };

  const theme = themes[kind];

  return `body {
  margin: 0;
  padding: 0;
  background-color: #f5f5f7;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  color: #111111;
}

a {
  color: ${theme.accent};
  text-decoration: none;
}

.email-outer {
  width: 100%;
  background-color: #f5f5f7;
}

.email-shell {
  padding: 40px 16px;
  display: flex;
  justify-content: center;
}

.email-card {
  width: 100%;
  max-width: 520px;
  background-color: #ffffff;
  border: 1px solid #e5e5e5;
}

.email-header {
  padding: 28px 28px 20px;
  border-bottom: 1px solid #e5e5e5;
}

.email-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: ${theme.badgeBg};
  color: ${theme.accent};
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.email-headline {
  margin-top: 14px;
  font-size: 22px;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: #111111;
}

.email-intro {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.55;
  color: #6e6e73;
}

.email-invoice-number {
  color: #111111;
}

.email-body {
  padding: 20px 28px;
}

.email-details {
  background: ${theme.detailBg};
  border: 1px solid ${theme.detailBorder};
  padding: 18px 20px;
}

.email-details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}

.email-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6e6e73;
}

.email-label-right {
  text-align: right;
}

.email-amount {
  font-size: 24px;
  font-weight: 500;
  line-height: 1.2;
  color: ${theme.accent};
}

.email-due {
  text-align: right;
  font-size: 14px;
  line-height: 1.4;
  color: #111111;
}

.email-meta {
  margin-top: 14px;
  padding-top: 14px;
  font-size: 12px;
  line-height: 1.5;
  color: #6e6e73;
  border-top: 1px solid ${theme.detailBorder};
}

.email-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.email-cta {
  display: block;
  text-align: center;
  padding: 12px 16px;
  border-radius: 8px;
  background: ${theme.accent};
  color: #ffffff !important;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.email-cta-secondary {
  display: block;
  text-align: center;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
  color: #111111 !important;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
}

.email-footer {
  padding: 0 28px 28px;
}

.email-footer-note {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.55;
  color: #6e6e73;
}

.email-business {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: #111111;
  font-weight: 500;
}`;
}

export const DEFAULT_EMAIL_TEMPLATE_HTML: Record<EmailTemplateKind, string> = {
  unpaid: buildEmailHtml('unpaid'),
  reminder: buildEmailHtml('reminder'),
  late: buildEmailHtml('late'),
  payment_received: buildEmailHtml('payment_received'),
};

export const DEFAULT_EMAIL_TEMPLATE_CSS: Record<EmailTemplateKind, string> = {
  unpaid: buildEmailCss('unpaid'),
  reminder: buildEmailCss('reminder'),
  late: buildEmailCss('late'),
  payment_received: buildEmailCss('payment_received'),
};

export const DEFAULT_EMAIL_TEMPLATE_SUBJECTS: Record<EmailTemplateKind, string> = {
  unpaid: 'Invoice {{invoiceNumber}} from {{businessName}}',
  reminder: 'Reminder: Invoice {{invoiceNumber}} from {{businessName}}',
  late: 'Overdue: Invoice {{invoiceNumber}} — payment required',
  payment_received: 'Payment received for invoice {{invoiceNumber}}',
};
