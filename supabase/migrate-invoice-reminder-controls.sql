-- Per-invoice reminder controls + per-client interval override
-- Run in Supabase SQL Editor

alter table public.invoices
add column if not exists reminders_paused boolean not null default false;

alter table public.invoices
add column if not exists reminder_snooze_until date;

alter table public.invoices
add column if not exists reminder_interval_days_override integer;

alter table public.invoices
add column if not exists late_reminder_interval_days_override integer;

alter table public.clients
add column if not exists reminder_interval_days integer;

alter table public.clients
add column if not exists late_reminder_interval_days integer;
