-- Run in Supabase SQL Editor to allow invoices without a due date.

alter table public.invoices
  alter column due_date drop not null;
