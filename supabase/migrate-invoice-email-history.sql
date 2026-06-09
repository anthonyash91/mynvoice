-- Email send history for the History panel
-- Run in Supabase SQL Editor

create table if not exists public.invoice_email_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete set null,
  invoice_number text not null,
  client_name text not null,
  email_kind text not null
    check (email_kind in ('unpaid', 'reminder', 'late', 'payment_received')),
  sent_at timestamptz not null default now()
);

create index if not exists invoice_email_history_user_id_idx
  on public.invoice_email_history (user_id);

create index if not exists invoice_email_history_sent_at_idx
  on public.invoice_email_history (user_id, sent_at desc);

alter table public.invoice_email_history enable row level security;

create policy "Users can view own email history"
on public.invoice_email_history for select
using (auth.uid () = user_id);

create policy "Users can insert own email history"
on public.invoice_email_history for insert
with check (auth.uid () = user_id);

grant select, insert on public.invoice_email_history to authenticated;

-- Backfill one row per invoice that already has a last send recorded
insert into public.invoice_email_history (
  user_id,
  invoice_id,
  invoice_number,
  client_name,
  email_kind,
  sent_at
)
select
  user_id,
  id,
  number,
  client_name,
  last_email_sent_kind,
  last_email_sent_at
from public.invoices
where last_email_sent_at is not null
  and last_email_sent_kind is not null
  and not exists (
    select 1
    from public.invoice_email_history h
    where h.invoice_id = invoices.id
      and h.sent_at = invoices.last_email_sent_at
      and h.email_kind = invoices.last_email_sent_kind
  );
