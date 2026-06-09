-- Track which email template was sent last (for invoice Sent column tooltip)
-- Run in Supabase SQL Editor

alter table public.invoices
add column if not exists last_email_sent_kind text
  check (last_email_sent_kind is null or last_email_sent_kind in ('unpaid', 'reminder', 'late', 'payment_received'));
