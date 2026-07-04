-- Historical invoice imports (record-only; no emails or public payment links)
-- PREREQUISITE: public.invoices must exist.

alter table public.invoices
add column if not exists is_historical boolean not null default false;

create index if not exists invoices_is_historical_idx
  on public.invoices (user_id, is_historical)
  where is_historical = true;
