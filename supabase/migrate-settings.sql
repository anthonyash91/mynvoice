-- Run in Supabase SQL Editor to add business and mailing address fields.

alter table public.user_settings
  add column if not exists business_address text not null default '',
  add column if not exists mailing_address text not null default '';
