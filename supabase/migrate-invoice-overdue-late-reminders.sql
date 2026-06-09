-- Automatic overdue status + late email reminder interval
-- Run in Supabase SQL Editor

alter table public.user_settings
add column if not exists late_reminder_interval_days integer not null default 3;

-- Persist overdue for unpaid invoices past their due date
update public.invoices
set status = 'overdue'
where status = 'unpaid'
  and due_date is not null
  and due_date < current_date;
