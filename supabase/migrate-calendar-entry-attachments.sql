-- Run in Supabase SQL Editor to attach receipts to calendar entries.
-- Requires migrate-line-item-attachments.sql (the invoice-attachments Storage bucket).
-- Receipts on an entry are copied onto the invoice line item when the entry is billed.

alter table public.calendar_entries
  add column if not exists attachments jsonb not null default '[]'::jsonb;
