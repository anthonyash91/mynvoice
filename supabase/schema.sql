-- MyNvoice Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)

-- Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  company text not null default '',
  email text not null default '',
  hourly_rate numeric not null default 0,
  additional_emails jsonb not null default '[]'::jsonb,
  additional_rates jsonb not null default '[]'::jsonb,
  recurring_line_items jsonb not null default '[]'::jsonb,
  recurring_calendar_exclusions jsonb not null default '[]'::jsonb,
  address text not null default '',
  reminder_interval_days integer,
  late_reminder_interval_days integer,
  created_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on public.clients (user_id);

-- Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null,
  number text not null,
  issue_date date not null,
  due_date date,
  line_items jsonb not null default '[]'::jsonb,
  notes text not null default '',
  tax_enabled boolean not null default false,
  tax_rate numeric not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'unpaid', 'paid', 'overdue', 'payment_sent')),
  public_token uuid unique,
  owner_confirm_token uuid unique,
  paid_at date,
  email_send_count integer not null default 0,
  last_email_sent_at timestamptz,
  last_email_sent_kind text
    check (last_email_sent_kind is null or last_email_sent_kind in ('unpaid', 'reminder', 'late', 'payment_received')),
  reminders_paused boolean not null default false,
  reminder_snooze_until date,
  reminder_interval_days_override integer,
  late_reminder_interval_days_override integer,
  created_at date not null default current_date,
  unique (user_id, client_id, number)
);

create index if not exists invoices_user_id_idx on public.invoices (user_id);
create index if not exists invoices_client_id_idx on public.invoices (client_id);
create index if not exists invoices_public_token_idx on public.invoices (public_token);
create index if not exists invoices_owner_confirm_token_idx on public.invoices (owner_confirm_token);

-- Email send history
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

-- Calendar work log entries (billable line items per client per day)
create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  entry_date date not null,
  description text not null default '',
  quantity numeric not null default 1,
  rate numeric not null default 0,
  entry_type text not null default 'hourly'
    check (entry_type in ('hourly', 'fixed')),
  invoice_id uuid references public.invoices (id) on delete set null,
  recurring_line_item_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists calendar_entries_user_id_idx on public.calendar_entries (user_id);
create index if not exists calendar_entries_invoice_id_idx on public.calendar_entries (invoice_id);
create index if not exists calendar_entries_client_id_idx on public.calendar_entries (client_id);
create index if not exists calendar_entries_entry_date_idx on public.calendar_entries (entry_date);

-- Per-user settings + invoice counter
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default '',
  email text not null default '',
  business_address text not null default '',
  mailing_address text not null default '',
  payment_details text not null default '',
  default_tax_rate numeric not null default 0,
  default_due_days integer not null default 14,
  reminder_interval_days integer not null default 5,
  late_reminder_interval_days integer not null default 3,
  paypal_client_id text not null default '',
  paypal_client_secret text not null default '',
  paypal_sandbox boolean not null default true,
  logo text,
  email_templates jsonb not null default '{}'::jsonb,
  next_invoice_number integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Auto-create settings row on signup
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user ();

-- Row Level Security
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.calendar_entries enable row level security;
alter table public.user_settings enable row level security;
alter table public.invoice_email_history enable row level security;

-- Clients policies
create policy "Users can view own clients"
on public.clients for select
using (auth.uid () = user_id);

create policy "Users can insert own clients"
on public.clients for insert
with check (auth.uid () = user_id);

create policy "Users can update own clients"
on public.clients for update
using (auth.uid () = user_id)
with check (auth.uid () = user_id);

create policy "Users can delete own clients"
on public.clients for delete
using (auth.uid () = user_id);

-- Invoices policies
create policy "Users can view own invoices"
on public.invoices for select
using (auth.uid () = user_id);

create policy "Users can insert own invoices"
on public.invoices for insert
with check (auth.uid () = user_id);

create policy "Users can update own invoices"
on public.invoices for update
using (auth.uid () = user_id)
with check (auth.uid () = user_id);

create policy "Users can delete own invoices"
on public.invoices for delete
using (auth.uid () = user_id);

-- Calendar policies
create policy "Users can view own calendar entries"
on public.calendar_entries for select
using (auth.uid () = user_id);

create policy "Users can insert own calendar entries"
on public.calendar_entries for insert
with check (auth.uid () = user_id);

create policy "Users can update own calendar entries"
on public.calendar_entries for update
using (auth.uid () = user_id)
with check (auth.uid () = user_id);

create policy "Users can delete own calendar entries"
on public.calendar_entries for delete
using (auth.uid () = user_id);

-- Email history policies
create policy "Users can view own email history"
on public.invoice_email_history for select
using (auth.uid () = user_id);

create policy "Users can insert own email history"
on public.invoice_email_history for insert
with check (auth.uid () = user_id);

-- Settings policies
create policy "Users can view own settings"
on public.user_settings for select
using (auth.uid () = user_id);

create policy "Users can insert own settings"
on public.user_settings for insert
with check (auth.uid () = user_id);

create policy "Users can update own settings"
on public.user_settings for update
using (auth.uid () = user_id)
with check (auth.uid () = user_id);

-- Table access for API roles
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.calendar_entries to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert on public.invoice_email_history to authenticated;

grant select on public.clients to anon;
grant select on public.invoices to anon;
grant select on public.calendar_entries to anon;
grant select on public.user_settings to anon;
