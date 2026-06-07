-- Run in Supabase SQL Editor to persist skipped recurring calendar entries per month.

alter table public.clients
  add column if not exists recurring_calendar_exclusions jsonb not null default '[]'::jsonb;
