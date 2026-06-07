-- Run in Supabase SQL Editor to add new client fields.
--
-- If your table still has name / company / email (legacy columns),
-- this only adds the new fields — no renames needed.
--
-- If you already renamed to owner / company_name / primary_email,
-- this still works — just adds the extra columns.

alter table public.clients
  add column if not exists hourly_rate numeric not null default 0,
  add column if not exists additional_emails jsonb not null default '[]'::jsonb,
  add column if not exists additional_rates jsonb not null default '[]'::jsonb,
  add column if not exists address text not null default '';
