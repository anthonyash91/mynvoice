-- Run in Supabase SQL Editor to support hourly and fixed calendar line items.

alter table public.calendar_entries
add column if not exists entry_type text not null default 'hourly'
check (entry_type in ('hourly', 'fixed'));
