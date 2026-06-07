-- Rename invoice status "sent" to "unpaid"
-- Drop the old constraint first so "unpaid" is allowed during the update.

alter table public.invoices
  drop constraint if exists invoices_status_check;

update public.invoices
set status = 'unpaid'
where status = 'sent';

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'unpaid', 'paid', 'overdue'));
