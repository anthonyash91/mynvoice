-- Run in Supabase SQL Editor to add calendar work log entries.

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  entry_date date not null,
  description text not null default '',
  quantity numeric not null default 1,
  rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists calendar_entries_user_id_idx on public.calendar_entries (user_id);
create index if not exists calendar_entries_client_id_idx on public.calendar_entries (client_id);
create index if not exists calendar_entries_entry_date_idx on public.calendar_entries (entry_date);

alter table public.calendar_entries enable row level security;

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

grant select, insert, update, delete on public.calendar_entries to authenticated;
grant select on public.calendar_entries to anon;
