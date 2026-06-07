-- Run in Supabase SQL Editor to track billed calendar entries on invoices.

alter table public.calendar_entries
add column if not exists invoice_id uuid references public.invoices (id) on delete set null;

create index if not exists calendar_entries_invoice_id_idx on public.calendar_entries (invoice_id);
