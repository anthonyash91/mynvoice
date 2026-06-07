-- Run in Supabase SQL Editor to store editable invoice email templates.

alter table public.user_settings
  add column if not exists email_templates jsonb not null default '{}'::jsonb;
