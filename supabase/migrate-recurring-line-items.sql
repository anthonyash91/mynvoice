-- Run in Supabase SQL Editor to add recurring line items for clients.

alter table public.clients
  add column if not exists recurring_line_items jsonb not null default '[]'::jsonb;

alter table public.calendar_entries
  add column if not exists recurring_line_item_id uuid;
