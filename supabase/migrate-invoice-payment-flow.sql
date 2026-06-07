-- Public invoice links + payment_sent status for client/owner payment flow.
-- Run in Supabase SQL Editor.

alter table public.invoices
  add column if not exists public_token uuid unique;

alter table public.invoices
  add column if not exists owner_confirm_token uuid unique;

alter table public.invoices
  drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'unpaid', 'paid', 'overdue', 'payment_sent'));

create index if not exists invoices_public_token_idx on public.invoices (public_token);
create index if not exists invoices_owner_confirm_token_idx on public.invoices (owner_confirm_token);
