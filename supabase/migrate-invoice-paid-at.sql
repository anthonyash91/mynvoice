-- Track when an invoice was marked paid (for {{paymentDate}} in email templates).

alter table public.invoices
  add column if not exists paid_at date;
