-- Run in Supabase SQL Editor to add default invoice due date setting.

alter table public.user_settings
  add column if not exists default_due_days integer not null default 14;
