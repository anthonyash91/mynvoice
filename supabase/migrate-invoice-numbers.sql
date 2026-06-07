-- Run in Supabase SQL Editor to allow per-client invoice numbers (e.g. each client starts at INV-001).

alter table public.invoices
  drop constraint if exists invoices_user_id_number_key;

alter table public.invoices
  add constraint invoices_user_id_client_id_number_key unique (user_id, client_id, number);
