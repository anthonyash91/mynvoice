-- Automated payment reminders + email send tracking
-- Run in Supabase SQL Editor

alter table public.user_settings
add column if not exists reminder_interval_days integer not null default 5;

alter table public.invoices
add column if not exists email_send_count integer not null default 0;

alter table public.invoices
add column if not exists last_email_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- Daily cron: invoke send-invoice-reminders edge function (09:00 UTC)
-- Supabase does not support schedule in config.toml — use pg_cron + pg_net.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- One-time: store secrets in Vault (replace placeholders, run before cron.schedule)
-- select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');

select cron.unschedule(jobid)
from cron.job
where jobname = 'send-invoice-reminders-daily';

select cron.schedule(
  'send-invoice-reminders-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/send-invoice-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
